import { fetchJob, markRunning, markSucceeded, markFailed, insertAsset } from './lib.js'
import { uploadFromUrl } from '../../lib/storage.js'
import { falGenerateImage } from '../../lib/providers/fal.js'
import { replicateGenerateImageSdxl } from '../../lib/providers/replicate.js'

interface ImageInput {
  prompt: string
  negative_prompt?: string
  image_size?: string
  num_images?: number
  seed?: number
}

export async function generateImageJob(data: { jobId: string }) {
  const { jobId } = data
  const job = await fetchJob(jobId)
  await markRunning(jobId)

  try {
    const input = job.input as unknown as ImageInput
    let urls: Array<{ url: string; width: number; height: number }> = []
    let seed = input.seed ?? 0
    let externalId: string | undefined

    try {
      const result = await falGenerateImage(input, job.model)
      urls = result.images.map((i) => ({ url: i.url, width: i.width, height: i.height }))
      seed = result.seed
      externalId = result.requestId
    } catch (err) {
      const fallback = process.env.STUDIO_IMAGE_FALLBACK === 'replicate'
      if (!fallback) throw err
      console.warn(`[generate-image] Fal failed, falling back to Replicate: ${err}`)
      const repl = await replicateGenerateImageSdxl({
        prompt: input.prompt,
        negative_prompt: input.negative_prompt,
        num_outputs: input.num_images || 1,
        seed: input.seed,
      })
      urls = repl.urls.map((u) => ({ url: u, width: 1024, height: 1024 }))
      externalId = repl.predictionId
    }

    const assetIds: string[] = []
    for (const img of urls) {
      const upload = await uploadFromUrl({
        orgId: job.organization_id,
        sourceUrl: img.url,
        ext: 'png',
        jobId,
      })
      const id = await insertAsset({
        orgId: job.organization_id,
        jobId,
        kind: 'image',
        source: job.provider,
        storagePath: upload.storagePath,
        storageBucket: upload.bucket,
        mimeType: upload.mimeType,
        width: img.width,
        height: img.height,
        sizeBytes: upload.sizeBytes,
        prompt: input.prompt,
        seed,
        createdBy: job.created_by,
      })
      assetIds.push(id)
    }

    await markSucceeded(jobId, { asset_ids: assetIds, external_id: externalId, seed })
  } catch (err) {
    await markFailed(jobId, err)
    throw err
  }
}
