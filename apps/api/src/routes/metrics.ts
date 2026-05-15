/**
 * Endpoints de analytics. Lee de kapi_pulse.post_metrics + account_metrics
 * y devuelve agregaciones para los gráficos del frontend.
 *
 * Patrón de auth: igual que /api/posts — se trustea el org_id del query.
 * TODO compartido con el resto del API: validar JWT del usuario y verificar
 * membership antes de servir datos (ver hilo de seguridad en posts.ts).
 */
import { Hono } from 'hono'
import { supabaseAdmin } from '../lib/supabase'

const metrics = new Hono()

function parseDateRange(c: { req: { query: (k: string) => string | undefined } }) {
  const to = c.req.query('to') ? new Date(c.req.query('to')!) : new Date()
  const from = c.req.query('from')
    ? new Date(c.req.query('from')!)
    : new Date(Date.now() - 30 * 86400_000)
  return { from: from.toISOString(), to: to.toISOString() }
}

/**
 * GET /api/metrics/overview?org_id=...&from=...&to=...
 * Devuelve KPIs agregados del rango + breakdown por red.
 */
metrics.get('/overview', async (c) => {
  const orgId = c.req.query('org_id')
  if (!orgId) return c.json({ error: 'Falta org_id' }, 400)
  const { from, to } = parseDateRange(c)

  // Posts publicados en el rango (de cualquier estado actual, lo que importa es published_at)
  const { data: posts, error: postsErr } = await supabaseAdmin
    .from('posts')
    .select('id, status, published_at, post_variants(id, social_account_id, social_accounts(provider))')
    .eq('organization_id', orgId)
    .gte('published_at', from)
    .lte('published_at', to)
    .not('published_at', 'is', null)

  if (postsErr) return c.json({ error: postsErr.message }, 500)

  const variantIds: string[] = []
  const variantToProvider: Record<string, string> = {}
  for (const p of posts || []) {
    for (const v of (p as unknown as { post_variants: Array<{ id: string; social_accounts: { provider: string } | null }> }).post_variants || []) {
      variantIds.push(v.id)
      if (v.social_accounts) variantToProvider[v.id] = v.social_accounts.provider
    }
  }

  // Métricas más recientes de esas variantes
  let metricsRows: Array<{
    post_variant_id: string
    impressions: number | null
    reach: number | null
    likes: number | null
    comments: number | null
    shares: number | null
    saves: number | null
    clicks: number | null
    engagement_rate: number | null
  }> = []
  if (variantIds.length > 0) {
    const { data: m, error: mErr } = await supabaseAdmin
      .from('post_metrics_latest')
      .select('post_variant_id, impressions, reach, likes, comments, shares, saves, clicks, engagement_rate')
      .in('post_variant_id', variantIds)
    if (mErr) return c.json({ error: mErr.message }, 500)
    metricsRows = m || []
  }

  // Agregaciones globales
  let totalImpressions = 0
  let totalReach = 0
  let totalEngagement = 0 // likes+comments+shares+saves+clicks

  // Breakdown por provider
  const byProvider: Record<string, { posts: number; impressions: number; engagement: number }> = {}
  for (const p of posts || []) {
    const providers = new Set<string>()
    for (const v of (p as unknown as { post_variants: Array<{ id: string; social_accounts: { provider: string } | null }> }).post_variants || []) {
      if (v.social_accounts) providers.add(v.social_accounts.provider)
    }
    for (const prov of providers) {
      if (!byProvider[prov]) byProvider[prov] = { posts: 0, impressions: 0, engagement: 0 }
      byProvider[prov].posts++
    }
  }

  for (const m of metricsRows) {
    const imps = m.impressions || 0
    const reach = m.reach || 0
    const eng = (m.likes || 0) + (m.comments || 0) + (m.shares || 0) + (m.saves || 0) + (m.clicks || 0)
    totalImpressions += imps
    totalReach += reach
    totalEngagement += eng
    const prov = variantToProvider[m.post_variant_id]
    if (prov && byProvider[prov]) {
      byProvider[prov].impressions += imps
      byProvider[prov].engagement += eng
    }
  }

  const denom = totalReach || totalImpressions
  const engagementRate = denom > 0 ? Math.round((totalEngagement / denom) * 10000) / 100 : 0 // %

  return c.json({
    range: { from, to },
    totalPosts: posts?.length || 0,
    totalImpressions,
    totalReach,
    totalEngagement,
    engagementRate, // porcentaje, 2 decimales
    byProvider: Object.entries(byProvider).map(([provider, v]) => ({
      provider,
      posts: v.posts,
      impressions: v.impressions,
      engagement: v.engagement,
    })),
  })
})

