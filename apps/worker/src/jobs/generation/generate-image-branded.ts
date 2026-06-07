/**
 * Branded Image Generation Job
 * Generates images with character and brand styling using Banana or FAL
 */

import { fetchJob, markRunning, markSucceeded, markFailed, insertAsset } from './lib.js'
import { uploadFromUrl } from '../../lib/storage.js'
import { falGenerateImage } from '../../lib/providers/fal.js'
import { bananaGenerateImage, bananaGenerateCarousel } from '../../services/providers/banana.js'
import { injectBrandAndCharacter } from '../../services/brand-injection.js'

interface BrandedImageInput {
  prompt: string
  negative_prompt?: string
  character_profile_id?: string
  brand_guidelines_id?: string
  image_size?: string
  num_images?: number
  is_carousel?: boolean
  provider?: 'fal' | 'banana'
  seed?: number
}

export async function generateImageBrandedJob(data: { jobId: string }) {
  const { jobId } = data
  const job = await fetchJob(jobId)
  await markRunning(jobId)

  try {
    const input = job.input as unknown as BrandedImageInput

    // Inject brand and character details
    const injected = await injectBrandAndCharacter(input.prompt, {
      organizationId: job.organization_id,
      characterProfileId: input.character_profile_id,
      brandGuidelinesId: input.brand_guidelines_id,
    })

    let urls: Array<{ url: string; width: number; height: number }> = []
    let seed = input.seed ?? 0
    let externalId: string | undefined
    let provider = input.provider || 'fal'

    // Generate using selected provider
    if (input.is_carousel && provider === 'banana') {
      // Generate carousel with multiple images
      const result = await bananaGenerateCarousel({
        prompt: injected.prompt,
        numImages: input.num_images || 3,
        model: 'flux-pro',
        baseSeed: input.seed,
      })
      urls = result.images
      seed = result.seed
      externalId = result.requestId
    } else if (provider === 'banana') {
      // Single image with Banana
      const result = await bananaGenerateImage({
        prompt: injected.prompt,
        negative_prompt: injected.negativePrompt,
        num_outputs: input.num_images || 1,
        seed: input.seed,
        model: 'flux-pro',
      })
      urls = result.images
      seed = result.seed
      externalId = result.requestId
    } else {
      // Default to FAL
      const falResult = await falGenerateImage(
        {
          prompt: injected.prompt,
          negative_prompt: injected.negativePrompt,
          image_size: input.image_size || 'square_hd',
          num_images: input.num_images || 1,
          seed: input.seed,
        },
        job.model
      )
      urls = falResult.images.map((i) => ({ url: i.url, width: i.width, height: i.height }))
      seed = falResult.seed
      externalId = falResult.requestId
    }

    // Upload all generated images
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
        source: provider,
        storagePath: upload.storagePath,
        storageBucket: upload.bucket,
        mimeType: upload.mimeType,
        width: img.width,
        height: img.height,
        sizeBytes: upload.sizeBytes,
        prompt: injected.prompt,
        seed,
        createdBy: job.created_by,
        metadata: {
          brand_colors: injected.metadata.brandColors,
          character: injected.metadata.characterName,
          original_prompt: input.prompt,
        },
      })
      assetIds.push(id)
    }

    await markSucceeded(jobId, {
      asset_ids: assetIds,
      external_id: externalId,
      seed,
      brand_metadata: injected.metadata,
    })
  } catch (err) {
    await markFailed(jobId, err)
    throw err
  }
}
