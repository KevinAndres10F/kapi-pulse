import { Hono } from 'hono'
import { randomBytes } from 'node:crypto'
import { getProvider } from '../providers/index'
import { encryptToken } from '../lib/encryption'
import { supabaseAdmin } from '../lib/supabase'
import { metaProvider } from '../providers/meta'

const connect = new Hono()

// Mapa temporal de estados OAuth (en producción usar Redis)
const pendingStates = new Map<string, { orgId: string; userId: string; provider: string; createdAt: number }>()

// Limpiar estados expirados (>10 min)
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of pendingStates) {
    if (now - val.createdAt > 600_000) pendingStates.delete(key)
  }
}, 60_000)

/**
 * GET /api/connect/:provider
 * Inicia el flujo OAuth redirigiendo al proveedor
 */
connect.get('/:provider', async (c) => {
  const providerName = c.req.param('provider')
  const orgId = c.req.query('org_id')
  const userId = c.req.query('user_id')

  if (!orgId || !userId) {
    return c.json({ error: 'Faltan parámetros org_id y user_id' }, 400)
  }

  const provider = getProvider(providerName)
  if (!provider) {
    return c.json({ error: `Proveedor "${providerName}" no soportado` }, 400)
  }

  const state = randomBytes(32).toString('hex')
  pendingStates.set(state, { orgId, userId, provider: providerName, createdAt: Date.now() })

  const redirectUri = `${process.env.API_URL}/api/callback/${providerName}`
  const authUrl = provider.getAuthUrl(state, redirectUri)

  return c.redirect(authUrl)
})

/**
 * GET /api/callback/:provider
 * Callback OAuth: intercambia código por tokens, guarda cuenta
 */
connect.get('/callback/:provider', async (c) => {
  const providerName = c.req.param('provider')
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')

  if (error) {
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    return c.redirect(`${appUrl}/connections?error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return c.json({ error: 'Faltan parámetros code o state' }, 400)
  }

  const pending = pendingStates.get(state)
  if (!pending) {
    return c.json({ error: 'Estado OAuth inválido o expirado' }, 400)
  }
  pendingStates.delete(state)

  const provider = getProvider(providerName)
  if (!provider) {
    return c.json({ error: `Proveedor "${providerName}" no soportado` }, 400)
  }

  try {
    const redirectUri = `${process.env.API_URL}/api/callback/${providerName}`
    const tokens = await provider.exchangeCode(code, redirectUri)
    const profile = await provider.getProfile(tokens.accessToken)

    // Encriptar tokens antes de guardar
    const accessTokenEncrypted = encryptToken(tokens.accessToken)
    const refreshTokenEncrypted = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null

    // Determinar el tipo de cuenta para Meta (puede ser Facebook, Instagram, etc.)
    let accountProvider = providerName
    if (providerName === 'meta') accountProvider = 'facebook'

    // Upsert la cuenta social
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

    // Para Meta: también guardar las Pages e Instagram accounts
    if (providerName === 'meta' || providerName === 'facebook') {
      try {
        await saveMetaSubAccounts(tokens.accessToken, pending.orgId, pending.userId)
      } catch (err) {
        console.error('Error guardando sub-cuentas Meta:', err)
        // No fallar la conexión principal
      }
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    // Redirigir usando orgSlug
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('slug')
      .eq('id', pending.orgId)
      .single()

    const orgSlug = org?.slug || ''
    return c.redirect(`${appUrl}/${orgSlug}/connections?success=true&provider=${providerName}`)
  } catch (err) {
    console.error(`Error en callback ${providerName}:`, err)
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    return c.redirect(`${appUrl}/connections?error=token_exchange_failed`)
  }
})

/**
 * Guarda Pages de Facebook e Instagram Business accounts como cuentas separadas
 */
async function saveMetaSubAccounts(userAccessToken: string, orgId: string, userId: string) {
  const pages = await metaProvider.getPages(userAccessToken)

  for (const page of pages) {
    // Guardar Facebook Page
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

    // Si tiene Instagram Business Account vinculada, guardarla
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
            access_token_encrypted: pageTokenEncrypted, // Usa el token de la Page
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

export { connect }
