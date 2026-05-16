const REPLICATE_API_URL = 'https://api.replicate.com/v1'
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN
const REPLICATE_SDXL_VERSION =
  process.env.REPLICATE_SDXL_VERSION ||
  '7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc'

function authHeaders() {
  if (!REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN is not configured')
  return {
    Authorization: `Token ${REPLICATE_API_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

interface Prediction {
  id: string
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
  output?: string | string[]
  error?: string | null
}

export async function replicateGenerateImageSdxl(input: {
  prompt: string
  negative_prompt?: string
  width?: number
  height?: number
  num_outputs?: number
  seed?: number
}): Promise<{ urls: string[]; predictionId: string }> {
  const create = await fetch(`${REPLICATE_API_URL}/predictions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      version: REPLICATE_SDXL_VERSION,
      input: {
        prompt: input.prompt,
        negative_prompt: input.negative_prompt,
        width: input.width ?? 1024,
        height: input.height ?? 1024,
        num_outputs: input.num_outputs ?? 1,
        seed: input.seed,
      },
    }),
  })
  if (!create.ok) throw new Error(`Replicate create failed: ${create.status}`)
  let current = (await create.json()) as Prediction

  const started = Date.now()
  while (current.status === 'starting' || current.status === 'processing') {
    if (Date.now() - started > 5 * 60_000) throw new Error('Replicate timed out')
    await new Promise((r) => setTimeout(r, 2000))
    const poll = await fetch(`${REPLICATE_API_URL}/predictions/${current.id}`, { headers: authHeaders() })
    if (!poll.ok) throw new Error(`Replicate poll failed: ${poll.status}`)
    current = (await poll.json()) as Prediction
  }

  if (current.status !== 'succeeded') {
    throw new Error(`Replicate ${current.status}: ${current.error || 'unknown'}`)
  }

  const output = current.output
  const urls = Array.isArray(output) ? output : output ? [output] : []
  return { urls, predictionId: current.id }
}
