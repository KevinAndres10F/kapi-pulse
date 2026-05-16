import { getSupabase } from '../../lib/supabase.js'
import { uploadBuffer, getSignedDownloadUrl } from '../../lib/storage.js'

interface PackageInput {
  campaignId: string
  orgId: string
  userId?: string
}

interface CampaignStepRow {
  selected_asset_ids: string[] | null
}

interface AssetRow {
  id: string
  kind: string
  storage_path: string
  storage_bucket: string | null
  mime_type: string | null
  prompt: string | null
}

export async function packageCampaignJob(data: PackageInput) {
  const supabase = getSupabase()
  const { campaignId, orgId } = data

  const { data: steps } = await supabase
    .from('campaign_steps')
    .select('selected_asset_ids')
    .eq('campaign_id', campaignId)

  const assetIds = [...new Set(((steps as CampaignStepRow[]) || []).flatMap((s) => s.selected_asset_ids || []))]

  if (assetIds.length === 0) {
    throw new Error('No assets selected in this campaign')
  }

  const { data: assets } = await supabase
    .from('generated_assets')
    .select('id, kind, storage_path, storage_bucket, mime_type, prompt')
    .in('id', assetIds)

  const assetRows = (assets as AssetRow[]) || []

  // Lazy import archiver — only loaded when packaging is triggered
  const archiver = (await import('archiver')).default
  const { PassThrough } = await import('node:stream')

  const archive = archiver('zip', { zlib: { level: 9 } })
  const passthrough = new PassThrough()
  const chunks: Buffer[] = []
  passthrough.on('data', (c) => chunks.push(Buffer.from(c)))

  const archiveDone = new Promise<void>((resolve, reject) => {
    archive.on('error', reject)
    passthrough.on('end', () => resolve())
    passthrough.on('error', reject)
  })

  archive.pipe(passthrough)

  for (const asset of assetRows) {
    try {
      const signedUrl = await getSignedDownloadUrl(asset.storage_path, {
        bucket: asset.storage_bucket || 'generated-assets',
        expiresIn: 600,
      })
      const res = await fetch(signedUrl)
      if (!res.ok) {
        console.warn(`[package] failed to fetch asset ${asset.id}: ${res.status}`)
        continue
      }
      const buffer = Buffer.from(await res.arrayBuffer())
      const ext =
        asset.mime_type === 'video/mp4' ? 'mp4' :
        asset.mime_type === 'application/json' ? 'json' :
        asset.mime_type === 'image/png' ? 'png' :
        asset.mime_type === 'image/jpeg' ? 'jpg' :
        asset.mime_type === 'image/webp' ? 'webp' :
        'bin'
      archive.append(buffer, { name: `${asset.kind}/${asset.id}.${ext}` })
    } catch (err) {
      console.warn(`[package] error processing asset ${asset.id}:`, err)
    }
  }

  // Manifest
  archive.append(
    JSON.stringify(
      {
        campaignId,
        generatedAt: new Date().toISOString(),
        assets: assetRows.map((a) => ({ id: a.id, kind: a.kind, prompt: a.prompt })),
      },
      null,
      2,
    ),
    { name: 'manifest.json' },
  )

  await archive.finalize()
  await archiveDone

  const zipBuffer = Buffer.concat(chunks)
  const upload = await uploadBuffer({
    orgId,
    buffer: zipBuffer,
    ext: 'zip',
    contentType: 'application/zip',
    jobId: `package-${campaignId}`,
  })

  const signedDownload = await getSignedDownloadUrl(upload.storagePath, {
    bucket: upload.bucket,
    expiresIn: 24 * 3600,
  })

  await supabase
    .from('campaign_steps')
    .update({
      state: 'done',
      result: {
        storage_path: upload.storagePath,
        size_bytes: upload.sizeBytes,
        asset_count: assetRows.length,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('campaign_id', campaignId)
    .eq('step_number', 6)

  return {
    storagePath: upload.storagePath,
    sizeBytes: upload.sizeBytes,
    downloadUrl: signedDownload,
    assetCount: assetRows.length,
  }
}
