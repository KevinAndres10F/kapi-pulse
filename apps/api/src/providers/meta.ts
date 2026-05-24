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

import type {
  SocialProvider,
  OAuthTokens,
  SocialProfile,
  InsightsData,
  PostInsightsData,
} from './types'

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

// Scopes del flow Facebook Login (provider 'meta'). Por DEFAULT solo
// Facebook Pages — los scopes que cualquier app tiene disponibles sin
// App Review.
//
// IMPORTANTE: NO incluir instagram_* por default. Son scopes legacy del
// Graph API clásico que requieren App Review en apps nuevas. Si la app
// los tiene aprobados, sumarlos via META_EXTRA_SCOPES (coma-separados):
//
//   META_EXTRA_SCOPES=instagram_basic,instagram_manage_insights
//
// Sin esos scopes el callback igualmente descubre Pages, pero la IG
// Business vinculada solo aparece con id (sin username/profile_picture).
// Para conectar IG con datos completos SIN Facebook Page, usar el flow
// separado /api/connect/instagram (providers/instagram.ts).
const FB_BASE_SCOPES = ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts']

function buildFbScopes(): string {
  const extras = (process.env.META_EXTRA_SCOPES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return [...FB_BASE_SCOPES, ...extras].join(',')
}

export class MetaProvider implements SocialProvider {
  readonly name = 'meta'

  private appId = process.env.META_APP_ID!
  private appSecret = process.env.META_APP_SECRET!

  getAuthUrl(state: string, redirectUri: string): string {
    const scope = buildFbScopes()
    console.log(`[meta] OAuth scope: ${scope}`)
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: redirectUri,
      state,
      scope,
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
      const err = (await res.json().catch(() => ({}))) as GraphError
      throw new Error(`Meta token exchange failed: ${err.error?.message || res.statusText}`)
    }

    const data = (await res.json()) as { access_token: string; expires_in?: number }

    // Paso 2: Intercambiar por long-lived token (60 días)
    const longLivedUrl = `${GRAPH_BASE}/oauth/access_token?${new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: data.access_token,
    })}`

    let finalAccessToken = data.access_token
    let finalExpiresIn = data.expires_in || 3600

    const longRes = await fetch(longLivedUrl)
    if (longRes.ok) {
      const longData = (await longRes.json()) as { access_token: string; expires_in?: number }
      finalAccessToken = longData.access_token
      finalExpiresIn = longData.expires_in || 5184000
    } else {
      console.warn(`[meta] long-lived token exchange failed, using short-lived`)
    }

    // Paso 3: Consultar los scopes efectivamente concedidos por el usuario
    let grantedScopes: string[] = []
    try {
      const permsRes = await fetch(
        `${GRAPH_BASE}/me/permissions?access_token=${finalAccessToken}`,
      )
      if (permsRes.ok) {
        const permsData = (await permsRes.json()) as { data?: Array<{ permission: string; status: string }> }
        grantedScopes = (permsData.data || [])
          .filter((p) => p.status === 'granted')
          .map((p) => p.permission)
      }
    } catch (err) {
      console.warn('[meta] could not fetch granted permissions:', err)
    }

    return {
      accessToken: finalAccessToken,
      expiresAt: new Date(Date.now() + finalExpiresIn * 1000),
      scopes: grantedScopes,
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

    const data = (await res.json()) as { access_token: string; expires_in?: number }
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

    const data = (await res.json()) as {
      id: string
      name?: string
      picture?: { data?: { url?: string } }
    }
    return {
      externalId: data.id,
      displayName: data.name || '',
      avatarUrl: data.picture?.data?.url,
    }
  }

  /**
   * Obtiene las Pages de Facebook del usuario
   */
  async getPages(accessToken: string): Promise<MetaPage[]> {
    const res = await fetch(
      `${GRAPH_BASE}/me/accounts?fields=id,name,access_token,picture.type(large),instagram_business_account&access_token=${accessToken}`,
    )
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as GraphError
      throw new Error(`No se pudieron obtener las Pages: ${err.error?.message || res.statusText}`)
    }
    const data = (await res.json()) as { data?: MetaPage[] }
    return data.data || []
  }

  /**
   * Obtiene la cuenta de Instagram Business vinculada a una Page
   */
  async getInstagramAccount(pageAccessToken: string, igAccountId: string): Promise<IgBusinessAccount | null> {
    const res = await fetch(
      `${GRAPH_BASE}/${igAccountId}?fields=id,username,name,profile_picture_url,followers_count&access_token=${pageAccessToken}`,
    )
    if (!res.ok) return null
    return (await res.json()) as IgBusinessAccount
  }

  /**
   * Insights de Facebook Page (level=cuenta).
   * Docs: https://developers.facebook.com/docs/graph-api/reference/v25.0/insights
   * Metrics deprecadas reemplazadas: usar page_impressions_unique en lugar de page_views,
   * page_post_engagements para engagement total.
   */
  async getFacebookPageInsights(
    pageAccessToken: string,
    pageId: string,
  ): Promise<InsightsData> {
    const metrics = [
      'page_impressions',
      'page_impressions_unique',
      'page_post_engagements',
      'page_fans',
    ].join(',')
    const url = `${GRAPH_BASE}/${pageId}/insights?metric=${metrics}&period=day&access_token=${pageAccessToken}`
    const res = await fetch(url)
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as GraphError
      throw new Error(`FB insights failed: ${err.error?.message || res.statusText}`)
    }
    const data = (await res.json()) as InsightsResponse
    const byName = indexInsightsByName(data.data || [])
    return {
      impressions: latestValue(byName.page_impressions),
      reach: latestValue(byName.page_impressions_unique),
      engagement: latestValue(byName.page_post_engagements),
      followers: latestValue(byName.page_fans),
      raw: data as unknown as Record<string, unknown>,
    }
  }

  /**
   * Insights de Instagram Business (level=cuenta).
   * Docs: https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights
   * Metric 'follower_count' es estable; impressions/reach están deprecadas a v22+ y
   * reemplazadas por 'views' y 'reach' como metric_type=total_value en algunos casos.
   */
  async getInstagramInsights(
    accessToken: string,
    igUserId: string,
  ): Promise<InsightsData> {
    const profileRes = await fetch(
      `${GRAPH_BASE}/${igUserId}?fields=id,username,followers_count,follows_count,media_count&access_token=${accessToken}`,
    )
    const profile = (
      profileRes.ok ? await profileRes.json() : {}
    ) as IgProfile

    const insightsUrl = `${GRAPH_BASE}/${igUserId}/insights?metric=impressions,reach,profile_views&period=day&access_token=${accessToken}`
    const insightsRes = await fetch(insightsUrl)
    const insights = (
      insightsRes.ok
        ? await insightsRes.json()
        : { data: [], error: 'insights unavailable' }
    ) as InsightsResponse
    const byName = indexInsightsByName(insights.data || [])

    return {
      followers: profile.followers_count,
      following: profile.follows_count,
      postsCount: profile.media_count,
      impressions: latestValue(byName.impressions),
      reach: latestValue(byName.reach),
      profileViews: latestValue(byName.profile_views),
      raw: { profile, insights } as unknown as Record<string, unknown>,
    }
  }

  /**
   * Insights de un post específico de FB Page.
   * El externalPostId tiene formato {page-id}_{post-id}; Graph acepta ambos.
   */
  async getFacebookPostInsights(
    pageAccessToken: string,
    externalPostId: string,
  ): Promise<PostInsightsData> {
    const metrics = [
      'post_impressions',
      'post_impressions_unique',
      'post_engaged_users',
      'post_clicks',
      'post_reactions_by_type_total',
    ].join(',')
    const url = `${GRAPH_BASE}/${externalPostId}/insights?metric=${metrics}&access_token=${pageAccessToken}`
    const res = await fetch(url)
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as GraphError
      throw new Error(`FB post insights failed: ${err.error?.message || res.statusText}`)
    }
    const data = (await res.json()) as InsightsResponse
    const byName = indexInsightsByName(data.data || [])

    const basicsUrl = `${GRAPH_BASE}/${externalPostId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${pageAccessToken}`
    const basicsRes = await fetch(basicsUrl)
    const basics = (basicsRes.ok ? await basicsRes.json() : {}) as FbPostBasics

    return {
      impressions: latestValue(byName.post_impressions),
      reach: latestValue(byName.post_impressions_unique),
      clicks: latestValue(byName.post_clicks),
      likes: basics.likes?.summary?.total_count,
      comments: basics.comments?.summary?.total_count,
      shares: basics.shares?.count,
      raw: { insights: data, basics } as unknown as Record<string, unknown>,
    }
  }

  /**
   * Insights de IG media. Requiere instagram_manage_insights scope.
   * Docs: https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-media/insights
   */
  async getInstagramMediaInsights(
    accessToken: string,
    mediaId: string,
  ): Promise<PostInsightsData> {
    const metrics = 'impressions,reach,likes,comments,saved,shares,video_views'
    const url = `${GRAPH_BASE}/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`
    const res = await fetch(url)
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as GraphError
      throw new Error(`IG media insights failed: ${err.error?.message || res.statusText}`)
    }
    const data = (await res.json()) as InsightsResponse
    const byName = indexInsightsByName(data.data || [])
    return {
      impressions: latestValue(byName.impressions),
      reach: latestValue(byName.reach),
      likes: latestValue(byName.likes),
      comments: latestValue(byName.comments),
      saves: latestValue(byName.saved),
      shares: latestValue(byName.shares),
      videoViews: latestValue(byName.video_views),
      raw: data as unknown as Record<string, unknown>,
    }
  }
}

