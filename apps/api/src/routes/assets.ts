import { Hono } from 'hono'
import { z } from 'zod'
import { withOrgAuth } from '../services/auth'
import { supabaseAdmin } from '../lib/supabase'
import { createSignedUploadUrl, getSignedDownloadUrl, deleteAsset } from '../services/storage'

const assets = new Hono()

const UploadUrlSchema = z.object({
  orgId: z.string().uuid(),
  ext: z.enum(['png', 'jpg', 'jpeg', 'webp', 'mp4', 'mov']),
  kind: z.enum(['image', 'video', 'audio', 'reference']).optional(),
  bucket: z.enum(['generated-assets', 'campaign-uploads']).optional(),
})

assets.post('/upload-url', withOrgAuth('editor'), async (c) => {
  const body = await c.req.json()
  const parsed = UploadUrlSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'invalid', details: parsed.error.flatten() }, 400)

  const { orgId } = c.var.auth
  const { ext, kind, bucket } = parsed.data

  try {
    const upload = await createSignedUploadUrl({
      orgId,
      ext,
      bucket: bucket || 'campaign-uploads',
    })

    const mimeByExt: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
      mp4: 'video/mp4', mov: 'video/quicktime',
    }
    const isVideo = ext === 'mp4' || ext === 'mov'

    const { data: asset, error } = await supabaseAdmin
      .from('generated_assets')
      .insert({
        organization_id: orgId,
        kind: kind === 'reference' ? 'image' : (isVideo ? 'video' : 'image'),
        source: 'upload',
        storage_bucket: upload.bucket,
        storage_path: upload.storagePath,
        mime_type: mimeByExt[ext] || 'application/octet-stream',
        created_by: c.var.auth.userId,
      })
      .select('id')
      .single()

    if (error) return c.json({ error: error.message }, 500)

    return c.json({
      assetId: asset.id,
      uploadUrl: upload.uploadUrl,
      token: upload.token,
      storagePath: upload.storagePath,
      bucket: upload.bucket,
    })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'unknown' }, 500)
  }
})

assets.get('/', withOrgAuth('viewer'), async (c) => {
  try {
    const { orgId } = c.var.auth
    const kind = c.req.query('kind')
    const limit = Math.min(Number(c.req.query('limit')) || 50, 200)
    const offset = Number(c.req.query('offset')) || 0

    let query = supabaseAdmin
      .from('generated_assets')
      .select('id, kind, source, storage_path, storage_bucket, mime_type, width, height, duration_seconds, size_bytes, prompt, parent_asset_id, metadata, created_at')
      .eq('organization_id', orgId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (kind) query = query.eq('kind', kind)

    const { data, error } = await query
    if (error) {
      console.error('[assets] query error:', error)
      return c.json({ error: error.message }, 500)
    }

    // Resolve signed URLs in parallel for the page
    const enriched = await Promise.all(
      (data || []).map(async (a) => ({
        ...a,
        signed_url: await getSignedDownloadUrl(a.storage_path, { bucket: a.storage_bucket || 'generated-assets' }).catch(() => null),
      })),
    )

    return c.json({ assets: enriched })
  } catch (err) {
    console.error('[assets] unexpected error:', err)
    return c.json({ error: err instanceof Error ? err.message : 'unknown' }, 500)
  }
})

assets.get('/:id', withOrgAuth('viewer'), async (c) => {
  const id = c.req.param('id')
  const { orgId } = c.var.auth
  const { data, error } = await supabaseAdmin
    .from('generated_assets')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'not found' }, 404)

  const signedUrl = await getSignedDownloadUrl(data.storage_path, { bucket: data.storage_bucket || 'generated-assets' }).catch(() => null)
  return c.json({ asset: { ...data, signed_url: signedUrl } })
})

assets.delete('/:id', withOrgAuth('editor'), async (c) => {
  const id = c.req.param('id')
  const { orgId } = c.var.auth

  const { data: asset, error: fetchErr } = await supabaseAdmin
    .from('generated_assets')
    .select('storage_path, storage_bucket')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (fetchErr) return c.json({ error: fetchErr.message }, 500)
  if (!asset) return c.json({ error: 'not found' }, 404)

  await deleteAsset(asset.storage_path, asset.storage_bucket || 'generated-assets').catch((err) => {
    console.warn('[assets] storage delete failed:', err)
  })

  const { error } = await supabaseAdmin
    .from('generated_assets')
    .update({ is_deleted: true })
    .eq('id', id)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})

export { assets }
