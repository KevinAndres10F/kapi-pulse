/**
 * Fal.ai provider — queue-based async API.
 * Submit returns a request_id; status & result are polled separately so the
 * BullMQ worker can yield while the upstream model is generating.
 */

const FAL_API_URL = process.env.FAL_API_URL || 'https://queue.fal.run'
const FAL_KEY = process.env.FAL_KEY

function authHeaders(): Record<string, string> {
  if (!FAL_KEY) throw new Error('FAL_KEY is not configured')
  return {
    Authorization: `Key ${FAL_KEY}`,
    'Content-Type': 'application/json',
  }
}

export type FalImageModel = 'fal-ai/flux/schnell' | 'fal-ai/flux/dev' | 'fal-ai/flux-pro/v1.1'
export type FalVideoModel = 'fal-ai/kling-video/v2' | 'fal-ai/luma-dream-machine'

export interface FalSubmitResponse {
  requestId: string
  statusUrl: string
  responseUrl: string
}

export interface FalImageResultRow {
  url: string
  width: number
  height: number
  content_type?: string
}

export interface FalImageResult {
  images: FalImageResultRow[]
  seed: number
  requestId: string
}

export interface FalVideoResult {
  videoUrl: string
  durationSeconds: number
  width?: number
  height?: number
  requestId: string
}

export interface FalImageInput {
  prompt: string
  negative_prompt?: string
  image_size?: 'square_hd' | 'portrait_16_9' | 'landscape_16_9' | 'portrait_4_3' | 'landscape_4_3' | 'square'
  num_images?: number
  seed?: number
  guidance_scale?: number
  num_inference_steps?: number
}

export interface FalVideoInput {
  prompt: string
  image_url?: string
  duration?: 5 | 10
  aspect_ratio?: '16:9' | '9:16' | '1:1'
  negative_prompt?: string
}

export async function falSubmit(model: string, input: object): Promise<FalSubmitResponse> {
  const res = await fetch(`${FAL_API_URL}/${model}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const code =
      res.status === 429 ? 'RATE_LIMITED' :
      res.status >= 500 ? 'UPSTREAM_ERROR' :
      'INVALID_INPUT'
    throw Object.assign(new Error(`Fal submit failed (${res.status}): ${text}`), { code, status: res.status })
  }

  const data = (await res.json()) as { request_id: string; status_url: string; response_url: string }
  return {
    requestId: data.request_id,
    statusUrl: data.status_url,
    responseUrl: data.response_url,
  }
}

export type FalPollStatus = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export interface FalPollResult {
  status: FalPollStatus
  queuePosition?: number
  logs?: Array<{ message: string; timestamp: string }>
  error?: string
}

export async function falPoll(statusUrl: string): Promise<FalPollResult> {
  const res = await fetch(statusUrl, { headers: authHeaders() })
  if (!res.ok) {
    throw Object.assign(new Error(`Fal poll failed: ${res.status}`), { code: 'UPSTREAM_ERROR', status: res.status })
  }
  const data = (await res.json()) as Record<string, unknown>
  return {
    status: data.status as FalPollStatus,
    queuePosition: data.queue_position as number | undefined,
    logs: data.logs as FalPollResult['logs'],
    error: data.error as string | undefined,
  }
}

export async function falFetchResult<T = unknown>(responseUrl: string): Promise<T> {
  const res = await fetch(responseUrl, { headers: authHeaders() })
  if (!res.ok) {
    throw Object.assign(new Error(`Fal result fetch failed: ${res.status}`), { code: 'UPSTREAM_ERROR', status: res.status })
  }
  return (await res.json()) as T
}

/**
 * High-level: submit + poll + fetch result. Blocks until terminal status.
 * Used by the worker (which is OK to block) — do NOT call from HTTP handlers.
 */
export async function falRun<T = unknown>(
  model: string,
  input: object,
  opts: { pollIntervalMs?: number; maxWaitMs?: number } = {},
): Promise<{ requestId: string; result: T }> {
  const pollInterval = opts.pollIntervalMs ?? (Number(process.env.STUDIO_VIDEO_POLL_INTERVAL_MS) || 5000)
  const maxWait = opts.maxWaitMs ?? (Number(process.env.STUDIO_VIDEO_MAX_POLL_MINUTES) || 8) * 60_000

  const { requestId, statusUrl, responseUrl } = await falSubmit(model, input)
  const started = Date.now()

  while (true) {
    if (Date.now() - started > maxWait) {
      throw Object.assign(new Error('Fal job timed out'), { code: 'TIMEOUT' })
    }
    const poll = await falPoll(statusUrl)
    if (poll.status === 'COMPLETED') {
      const result = await falFetchResult<T>(responseUrl)
      return { requestId, result }
    }
    if (poll.status === 'FAILED' || poll.status === 'CANCELLED') {
      throw Object.assign(new Error(`Fal job ${poll.status.toLowerCase()}: ${poll.error || 'unknown'}`), { code: 'UPSTREAM_ERROR' })
    }
    await new Promise((r) => setTimeout(r, pollInterval))
  }
}

export async function falGenerateImage(input: FalImageInput, model: FalImageModel = (process.env.FAL_DEFAULT_IMAGE_MODEL as FalImageModel) || 'fal-ai/flux/dev'): Promise<FalImageResult> {
  const { requestId, result } = await falRun<{ images: FalImageResultRow[]; seed?: number }>(model, input, {
    pollIntervalMs: 2000,
    maxWaitMs: 3 * 60_000,
  })
  return {
    images: result.images || [],
    seed: result.seed ?? 0,
    requestId,
  }
}

export async function falGenerateVideo(input: FalVideoInput, model: FalVideoModel = (process.env.FAL_DEFAULT_VIDEO_MODEL as FalVideoModel) || 'fal-ai/kling-video/v2'): Promise<FalVideoResult> {
  const { requestId, result } = await falRun<{ video?: { url: string; width?: number; height?: number; duration?: number }; video_url?: string; duration?: number }>(model, input)

  const video = result.video
  const url = video?.url || result.video_url
  if (!url) throw new Error('Fal video result missing video.url')

  return {
    videoUrl: url,
    durationSeconds: video?.duration ?? result.duration ?? input.duration ?? 5,
    width: video?.width,
    height: video?.height,
    requestId,
  }
}
