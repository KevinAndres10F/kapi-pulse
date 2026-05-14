/**
 * Adaptador OAuth para Meta (Facebook + Instagram + Threads)
 *
 * Docs: https://developers.facebook.com/docs/facebook-login/guides/advanced/manual-flow
 * Graph API: https://developers.facebook.com/docs/graph-api
 * Versión: v25.0
 *
 * Scopes requeridos:
 *   - pages_show_list, pages_read_engagement, pages_manage_posts (Facebook Pages)
 *   - instagram_basic, instagram_content_publish, instagram_manage_insights (Instagram)
 *   - threads_basic, threads_content_publish (Threads)
 *
 * Rate limits:
 *   - 200 llamadas/hora por usuario
 *   - IG: 50 posts/24h por cuenta, 30 hashtags únicos/semana
 *
 * Gotchas:
 *   - Solo IG Business/Creator (no personal)
 *   - Business Verification con RUC ecuatoriano necesaria para permisos avanzados
 *   - Long-lived token dura 60 días, renovar antes de expirar
 */

import type { SocialProvider, OAuthTokens, SocialProfile } from './types'

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

const FB_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_insights',
].join(',')

export class MetaProvider implements SocialProvider {
  readonly name = 'meta'

  private appId = process.env.META_APP_ID!
  private appSecret = process.env.META_APP_SECRET!

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: redirectUri,
      state,
      scope: FB_SCOPES,
      response_type: 'code',
    })
    return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params}`
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    // Paso 1: Obtener short-lived token
    const tokenUrl = `${GRAPH_BASE}/oauth/access_token?${new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: redirectUri,
      code,
    })}`

    const res = await fetch(tokenUrl)
    if (!res.ok) {
      const err = await res.json()
      throw new Error(`Meta token exchange failed: ${err.error?.message || res.statusText}`)
    }

    const data = await res.json()

    // Paso 2: Intercambiar por long-lived token (60 días)
    const longLivedUrl = `${GRAPH_BASE}/oauth/access_token?${new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: data.access_token,
    })}`

    const longRes = await fetch(longLivedUrl)
    if (!longRes.ok) {
      // Si falla, usar el short-lived
      return {
        accessToken: data.access_token,
        expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      }
    }

    const longData = await longRes.json()
    return {
      accessToken: longData.access_token,
      expiresAt: new Date(Date.now() + (longData.expires_in || 5184000) * 1000), // ~60 días
    }
  }

  async refreshTokens(currentToken: string): Promise<OAuthTokens> {
    // Meta no usa refresh_token estándar; se renueva el long-lived token
    const url = `${GRAPH_BASE}/oauth/access_token?${new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: currentToken,
    })}`

    const res = await fetch(url)
    if (!res.ok) {
      throw new Error('Meta token refresh failed — puede requerir reconexión')
    }

    const data = await res.json()
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
    }
  }

  async getProfile(accessToken: string): Promise<SocialProfile> {
    const res = await fetch(
      `${GRAPH_BASE}/me?fields=id,name,picture.type(large)&access_token=${accessToken}`,
    )
    if (!res.ok) throw new Error('No se pudo obtener el perfil de Meta')

    const data = await res.json()
    return {
      externalId: data.id,
      displayName: data.name,
      avatarUrl: data.picture?.data?.url,
    }
  }

  /**
   * Obtiene las Pages de Facebook del usuario
   */
  async getPages(accessToken: string) {
    const res = await fetch(
      `${GRAPH_BASE}/me/accounts?fields=id,name,access_token,picture.type(large),instagram_business_account&access_token=${accessToken}`,
    )
    if (!res.ok) throw new Error('No se pudieron obtener las Pages')
    const data = await res.json()
    return data.data || []
  }

  /**
   * Obtiene la cuenta de Instagram Business vinculada a una Page
   */
  async getInstagramAccount(pageAccessToken: string, igAccountId: string) {
    const res = await fetch(
      `${GRAPH_BASE}/${igAccountId}?fields=id,username,name,profile_picture_url,followers_count&access_token=${pageAccessToken}`,
    )
    if (!res.ok) return null
    return await res.json()
  }
}

export const metaProvider = new MetaProvider()
