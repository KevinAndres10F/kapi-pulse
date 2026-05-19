/**
 * Meta Marketing API client — modelo "agencia central".
 *
 * Se diferencia de providers/meta.ts (que maneja Facebook Login + posts orgánicos
 * vía OAuth por usuario): este módulo usa UN solo System User token compartido
 * que vive en META_SYSTEM_USER_TOKEN. Ese token tiene scope ads_management sobre
 * todas las Ad Accounts asignadas a nuestro Business Portfolio.
 *
 * Docs:
 *   - Marketing API: https://developers.facebook.com/docs/marketing-apis
 *   - Graph version: v25.0 (mismo que el provider orgánico)
 *
 * Por qué no requiere App Review:
 *   El System User es operado por el admin del Business Portfolio (KAPI),
 *   no por usuarios finales. Meta no exige review para que el admin actúe
 *   sobre sus propias Ad Accounts asignadas.
 *
 * Gotchas:
 *   - Budgets en cents de la moneda de la Ad Account (consistente con el CLI
 *     oficial de Meta y con el skill de Santiago).
 *   - El "act_" prefix es obligatorio en ad_account_id.
 *   - Errores de políticas vienen como code 1815108 / 1815109 — los traduce
 *     translateGraphError() abajo.
 */

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

type GraphErrorBody = {
  error?: {
    message?: string
    type?: string
    code?: number
    error_subcode?: number
    error_user_title?: string
    error_user_msg?: string
    fbtrace_id?: string
  }
}

export class MetaAdsError extends Error {
  code?: number
  subcode?: number
  userMessage?: string
  fbtraceId?: string
  isPolicyRejection: boolean
  isFundingIssue: boolean

  constructor(body: GraphErrorBody, fallback: string) {
    const err = body.error
    super(err?.message || fallback)
    this.code = err?.code
    this.subcode = err?.error_subcode
    this.userMessage = err?.error_user_msg
    this.fbtraceId = err?.fbtrace_id
    this.isPolicyRejection = err?.code === 1815108 || err?.code === 1815109 || err?.code === 1487390
    this.isFundingIssue = err?.code === 100 && /funding|payment|billing/i.test(err.message || '')
  }
}

function getToken(): string {
  const token = process.env.META_SYSTEM_USER_TOKEN
  if (!token) throw new Error('META_SYSTEM_USER_TOKEN no configurado')
  return token
}

async function graphRequest<T>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'DELETE'; body?: Record<string, unknown> } = {},
): Promise<T> {
  const method = init.method || 'GET'
  const token = getToken()
  const url = new URL(`${GRAPH_BASE}${path}`)
  url.searchParams.set('access_token', token)

  const fetchInit: RequestInit = { method }
  if (init.body) {
    fetchInit.headers = { 'Content-Type': 'application/json' }
    fetchInit.body = JSON.stringify(init.body)
  }

  const res = await fetch(url.toString(), fetchInit)
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as GraphErrorBody
    throw new MetaAdsError(body, `Marketing API ${method} ${path} → ${res.status}`)
  }
  return (await res.json()) as T
}

// ============== Tipos del dominio ==============

export type AdObjective =
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_SALES'
  | 'OUTCOME_APP_PROMOTION'

export interface CampaignInput {
  adAccountId: string // formato "act_xxx"
  name: string
  objective: AdObjective
  status?: 'ACTIVE' | 'PAUSED'
  dailyBudgetCents?: number
  lifetimeBudgetCents?: number
  startTime?: string
  endTime?: string
  specialAdCategories?: string[]
}

export interface AdSetInput {
  adAccountId: string
  campaignId: string
  name: string
  dailyBudgetCents?: number
  lifetimeBudgetCents?: number
  billingEvent?: string
  optimizationGoal?: string
  targeting: Record<string, unknown>
  startTime?: string
  endTime?: string
  status?: 'ACTIVE' | 'PAUSED'
}

export interface AdCreativeInput {
  adAccountId: string
  name: string
  pageId: string
  instagramActorId?: string
  message?: string
  headline?: string
  linkUrl: string
  callToActionType?: string
  imageUrl?: string
  videoId?: string
}

export interface AdInput {
  adAccountId: string
  adSetId: string
  creativeId: string
  name: string
  status?: 'ACTIVE' | 'PAUSED'
}

export interface InsightsParams {
  level: 'campaign' | 'adset' | 'ad' | 'account'
  ids?: string[]
  datePreset?: 'today' | 'yesterday' | 'last_7d' | 'last_14d' | 'last_30d' | 'last_90d'
  since?: string // YYYY-MM-DD
  until?: string
  timeIncrement?: number // días por bucket (1 = diario)
}

export interface InsightsRow {
  date_start?: string
  date_stop?: string
  campaign_id?: string
  adset_id?: string
  ad_id?: string
  account_id?: string
  spend?: string
  impressions?: string
  reach?: string
  clicks?: string
  ctr?: string
  cpc?: string
  cpm?: string
  frequency?: string
  actions?: Array<{ action_type: string; value: string }>
  purchase_roas?: Array<{ action_type: string; value: string }>
  action_values?: Array<{ action_type: string; value: string }>
}

// ============== Campaigns ==============

