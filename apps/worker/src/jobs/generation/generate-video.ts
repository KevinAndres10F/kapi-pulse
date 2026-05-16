import { fetchJob, markRunning, markSucceeded, markFailed, insertAsset, getAssetSignedUrl } from './lib.js'
import { uploadFromUrl } from '../../lib/storage.js'
import { falGenerateVideo } from '../../lib/providers/fal.js'

interface VideoInput {
  prompt: string
  source_asset_id?: string
  duration?: 5 | 10
  aspect_ratio?: '16:9' | '9:16' | '1:1'
  negative_prompt?: string
}

export async function generateVideoJob(data: { jobId: string }) {
  const { jobId } = data
  const job = await fetchJob(jobId)
  await markRunning(jobId)

  try {
    const input = job.input as unknown as VideoInput

    let imageUrl: string | undefined
    if (input.source_asset_id) {
      imageUrl = await getAssetSignedUrl(input.source_asset_id, { expiresIn: 3600 })
    }

    const result = await falGenerateVideo(
      {
        prompt: input.prompt,
        image_url: imageUrl,
        duration: input.duration ?? 5,
        aspect_ratio: input.aspect_ratio || '9:16',
        negative_prompt: input.negative_prompt,
      },
      job.model,
    )

    const upload = await uploadFromUrl({
      orgId: job.organization_id,
      sourceUrl: result.videoUrl,
      ext: 'mp4',
      jobId,
    })

    const assetId = await insertAsset({
      orgId: job.organization_id,
      jobId,
      kind: 'video',
      source: job.provider,
      storagePath: upload.storagePath,
      storageBucket: upload.bucket,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      width: result.width,
      height: result.height,
      durationSeconds: result.durationSeconds,
      prompt: input.prompt,
      parentAssetId: input.source_asset_id,
      createdBy: job.created_by,
    })

    await markSucceeded(jobId, { asset_ids: [assetId], external_id: result.requestId })
  } catch (err) {
    await markFailed(jobId, err)
    throw err
  }
}
