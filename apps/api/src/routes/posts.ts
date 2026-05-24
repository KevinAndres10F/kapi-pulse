import { Hono } from 'hono'
import { z } from 'zod'
import { supabaseAdmin } from '../lib/supabase'

// Lazy import de BullMQ para encolar publicaciones
async function getPublishQueue() {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) return null
  try {
    const { Queue } = await import('bullmq')
    const IORedis = (await import('ioredis')).default
    const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null })
    return new Queue('publish', { connection })
  } catch {
    console.warn('No se pudo conectar a Redis para encolar jobs')
    return null
  }
}

const posts = new Hono()

const MediaItemSchema = z.object({
  assetId: z.string().uuid().optional(),
  storagePath: z.string().optional(),
  storageBucket: z.string().optional(),
  mediaType: z.enum(['image', 'video', 'carousel']).default('image'),
  mimeType: z.string().optional(),
  position: z.number().int().min(0).optional(),
  altText: z.string().max(500).optional(),
}).refine((v) => v.assetId || v.storagePath, {
  message: 'media item requires assetId or storagePath',
})

const CreatePostSchema = z.object({
  organizationId: z.string().uuid(),
  createdBy: z.string().uuid(),
  title: z.string().max(200).optional(),
  internalNotes: z.string().max(1000).optional(),
  scheduledAt: z.string().datetime().optional(),
  variants: z.array(z.object({
    socialAccountId: z.string().uuid(),
    content: z.string().max(5000),
    hashtags: z.array(z.string()).optional(),
    linkUrl: z.string().url().optional(),
    media: z.array(MediaItemSchema).optional(),
  })).min(1),
})

/**
 * GET /api/posts?org_id=xxx
 * Lista posts de una organización con sus variantes
 */
