import { Hono } from 'hono'
import { z } from 'zod'
import { withOrgAuth } from '../../services/auth'
import { supabaseAdmin } from '../../lib/supabase'
import {
  dispatchGenerationJob,
  getJob,
  listAssetsByJob,
  type GenKind,
  type GenProvider,
} from '../../services/generation'
import { InsufficientCreditsError } from '../../services/credits'
import { getSignedDownloadUrl } from '../../services/storage'
import { listHeygenAvatars, listHeygenVoices } from '../../services/providers/heygen'

const generate = new Hono()

type StatusCode = 400 | 401 | 402 | 403 | 404 | 429 | 500 | 502 | 503

function handleDispatchError(c: import('hono').Context, err: unknown) {
  if (err instanceof InsufficientCreditsError) {
    return c.json({ error: 'insufficient_credits', balance: err.balance, required: err.required }, 402)
  }
  const status = ((err as { status?: number })?.status || 500) as StatusCode
  const code = (err as { code?: string })?.code
  const message = err instanceof Error ? err.message : String(err)
  return c.json({ error: code || 'generation_failed', message }, status)
}

// ============== Image generation ==============
const ImageSchema = z.object({
  orgId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional(),
  prompt: z.string().min(3).max(2000),
  model: z.enum(['fal-ai/flux/schnell', 'fal-ai/flux/dev', 'fal-ai/flux-pro/v1.1']).optional(),
  imageSize: z.enum(['square_hd', 'portrait_16_9', 'landscape_16_9', 'portrait_4_3', 'landscape_4_3']).optional(),
  numImages: z.number().int().min(1).max(4).optional(),
  seed: z.number().int().optional(),
  negativePrompt: z.string().max(500).optional(),
})

generate.post('/image', withOrgAuth('editor'), async (c) => {
  const body = await c.req.json()
  const parsed = ImageSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'invalid', details: parsed.error.flatten() }, 400)
  const { userId, orgId } = c.var.auth
  const data = parsed.data

  const model = data.model || (process.env.FAL_DEFAULT_IMAGE_MODEL as 'fal-ai/flux/dev') || 'fal-ai/flux/dev'
  const operation =
    model === 'fal-ai/flux/schnell' ? 'generate_image_flux_schnell' :
    model === 'fal-ai/flux-pro/v1.1' ? 'generate_image_flux_pro' :
    'generate_image_flux_dev'

  try {
    const result = await dispatchGenerationJob({
      orgId,
      userId,
      kind: 'image',
      provider: 'fal',
      model,
      operation,
      campaignId: data.campaignId,
      stepId: data.stepId,
      input: {
        prompt: data.prompt,
        negative_prompt: data.negativePrompt,
        image_size: data.imageSize || 'square_hd',
        num_images: data.numImages || 1,
        seed: data.seed,
      },
    })
    return c.json(result, 202)
  } catch (err) {
    return handleDispatchError(c, err)
  }
})

// ============== Image-to-video generation ==============
const VideoSchema = z.object({
  orgId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional(),
  sourceAssetId: z.string().uuid(),
  prompt: z.string().min(3).max(2000),
  duration: z.union([z.literal(5), z.literal(10)]).optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional(),
  model: z.enum(['fal-ai/kling-video/v2', 'fal-ai/luma-dream-machine']).optional(),
})

generate.post('/video', withOrgAuth('editor'), async (c) => {
  const body = await c.req.json()
  const parsed = VideoSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'invalid', details: parsed.error.flatten() }, 400)
  const { userId, orgId } = c.var.auth
  const data = parsed.data

  const model = data.model || (process.env.FAL_DEFAULT_VIDEO_MODEL as 'fal-ai/kling-video/v2') || 'fal-ai/kling-video/v2'
  const operation =
    model === 'fal-ai/luma-dream-machine' ? 'generate_video_luma' :
    (data.duration ?? 5) === 10 ? 'generate_video_kling_10s' :
    'generate_video_kling_5s'

  try {
    const result = await dispatchGenerationJob({
      orgId,
      userId,
      kind: 'video',
      provider: 'fal',
      model,
      operation,
      campaignId: data.campaignId,
      stepId: data.stepId,
      input: {
        prompt: data.prompt,
        source_asset_id: data.sourceAssetId,
        duration: data.duration ?? 5,
        aspect_ratio: data.aspectRatio || '9:16',
      },
    })
    return c.json(result, 202)
  } catch (err) {
    return handleDispatchError(c, err)
  }
})

// ============== UGC avatar generation ==============
const AvatarSchema = z.object({
  orgId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional(),
  avatarId: z.string().min(1),
  voiceId: z.string().min(1),
  script: z.string().min(3).max(2000),
  background: z
    .object({ type: z.enum(['color', 'image']), value: z.string() })
    .optional(),
  provider: z.enum(['heygen', 'hedra']).optional(),
})

generate.post('/avatar', withOrgAuth('editor'), async (c) => {
  const body = await c.req.json()
  const parsed = AvatarSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'invalid', details: parsed.error.flatten() }, 400)
  const { userId, orgId } = c.var.auth
  const data = parsed.data

  const provider: GenProvider = data.provider || ((process.env.STUDIO_AVATAR_PROVIDER as 'heygen' | 'hedra') || 'heygen')
  const operation = provider === 'hedra' ? 'generate_avatar_hedra' : 'generate_avatar_heygen_15s'
  const model = provider === 'hedra' ? 'hedra-character-2' : 'heygen-avatar-iv'

  try {
    const result = await dispatchGenerationJob({
      orgId,
      userId,
      kind: 'avatar_video',
      provider,
      model,
      operation,
      campaignId: data.campaignId,
      stepId: data.stepId,
      input: {
        avatar_id: data.avatarId,
        voice_id: data.voiceId,
        script: data.script,
        background: data.background,
      },
    })
    return c.json(result, 202)
  } catch (err) {
    return handleDispatchError(c, err)
  }
})

