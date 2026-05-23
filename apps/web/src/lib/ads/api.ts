/**
 * Cliente API para Meta Ads (modelo agencia central).
 * Usa el mismo patrón que lib/studio/api.ts.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`Non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok) {
    const err = data as { error?: string; details?: unknown }
    const e = new Error(err.error || `HTTP ${res.status}`) as Error & { details?: unknown; status?: number }
    e.details = err.details
    e.status = res.status
    throw e
  }
  return data as T
}

function headers(userId: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-User-Id': userId }
}

// ============== Tipos del dominio ==============

export type AdCampaignStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'paused'
  | 'rejected'
  | 'archived'

export type AdObjective =
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_SALES'
  | 'OUTCOME_APP_PROMOTION'

export interface AdAccount {
  id: string
  organization_id: string
  meta_ad_account_id: string
  name: string | null
  currency: string
  timezone_name: string | null
  status: 'active' | 'disabled'
  created_at: string
}

export interface FundingStatus {
  hasFunding: boolean
  accountStatus?: number
  disableReason?: number
  fundingSource?: string
}

export interface BusinessPage {
  id: string
  name?: string
  kind: 'owned' | 'client'
}

export interface AdCampaign {
  id: string
  organization_id: string
  ad_account_id: string
  meta_campaign_id: string | null
  name: string
  objective: AdObjective
  status: AdCampaignStatus
  daily_budget_cents: number | null
  lifetime_budget_cents: number | null
  start_time: string | null
  end_time: string | null
  proposed_by: string | null
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  launched_at: string | null
  created_at: string
  ad_accounts?: { id: string; meta_ad_account_id: string; currency: string }
  ad_sets?: Array<{ id: string; name: string; status: string; meta_adset_id: string | null }>
  ad_creatives?: Array<{
    id: string
    name: string
    headline: string | null
    body: string | null
    link_url: string | null
    meta_creative_id: string | null
  }>
}

export interface PendingCampaign {
  id: string
  organization_id: string
  name: string
  objective: AdObjective
  daily_budget_cents: number | null
  lifetime_budget_cents: number | null
  start_time: string | null
  end_time: string | null
  proposed_by: string | null
  created_at: string
  meta_ad_account_id: string
  currency: string
}

export interface AdInsight {
  id: string
  organization_id: string
  scope_type: 'campaign' | 'adset' | 'ad' | 'account'
  scope_id: string
  meta_object_id: string
  period_start: string
  spend_cents: number
  impressions: number
  reach: number
  clicks: number
  ctr: number | null
  cpc_cents: number | null
  cpm_cents: number | null
  frequency: number | null
  purchase_value_cents: number | null
  roas: number | null
}

// ============== Ad Accounts ==============

export async function listAdAccounts(orgId: string, userId: string): Promise<{ accounts: AdAccount[] }> {
  const res = await fetch(`${API_URL}/api/ads/accounts?org_id=${encodeURIComponent(orgId)}`, {
    headers: headers(userId),
  })
  return jsonOrThrow(res)
}

export async function listBusinessAdAccounts(
  userId: string,
): Promise<{ accounts: Array<{ id: string; name?: string; currency?: string }> }> {
  const res = await fetch(`${API_URL}/api/ads/accounts/business`, { headers: headers(userId) })
  return jsonOrThrow(res)
}

export async function registerAdAccount(
  body: { organizationId: string; metaAdAccountId: string },
  userId: string,
): Promise<{ account: AdAccount; warnings: string[] }> {
  const res = await fetch(`${API_URL}/api/ads/accounts`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify(body),
  })
  return jsonOrThrow(res)
}

export async function checkFunding(accountId: string, userId: string): Promise<FundingStatus> {
  const res = await fetch(`${API_URL}/api/ads/accounts/${accountId}/funding`, {
    headers: headers(userId),
  })
  return jsonOrThrow(res)
}

// ============== Pages ==============

export async function listPages(userId: string): Promise<{ pages: BusinessPage[] }> {
  const res = await fetch(`${API_URL}/api/ads/pages`, { headers: headers(userId) })
  return jsonOrThrow(res)
}

// ============== Campaigns ==============

export interface DraftCampaignInput {
  organizationId: string
  adAccountId: string
  createdBy: string
  name: string
  objective: AdObjective
  dailyBudgetCents?: number
  lifetimeBudgetCents?: number
  startTime?: string
  endTime?: string
  specialAdCategories?: string[]
  adSet: {
    name: string
    optimizationGoal?: string
    billingEvent?: string
    targeting: Record<string, unknown>
    dailyBudgetCents?: number
    lifetimeBudgetCents?: number
    startTime?: string
    endTime?: string
  }
  creative: {
    name: string
    pageId: string
    instagramActorId?: string
    message?: string
    headline?: string
    linkUrl: string
    callToActionType?: string
    mediaAssetId?: string
    mediaUrl?: string
  }
}

export async function listCampaigns(
  orgId: string,
  userId: string,
  status?: AdCampaignStatus,
): Promise<{ campaigns: AdCampaign[] }> {
  const qs = new URLSearchParams({ org_id: orgId })
  if (status) qs.set('status', status)
  const res = await fetch(`${API_URL}/api/ads/campaigns?${qs}`, { headers: headers(userId) })
  return jsonOrThrow(res)
}

export async function createDraft(
  input: DraftCampaignInput,
  userId: string,
): Promise<{ campaign: AdCampaign; adSet: unknown; creative: unknown }> {
  const res = await fetch(`${API_URL}/api/ads/campaigns/draft`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify(input),
  })
  return jsonOrThrow(res)
}

export async function submitForApproval(id: string, userId: string): Promise<{ campaign: AdCampaign }> {
  const res = await fetch(`${API_URL}/api/ads/campaigns/${id}/submit`, {
    method: 'POST',
    headers: headers(userId),
  })
  return jsonOrThrow(res)
}

export async function deleteCampaign(id: string, userId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_URL}/api/ads/campaigns/${id}`, {
    method: 'DELETE',
    headers: headers(userId),
  })
  return jsonOrThrow(res)
}

// ============== Admin ==============

export async function listPending(userId: string): Promise<{ pending: PendingCampaign[] }> {
  const res = await fetch(`${API_URL}/api/admin/ads/pending`, { headers: headers(userId) })
  return jsonOrThrow(res)
}

export async function approveCampaign(
  id: string,
  userId: string,
): Promise<{
  success: boolean
  meta: { campaignId: string; adSetId: string; creativeId: string; adId: string }
}> {
  const res = await fetch(`${API_URL}/api/admin/ads/campaigns/${id}/approve`, {
    method: 'POST',
    headers: headers(userId),
  })
  return jsonOrThrow(res)
}

export async function launchCampaign(id: string, userId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_URL}/api/admin/ads/campaigns/${id}/launch`, {
    method: 'POST',
    headers: headers(userId),
  })
  return jsonOrThrow(res)
}

export async function pauseCampaign(id: string, userId: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_URL}/api/admin/ads/campaigns/${id}/pause`, {
    method: 'POST',
    headers: headers(userId),
  })
  return jsonOrThrow(res)
}

export async function rejectCampaign(
  id: string,
  reason: string,
  userId: string,
): Promise<{ campaign: AdCampaign }> {
  const res = await fetch(`${API_URL}/api/admin/ads/campaigns/${id}/reject`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify({ reason }),
  })
  return jsonOrThrow(res)
}

// ============== Insights ==============

export async function listInsights(
  orgId: string,
  userId: string,
  opts?: { scope?: 'campaign' | 'adset' | 'ad' | 'account'; datePreset?: string },
): Promise<{ insights: AdInsight[]; source: 'cached' | 'live' }> {
  const qs = new URLSearchParams({ org_id: orgId })
  if (opts?.scope) qs.set('scope', opts.scope)
  if (opts?.datePreset) qs.set('date_preset', opts.datePreset)
  const res = await fetch(`${API_URL}/api/ads/insights?${qs}`, { headers: headers(userId) })
  return jsonOrThrow(res)
}

// ============== Helpers de formato ==============

export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${(value * 100).toFixed(2)}%`
}

export function statusLabel(status: AdCampaignStatus): { label: string; color: string } {
  const map: Record<AdCampaignStatus, { label: string; color: string }> = {
    draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700' },
    pending_approval: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
    approved: { label: 'Aprobada', color: 'bg-blue-100 text-blue-800' },
    active: { label: 'Activa', color: 'bg-green-100 text-green-800' },
    paused: { label: 'Pausada', color: 'bg-orange-100 text-orange-800' },
    rejected: { label: 'Rechazada', color: 'bg-red-100 text-red-800' },
    archived: { label: 'Archivada', color: 'bg-gray-200 text-gray-600' },
  }
  return map[status]
}

export function objectiveLabel(obj: AdObjective): string {
  return {
    OUTCOME_TRAFFIC: 'Tráfico',
    OUTCOME_AWARENESS: 'Reconocimiento',
    OUTCOME_ENGAGEMENT: 'Interacción',
    OUTCOME_LEADS: 'Leads',
    OUTCOME_SALES: 'Ventas',
    OUTCOME_APP_PROMOTION: 'Promoción de App',
  }[obj]
}
