/**
 * HeyGen provider — UGC avatar video generation.
 * Two-step: POST /video/generate returns video_id; GET /video_status.get
 * polls until completed and returns the downloadable URL.
 */

const HEYGEN_API_URL = process.env.HEYGEN_API_URL || 'https://api.heygen.com'
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY

function authHeaders(): Record<string, string> {
  if (!HEYGEN_API_KEY) throw new Error('HEYGEN_API_KEY is not configured')
  return {
    'X-Api-Key': HEYGEN_API_KEY,
    'Content-Type': 'application/json',
  }
}

export interface HeygenAvatarRequest {
  avatarId: string
  voiceId: string
  script: string
  background?: { type: 'color' | 'image'; value: string }
  dimension?: { width: number; height: number }
  testMode?: boolean
}

export interface HeygenStatusResult {
  videoId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'waiting'
  videoUrl?: string
  thumbnailUrl?: string
  duration?: number
  error?: string
}

export async function heygenSubmit(req: HeygenAvatarRequest): Promise<{ videoId: string }> {
  const body = {
    video_inputs: [
      {
        character: {
          type: 'avatar',
          avatar_id: req.avatarId,
          avatar_style: 'normal',
        },
        voice: {
          type: 'text',
          voice_id: req.voiceId,
          input_text: req.script,
        },
        background: req.background
          ? {
              type: req.background.type,
              [req.background.type === 'color' ? 'value' : 'url']: req.background.value,
            }
          : { type: 'color', value: '#FFFFFF' },
      },
    ],
    dimension: req.dimension || { width: 1080, height: 1920 },
    test: req.testMode ?? false,
  }

  const res = await fetch(`${HEYGEN_API_URL}/v2/video/generate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw Object.assign(new Error(`HeyGen submit failed (${res.status}): ${text}`), { code: 'UPSTREAM_ERROR', status: res.status })
  }

  const data = (await res.json()) as { data?: { video_id: string } }
  if (!data.data?.video_id) throw new Error('HeyGen response missing video_id')
  return { videoId: data.data.video_id }
}

export async function heygenPoll(videoId: string): Promise<HeygenStatusResult> {
  const res = await fetch(`${HEYGEN_API_URL}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`, {
    headers: authHeaders(),
  })

  if (!res.ok) {
    throw Object.assign(new Error(`HeyGen status failed: ${res.status}`), { code: 'UPSTREAM_ERROR' })
  }

  const data = (await res.json()) as {
    data?: {
      status: HeygenStatusResult['status']
      video_url?: string
      thumbnail_url?: string
      duration?: number
      error?: { message?: string }
    }
  }

  if (!data.data) throw new Error('HeyGen status response missing data')

  return {
    videoId,
    status: data.data.status,
    videoUrl: data.data.video_url,
    thumbnailUrl: data.data.thumbnail_url,
    duration: data.data.duration,
    error: data.data.error?.message,
  }
}

export async function heygenRun(req: HeygenAvatarRequest, opts: { pollIntervalMs?: number; maxWaitMs?: number } = {}): Promise<HeygenStatusResult> {
  const pollInterval = opts.pollIntervalMs ?? 5000
  const maxWait = opts.maxWaitMs ?? 10 * 60_000

  const { videoId } = await heygenSubmit(req)
  const started = Date.now()

  while (true) {
    if (Date.now() - started > maxWait) {
      throw Object.assign(new Error('HeyGen job timed out'), { code: 'TIMEOUT' })
    }
    const status = await heygenPoll(videoId)
    if (status.status === 'completed' && status.videoUrl) return status
    if (status.status === 'failed') {
      throw Object.assign(new Error(`HeyGen failed: ${status.error || 'unknown'}`), { code: 'UPSTREAM_ERROR' })
    }
    await new Promise((r) => setTimeout(r, pollInterval))
  }
}

export interface HeygenAvatarRow {
  id: string
  name: string
  previewUrl: string
  gender?: string
}

export async function listHeygenAvatars(): Promise<HeygenAvatarRow[]> {
  const res = await fetch(`${HEYGEN_API_URL}/v2/avatars`, { headers: authHeaders() })
  if (!res.ok) {
    throw Object.assign(new Error(`HeyGen list avatars failed: ${res.status}`), { code: 'UPSTREAM_ERROR' })
  }
  const data = (await res.json()) as { data?: { avatars?: Array<{ avatar_id: string; avatar_name: string; preview_image_url: string; gender?: string }> } }
  return (data.data?.avatars || []).map((a) => ({
    id: a.avatar_id,
    name: a.avatar_name,
    previewUrl: a.preview_image_url,
    gender: a.gender,
  }))
}

export interface HeygenVoiceRow {
  id: string
  name: string
  language: string
  previewUrl?: string
  gender?: string
}

export async function listHeygenVoices(language?: string): Promise<HeygenVoiceRow[]> {
  const res = await fetch(`${HEYGEN_API_URL}/v2/voices`, { headers: authHeaders() })
  if (!res.ok) {
    throw Object.assign(new Error(`HeyGen list voices failed: ${res.status}`), { code: 'UPSTREAM_ERROR' })
  }
  const data = (await res.json()) as { data?: { voices?: Array<{ voice_id: string; name: string; language: string; preview_audio?: string; gender?: string }> } }
  const voices = (data.data?.voices || []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    language: v.language,
    previewUrl: v.preview_audio,
    gender: v.gender,
  }))
  return language ? voices.filter((v) => v.language?.toLowerCase().includes(language.toLowerCase())) : voices
}
