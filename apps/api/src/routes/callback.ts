import { Hono } from 'hono'
import { getProvider } from '../providers/index'
import { metaProvider } from '../providers/meta'
import { encryptToken } from '../lib/encryption'
import { supabaseAdmin } from '../lib/supabase'
import { consumePendingState } from '../lib/oauth-state'

const callback = new Hono()

/**
 * GET /api/callback/:provider
 * Callback OAuth: intercambia código por tokens, guarda la cuenta en DB.
 */
callback.get('/:provider', async (c) => {
  const providerName = c.req.param('provider')
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')
  const appUrl = process.env.APP_URL || 'http://localhost:3000'

  if (error) {
    return c.redirect(`${appUrl}/connections?error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return c.json({ error: 'Faltan parámetros code o state' }, 400)
  }

  const pending = consumePendingState(state)
  if (!pending) {
    return c.json({ error: 'Estado OAuth inválido o expirado' }, 400)
  }

  const provider = getProvider(providerName)
  if (!provider) {
    return c.json({ error: `Proveedor "${providerName}" no soportado` }, 400)
  }

  try {
    const redirectUri = `${process.env.API_URL}/api/callback/${providerName}`
    const tokens = await provider.exchangeCode(code, redirectUri)
    const profile = await provider.getProfile(tokens.accessToken)

    const accessTokenEncrypted = encryptToken(tokens.accessToken)
    const refreshTokenEncrypted = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null

    let accountProvider = providerName
    if (providerName === 'meta') accountProvider = 'facebook'

    const { error: dbError } = await supabaseAdmin
      .from('social_accounts')
      .upsert(
        {
          organization_id: pending.orgId,
          provider: accountProvider,
          external_id: profile.externalId,
          display_name: profile.displayName,
          avatar_url: profile.avatarUrl,
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: refreshTokenEncrypted,
          expires_at: tokens.expiresAt?.toISOString(),
          scopes: tokens.scopes,
          status: 'active',
          metadata: profile.metadata || {},
          connected_by: pending.userId,
        },
        { onConflict: 'organization_id,provider,external_id' },
      )

    if (dbError) {
      console.error('Error guardando cuenta social:', dbError)
      return c.json({ error: 'Error guardando la conexión' }, 500)
    }

    // Para Meta: también descubrir Pages e Instagram accounts
    if (providerName === 'meta' || providerName === 'facebook') {
      try {
        await saveMetaSubAccounts(tokens.accessToken, pending.orgId, pending.userId)
      } catch (err) {
        console.error('Error guardando sub-cuentas Meta:', err)
      }
    }

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('slug')
      .eq('id', pending.orgId)
      .single()

    const orgSlug = org?.slug || ''
    return c.redirect(`${appUrl}/${orgSlug}/connections?success=true&provider=${providerName}`)
  } catch (err) {
    console.error(`Error en callback ${providerName}:`, err)
    return c.redirect(`${appUrl}/connections?error=token_exchange_failed`)
  }
})

async function saveMetaSubAccounts(userAccessToken: string, orgId: string, userId: string) {
  const pages = await metaProvider.getPages(userAccessToken)

  for (const page of pages) {
    const pageTokenEncrypted = encryptToken(page.access_token)
    await supabaseAdmin.from('social_accounts').upsert(
      {
        organization_id: orgId,
        provider: 'facebook',
        external_id: page.id,
        display_name: page.name,
        avatar_url: page.picture?.data?.url,
        access_token_encrypted: pageTokenEncrypted,
        status: 'active',
        metadata: { type: 'page', page_id: page.id },
        connected_by: userId,
      },
      { onConflict: 'organization_id,provider,external_id' },
    )

    if (page.instagram_business_account?.id) {
      const igAccount = await metaProvider.getInstagramAccount(
        page.access_token,
        page.instagram_business_account.id,
      )

      if (igAccount) {
        await supabaseAdmin.from('social_accounts').upsert(
          {
            organization_id: orgId,
            provider: 'instagram',
            external_id: igAccount.id,
            display_name: igAccount.username || igAccount.name,
            avatar_url: igAccount.profile_picture_url,
            access_token_encrypted: pageTokenEncrypted,
            status: 'active',
            metadata: {
              type: 'business',
              username: igAccount.username,
              followers: igAccount.followers_count,
              page_id: page.id,
            },
            connected_by: userId,
          },
          { onConflict: 'organization_id,provider,external_id' },
        )
      }
    }
  }
}

export { callback }
