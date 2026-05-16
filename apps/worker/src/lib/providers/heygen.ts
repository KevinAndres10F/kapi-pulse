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
}

export async function heygenRun(req: HeygenAvatarRequest): Promise<{ videoId: string; videoUrl: string; thumbnailUrl?: string; duration?: number }> {
  const body = {
    video_inputs: [
      {
        character: { type: 'avatar', avatar_id: req.avatarId, avatar_style: 'normal' },
        voice: { type: 'text', voice_id: req.voiceId, input_text: req.script },
        background: req.background
          ? {
              type: req.background.type,
              [req.background.type === 'color' ? 'value' : 'url']: req.background.value,
            }
          : { type: 'color', value: '#FFFFFF' },
      },
    ],
    dimension: req.dimension || { width: 1080, height: 1920 },
  }

  const submit = await fetch(`${HEYGEN_API_URL}/v2/video/generate`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  if (!submit.ok) {
    const text = await submit.text().catch(() => '')
    throw new Error(`HeyGen submit failed (${submit.status}): ${text}`)
  }
  const submitData = (await submit.json()) as { data?: { video_id: string } }
  const videoId = submitData.data?.video_id
  if (!videoId) throw new Error('HeyGen response missing video_id')

  const started = Date.now()
  const maxWait = 10 * 60_000
  while (true) {
    if (Date.now() - started > maxWait) throw new Error('HeyGen job timed out')
    await new Promise((r) => setTimeout(r, 5000))

    const poll = await fetch(`${HEYGEN_API_URL}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`, {
      headers: authHeaders(),
    })
    if (!poll.ok) throw new Error(`HeyGen status failed: ${poll.status}`)
    const pollData = (await poll.json()) as {
      data?: {
        status: 'pending' | 'processing' | 'completed' | 'failed' | 'waiting'
        video_url?: string
        thumbnail_url?: string
        duration?: number
        error?: { message?: string }
      }
    }
    const d = pollData.data
    if (!d) throw new Error('HeyGen status response missing data')

    if (d.status === 'completed' && d.video_url) {
      return { videoId, videoUrl: d.video_url, thumbnailUrl: d.thumbnail_url, duration: d.duration }
    }
    if (d.status === 'failed') {
      throw new Error(`HeyGen failed: ${d.error?.message || 'unknown'}`)
    }
  }
}