posts.get('/', async (c) => {
  const orgId = c.req.query('org_id')
  if (!orgId) return c.json({ error: 'Falta org_id' }, 400)

  const status = c.req.query('status') // filtrar por status
  const limit = Number(c.req.query('limit')) || 50
  const offset = Number(c.req.query('offset')) || 0

  let query = supabaseAdmin
    .from('posts')
    .select(`
      *,
      post_variants (
        id, social_account_id, content, hashtags, link_url,
        external_post_id, status, error_message, published_at,
        social_accounts (id, provider, display_name, avatar_url)
      )
    `)
    .eq('organization_id', orgId)
    .order('scheduled_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ posts: data })
})

/**
 * POST /api/posts
 * Crea un post con variantes y lo programa si tiene scheduledAt
 */
posts.post('/', async (c) => {
  const body = await c.req.json()
  const parsed = CreatePostSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, 400)
  }

  const { organizationId, createdBy, title, internalNotes, scheduledAt, variants } = parsed.data

  const postStatus = scheduledAt ? 'scheduled' : 'draft'

  // Crear el post
  const { data: post, error: postError } = await supabaseAdmin
    .from('posts')
    .insert({
      organization_id: organizationId,
      created_by: createdBy,
      title,
      internal_notes: internalNotes,
      status: postStatus,
      scheduled_at: scheduledAt,
    })
    .select()
    .single()

  if (postError) return c.json({ error: postError.message }, 500)

  // Crear las variantes
  const variantsData = variants.map((v) => ({
    post_id: post.id,
    social_account_id: v.socialAccountId,
    content: v.content,
    hashtags: v.hashtags || [],
    link_url: v.linkUrl,
    status: postStatus,
  }))

  const { data: createdVariants, error: variantsError } = await supabaseAdmin
    .from('post_variants')
    .insert(variantsData)
    .select()

  if (variantsError) return c.json({ error: variantsError.message }, 500)

  // Crear post_media para cada variante. Cuando viene un assetId, resolvemos
  // storage_path y bucket desde generated_assets para mantener consistencia
  // con el worker (que lee storage_path + storage_bucket).
  const mediaRows: Array<{
    post_variant_id: string
    position: number
    media_type: string
    storage_path: string
    storage_bucket: string
    mime_type: string | null
    generated_asset_id: string | null
  }> = []

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]
    const createdVariant = createdVariants?.[i]
    if (!v.media || v.media.length === 0 || !createdVariant) continue

    const assetIds = v.media.map((m) => m.assetId).filter((x): x is string => !!x)
    const assetById: Record<string, { storage_path: string; storage_bucket: string | null; mime_type: string | null }> = {}
    if (assetIds.length > 0) {
      const { data: assets } = await supabaseAdmin
        .from('generated_assets')
        .select('id, storage_path, storage_bucket, mime_type')
        .in('id', assetIds)
        .eq('organization_id', organizationId)
        .eq('is_deleted', false)
      for (const a of assets || []) assetById[a.id as string] = a as never
    }

    for (let j = 0; j < v.media.length; j++) {
      const m = v.media[j]
      const fromAsset = m.assetId ? assetById[m.assetId] : null
      const storagePath = fromAsset?.storage_path || m.storagePath
      if (!storagePath) continue
      mediaRows.push({
        post_variant_id: createdVariant.id,
        position: m.position ?? j,
        media_type: m.mediaType,
        storage_path: storagePath,
        storage_bucket: fromAsset?.storage_bucket || m.storageBucket || 'campaign-uploads',
        mime_type: fromAsset?.mime_type || m.mimeType || null,
        generated_asset_id: m.assetId || null,
      })
    }
  }

  if (mediaRows.length > 0) {
    const { error: mediaError } = await supabaseAdmin.from('post_media').insert(mediaRows)
    if (mediaError) {
      console.error('[posts] media insert error:', mediaError)
      return c.json({ error: mediaError.message }, 500)
    }
  }

  // Si está programado, encolar job de publicación en BullMQ con delay
  if (scheduledAt) {
    try {
      const queue = await getPublishQueue()
      if (queue) {
        const delay = Math.max(0, new Date(scheduledAt).getTime() - Date.now())
        await queue.add('publish-post', { postId: post.id }, {
          delay,
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
          jobId: `publish-${post.id}`,
        })
        console.log(`[posts] Job encolado para post ${post.id} con delay ${Math.round(delay / 1000)}s`)
      } else {
        console.warn(`[posts] Redis no disponible — post ${post.id} programado pero no encolado`)
      }
    } catch (err) {
      console.error('[posts] Error encolando job:', err)
      // No fallamos la creación del post, solo log el error
    }
  }

  return c.json({ post: { ...post, post_variants: createdVariants } }, 201)
})

/**
 * PATCH /api/posts/:id
 * Actualiza un post (reagendar, editar contenido, cambiar estado)
 */
posts.patch('/:id', async (c) => {
  const postId = c.req.param('id')
  const body = await c.req.json()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.title !== undefined) updates.title = body.title
  if (body.internalNotes !== undefined) updates.internal_notes = body.internalNotes
  if (body.status !== undefined) updates.status = body.status

  if (body.scheduledAt !== undefined) {
    updates.scheduled_at = body.scheduledAt
    if (body.scheduledAt && updates.status !== 'cancelled') {
      updates.status = 'scheduled'
    }
  }

  const { data, error } = await supabaseAdmin
    .from('posts')
    .update(updates)
    .eq('id', postId)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)

  // Actualizar variantes si se envían
  if (body.variants) {
    for (const variant of body.variants) {
      if (variant.id) {
        await supabaseAdmin
          .from('post_variants')
          .update({
            content: variant.content,
            hashtags: variant.hashtags,
            link_url: variant.linkUrl,
            status: updates.status as string || undefined,
          })
          .eq('id', variant.id)
      }
    }
  }

  return c.json({ post: data })
})

/**
 * DELETE /api/posts/:id
 * Elimina un post y cancela jobs pendientes
 */
posts.delete('/:id', async (c) => {
  const postId = c.req.param('id')

  // Primero marcar como cancelado
  await supabaseAdmin
    .from('posts')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', postId)

  // Luego eliminar
  const { error } = await supabaseAdmin
    .from('posts')
    .delete()
    .eq('id', postId)

  if (error) return c.json({ error: error.message }, 500)

  // TODO: Cancelar jobs en BullMQ
  return c.json({ success: true })
})

export { posts }
