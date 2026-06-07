/**
 * Banana.dev API Provider for Image Generation
 * Supports image generation with character reference and brand styling
 */

export interface BananaImageGenerationInput {
  prompt: string
  negative_prompt?: string
  width?: number
  height?: number
  num_outputs?: number
  num_inference_steps?: number
  guidance_scale?: number
  seed?: number
  model?: 'flux-pro' | 'flux-dev' | 'flux-schnell' | 'sdxl' // Supported models on Banana
}

export interface BananaImageResult {
  images: Array<{
    url: string
    width: number
    height: number
  }>
  seed: number
  requestId: string
}

const BANANA_API_KEY = process.env.BANANA_API_KEY
const BANANA_ENDPOINT = process.env.BANANA_ENDPOINT || 'https://api.banana.dev/start/v4/'

if (!BANANA_API_KEY) {
  console.warn('BANANA_API_KEY not configured - image generation via Banana will fail')
}

/**
 * Generate images using Banana API
 * Supports multiple models and styles
 */
export async function bananaGenerateImage(input: BananaImageGenerationInput): Promise<BananaImageResult> {
  if (!BANANA_API_KEY) {
    throw new Error('BANANA_API_KEY not configured')
  }

  const {
    prompt,
    negative_prompt = '',
    width = 1024,
    height = 1024,
    num_outputs = 1,
    num_inference_steps = 20,
    guidance_scale = 7.5,
    seed = Math.floor(Math.random() * 2147483647),
    model = 'flux-pro',
  } = input

  // Banana expects a model key - map our model names to their keys
  const modelKeyMap: Record<string, string> = {
    'flux-pro': 'e261d61f-7bcc-4122-8fea-abdce3b10d68',
    'flux-dev': 'c13ff1c3-38c7-4dd8-b4b5-e7342e09d63f',
    'flux-schnell': '6b90b125-9389-489d-8009-e65ec477619f',
    'sdxl': '62fd3a2e-9f63-4f5e-b732-6569601f4f0a',
  }

  const modelKey = modelKeyMap[model] || modelKeyMap['flux-pro']

  const payload = {
    model_key: modelKey,
    prompt,
    negative_prompt,
    width,
    height,
    num_outputs,
    num_inference_steps,
    guidance_scale,
    seed,
  }

  try {
    const response = await fetch(BANANA_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': BANANA_API_KEY,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(300000), // 5 min timeout
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Banana API error (${response.status}): ${error}`)
    }

    const data = (await response.json()) as {
      modelOutputs: Array<{ image_url?: string; images?: string[] }>
      callID: string
    }

    // Extract image URLs from response
    const images: Array<{ url: string; width: number; height: number }> = []

    if (data.modelOutputs?.[0]?.image_url) {
      images.push({
        url: data.modelOutputs[0].image_url,
        width,
        height,
      })
    } else if (data.modelOutputs?.[0]?.images) {
      for (const imgUrl of data.modelOutputs[0].images) {
        images.push({
          url: imgUrl,
          width,
          height,
        })
      }
    }

    if (images.length === 0) {
      throw new Error('No images returned from Banana API')
    }

    return {
      images,
      seed,
      requestId: data.callID || `banana-${Date.now()}`,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Banana image generation request timed out')
    }
    throw error
  }
}

/**
 * Generate carousel (multiple related images)
 * Creates variations of the same scene for carousel posts
 */
export async function bananaGenerateCarousel(input: {
  prompt: string
  numImages: number
  width?: number
  height?: number
  baseSeed?: number
  model?: 'flux-pro' | 'flux-dev' | 'flux-schnell'
}): Promise<BananaImageResult> {
  const { prompt, numImages, baseSeed = Math.floor(Math.random() * 2147483647) } = input

  const images: Array<{ url: string; width: number; height: number }> = []

  // Generate multiple images with sequential seeds for variation
  for (let i = 0; i < numImages; i++) {
    try {
      const result = await bananaGenerateImage({
        prompt,
        width: input.width,
        height: input.height,
        num_outputs: 1,
        seed: baseSeed + i,
        model: input.model,
      })
      images.push(...result.images)
    } catch (error) {
      console.error(`Error generating carousel image ${i + 1}:`, error)
      // Continue with next image instead of failing completely
    }
  }

  if (images.length === 0) {
    throw new Error('Failed to generate any carousel images')
  }

  return {
    images,
    seed: baseSeed,
    requestId: `banana-carousel-${Date.now()}`,
  }
}
