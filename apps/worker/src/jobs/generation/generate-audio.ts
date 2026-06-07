/**
 * Audio Generation Job
 * Generates narration/dialogue using Eleven Labs TTS
 */

import { fetchJob, markRunning, markSucceeded, markFailed, insertAsset } from './lib.js'
import { uploadFromUrl } from '../../lib/storage.js'
import { elevenLabsGenerateAudio } from '../../services/providers/eleven_labs.js'

interface AudioInput {
  text: string
  voice_id: string
  model_id?: string
}

export async function generateAudioJob(data: { jobId: string }) {
  const { jobId } = data
  const job = await fetchJob(jobId)
  await markRunning(jobId)

  try {
    const input = job.input as unknown as AudioInput

    const result = await elevenLabsGenerateAudio({
      text: input.text,
      voiceId: input.voice_id,
      modelId: input.model_id,
      stability: 0.5,
      similarityBoost: 0.75,
    })

    // Convert blob URL to actual file upload
    const audioResponse = await fetch(result.audioUrl)
    const audioBlob = await audioResponse.blob()
    const audioArrayBuffer = await audioBlob.arrayBuffer()

    // Upload audio file
    const upload = await uploadFromUrl({
      orgId: job.organization_id,
      sourceUrl: result.audioUrl,
      ext: 'mp3',
      jobId,
    })

    const assetId = await insertAsset({
      orgId: job.organization_id,
      jobId,
      kind: 'audio',
      source: 'eleven_labs',
      storagePath: upload.storagePath,
      storageBucket: upload.bucket,
      mimeType: 'audio/mpeg',
      sizeBytes: upload.sizeBytes,
      durationSeconds: result.duration,
      metadata: {
        voice_id: input.voice_id,
        text_length: input.text.length,
      },
      createdBy: job.created_by,
    })

    await markSucceeded(jobId, {
      asset_ids: [assetId],
      external_id: result.requestId,
      duration: result.duration,
    })
  } catch (err) {
    await markFailed(jobId, err)
    throw err
  }
}
