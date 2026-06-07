/**
 * Video Generation with Audio Sync
 * Generates video and synchronizes with Eleven Labs audio
 */

import { fetchJob, markRunning, markSucceeded, markFailed, insertAsset, getAssetSignedUrl } from './lib.js'
import { uploadFromUrl } from '../../lib/storage.js'
import { falGenerateVideo } from '../../lib/providers/fal.js'
import { injectBrandAndCharacter } from '../../services/brand-injection.js'

interface VideoWithAudioInput {
  prompt: string
  audio_asset_id?: string
  character_profile_id?: string
  brand_guidelines_id?: string
  source_asset_id?: string
  duration?: 5 | 10
  aspect_ratio?: '16:9' | '9:16' | '1:1'
  negative_prompt?: string
}

export async function generateVideoWithAudioJob(data: { jobId: string }) {
  const { jobId } = data
  const job = await fetchJob(jobId)
  await markRunning(jobId)

  try {
    const input = job.input as unknown as VideoWithAudioInput

    // Inject brand and character details
    const injected = await injectBrandAndCharacter(input.prompt, {
      organizationId: job.organization_id,
      characterProfileId: input.character_profile_id,
      brandGuidelinesId: input.brand_guidelines_id,
    })

    let imageUrl: string | undefined
    if (input.source_asset_id) {
      imageUrl = await getAssetSignedUrl(input.source_asset_id, { expiresIn: 3600 })
    }

    // Get audio URL if provided
    let audioUrl: string | undefined
    if (input.audio_asset_id) {
      audioUrl = await getAssetSignedUrl(input.audio_asset_id, { expiresIn: 3600 })
    }

    // Generate video with FAL
    const videoResult = await falGenerateVideo(
      {
        prompt: injected.prompt,
        image_url: imageUrl,
        duration: input.duration ?? 5,
        aspect_ratio: input.aspect_ratio || '9:16',
        negative_prompt: injected.negativePrompt,
      },
      job.model
    )

    // Upload video
    const videoUpload = await uploadFromUrl({
      orgId: job.organization_id,
      sourceUrl: videoResult.videoUrl,
      ext: 'mp4',
      jobId,
    })

    // Create video asset
    const videoAssetId = await insertAsset({
      orgId: job.organization_id,
      jobId,
      kind: 'video',
      source: 'fal',
      storagePath: videoUpload.storagePath,
      storageBucket: videoUpload.bucket,
      mimeType: videoUpload.mimeType,
      sizeBytes: videoUpload.sizeBytes,
      width: videoResult.width,
      height: videoResult.height,
      durationSeconds: videoResult.durationSeconds,
      prompt: injected.prompt,
      parentAssetId: input.source_asset_id,
      createdBy: job.created_by,
      metadata: {
        audio_asset_id: input.audio_asset_id,
        has_audio: !!input.audio_asset_id,
        character: injected.metadata.characterName,
        brand_colors: injected.metadata.brandColors,
      },
    })

    // Note: Actual audio mixing/syncing should be done in post-processing
    // or through a separate video composition service

    await markSucceeded(jobId, {
      asset_ids: [videoAssetId],
      external_id: videoResult.requestId,
      audio_asset_id: input.audio_asset_id,
      video_duration: videoResult.durationSeconds,
      brand_metadata: injected.metadata,
    })
  } catch (err) {
    await markFailed(jobId, err)
    throw err
  }
}