export async function createCampaign(input: CampaignInput): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    name: input.name,
    objective: input.objective,
    status: input.status || 'PAUSED',
    special_ad_categories: input.specialAdCategories || [],
  }
  if (input.dailyBudgetCents) body.daily_budget = input.dailyBudgetCents
  if (input.lifetimeBudgetCents) body.lifetime_budget = input.lifetimeBudgetCents
  if (input.startTime) body.start_time = input.startTime
  if (input.endTime) body.stop_time = input.endTime

  return graphRequest<{ id: string }>(`/${input.adAccountId}/campaigns`, {
    method: 'POST',
    body,
  })
}

export async function updateCampaignStatus(
  metaCampaignId: string,
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'DELETED',
): Promise<{ success: true }> {
  await graphRequest(`/${metaCampaignId}`, { method: 'POST', body: { status } })
  return { success: true }
}

export async function listCampaigns(
  adAccountId: string,
  fields: string[] = ['id', 'name', 'objective', 'status', 'daily_budget', 'lifetime_budget', 'created_time'],
): Promise<{ data: Array<Record<string, unknown>> }> {
  return graphRequest(
    `/${adAccountId}/campaigns?fields=${encodeURIComponent(fields.join(','))}&limit=100`,
  )
}

// ============== Ad Sets ==============

export async function createAdSet(input: AdSetInput): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    name: input.name,
    campaign_id: input.campaignId,
    billing_event: input.billingEvent || 'IMPRESSIONS',
    optimization_goal: input.optimizationGoal || 'LINK_CLICKS',
    targeting: input.targeting,
    status: input.status || 'PAUSED',
  }
  if (input.dailyBudgetCents) body.daily_budget = input.dailyBudgetCents
  if (input.lifetimeBudgetCents) body.lifetime_budget = input.lifetimeBudgetCents
  if (input.startTime) body.start_time = input.startTime
  if (input.endTime) body.end_time = input.endTime

  return graphRequest<{ id: string }>(`/${input.adAccountId}/adsets`, {
    method: 'POST',
    body,
  })
}

// ============== Ad Creatives ==============

export async function createAdCreative(input: AdCreativeInput): Promise<{ id: string }> {
  const linkData: Record<string, unknown> = {
    link: input.linkUrl,
  }
  if (input.message) linkData.message = input.message
  if (input.headline) linkData.name = input.headline
  if (input.imageUrl) linkData.picture = input.imageUrl
  if (input.videoId) linkData.video_id = input.videoId
  if (input.callToActionType) {
    linkData.call_to_action = {
      type: input.callToActionType,
      value: { link: input.linkUrl },
    }
  }

  const objectStorySpec: Record<string, unknown> = {
    page_id: input.pageId,
    link_data: linkData,
  }
  if (input.instagramActorId) objectStorySpec.instagram_actor_id = input.instagramActorId

  return graphRequest<{ id: string }>(`/${input.adAccountId}/adcreatives`, {
    method: 'POST',
    body: {
      name: input.name,
      object_story_spec: objectStorySpec,
    },
  })
}

// ============== Ads ==============

export async function createAd(input: AdInput): Promise<{ id: string }> {
  return graphRequest<{ id: string }>(`/${input.adAccountId}/ads`, {
    method: 'POST',
    body: {
      name: input.name,
      adset_id: input.adSetId,
      creative: { creative_id: input.creativeId },
      status: input.status || 'PAUSED',
    },
  })
}

// ============== Insights ==============

export async function getInsights(
  scopeId: string,
  params: InsightsParams,
): Promise<{ data: InsightsRow[] }> {
  const fields = [
    'date_start',
    'date_stop',
    'campaign_id',
    'adset_id',
    'ad_id',
    'account_id',
    'spend',
    'impressions',
    'reach',
    'clicks',
    'ctr',
    'cpc',
    'cpm',
    'frequency',
    'actions',
    'action_values',
    'purchase_roas',
  ].join(',')

  const qs = new URLSearchParams({
    fields,
    level: params.level,
  })
  if (params.datePreset) qs.set('date_preset', params.datePreset)
  if (params.since && params.until) {
    qs.set('time_range', JSON.stringify({ since: params.since, until: params.until }))
  }
  if (params.timeIncrement) qs.set('time_increment', String(params.timeIncrement))

  return graphRequest(`/${scopeId}/insights?${qs.toString()}`)
}

// ============== Verificación / introspección ==============

/**
 * Útil para validar que el System User token tenga acceso a una Ad Account
 * antes de empezar a operar.
 */
export async function getAdAccount(adAccountId: string): Promise<{
  id: string
  name?: string
  currency?: string
  timezone_name?: string
  account_status?: number
}> {
  return graphRequest(
    `/${adAccountId}?fields=id,name,currency,timezone_name,account_status`,
  )
}

/**
 * Lista las Ad Accounts del Business Portfolio. Útil para el setup inicial:
 * el admin ve qué cuentas tiene el System User y elige cuáles conectar a qué orgs.
 */
export async function listBusinessAdAccounts(): Promise<{
  data: Array<{ id: string; name?: string; currency?: string }>
}> {
  const businessId = process.env.META_BUSINESS_ID
  if (!businessId) throw new Error('META_BUSINESS_ID no configurado')
  return graphRequest(
    `/${businessId}/owned_ad_accounts?fields=id,name,currency&limit=500`,
  )
}
