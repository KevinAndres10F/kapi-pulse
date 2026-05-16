import { Hono } from 'hono'
import { z } from 'zod'
import { withOrgAuth } from '../../services/auth'
import { supabaseAdmin } from '../../lib/supabase'
import { getSignedDownloadUrl } from '../../services/storage'
import { getPublishQueue, getGenerationQueue } from '../../lib/queues'

const campaigns = new Hono()

const BriefSchema = z.object({
  product: z.string().min(2).max(500),
  audience: z.string().max(500).optional(),
  tone: z.string().max(120).optional(),
  format: z.enum(['single', 'carousel', 'reel', 'story']).optional(),
  referenceAssetIds: z.array(z.string().uuid()).optional(),
  notes: z.string().max(2000).optional(),
})

const CreateCampaignSchema = z.object({
  orgId: z.string().uuid(),
  name: z.string().min(2).max(200),
  brief: BriefSchema,
})

campaigns.post('/', withOrgAuth('editor'), async (c) => {
  const body = await c.req.json()
  const parsed = CreateCampaignSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'invalid', details: parsed.error.flatten() }, 400)
  const { orgId, userId } = c.var.auth
  const { name, brief } = parsed.data

  const { data: campaign, error } = await supabaseAdmin
    .from('campaigns')
    .insert({
      organization_id: orgId,
      created_by: userId,
      name,
      brief,
      status: 'draft',
    })
    .select('*')
    .single()
  if (error || !campaign) return c.json({ error: error?.message || 'failed' }, 500)

  // Bootstrap step 1 (brief) as done; remaining steps as pending
  const stepSeed = [
    { step_number: 1, step_type: 'brief', state: 'done', config: brief },
    { step_number: 2, step_type: 'images', state: 'pending' },
    { step_number: 3, step_type: 'video', state: 'pending' },
    { step_number: 4, step_type: 'avatar', state: 'pending' },
    { step_number: 5, step_type: 'copy', state: 'pending' },
    { step_number: 6, step_type: 'package', state: 'pending' },
  ].map((s) => ({ campaign_id: campaign.id, ...s }))

  const { error: stepsErr } = await supabaseAdmin.from('campaign_steps').insert(stepSeed)
  if (stepsErr) {
    return c.json({ error: stepsErr.message }, 500)
  }

  return c.json({ campaign }, 201)
})

campaigns.get('/', withOrgAuth('viewer'), async (c) => {
  const { orgId } = c.var.auth
  const status = c.req.query('status')
  const limit = Math.min(Number(c.req.query('limit')) || 30, 200)
  const offset = Number(c.req.query('offset')) || 0

  let query = supabaseAdmin
    .from('campaigns')
    .select('id, name, status, brief, total_credits_spent, cover_asset_id, created_at, updated_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ campaigns: data })
})

campaigns.get('/:id', withOrgAuth('viewer'), async (c) => {
  const id = c.req.param('id')
  const { orgId } = c.var.auth

  const { data: campaign, error } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!campaign) return c.json({ error: 'not found' }, 404)

  const { data: steps } = await supabaseAdmin
    .from('campaign_steps')
    .select('*')
    .eq('campaign_id', id)
    .order('step_number', { ascending: true })

  // Collect all selected asset ids across steps
  const selectedIds = [...new Set((steps || []).flatMap((s) => s.selected_asset_ids || []))]

  let assets: Array<Record<string, unknown>> = []
  if (selectedIds.length) {
    const { data: assetRows } = await supabaseAdmin
      .from('generated_assets')
      .select('id, kind, source, storage_path, storage_bucket, mime_type, width, height, duration_seconds, prompt, parent_asset_id, created_at')
      .in('id', selectedIds)
    assets = await Promise.all(
      (assetRows || []).map(async (a) => ({
        ...a,
        signed_url: await getSignedDownloadUrl(a.storage_path as string, { bucket: a.storage_bucket as string || 'generated-assets' }).catch(() => null),
      })),
    )
  }

  return c.json({ campaign, steps: steps ?? [], assets })
})

const UpdateStepSchema = z.object({
  state: z.enum(['pending', 'running', 'done', 'skipped', 'failed']).optional(),
  selectedAssetIds: z.array(z.string().uuid()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  result: z.record(z.string(), z.unknown()).optional(),
})

const PatchCampaignSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  status: z.enum(['draft', 'generating', 'review', 'approved', 'published', 'archived', 'failed']).optional(),
  coverAssetId: z.string().uuid().nullable().optional(),
  step: z
    .object({
      stepNumber: z.number().int().min(1).max(6),
      update: UpdateStepSchema,
    })
    .optional(),
})

