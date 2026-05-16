/**
 * Hedra provider — alt avatar generation. Used when HeyGen unavailable
 * (STUDIO_AVATAR_PROVIDER=hedra or HEYGEN_API_KEY missing).
 */

const HEDRA_API_URL = process.env.HEDRA_API_URL || 'https://mercury.dev.dream-ai.com/api/v1'
const HEDRA_API_KEY = process.env.HEDRA_API_KEY

function authHeaders(): Record<string, string> {
  if (!HEDRA_API_KEY) throw new Error('HEDRA_API_KEY is not configured')
  return {
    'X-API-Key': HEDRA_API_KEY,
    'Content-Type': 'application/json',
  }
}

export interface HedraAvatarRequest {
  characterImageUrl: string
  audioUrl?: string
  script?: string
  voiceId?: string
  aspectRatio?: '1:1' | '9:16' | '16:9'
}

export interface HedraGeneration {
  generationId: string
  status: 'queued' | 'in_progress' | 'complete' | 'error'
  videoUrl?: string
  error?: string
}

export async function hedraSubmit(req: HedraAvatarRequest): Promise<{ generationId: string }> {
  const body = {
    text: req.script,
    voiceId: req.voiceId,
    voiceUrl: req.audioUrl,
    avatarImage: req.characterImageUrl,
    aspectRatio: req.aspectRatio || '9:16',
  }

  const res = await fetch(`${HEDRA_API_URL}/characters`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw Object.assign(new Error(`Hedra submit failed (${res.status}): ${text}`), { code: 'UPSTREAM_ERROR', status: res.status })
  }

  const data = (await res.json()) as { jobId?: string; generationId?: string }
  const id = data.generationId || data.jobId
  if (!id) throw new Error('Hedra response missing generation id')
  return { generationId: id }
}

export async function hedraPoll(generationId: string): Promise<HedraGeneration> {
  const res = await fetch(`${HEDRA_API_URL}/projects/${generationId}`, { headers: authHeaders() })
  if (!res.ok) {
    throw Object.assign(new Error(`Hedra status failed: ${res.status}`), { code: 'UPSTREAM_ERROR' })
  }
  const data = (await res.json()) as { status: string; videoUrl?: string; errorMessage?: string }
  const status: HedraGeneration['status'] =
    data.status === 'Completed' || data.status === 'complete' ? 'complete' :
    data.status === 'InProgress' || data.status === 'in_progress' ? 'in_progress' :
    data.status === 'Error' || data.status === 'error' ? 'error' : 'queued'
  return { generationId, status, videoUrl: data.videoUrl, error: data.errorMessage }
}

export async function hedraRun(req: HedraAvatarRequest, opts: { pollIntervalMs?: number; maxWaitMs?: number } = {}): Promise<HedraGeneration> {
  const pollInterval = opts.pollIntervalMs ?? 5000
  const maxWait = opts.maxWaitMs ?? 10 * 60_000

  const { generationId } = await hedraSubmit(req)
  const started = Date.now()
  while (true) {
    if (Date.now() - started > maxWait) {
      throw Object.assign(new Error('Hedra job timed out'), { code: 'TIMEOUT' })
    }
    const status = await hedraPoll(generationId)
    if (status.status === 'complete' && status.videoUrl) return status
    if (status.status === 'error') {
      throw Object.assign(new Error(`Hedra failed: ${status.error || 'unknown'}`), { code: 'UPSTREAM_ERROR' })
    }
    await new Promise((r) => setTimeout(r, pollInterval))
  }
}
