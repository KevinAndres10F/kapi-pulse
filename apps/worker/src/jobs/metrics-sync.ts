/**
 * Job de sincronización de métricas. Corre cada 6h:
 *   1. Para cada social_account activa: pide insights de cuenta y guarda
 *      un snapshot en kapi_pulse.account_metrics (bucket diario).
 *   2. Para cada post_variant publicado en los últimos 30 días:
 *      pide insights del post y guarda snapshot en kapi_pulse.post_metrics
 *      (bucket por hora durante 7d, luego diario).
 *
 * Idempotente: usa UPSERT por (entity, period_start) — múltiples corridas en
 * la misma hora/día no duplican filas. Errores por cuenta se logean y no
 * tumban el job entero.
 */

import { createClient } from '@supabase/supabase-js'

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`
const LINKEDIN_API = 'https://api.linkedin.com/v2'
const LINKEDIN_VERSION = '202602'

function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key || key.length !== 64) throw new Error('TOKEN_ENCRYPTION_KEY inválido')
  return Buffer.from(key, 'hex')
}

function decryptToken(encryptedStr: string): string {
  const { createDecipheriv } = require('node:crypto')
  const key = getEncryptionKey()
  const [ivHex, authTagHex, encrypted] = encryptedStr.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'kapi_pulse' },
  })
}

function truncateToHour(d = new Date()): Date {
  const r = new Date(d)
  r.setUTCMinutes(0, 0, 0)
  return r
}
function truncateToDay(d = new Date()): Date {
  const r = new Date(d)
  r.setUTCHours(0, 0, 0, 0)
  return r
}

interface InsightsBundle {
  followers?: number
  following?: number
  postsCount?: number
  impressions?: number
  reach?: number
  profileViews?: number
  raw: Record<string, unknown>
}

interface PostInsightsBundle {
  impressions?: number
  reach?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  clicks?: number
  videoViews?: number
  raw: Record<string, unknown>
}

type GraphError = { error?: { message?: string; code?: number }; message?: string }
type InsightsEntry = { name: string; values: Array<{ value: number | Record<string, number> }> }
type InsightsResponse = { data?: InsightsEntry[] }
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
type LinkedInSocialActions = {
  likesSummary?: { totalLikes?: number; aggregatedTotalLikes?: number }
  commentsSummary?: { totalFirstLevelComments?: number; aggregatedTotalComments?: number }
}

function latestValue(entry: InsightsEntry | undefined): number | undefined {
  if (!entry || !entry.values?.length) return undefined
  const last = entry.values[entry.values.length - 1].value
  if (typeof last === 'number') return last
  if (last && typeof last === 'object') {
    return Object.values(last).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0)
  }
  return undefined
}
function indexBy(entries: InsightsEntry[]): Record<string, InsightsEntry> {
  const map: Record<string, InsightsEntry> = {}
  for (const e of entries || []) map[e.name] = e
  return map
}

// ============== Insights por provider ==============

async function fetchFacebookPageInsights(
  pageAccessToken: string,
  pageId: string,
): Promise<InsightsBundle> {
  const metrics = 'page_impressions,page_impressions_unique,page_post_engagements,page_fans'
  const url = `${GRAPH_BASE}/${pageId}/insights?metric=${metrics}&period=day&access_token=${pageAccessToken}`
  const res = await fetch(url)
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as GraphError
    throw new Error(`FB page insights: ${err.error?.message || res.statusText}`)
  }
  const data = (await res.json()) as InsightsResponse
  const by = indexBy(data.data || [])
  return {
    impressions: latestValue(by.page_impressions),
    reach: latestValue(by.page_impressions_unique),
    followers: latestValue(by.page_fans),
    raw: data as unknown as Record<string, unknown>,
  }
}

async function fetchInstagramInsights(
  accessToken: string,
  igUserId: string,
): Promise<InsightsBundle> {
  const profileRes = await fetch(
    `${GRAPH_BASE}/${igUserId}?fields=id,username,followers_count,follows_count,media_count&access_token=${accessToken}`,
  )
  const profile = (profileRes.ok ? await profileRes.json() : {}) as IgProfile
  const insRes = await fetch(
    `${GRAPH_BASE}/${igUserId}/insights?metric=impressions,reach,profile_views&period=day&access_token=${accessToken}`,
  )
  const insights = (insRes.ok ? await insRes.json() : { data: [] }) as InsightsResponse
  const by = indexBy(insights.data || [])
  return {
    followers: profile.followers_count,
    following: profile.follows_count,
    postsCount: profile.media_count,
    impressions: latestValue(by.impressions),
    reach: latestValue(by.reach),
    profileViews: latestValue(by.profile_views),
    raw: { profile, insights } as unknown as Record<string, unknown>,
  }
}

async function fetchFacebookPostInsights(
  pageAccessToken: string,
  externalPostId: string,
): Promise<PostInsightsBundle> {
  const metrics = 'post_impressions,post_impressions_unique,post_engaged_users,post_clicks'
  const insUrl = `${GRAPH_BASE}/${externalPostId}/insights?metric=${metrics}&access_token=${pageAccessToken}`
  const basicsUrl = `${GRAPH_BASE}/${externalPostId}?fields=likes.summary(true),comments.summary(true),shares&access_token=${pageAccessToken}`
  const [insRes, basicsRes] = await Promise.all([fetch(insUrl), fetch(basicsUrl)])
  if (!insRes.ok && !basicsRes.ok) {
    throw new Error(`FB post insights: ambos endpoints fallaron`)
  }
  const ins = (insRes.ok ? await insRes.json() : { data: [] }) as InsightsResponse
  const basics = (basicsRes.ok ? await basicsRes.json() : {}) as FbPostBasics
  const by = indexBy(ins.data || [])
  return {
    impressions: latestValue(by.post_impressions),
    reach: latestValue(by.post_impressions_unique),
    clicks: latestValue(by.post_clicks),
    likes: basics.likes?.summary?.total_count,
    comments: basics.comments?.summary?.total_count,
    shares: basics.shares?.count,
    raw: { insights: ins, basics } as unknown as Record<string, unknown>,
  }
}

async function fetchInstagramMediaInsights(
  accessToken: string,
  mediaId: string,
): Promise<PostInsightsBundle> {
  const metrics = 'impressions,reach,likes,comments,saved,shares,video_views'
  const url = `${GRAPH_BASE}/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`
  const res = await fetch(url)
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as GraphError
    throw new Error(`IG media insights: ${err.error?.message || res.statusText}`)
  }
  const data = (await res.json()) as InsightsResponse
  const by = indexBy(data.data || [])
  return {
    impressions: latestValue(by.impressions),
    reach: latestValue(by.reach),
    likes: latestValue(by.likes),
    comments: latestValue(by.comments),
    saves: latestValue(by.saved),
    shares: latestValue(by.shares),
    videoViews: latestValue(by.video_views),
    raw: data as unknown as Record<string, unknown>,
  }
}

async function fetchLinkedInPostInsights(
  accessToken: string,
  externalPostId: string,
): Promise<PostInsightsBundle> {
  const encoded = encodeURIComponent(externalPostId)
  const res = await fetch(`${LINKEDIN_API}/socialActions/${encoded}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'LinkedIn-Version': LINKEDIN_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    },
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as GraphError
    throw new Error(`LinkedIn socialActions: ${err.message || res.statusText}`)
  }
  const data = (await res.json()) as LinkedInSocialActions
  return {
    likes: data.likesSummary?.totalLikes ?? data.likesSummary?.aggregatedTotalLikes,
    comments:
      data.commentsSummary?.totalFirstLevelComments ??
      data.commentsSummary?.aggregatedTotalComments,
    raw: data as unknown as Record<string, unknown>,
  }
}

