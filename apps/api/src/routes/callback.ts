import { Hono } from 'hono'
import { getProvider } from '../providers/index'
import { metaProvider } from '../providers/meta'
import { encryptToken } from '../lib/encryption'
import { supabaseAdmin } from '../lib/supabase'
import { consumePendingState } from '../lib/oauth-state'
import { dbg } from '../lib/oauth-debug'

const callback = new Hono()

/**
 * Resolver el slug de la org para construir redirects con la ruta correcta.
 * Si no se puede resolver, devolvemos string vacío y el redirect cae en
 * `/connections` (la home de la app capturará la query string).
 */
async function resolveOrgSlug(orgId?: string): Promise<string> {
  if (!orgId) return ''
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('slug')
    .eq('id', orgId)
    .maybeSingle()
  return (data?.slug as string | undefined) || ''
}

function redirectToConnections(appUrl: string, orgSlug: string, qs: URLSearchParams): string {
  const base = orgSlug ? `${appUrl}/${orgSlug}/connections` : `${appUrl}/connections`
  return `${base}?${qs.toString()}`
}

/**
 * GET /api/callback/:provider
 * Callback OAuth: intercambia código por tokens, guarda la cuenta en DB.
 */
callback.get('/:provider', async (c) => {
  const providerName = c.req.param('provider')
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')
  const errorReason = c.req.query('error_reason')
  const errorDescription = c.req.query('error_description')
  const appUrl = process.env.APP_URL || 'http://localhost:3000'

  // Si el usuario rechazó permisos o Meta devolvió error en el flow inicial,
  // intentamos extraer el orgSlug del state ANTES de consumirlo para devolver
  // al usuario a la página correcta.
  if (error) {
    console.warn(`[oauth] ${providerName} error:`, { error, errorReason, errorDescription })
    let orgSlug = ''
    if (state) {
      const pending = consumePendingState(state)
      orgSlug = await resolveOrgSlug(pending?.orgId)
    }
    const qs = new URLSearchParams({
      error,
      ...(errorReason ? { error_reason: errorReason } : {}),
      ...(errorDescription ? { error_description: errorDescription } : {}),
      provider: providerName,
    })
    return c.redirect(redirectToConnections(appUrl, orgSlug, qs))
  }

  if (!code || !state) {
    return c.json({ error: 'Faltan parámetros code o state' }, 400)
  }

  const pending = consumePendingState(state)
  if (!pending) {
    // No tenemos forma de saber el orgSlug — redirigimos a la home.
    const qs = new URLSearchParams({ error: 'state_expired', provider: providerName })
    return c.redirect(redirectToConnections(appUrl, '', qs))
  }

  const provider = getProvider(providerName)
  if (!provider) {
    const orgSlug = await resolveOrgSlug(pending.orgId)
    const qs = new URLSearchParams({ error: 'provider_unsupported', provider: providerName })
    return c.redirect(redirectToConnections(appUrl, orgSlug, qs))
  }

  const orgSlug = await resolveOrgSlug(pending.orgId)

  try {
    const redirectUri = `${process.env.API_URL}/api/callback/${providerName}`
    const tokens = await provider.exchangeCode(code, redirectUri)

    // Para Meta: el user-level token sólo lo usamos para descubrir Pages e IG.
    // NO guardamos una "cuenta Facebook" con el user_id — esas entradas no son
    // publicables y confunden el picker de destino.
    if (providerName === 'meta' || providerName === 'facebook') {
      const result = await saveMetaSubAccounts(tokens.accessToken, pending.orgId, pending.userId)

      if (result.pages === 0) {
        console.warn(`[oauth] meta connect succeeded but user has no Pages`, { orgId: pending.orgId })
        const qs = new URLSearchParams({
          error: 'no_pages',
          provider: providerName,
          message: 'No encontramos Pages de Facebook administrables. Crea o pide acceso a una Page antes de conectar.',
        })
        return c.redirect(redirectToConnections(appUrl, orgSlug, qs))
      }

      const qs = new URLSearchParams({
        success: 'true',
        provider: providerName,
        pages: String(result.pages),
        instagram: String(result.instagram),
      })
      return c.redirect(redirectToConnections(appUrl, orgSlug, qs))
    }

    // Resto de providers (LinkedIn, etc.) — perfil al nivel de usuario es la cuenta publicable.
    const profile = await provider.getProfile(tokens.accessToken)
    const accessTokenEncrypted = encryptToken(tokens.accessToken)
    const refreshTokenEncrypted = tokens.refreshToken ? encryptToken(tokens.refreshToken) : null

    const { error: dbError } = await supabaseAdmin
      .from('social_accounts')
      .upsert(
        {
          organization_id: pending.orgId,
          provider: providerName,
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
      console.error('[oauth] Error guardando cuenta social:', dbError)
      const qs = new URLSearchParams({ error: 'db_error', message: dbError.message, provider: providerName })
      return c.redirect(redirectToConnections(appUrl, orgSlug, qs))
    }

    const qs = new URLSearchParams({ success: 'true', provider: providerName })
    return c.redirect(redirectToConnections(appUrl, orgSlug, qs))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[oauth] callback ${providerName} failed:`, message)
    const qs = new URLSearchParams({
      error: 'token_exchange_failed',
      message,
      provider: providerName,
    })
    return c.redirect(redirectToConnections(appUrl, orgSlug, qs))
  }
})

/**
 * Descubre Pages de Facebook (y su Instagram Business asociado si existe)
 * y las guarda como cuentas publicables. Devuelve cuántas se guardaron.
 */
async function saveMetaSubAccounts(
  userAccessToken: string,
  orgId: string,
  userId: string,
): Promise<{ pages: number; instagram: number }> {
  // Debug: verificar que el token funciona antes de pedir /me/accounts
  await metaProvider.getMe(userAccessToken)

  const pages = await metaProvider.getPages(userAccessToken)
  console.log(`[oauth] meta: discovered ${pages.length} Page(s) for org ${orgId}`)

  let igCount = 0
  let kept = 0

  for (const page of pages) {
    const reasons: string[] = []
    if (!page.id) reasons.push('missing_id')
    if (!page.name) reasons.push('missing_name')
    if (!page.access_token) reasons.push('missing_page_access_token')
    const hasPublishTask =
      Array.isArray(page.tasks) &&
      (page.tasks.includes('CREATE_CONTENT') ||
        page.tasks.includes('MANAGE') ||
        page.tasks.includes('MODERATE'))
    if (!hasPublishTask && page.tasks !== undefined) {
      // tasks=undefined puede pasar si el field no fue concedido; en ese caso
      // confiamos en access_token como signal y NO descartamos.
      reasons.push('missing_publish_task')
    }
    const keep = reasons.length === 0
    dbg('filter decision', {
      page_id: page.id,
      page_name: page.name,
      keep,
      reasons,
      tasks: page.tasks || [],
      has_token: Boolean(page.access_token),
    })

    if (!keep) {
      console.warn(
        `[oauth] meta: descartando Page ${page.id} (${page.name || 'sin nombre'}): ${reasons.join(', ')}`,
      )
      continue
    }
    kept++

    const pageTokenEncrypted = encryptToken(page.access_token)
    const { error: pageErr } = await supabaseAdmin.from('social_accounts').upsert(
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
    if (pageErr) {
      console.error(`[oauth] meta: error guardando Page ${page.id}:`, pageErr)
      continue
    }

    if (page.instagram_business_account?.id) {
      try {
        const igAccount = await metaProvider.getInstagramAccount(
          page.access_token,
          page.instagram_business_account.id,
        )

        if (igAccount) {
          const { error: igErr } = await supabaseAdmin.from('social_accounts').upsert(
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
          if (igErr) {
            console.error(`[oauth] meta: error guardando IG ${igAccount.id}:`, igErr)
          } else {
            igCount++
          }
        }
      } catch (err) {
        console.error(`[oauth] meta: error descubriendo IG para Page ${page.id}:`, err)
      }
    }
  }

  dbg('filter summary', { raw_count: pages.length, kept_count: kept, instagram: igCount })

  // Devuelve "pages" = cuántas se persistieron (kept), no el raw count. Eso es
  // lo que el callback usa para decidir si redirigir con error=no_pages.
  return { pages: kept, instagram: igCount }
}

export { callback }
