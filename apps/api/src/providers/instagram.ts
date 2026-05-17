/**
 * Adaptador OAuth para "Instagram API with Instagram Login".
 *
 * Diferencia clave con MetaProvider:
 * - El usuario inicia sesion DIRECTAMENTE con su cuenta Instagram (Business o
 *   Creator). NO necesita Facebook Page vinculada.
 * - Endpoints viven en `graph.instagram.com` (no en `graph.facebook.com`).
 * - Token exchange usa `api.instagram.com/oauth/access_token` para el
 *   short-lived y luego `graph.instagram.com/access_token` para el long-lived.
 * - Scopes son los `instagram_business_*` (no los `pages_*` ni `instagram_basic`).
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
 *
 * Cuando el callback termina, guardamos UNA fila en `social_accounts` con
 * `provider='instagram'` y `metadata.auth_method='instagram_login'` para que
 * el publisher sepa que tiene que usar `graph.instagram.com` (no Facebook).
 */

import type {
  SocialProvider,
  OAuthTokens,
  SocialProfile,
} from './types'

const IG_GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION || 'v22.0'
const IG_GRAPH_BASE = `https://graph.instagram.com/${IG_GRAPH_VERSION}`
const IG_GRAPH_ROOT = 'https://graph.instagram.com'

// Scopes minimos para conectar + publicar (los 2 que NO requieren App Review).
// Si tu app ya tiene aprobados manage_comments / manage_messages podes sumarlos
// via INSTAGRAM_EXTRA_SCOPES (coma-separados).
// Incluir scopes que la app NO tiene approbados causa "Invalid platform app".
const IG_BASE_SCOPES = ['instagram_business_basic', 'instagram_business_content_publish']

function buildScopes(): string {
  const extras = (process.env.INSTAGRAM_EXTRA_SCOPES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return [...IG_BASE_SCOPES, ...extras].join(',')
}

interface IgTokenResponse {
  access_token: string
  user_id?: number | string
  permissions?: string | string[]
  expires_in?: number
  token_type?: string
}

interface IgProfileResponse {
  id?: string
  user_id?: string | number
  username?: string
  name?: string
  profile_picture_url?: string
  account_type?: string
  followers_count?: number
  media_count?: number
}

interface IgErrorResponse {
  error?: { message?: string; code?: number; type?: string }
  error_type?: string
  error_message?: string
}

export class InstagramProvider implements SocialProvider {
  readonly name = 'instagram'

  private appId = process.env.INSTAGRAM_APP_ID || ''
  private appSecret = process.env.INSTAGRAM_APP_SECRET || ''

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: buildScopes(),
      state,
    })
    // IMPORTANTE: el endpoint correcto es `api.instagram.com/oauth/authorize`
    // (no `www.instagram.com/...`). Usar el host equivocado devuelve
    // "Invalid platform app" aunque el client_id sea correcto.
    return `https://api.instagram.com/oauth/authorize?${params.toString()}`
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    // Paso 1: short-lived token (max 1h)
    const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.appId,
        client_secret: this.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }).toString(),
    })

    if (!shortRes.ok) {
      const err = (await shortRes.json().catch(() => ({}))) as IgErrorResponse
      throw new Error(
        `Instagram token exchange failed (${shortRes.status}): ${
          err.error_message || err.error?.message || shortRes.statusText
        }`,
      )
    }

    const shortData = (await shortRes.json()) as IgTokenResponse
    if (!shortData.access_token) {
      throw new Error('Instagram token exchange returned no access_token')
    }

    // Paso 2: long-lived token (60 dias)
    const longUrl = `${IG_GRAPH_ROOT}/access_token?${new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: this.appSecret,
      access_token: shortData.access_token,
    }).toString()}`

    let finalToken = shortData.access_token
    let finalExpiresIn = 3600

    const longRes = await fetch(longUrl)
    if (longRes.ok) {
      const longData = (await longRes.json()) as IgTokenResponse
      finalToken = longData.access_token
      finalExpiresIn = longData.expires_in || 5184000
    } else {
      console.warn('[instagram] long-lived exchange failed, usando short-lived')
    }

    // Los permisos efectivamente concedidos vienen en el response del exchange
    let scopes: string[] = []
    if (Array.isArray(shortData.permissions)) {
      scopes = shortData.permissions
    } else if (typeof shortData.permissions === 'string') {
      scopes = shortData.permissions.split(',').map((s) => s.trim()).filter(Boolean)
    }

    return {
      accessToken: finalToken,
      expiresAt: new Date(Date.now() + finalExpiresIn * 1000),
      scopes,
    }
  }

  /**
   * Refresca el long-lived token (siempre dentro de los 60 dias previos a
   * expiracion). Devuelve un nuevo token con 60 dias frescos.
   */
  async refreshTokens(currentToken: string): Promise<OAuthTokens> {
    const url = `${IG_GRAPH_ROOT}/refresh_access_token?${new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: currentToken,
    }).toString()}`

    const res = await fetch(url)
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as IgErrorResponse
      throw new Error(
        `Instagram refresh failed: ${err.error_message || err.error?.message || res.statusText}`,
      )
    }
    const data = (await res.json()) as IgTokenResponse
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
    }
  }

  async getProfile(accessToken: string): Promise<SocialProfile> {
    const fields = [
      'user_id',
      'username',
      'name',
      'profile_picture_url',
      'account_type',
      'followers_count',
      'media_count',
    ].join(',')
    const url = `${IG_GRAPH_BASE}/me?fields=${fields}&access_token=${accessToken}`

    const res = await fetch(url)
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as IgErrorResponse
      throw new Error(
        `Instagram profile fetch failed: ${err.error_message || err.error?.message || res.statusText}`,
      )
    }

    const data = (await res.json()) as IgProfileResponse
    // `user_id` (numerico) es el ID de la cuenta IG Business; lo usamos como
    // external_id porque es lo que aceptan los endpoints de Graph para crear
    // media containers, publicar, leer insights, etc.
    const externalId = String(data.user_id ?? data.id ?? '')
    if (!externalId) {
      throw new Error('Instagram profile response no incluyo user_id')
    }

    return {
      externalId,
      displayName: data.username || data.name || 'Instagram',
      avatarUrl: data.profile_picture_url,
      metadata: {
        auth_method: 'instagram_login',
        username: data.username,
        account_type: data.account_type,
        followers: data.followers_count,
        media_count: data.media_count,
      },
    }
  }
}

export const instagramProvider = new InstagramProvider()