campaigns.patch('/:id', withOrgAuth('editor'), async (c) => {
  const id = c.req.param('id')
  const { orgId } = c.var.auth
  const body = await c.req.json()
  const parsed = PatchCampaignSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'invalid', details: parsed.error.flatten() }, 400)

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (parsed.data.name !== undefined) updates.name = parsed.data.name
  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (parsed.data.coverAssetId !== undefined) updates.cover_asset_id = parsed.data.coverAssetId

  if (Object.keys(updates).length > 1) {
    const { error } = await supabaseAdmin
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .eq('organization_id', orgId)
    if (error) return c.json({ error: error.message }, 500)
  }

  if (parsed.data.step) {
    const stepUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (parsed.data.step.update.state !== undefined) stepUpdates.state = parsed.data.step.update.state
    if (parsed.data.step.update.selectedAssetIds !== undefined) stepUpdates.selected_asset_ids = parsed.data.step.update.selectedAssetIds
    if (parsed.data.step.update.config !== undefined) stepUpdates.config = parsed.data.step.update.config
    if (parsed.data.step.update.result !== undefined) stepUpdates.result = parsed.data.step.update.result
    const { error: stepErr } = await supabaseAdmin
      .from('campaign_steps')
      .update(stepUpdates)
      .eq('campaign_id', id)
      .eq('step_number', parsed.data.step.stepNumber)
    if (stepErr) return c.json({ error: stepErr.message }, 500)
  }

  return c.json({ success: true })
})

campaigns.delete('/:id', withOrgAuth('editor'), async (c) => {
  const id = c.req.param('id')
  const { orgId } = c.var.auth
  const { error } = await supabaseAdmin
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})

// =========================================================================
// POST /:id/publish — create posts + variants + media linked to assets
// =========================================================================
const PublishSchema = z.object({
  orgId: z.string().uuid(),
  scheduledAt: z.string().datetime().optional(),
  targets: z.array(
    z.object({
      socialAccountId: z.string().uuid(),
      content: z.string().max(5000),
      hashtags: z.array(z.string()).optional(),
      assetIds: z.array(z.string().uuid()).min(1),
    }),
  ).min(1),
})

campaigns.post('/:id/publish', withOrgAuth('editor'), async (c) => {
  const id = c.req.param('id')
  const { orgId, userId } = c.var.auth
  const body = await c.req.json()
  const parsed = PublishSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'invalid', details: parsed.error.flatten() }, 400)

  const { scheduledAt, targets } = parsed.data
  const postStatus = scheduledAt ? 'scheduled' : 'draft'

  const { data: post, error: postError } = await supabaseAdmin
    .from('posts')
    .insert({
      organization_id: orgId,
      created_by: userId,
      title: `Campaña ${id.slice(0, 8)}`,
      status: postStatus,
      scheduled_at: scheduledAt ?? null,
    })
    .select('id')
    .single()
  if (postError || !post) return c.json({ error: postError?.message || 'failed' }, 500)

  for (const target of targets) {
    const { data: variant, error: variantErr } = await supabaseAdmin
      .from('post_variants')
      .insert({
        post_id: post.id,
        social_account_id: target.socialAccountId,
        content: target.content,
        hashtags: target.hashtags || [],
        status: postStatus,
      })
      .select('id')
      .single()
    if (variantErr || !variant) {
      console.error('[publish] variant insert failed:', variantErr)
      continue
    }

    const { data: assetRows } = await supabaseAdmin
      .from('generated_assets')
      .select('id, kind, storage_path, storage_bucket, mime_type, width, height, duration_seconds')
      .in('id', target.assetIds)

    const mediaRows = (assetRows || []).map((a, idx) => ({
      post_variant_id: variant.id,
      position: idx,
      media_type: a.kind === 'avatar_video' ? 'video' : a.kind === 'image' ? 'image' : 'video',
      storage_path: a.storage_path,
      storage_bucket: a.storage_bucket || 'generated-assets',
      mime_type: a.mime_type,
      width: a.width,
      height: a.height,
      duration_seconds: a.duration_seconds ? Math.round(Number(a.duration_seconds)) : null,
      generated_asset_id: a.id,
    }))

    if (mediaRows.length) {
      await supabaseAdmin.from('post_media').insert(mediaRows)
    }
  }

  if (scheduledAt) {
    const queue = await getPublishQueue()
    if (queue) {
      const delay = Math.max(0, new Date(scheduledAt).getTime() - Date.now())
      await queue.add('publish-post', { postId: post.id }, {
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        jobId: `publish-${post.id}`,
      })
    }
  } else {
    const queue = await getPublishQueue()
    if (queue) {
      await queue.add('publish-post', { postId: post.id }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        jobId: `publish-${post.id}`,
      })
    }
  }

  await supabaseAdmin
    .from('campaigns')
    .update({ status: 'published', updated_at: new Date().toISOString() })
    .eq('id', id)

  return c.json({ postId: post.id, status: postStatus }, 201)
})

// =========================================================================
// POST /:id/package — enqueue ZIP packaging job
// =========================================================================
campaigns.post('/:id/package', withOrgAuth('editor'), async (c) => {
  const id = c.req.param('id')
  const { orgId, userId } = c.var.auth

  const queue = await getGenerationQueue()
  if (!queue) return c.json({ error: 'queue unavailable' }, 503)

  const bullJob = await queue.add(
    'package-campaign',
    { campaignId: id, orgId, userId },
    { jobId: `package-${id}-${Date.now()}`, removeOnComplete: { count: 100 }, removeOnFail: { count: 50 } },
  )

  return c.json({ jobId: bullJob.id, status: 'queued' }, 202)
})

export { campaigns }
