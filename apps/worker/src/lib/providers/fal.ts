const FAL_API_URL = process.env.FAL_API_URL || 'https://queue.fal.run'
const FAL_KEY = process.env.FAL_KEY

function authHeaders(): Record<string, string> {
  if (!FAL_KEY) throw new Error('FAL_KEY is not configured')
  return {
    Authorization: `Key ${FAL_KEY}`,
    'Content-Type': 'application/json',
  }
}

export type FalPollStatus = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface FalImageResultRow {
  url: string
  width: number
  height: number
  content_type?: string
}

export async function falRun<T = unknown>(
  model: string,
  input: object,
  opts: { pollIntervalMs?: number; maxWaitMs?: number } = {},
): Promise<{ requestId: string; result: T }> {
  const pollInterval = opts.pollIntervalMs ?? (Number(process.env.STUDIO_VIDEO_POLL_INTERVAL_MS) || 5000)
  const maxWait = opts.maxWaitMs ?? (Number(process.env.STUDIO_VIDEO_MAX_POLL_MINUTES) || 8) * 60_000

  // Submit
  const submitRes = await fetch(`${FAL_API_URL}/${model}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  })
  if (!submitRes.ok) {
    const text = await submitRes.text().catch(() => '')
    throw new Error(`Fal submit failed (${submitRes.status}): ${text}`)
  }
  const submit = (await submitRes.json()) as { request_id: string; status_url: string; response_url: string }

  const started = Date.now()
  while (true) {
    if (Date.now() - started > maxWait) throw new Error('Fal job timed out')

    const pollRes = await fetch(submit.status_url, { headers: authHeaders() })
    if (!pollRes.ok) throw new Error(`Fal poll failed: ${pollRes.status}`)
    const poll = (await pollRes.json()) as { status: FalPollStatus; error?: string }

    if (poll.status === 'COMPLETED') {
      const r = await fetch(submit.response_url, { headers: authHeaders() })
      if (!r.ok) throw new Error(`Fal result fetch failed: ${r.status}`)
      return { requestId: submit.request_id, result: (await r.json()) as T }
    }
    if (poll.status === 'FAILED' || poll.status === 'CANCELLED') {
      throw new Error(`Fal job ${poll.status.toLowerCase()}: ${poll.error || 'unknown'}`)
    }
    await new Promise((r) => setTimeout(r, pollInterval))
  }
}

export async function falGenerateImage(input: {
  prompt: string
  negative_prompt?: string
  image_size?: string
  num_images?: number
  seed?: number
}, model?: string): Promise<{ images: FalImageResultRow[]; seed: number; requestId: string }> {
  const m = model || process.env.FAL_DEFAULT_IMAGE_MODEL || 'fal-ai/flux/dev'
  const { requestId, result } = await falRun<{ images: FalImageResultRow[]; seed?: number }>(m, input, {
    pollIntervalMs: 2000,
    maxWaitMs: 3 * 60_000,
  })
  return { images: result.images || [], seed: result.seed ?? 0, requestId }
}

export async function falGenerateVideo(input: {
  prompt: string
  image_url?: string
  duration?: 5 | 10
  aspect_ratio?: '16:9' | '9:16' | '1:1'
  negative_prompt?: string
}, model?: string): Promise<{ videoUrl: string; durationSeconds: number; width?: number; height?: number; requestId: string }> {
  const m = model || process.env.FAL_DEFAULT_VIDEO_MODEL || 'fal-ai/kling-video/v2'
  const { requestId, result } = await falRun<{
    video?: { url: string; width?: number; height?: number; duration?: number }
    video_url?: string
    duration?: number
  }>(m, input)

  const url = result.video?.url || result.video_url
  if (!url) throw new Error('Fal video result missing video.url')

  return {
    videoUrl: url,
    durationSeconds: result.video?.duration ?? result.duration ?? input.duration ?? 5,
    width: result.video?.width,
    height: result.video?.height,
    requestId,
  }
}