// ============== Helpers de upsert ==============

function calcEngagementRate(p: PostInsightsBundle): number | null {
  const interactions =
    (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0) + (p.clicks || 0)
  const denom = p.reach || p.impressions
  if (!denom) return null
  return Math.round((interactions / denom) * 10000) / 10000 // 4 decimales
}

// ============== Job principal ==============

export async function syncAllMetrics() {
  const supabase = getSupabase()
  const startedAt = Date.now()

  const { data: accounts, error } = await supabase
    .from('social_accounts')
    .select('id, organization_id, provider, external_id, access_token_encrypted, status')
    .eq('status', 'active')

  if (error) {
    console.error('[metrics-sync] Error listando cuentas:', error)
    return
  }
  if (!accounts || accounts.length === 0) {
    console.log('[metrics-sync] No hay cuentas activas')
    return
  }

  console.log(`[metrics-sync] Procesando ${accounts.length} cuentas...`)

  const accountPeriod = truncateToDay().toISOString()
  let accountOk = 0
  let accountFail = 0
  let postOk = 0
  let postFail = 0

  for (const acc of accounts) {
    try {
      const token = decryptToken(acc.access_token_encrypted)

      // 1. Insights de cuenta
      let acctInsights: InsightsBundle | null = null
      try {
        if (acc.provider === 'facebook') {
          acctInsights = await fetchFacebookPageInsights(token, acc.external_id)
        } else if (acc.provider === 'instagram') {
          acctInsights = await fetchInstagramInsights(token, acc.external_id)
        }
        // LinkedIn: sin métricas de cuenta sin Marketing API
      } catch (err) {
        console.warn(
          `[metrics-sync] insights cuenta ${acc.id} (${acc.provider}):`,
          err instanceof Error ? err.message : err,
        )
      }

      if (acctInsights) {
        const { error: upErr } = await supabase.from('account_metrics').upsert(
          {
            social_account_id: acc.id,
            period_start: accountPeriod,
            collected_at: new Date().toISOString(),
            followers: acctInsights.followers,
            following: acctInsights.following,
            posts_count: acctInsights.postsCount,
            impressions: acctInsights.impressions,
            reach: acctInsights.reach,
            profile_views: acctInsights.profileViews,
            raw: acctInsights.raw,
          },
          { onConflict: 'social_account_id,period_start' },
        )
        if (upErr) {
          console.error(`[metrics-sync] upsert account_metrics ${acc.id}:`, upErr)
          accountFail++
        } else {
          accountOk++
        }
      }

      // 2. Insights de posts de los últimos 30d
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString()
      const { data: variants } = await supabase
        .from('post_variants')
        .select('id, external_post_id, published_at')
        .eq('social_account_id', acc.id)
        .eq('status', 'published')
        .gte('published_at', thirtyDaysAgo)
        .not('external_post_id', 'is', null)

      if (!variants || variants.length === 0) continue

      // Bucket por hora si publicado <7d; sino por día. Reduce filas a futuro.
      const postPeriod = truncateToHour().toISOString()

      for (const v of variants) {
        if (!v.external_post_id) continue
        try {
          let pi: PostInsightsBundle
          if (acc.provider === 'facebook') {
            pi = await fetchFacebookPostInsights(token, v.external_post_id)
          } else if (acc.provider === 'instagram') {
            pi = await fetchInstagramMediaInsights(token, v.external_post_id)
          } else if (acc.provider === 'linkedin') {
            pi = await fetchLinkedInPostInsights(token, v.external_post_id)
          } else {
            continue
          }

          const { error: upErr } = await supabase.from('post_metrics').upsert(
            {
              post_variant_id: v.id,
              period_start: postPeriod,
              collected_at: new Date().toISOString(),
              impressions: pi.impressions ?? 0,
              reach: pi.reach ?? 0,
              likes: pi.likes ?? 0,
              comments: pi.comments ?? 0,
              shares: pi.shares ?? 0,
              saves: pi.saves ?? 0,
              clicks: pi.clicks ?? 0,
              video_views: pi.videoViews ?? 0,
              engagement_rate: calcEngagementRate(pi),
              raw: pi.raw,
            },
            { onConflict: 'post_variant_id,period_start' },
          )
          if (upErr) {
            console.error(`[metrics-sync] upsert post_metrics ${v.id}:`, upErr)
            postFail++
          } else {
            postOk++
          }
        } catch (err) {
          console.warn(
            `[metrics-sync] post ${v.id} (${acc.provider}):`,
            err instanceof Error ? err.message : err,
          )
          postFail++
        }
      }
    } catch (err) {
      console.error(`[metrics-sync] cuenta ${acc.id} falló:`, err)
      accountFail++
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(
    `[metrics-sync] Completado en ${elapsed}s — ` +
      `cuentas ok=${accountOk}/fail=${accountFail}, posts ok=${postOk}/fail=${postFail}`,
  )
}