/**
 * GET /api/metrics/timeline?org_id=...&from=...&to=...
 * Devuelve una serie temporal diaria agregada para gráfico de líneas.
 */
metrics.get('/timeline', async (c) => {
  const orgId = c.req.query('org_id')
  if (!orgId) return c.json({ error: 'Falta org_id' }, 400)
  const { from, to } = parseDateRange(c)

  // Traemos snapshots crudos en el rango y agrupamos en memoria por día.
  // Para volúmenes grandes (>10k filas/rango) conviene migrar a RPC SQL.
  const { data: variants, error: vErr } = await supabaseAdmin
    .from('posts')
    .select('post_variants(id)')
    .eq('organization_id', orgId)

  if (vErr) return c.json({ error: vErr.message }, 500)

  const variantIds: string[] = []
  for (const p of variants || []) {
    for (const v of (p as unknown as { post_variants: Array<{ id: string }> }).post_variants || []) {
      variantIds.push(v.id)
    }
  }

  if (variantIds.length === 0) {
    return c.json({ points: [] })
  }

  const { data: snaps, error: sErr } = await supabaseAdmin
    .from('post_metrics')
    .select('period_start, impressions, reach, likes, comments, shares, saves, clicks')
    .in('post_variant_id', variantIds)
    .gte('period_start', from)
    .lte('period_start', to)
    .order('period_start', { ascending: true })

  if (sErr) return c.json({ error: sErr.message }, 500)

  // Agrupar por día (UTC)
  const byDay: Record<string, { impressions: number; reach: number; engagement: number; samples: number }> = {}
  for (const s of snaps || []) {
    const day = s.period_start.slice(0, 10)
    if (!byDay[day]) byDay[day] = { impressions: 0, reach: 0, engagement: 0, samples: 0 }
    byDay[day].impressions += s.impressions || 0
    byDay[day].reach += s.reach || 0
    byDay[day].engagement +=
      (s.likes || 0) + (s.comments || 0) + (s.shares || 0) + (s.saves || 0) + (s.clicks || 0)
    byDay[day].samples++
  }

  const points = Object.entries(byDay)
    .map(([date, v]) => ({
      date,
      impressions: v.impressions,
      reach: v.reach,
      engagement: v.engagement,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return c.json({ points })
})

/**
 * GET /api/metrics/top-posts?org_id=...&limit=10&from=...&to=...
 * Posts con mayor engagement absoluto en el rango.
 */
metrics.get('/top-posts', async (c) => {
  const orgId = c.req.query('org_id')
  if (!orgId) return c.json({ error: 'Falta org_id' }, 400)
  const limit = Math.min(Number(c.req.query('limit')) || 10, 50)
  const { from, to } = parseDateRange(c)

  const { data: variants, error } = await supabaseAdmin
    .from('post_variants')
    .select(`
      id, content, published_at, external_post_id,
      social_accounts(provider, display_name),
      posts!inner(organization_id, title)
    `)
    .eq('posts.organization_id', orgId)
    .eq('status', 'published')
    .gte('published_at', from)
    .lte('published_at', to)
    .not('published_at', 'is', null)

  if (error) return c.json({ error: error.message }, 500)

  type VRow = {
    id: string
    content: string | null
    published_at: string | null
    external_post_id: string | null
    social_accounts: { provider: string; display_name: string | null } | null
    posts: { title: string | null } | null
  }

  const rows = (variants || []) as unknown as VRow[]
  const variantIds = rows.map((v) => v.id)
  if (variantIds.length === 0) return c.json({ posts: [] })

  const { data: m } = await supabaseAdmin
    .from('post_metrics_latest')
    .select('post_variant_id, impressions, reach, likes, comments, shares, saves, clicks, engagement_rate')
    .in('post_variant_id', variantIds)

  const metricsBy: Record<string, { impressions: number; reach: number; engagement: number; engagement_rate: number | null }> = {}
  for (const row of m || []) {
    const eng =
      (row.likes || 0) + (row.comments || 0) + (row.shares || 0) + (row.saves || 0) + (row.clicks || 0)
    metricsBy[row.post_variant_id] = {
      impressions: row.impressions || 0,
      reach: row.reach || 0,
      engagement: eng,
      engagement_rate: row.engagement_rate,
    }
  }

  const enriched = rows
    .map((v) => ({
      variantId: v.id,
      title: v.posts?.title || null,
      content: v.content,
      provider: v.social_accounts?.provider || null,
      accountName: v.social_accounts?.display_name || null,
      publishedAt: v.published_at,
      externalPostId: v.external_post_id,
      ...metricsBy[v.id] || { impressions: 0, reach: 0, engagement: 0, engagement_rate: null },
    }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, limit)

  return c.json({ posts: enriched })
})

/**
 * GET /api/metrics/accounts?org_id=...
 * Snapshot más reciente por cuenta (followers, etc).
 */
metrics.get('/accounts', async (c) => {
  const orgId = c.req.query('org_id')
  if (!orgId) return c.json({ error: 'Falta org_id' }, 400)

  const { data: accounts, error } = await supabaseAdmin
    .from('social_accounts')
    .select('id, provider, display_name, avatar_url, status')
    .eq('organization_id', orgId)

  if (error) return c.json({ error: error.message }, 500)
  if (!accounts || accounts.length === 0) return c.json({ accounts: [] })

  type AccountSnapshot = {
    social_account_id: string
    followers: number | null
    following: number | null
    posts_count: number | null
    impressions: number | null
    reach: number | null
    profile_views: number | null
    collected_at: string
  }

  const accountIds = accounts.map((a) => a.id)
  const { data: m } = await supabaseAdmin
    .from('account_metrics_latest')
    .select('social_account_id, followers, following, posts_count, impressions, reach, profile_views, collected_at')
    .in('social_account_id', accountIds)

  const byAcc: Record<string, AccountSnapshot> = {}
  for (const row of (m || []) as AccountSnapshot[]) byAcc[row.social_account_id] = row

  const out = accounts.map((a) => ({
    id: a.id,
    provider: a.provider,
    displayName: a.display_name,
    avatarUrl: a.avatar_url,
    status: a.status,
    followers: byAcc[a.id]?.followers ?? null,
    following: byAcc[a.id]?.following ?? null,
    postsCount: byAcc[a.id]?.posts_count ?? null,
    impressions: byAcc[a.id]?.impressions ?? null,
    reach: byAcc[a.id]?.reach ?? null,
    profileViews: byAcc[a.id]?.profile_views ?? null,
    lastSync: byAcc[a.id]?.collected_at ?? null,
  }))

  return c.json({ accounts: out })
})

/**
 * POST /api/metrics/sync
 * Encola un job inmediato de metrics-sync. Útil para "refrescar ahora".
 */
metrics.post('/sync', async (c) => {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) return c.json({ error: 'Redis no configurado' }, 503)

  try {
    const { Queue } = await import('bullmq')
    const IORedis = (await import('ioredis')).default
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null })
    const queue = new Queue('maintenance', { connection })
    const job = await queue.add('metrics-sync', {})
    return c.json({ queued: true, jobId: job.id }, 202)
  } catch (err) {
    return c.json(
      { error: 'No se pudo encolar', detail: err instanceof Error ? err.message : String(err) },
      500,
    )
  }
})

export { metrics }