// ============== Tipos y helpers para parsear respuestas de Graph API ==============

type GraphError = { error?: { message?: string; code?: number; type?: string } }
type InsightsEntry = { name: string; values: Array<{ value: number | Record<string, number> }> }
type InsightsResponse = { data?: InsightsEntry[] }

export type MetaPage = {
  id: string
  name: string
  access_token: string
  picture?: { data?: { url?: string } }
  instagram_business_account?: { id: string }
}

export type IgBusinessAccount = {
  id: string
  username?: string
  name?: string
  profile_picture_url?: string
  followers_count?: number
}
type IgProfile = {
  followers_count?: number
  follows_count?: number
  media_count?: number
}
type FbPostBasics = {
  likes?: { summary?: { total_count?: number } }
  comments?: { summary?: { total_count?: number } }
  shares?: { count?: number }
}

function indexInsightsByName(entries: InsightsEntry[]): Record<string, InsightsEntry> {
  const map: Record<string, InsightsEntry> = {}
  for (const e of entries) map[e.name] = e
  return map
}

function latestValue(entry: InsightsEntry | undefined): number | undefined {
  if (!entry || !entry.values?.length) return undefined
  const last = entry.values[entry.values.length - 1].value
  if (typeof last === 'number') return last
  // Algunas metrics devuelven objeto {key: count}; sumamos
  if (last && typeof last === 'object') {
    return Object.values(last).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0)
  }
  return undefined
}

export const metaProvider = new MetaProvider()
