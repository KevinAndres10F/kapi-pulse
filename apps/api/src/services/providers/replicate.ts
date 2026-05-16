/**
 * Replicate.com provider — fallback for image generation when Fal is rate
 * limited or returns 5xx. Uses the predictions queue API.
 */

const REPLICATE_API_URL = 'https://api.replicate.com/v1'
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN

function authHeaders(): Record<string, string> {
  if (!REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN is not configured')
  return {
    Authorization: `Token ${REPLICATE_API_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

export interface ReplicatePrediction {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  output?: string | string[]
  error?: string | null
  urls?: { get: string; cancel: string }
}

export async function replicateCreatePrediction(input: {
  version: string
  input: Record<string, unknown>
}): Promise<ReplicatePrediction> {
  const res = await fetch(`${REPLICATE_API_URL}/predictions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw Object.assign(new Error(`Replicate create failed (${res.status}): ${text}`), { code: 'UPSTREAM_ERROR' })
  }
  return (await res.json()) as ReplicatePrediction
}

export async function replicateGetPrediction(id: string): Promise<ReplicatePrediction> {
  const res = await fetch(`${REPLICATE_API_URL}/predictions/${id}`, { headers: authHeaders() })
  if (!res.ok) {
    throw Object.assign(new Error(`Replicate get failed: ${res.status}`), { code: 'UPSTREAM_ERROR' })
  }
  return (await res.json()) as ReplicatePrediction
}

export async function replicateRun<T = string[]>(
  version: string,
  input: Record<string, unknown>,
  opts: { pollIntervalMs?: number; maxWaitMs?: number } = {},
): Promise<{ id: string; output: T }> {
  const pollInterval = opts.pollIntervalMs ?? 2000
  const maxWait = opts.maxWaitMs ?? 5 * 60_000

  const prediction = await replicateCreatePrediction({ version, input })
  const started = Date.now()
  let current = prediction

  while (current.status === 'starting' || current.status === 'processing') {
    if (Date.now() - started > maxWait) {
      throw Object.assign(new Error('Replicate prediction timed out'), { code: 'TIMEOUT' })
    }
    await new Promise((r) => setTimeout(r, pollInterval))
    current = await replicateGetPrediction(current.id)
  }

  if (current.status !== 'succeeded') {
    throw Object.assign(new Error(`Replicate ${current.status}: ${current.error || 'unknown'}`), { code: 'UPSTREAM_ERROR' })
  }

  return { id: current.id, output: current.output as unknown as T }
}

// SDXL version pin (Stability AI). Override via env if needed.
const REPLICATE_SDXL_VERSION =
  process.env.REPLICATE_SDXL_VERSION ||
  '7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc'

export async function replicateGenerateImageSdxl(input: {
  prompt: string
  negative_prompt?: string
  width?: number
  height?: number
  num_outputs?: number
  seed?: number
}): Promise<{ urls: string[]; predictionId: string }> {
  const { id, output } = await replicateRun<string[]>(REPLICATE_SDXL_VERSION, {
    prompt: input.prompt,
    negative_prompt: input.negative_prompt,
    width: input.width ?? 1024,
    height: input.height ?? 1024,
    num_outputs: input.num_outputs ?? 1,
    seed: input.seed,
  })
  return { urls: Array.isArray(output) ? output : [output as unknown as string], predictionId: id }
}