// ============== Copy bundle generation ==============
const CopySchema = z.object({
  orgId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional(),
  brief: z.record(z.string(), z.unknown()),
  platforms: z.array(z.enum(['facebook', 'instagram', 'linkedin', 'x', 'tiktok', 'threads', 'youtube'])).min(1),
  imageDescription: z.string().max(1000).optional(),
  nVariants: z.number().int().min(1).max(5).optional(),
})

generate.post('/copy', withOrgAuth('editor'), async (c) => {
  const body = await c.req.json()
  const parsed = CopySchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'invalid', details: parsed.error.flatten() }, 400)
  const { userId, orgId } = c.var.auth
  const data = parsed.data

  try {
    const result = await dispatchGenerationJob({
      orgId,
      userId,
      kind: 'copy_bundle',
      provider: 'claude',
      model: process.env.CLAUDE_MODEL || 'claude-opus-4-7',
      operation: 'generate_copy_claude',
      campaignId: data.campaignId,
      stepId: data.stepId,
      input: {
        brief: data.brief,
        platforms: data.platforms,
        image_description: data.imageDescription,
        n_variants: data.nVariants ?? 3,
      },
    })
    return c.json(result, 202)
  } catch (err) {
    return handleDispatchError(c, err)
  }
})

// ============== Job status & SSE ==============
generate.get('/jobs/:id', withOrgAuth('viewer'), async (c) => {
  const id = c.req.param('id')
  const { orgId } = c.var.auth

  const job = await getJob(id).catch(() => null)
  if (!job || job.organization_id !== orgId) return c.json({ error: 'not found' }, 404)

  let assets: Array<Record<string, unknown>> = []
  if (job.status === 'succeeded') {
    const raw = await listAssetsByJob(id)
    assets = await Promise.all(
      raw.map(async (a) => ({
        ...a,
        signed_url: await getSignedDownloadUrl(a.storage_path, { bucket: a.storage_bucket || 'generated-assets' }).catch(() => null),
      })),
    )
  }

  return c.json({ job, assets })
})

generate.get('/jobs/:id/stream', withOrgAuth('viewer'), async (c) => {
  const id = c.req.param('id')
  const { orgId } = c.var.auth

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (event: string, payload: unknown) => {
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`))
      }

      const started = Date.now()
      const maxMs = 15 * 60_000
      let lastStatus = ''

      while (Date.now() - started < maxMs) {
        const job = await getJob(id).catch(() => null)
        if (!job || job.organization_id !== orgId) {
          send('error', { message: 'not found' })
          break
        }

        if (job.status !== lastStatus) {
          send('status', { status: job.status, error: job.error })
          lastStatus = job.status
        }

        if (job.status === 'succeeded') {
          const raw = await listAssetsByJob(id)
          const assets = await Promise.all(
            raw.map(async (a) => ({
              id: a.id,
              kind: a.kind,
              storage_path: a.storage_path,
              width: a.width,
              height: a.height,
              duration_seconds: a.duration_seconds,
              signed_url: await getSignedDownloadUrl(a.storage_path, { bucket: a.storage_bucket || 'generated-assets' }).catch(() => null),
            })),
          )
          send('completed', { assets })
          break
        }

        if (job.status === 'failed' || job.status === 'cancelled' || job.status === 'refunded') {
          send('failed', { error: job.error })
          break
        }

        await new Promise((r) => setTimeout(r, 2000))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
})

// ============== Avatar catalog (proxy) ==============
// Si HEYGEN_API_KEY no está configurada, devolvemos available=false en vez
// de un 500 — el frontend usa eso para deshabilitar el step de UGC.
generate.get('/avatars', withOrgAuth('viewer'), async (c) => {
  if (!process.env.HEYGEN_API_KEY) {
    c.header('cache-control', 'private, max-age=60')
    return c.json({ avatars: [], available: false, reason: 'HEYGEN_API_KEY not configured' })
  }
  try {
    const avatars = await listHeygenAvatars()
    c.header('cache-control', 'private, max-age=300')
    return c.json({ avatars, available: true })
  } catch (err) {
    return c.json({ avatars: [], available: false, reason: err instanceof Error ? err.message : 'unknown' })
  }
})

generate.get('/voices', withOrgAuth('viewer'), async (c) => {
  if (!process.env.HEYGEN_API_KEY) {
    c.header('cache-control', 'private, max-age=60')
    return c.json({ voices: [], available: false, reason: 'HEYGEN_API_KEY not configured' })
  }
  const language = c.req.query('language') || undefined
  try {
    const voices = await listHeygenVoices(language)
    c.header('cache-control', 'private, max-age=300')
    return c.json({ voices, available: true })
  } catch (err) {
    return c.json({ voices: [], available: false, reason: err instanceof Error ? err.message : 'unknown' })
  }
})

// Capability flags para que el frontend sepa qué pasos están disponibles
generate.get('/capabilities', withOrgAuth('viewer'), async (c) => {
  c.header('cache-control', 'private, max-age=60')
  return c.json({
    image: Boolean(process.env.FAL_KEY),
    video: Boolean(process.env.FAL_KEY),
    avatar: Boolean(process.env.HEYGEN_API_KEY || process.env.HEDRA_API_KEY),
    copy: true,
    avatarProvider: process.env.HEYGEN_API_KEY
      ? 'heygen'
      : process.env.HEDRA_API_KEY
        ? 'hedra'
        : null,
  })
})

export { generate as studioGenerate }
