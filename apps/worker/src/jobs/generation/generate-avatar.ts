import { fetchJob, markRunning, markSucceeded, markFailed, insertAsset } from './lib.js'
import { uploadFromUrl } from '../../lib/storage.js'
import { heygenRun } from '../../lib/providers/heygen.js'
import { hedraRun } from '../../lib/providers/hedra.js'

interface AvatarInput {
  avatar_id: string
  voice_id: string
  script: string
  background?: { type: 'color' | 'image'; value: string }
  character_image_url?: string
}

export async function generateAvatarJob(data: { jobId: string }) {
  const { jobId } = data
  const job = await fetchJob(jobId)
  await markRunning(jobId)

  try {
    const input = job.input as unknown as AvatarInput

    let videoUrl: string
    let externalId: string
    let duration: number | undefined

    if (job.provider === 'heygen') {
      const result = await heygenRun({
        avatarId: input.avatar_id,
        voiceId: input.voice_id,
        script: input.script,
        background: input.background,
        dimension: { width: 1080, height: 1920 },
      })
      videoUrl = result.videoUrl
      externalId = result.videoId
      duration = result.duration
    } else if (job.provider === 'hedra') {
      if (!input.character_image_url) {
        throw new Error('Hedra requires character_image_url')
      }
      const result = await hedraRun({
        characterImageUrl: input.character_image_url,
        script: input.script,
        voiceId: input.voice_id,
        aspectRatio: '9:16',
      })
      videoUrl = result.videoUrl
      externalId = result.generationId
    } else {
      throw new Error(`Unsupported avatar provider: ${job.provider}`)
    }

    const upload = await uploadFromUrl({
      orgId: job.organization_id,
      sourceUrl: videoUrl,
      ext: 'mp4',
      jobId,
    })

    const assetId = await insertAsset({
      orgId: job.organization_id,
      jobId,
      kind: 'avatar_video',
      source: job.provider,
      storagePath: upload.storagePath,
      storageBucket: upload.bucket,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      width: 1080,
      height: 1920,
      durationSeconds: duration,
      prompt: input.script.slice(0, 500),
      createdBy: job.created_by,
      metadata: { avatar_id: input.avatar_id, voice_id: input.voice_id },
    })

    await markSucceeded(jobId, { asset_ids: [assetId], external_id: externalId })
  } catch (err) {
    await markFailed(jobId, err)
    throw err
  }
}
