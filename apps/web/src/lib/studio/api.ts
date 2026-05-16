/**
 * Studio API client — wrappers tipados sobre /api/studio/*.
 * El API_URL apunta al backend Hono que orquesta IA + créditos + storage.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok) {
    const err = data as { error?: string; message?: string; balance?: number; required?: number }
    if (res.status === 402) {
      const e = new Error(err.error || 'insufficient_credits') as Error & { code: string; balance?: number; required?: number }
      e.code = 'INSUFFICIENT_CREDITS'
      e.balance = err.balance
      e.required = err.required
      throw e
    }
    throw new Error(err.message || err.error || `HTTP ${res.status}`)
  }
  return data as T
}

function authHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
  return headers
}

// ============== Credits ==============
export interface CreditBalance {
  balance: number
  totalGranted: number
  totalConsumed: number
  plan: { code: string; name: string; monthly_credits: number } | null
}

export async function fetchBalance(orgId: string, accessToken?: string): Promise<CreditBalance> {
  const res = await fetch(`${API_URL}/api/credits/balance?org_id=${encodeURIComponent(orgId)}`, {
    headers: authHeaders(accessToken),
    credentials: 'include',
  })
  return jsonOrThrow<CreditBalance>(res)
}

export async function fetchHistory(orgId: string, limit = 50, accessToken?: string) {
  const res = await fetch(
    `${API_URL}/api/credits/history?org_id=${encodeURIComponent(orgId)}&limit=${limit}`,
    { headers: authHeaders(accessToken), credentials: 'include' },
  )
  return jsonOrThrow<{ transactions: Array<{ id: string; type: string; amount: number; balance_after: number; reason: string; created_at: string }> }>(res)
}

export async function fetchPricing(accessToken?: string) {
  const res = await fetch(`${API_URL}/api/credits/pricing`, {
    headers: authHeaders(accessToken),
    credentials: 'include',
  })
  return jsonOrThrow<{ pricing: Array<{ operation: string; model: string; credits_per_unit: number; notes?: string }> }>(res)
}

// ============== Generation ==============
export interface DispatchResult {
  jobId: string
  status: 'reserved'
  creditsCharged: number
  balanceAfter: number
}

export async function dispatchImageGen(orgId: string, body: {
  prompt: string
  numImages?: number
  imageSize?: 'square_hd' | 'portrait_16_9' | 'landscape_16_9' | 'portrait_4_3' | 'landscape_4_3'
  model?: 'fal-ai/flux/schnell' | 'fal-ai/flux/dev' | 'fal-ai/flux-pro/v1.1'
  negativePrompt?: string
  seed?: number
  campaignId?: string
  stepId?: string
}, accessToken?: string): Promise<DispatchResult> {
  const res = await fetch(`${API_URL}/api/studio/generate/image`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ orgId, ...body }),
    credentials: 'include',
  })
  return jsonOrThrow<DispatchResult>(res)
}

export async function dispatchVideoGen(orgId: string, body: {
  prompt: string
  sourceAssetId: string
  duration?: 5 | 10
  aspectRatio?: '16:9' | '9:16' | '1:1'
  model?: 'fal-ai/kling-video/v2' | 'fal-ai/luma-dream-machine'
  campaignId?: string
  stepId?: string
}, accessToken?: string): Promise<DispatchResult> {
  const res = await fetch(`${API_URL}/api/studio/generate/video`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ orgId, ...body }),
    credentials: 'include',
  })
  return jsonOrThrow<DispatchResult>(res)
}

export async function dispatchAvatarGen(orgId: string, body: {
  avatarId: string
  voiceId: string
  script: string
  background?: { type: 'color' | 'image'; value: string }
  provider?: 'heygen' | 'hedra'
  campaignId?: string
  stepId?: string
}, accessToken?: string): Promise<DispatchResult> {
  const res = await fetch(`${API_URL}/api/studio/generate/avatar`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ orgId, ...body }),
    credentials: 'include',
  })
  return jsonOrThrow<DispatchResult>(res)
}

export async function dispatchCopyGen(orgId: string, body: {
  brief: Record<string, unknown>
  platforms: string[]
  imageDescription?: string
  nVariants?: number
  campaignId?: string
  stepId?: string
}, accessToken?: string): Promise<DispatchResult> {
  const res = await fetch(`${API_URL}/api/studio/generate/copy`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ orgId, ...body }),
    credentials: 'include',
  })
  return jsonOrThrow<DispatchResult>(res)
}

export interface JobAsset {
  id: string
  kind: string
  storage_path: string
  width?: number
  height?: number
  duration_seconds?: number
  signed_url: string | null
}

export async function fetchJob(jobId: string, orgId: string, accessToken?: string) {
  const res = await fetch(`${API_URL}/api/studio/generate/jobs/${jobId}?org_id=${encodeURIComponent(orgId)}`, {
    headers: authHeaders(accessToken),
    credentials: 'include',
  })
  return jsonOrThrow<{ job: { id: string; status: string; error?: string }; assets: JobAsset[] }>(res)
}

export type JobSseEvent =
  | { event: 'status'; status: string; error?: string }
  | { event: 'completed'; assets: JobAsset[] }
  | { event: 'failed'; error?: string }
  | { event: 'error'; message: string }

export function subscribeJob(jobId: string, orgId: string, onEvent: (ev: JobSseEvent) => void): EventSource {
  const url = `${API_URL}/api/studio/generate/jobs/${jobId}/stream?org_id=${encodeURIComponent(orgId)}`
  const es = new EventSource(url, { withCredentials: true })
  ;(['status', 'completed', 'failed', 'error'] as const).forEach((name) => {
    es.addEventListener(name, (msg) => {
      try {
        const data = JSON.parse((msg as MessageEvent).data)
        onEvent({ event: name, ...data })
      } catch (err) {
        console.warn('[sse] parse error:', err)
      }
    })
  })
  return es
}

// ============== Campaigns ==============
export interface CampaignBrief {
  product: string
  audience?: string
  tone?: string
  format?: 'single' | 'carousel' | 'reel' | 'story'
  notes?: string
  referenceAssetIds?: string[]
}

export async function createCampaign(orgId: string, name: string, brief: CampaignBrief, accessToken?: string) {
  const res = await fetch(`${API_URL}/api/studio/campaigns?org_id=${encodeURIComponent(orgId)}`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ orgId, name, brief }),
    credentials: 'include',
  })
  return jsonOrThrow<{ campaign: { id: string; name: string; status: string; brief: CampaignBrief } }>(res)
}

export async function listCampaigns(orgId: string, accessToken?: string) {
  const res = await fetch(`${API_URL}/api/studio/campaigns?org_id=${encodeURIComponent(orgId)}`, {
    headers: authHeaders(accessToken),
    credentials: 'include',
  })
  return jsonOrThrow<{ campaigns: Array<{ id: string; name: string; status: string; total_credits_spent: number; created_at: string }> }>(res)
}

export async function fetchCampaign(orgId: string, id: string, accessToken?: string) {
  const res = await fetch(`${API_URL}/api/studio/campaigns/${id}?org_id=${encodeURIComponent(orgId)}`, {
    headers: authHeaders(accessToken),
    credentials: 'include',
  })
  return jsonOrThrow<{
    campaign: { id: string; name: string; status: string; brief: CampaignBrief }
    steps: Array<{ id: string; step_number: number; step_type: string; state: string; selected_asset_ids: string[]; config: Record<string, unknown>; result: Record<string, unknown> }>
    assets: JobAsset[]
  }>(res)
}

export async function patchCampaign(orgId: string, id: string, body: {
  name?: string
  status?: string
  coverAssetId?: string | null
  step?: { stepNumber: number; update: { state?: string; selectedAssetIds?: string[]; config?: Record<string, unknown>; result?: Record<string, unknown> } }
}, accessToken?: string) {
  const res = await fetch(`${API_URL}/api/studio/campaigns/${id}?org_id=${encodeURIComponent(orgId)}`, {
    method: 'PATCH',
    headers: authHeaders(accessToken),
    body: JSON.stringify(body),
    credentials: 'include',
  })
  return jsonOrThrow<{ success: boolean }>(res)
}

export async function publishCampaign(orgId: string, id: string, body: {
  scheduledAt?: string
  targets: Array<{ socialAccountId: string; content: string; hashtags?: string[]; assetIds: string[] }>
}, accessToken?: string) {
  const res = await fetch(`${API_URL}/api/studio/campaigns/${id}/publish?org_id=${encodeURIComponent(orgId)}`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ orgId, ...body }),
    credentials: 'include',
  })
  return jsonOrThrow<{ postId: string; status: string }>(res)
}

export async function packageCampaign(orgId: string, id: string, accessToken?: string) {
  const res = await fetch(`${API_URL}/api/studio/campaigns/${id}/package?org_id=${encodeURIComponent(orgId)}`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    credentials: 'include',
  })
  return jsonOrThrow<{ jobId: string; status: string }>(res)
}

// ============== Assets ==============
export async function listAssets(orgId: string, kind?: string, accessToken?: string) {
  const q = new URLSearchParams({ org_id: orgId })
  if (kind) q.set('kind', kind)
  const res = await fetch(`${API_URL}/api/assets?${q.toString()}`, {
    headers: authHeaders(accessToken),
    credentials: 'include',
  })
  return jsonOrThrow<{ assets: JobAsset[] }>(res)
}

export async function requestUploadUrl(orgId: string, ext: string, kind?: string, accessToken?: string) {
  const res = await fetch(`${API_URL}/api/assets/upload-url?org_id=${encodeURIComponent(orgId)}`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ orgId, ext, kind }),
    credentials: 'include',
  })
  return jsonOrThrow<{ assetId: string; uploadUrl: string; token: string; storagePath: string; bucket: string }>(res)
}

// ============== Avatars ==============
export async function listAvatars(orgId: string, accessToken?: string) {
  const res = await fetch(`${API_URL}/api/studio/generate/avatars?org_id=${encodeURIComponent(orgId)}`, {
    headers: authHeaders(accessToken),
    credentials: 'include',
  })
  return jsonOrThrow<{ avatars: Array<{ id: string; name: string; previewUrl: string; gender?: string }> }>(res)
}

export async function listVoices(orgId: string, language?: string, accessToken?: string) {
  const q = new URLSearchParams({ org_id: orgId })
  if (language) q.set('language', language)
  const res = await fetch(`${API_URL}/api/studio/generate/voices?${q.toString()}`, {
    headers: authHeaders(accessToken),
    credentials: 'include',
  })
  return jsonOrThrow<{ voices: Array<{ id: string; name: string; language: string; previewUrl?: string; gender?: string }> }>(res)
}

// ============== Social accounts (for publish target picker) ==============
export async function listSocialAccounts(orgId: string, accessToken?: string) {
  const res = await fetch(`${API_URL}/api/social-accounts?org_id=${encodeURIComponent(orgId)}`, {
    headers: authHeaders(accessToken),
    credentials: 'include',
  })
  return jsonOrThrow<{ accounts: Array<{ id: string; provider: string; display_name: string; avatar_url: string | null; status: string }> }>(res)
}
