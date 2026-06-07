/**
 * Studio Generation Routes - Branded & Character-based
 * Endpoints for generating content with KAPI brand consistency and character profiles
 */

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
import { getCharacterProfile, getBrandColors } from '../../services/brand-injection'

const generateBranded = new Hono()

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

// ============== Character Profiles ==============
generateBranded.get('/characters', withOrgAuth('viewer'), async (c) => {
  const { orgId } = c.var.auth

  const { data: characters, error } = await supabaseAdmin
    .from('character_profiles')
    .select('id, name, description, personality, visual_style, is_default, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: 'fetch_failed' }, 500)
  return c.json({ characters: characters ?? [] })
})

generateBranded.get('/characters/:id', withOrgAuth('viewer'), async (c) => {
  const { orgId } = c.var.auth
  const characterId = c.req.param('id')

  const { data: character, error } = await supabaseAdmin
    .from('character_profiles')
    .select('*')
    .eq('id', characterId)
    .eq('organization_id', orgId)
    .single()

  if (error || !character) return c.json({ error: 'not_found' }, 404)
  return c.json({ character })
})

// Create character profile
const CharacterCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  personality: z.string().max(500).optional(),
  elevenLabsVoiceId: z.string().optional(),
  visualStyle: z.string().max(500).optional(),
  referenceImageUrls: z.array(z.string().url()).optional(),
  isDefault: z.boolean().optional(),
})

generateBranded.post('/characters', withOrgAuth('editor'), async (c) => {
  const { orgId } = c.var.auth
  const body = await c.req.json()
  const parsed = CharacterCreateSchema.safeParse(body)

  if (!parsed.success) return c.json({ error: 'invalid', details: parsed.error.flatten() }, 400)

  const { data: character, error } = await supabaseAdmin
    .from('character_profiles')
    .insert({
      organization_id: orgId,
      name: parsed.data.name,
      description: parsed.data.description,
      personality: parsed.data.personality,
      eleven_labs_voice_id: parsed.data.elevenLabsVoiceId,
      visual_style: parsed.data.visualStyle,
      reference_image_urls: parsed.data.referenceImageUrls,
      is_default: parsed.data.isDefault,
    })
    .select()
    .single()

  if (error) return c.json({ error: 'creation_failed' }, 500)
  return c.json({ character }, 201)
})

// ============== Brand Guidelines ==============
generateBranded.get('/brand', withOrgAuth('viewer'), async (c) => {
  const { orgId } = c.var.auth

  const { data: brand, error } = await supabaseAdmin
    .from('brand_guidelines')
    .select('*')
    .eq('organization_id', orgId)
    .single()

  if (error || !brand) {
    // Return defaults
    return c.json({
      brand: {
        primary_color: '#001F4D',
        secondary_color: '#BFCC00',
        accent_color: '#00A9B5',
        watermark_enabled: true,
      },
    })
  }

  return c.json({ brand })
})

// ============== Branded Image Generation ==============
const BrandedImageSchema = z.object({
  orgId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional(),
  prompt: z.string().min(3).max(2000),
  characterId: z.string().uuid().optional(),
  model: z.enum(['flux-pro', 'flux-dev', 'flux-schnell', 'fal-ai/flux/dev']).optional(),
  provider: z.enum(['fal', 'banana']).optional(),
  numImages: z.number().int().min(1).max(4).optional(),
  isCarousel: z.boolean().optional(),
  seed: z.number().int().optional(),
  negativePrompt: z.string().max(500).optional(),
})

generateBranded.post('/image-branded', withOrgAuth('editor'), async (c) => {
  const body = await c.req.json()
  const parsed = BrandedImageSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'invalid', details: parsed.error.flatten() }, 400)

  const { userId, orgId } = c.var.auth
  const data = parsed.data

  const provider: GenProvider = data.provider === 'banana' ? 'banana' : 'fal'
  const model = data.model || 'fal-ai/flux/dev'
  const operation =
    provider === 'banana'
      ? 'generate_image_banana_flux_pro'
      : model === 'flux-pro'
        ? 'generate_image_flux_pro'
        : 'generate_image_flux_dev'

  try {
    const result = await dispatchGenerationJob({
      orgId,
      userId,
      kind: 'image',
      provider,
      model,
      operation,
      campaignId: data.campaignId,
      stepId: data.stepId,
      input: {
        prompt: data.prompt,
        negative_prompt: data.negativePrompt,
        num_images: data.numImages || 1,
        is_carousel: data.isCarousel || false,
        character_profile_id: data.characterId,
        brand_guidelines_id: undefined, // Will use default brand
        seed: data.seed,
      },
    })
    return c.json(result, 202)
  } catch (err) {
    return handleDispatchError(c, err)
  }
})

// ============== Audio Generation (Eleven Labs) ==============
const AudioSchema = z.object({
  orgId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional(),
  text: z.string().min(1).max(5000),
  voiceId: z.string().min(1),
  modelId: z.string().optional(),
})

generateBranded.post('/audio', withOrgAuth('editor'), async (c) => {
  const body = await c.req.json()
  const parsed = AudioSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'invalid', details: parsed.error.flatten() }, 400)

  const { userId, orgId } = c.var.auth
  const data = parsed.data

  try {
    const result = await dispatchGenerationJob({
      orgId,
      userId,
      kind: 'audio',
      provider: 'eleven_labs',
      model: data.modelId || 'eleven_monolingual_v1',
      operation: 'generate_audio_eleven_labs',
      campaignId: data.campaignId,
      stepId: data.stepId,
      input: {
        text: data.text,
        voice_id: data.voiceId,
        model_id: data.modelId,
      },
    })
    return c.json(result, 202)
  } catch (err) {
    return handleDispatchError(c, err)
  }
})

// ============== Video + Audio Generation ==============
const VideoWithAudioSchema = z.object({
  orgId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  stepId: z.string().uuid().optional(),
  prompt: z.string().min(3).max(2000),
  sourceAssetId: z.string().uuid().optional(),
  audioAssetId: z.string().uuid().optional(),
  characterId: z.string().uuid().optional(),
  duration: z.union([z.literal(5), z.literal(10)]).optional(),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional(),
  model: z.enum(['fal-ai/kling-video/v2', 'fal-ai/luma-dream-machine']).optional(),
})

generateBranded.post('/video-with-audio', withOrgAuth('editor'), async (c) => {
  const body = await c.req.json()
  const parsed = VideoWithAudioSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'invalid', details: parsed.error.flatten() }, 400)

  const { userId, orgId } = c.var.auth
  const data = parsed.data

  const model = data.model || 'fal-ai/kling-video/v2'
  const operation =
    model === 'fal-ai/luma-dream-machine'
      ? 'generate_video_with_audio_luma'
      : (data.duration ?? 5) === 10
        ? 'generate_video_with_audio_kling_10s'
        : 'generate_video_with_audio_kling_5s'

  try {
    const result = await dispatchGenerationJob({
      orgId,
      userId,
      kind: 'video_with_audio',
      provider: 'fal',
      model,
      operation,
      campaignId: data.campaignId,
      stepId: data.stepId,
      input: {
        prompt: data.prompt,
        source_asset_id: data.sourceAssetId,
        audio_asset_id: data.audioAssetId,
        character_profile_id: data.characterId,
        duration: data.duration ?? 5,
        aspect_ratio: data.aspectRatio || '9:16',
      },
    })
    return c.json(result, 202)
  } catch (err) {
    return handleDispatchError(c, err)
  }
})

export default generateBranded
