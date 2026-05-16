import { fetchJob, markRunning, markSucceeded, markFailed, insertAsset } from './lib.js'
import { uploadJson } from '../../lib/storage.js'

const AI_URL = process.env.AI_URL || 'http://kapi-ai:3002'

interface CopyInput {
  brief: Record<string, unknown>
  platforms: string[]
  image_description?: string
  n_variants?: number
}

export async function generateCopyJob(data: { jobId: string }) {
  const { jobId } = data
  const job = await fetchJob(jobId)
  await markRunning(jobId)

  try {
    const input = job.input as unknown as CopyInput

    const res = await fetch(`${AI_URL}/api/ai/studio/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brief: input.brief,
        platforms: input.platforms,
        image_description: input.image_description,
        n_variants: input.n_variants ?? 3,
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`AI service error (${res.status}): ${text}`)
    }

    const result = (await res.json()) as { variants?: Array<Record<string, unknown>> }

    const upload = await uploadJson({
      orgId: job.organization_id,
      data: result,
      jobId,
    })

    const assetId = await insertAsset({
      orgId: job.organization_id,
      jobId,
      kind: 'copy_bundle',
      source: 'claude',
      storagePath: upload.storagePath,
      storageBucket: upload.bucket,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      createdBy: job.created_by,
      metadata: {
        platforms: input.platforms,
        n_variants: result.variants?.length ?? 0,
      },
    })

    await markSucceeded(jobId, {
      asset_ids: [assetId],
      variants_count: result.variants?.length ?? 0,
      preview: result.variants?.slice(0, 1),
    })
  } catch (err) {
    await markFailed(jobId, err)
    throw err
  }
}
