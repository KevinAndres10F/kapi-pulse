/**
 * Publishing Service with Brand Validation
 * Handles post publishing with brand consistency checks
 */

import { supabaseAdmin } from '../lib/supabase'
import { validateAssetBranding } from './brand-validation'

export interface PublishingRequest {
  assetIds: string[]
  platform: 'instagram' | 'tiktok' | 'linkedin' | 'facebook' | 'twitter'
  caption?: string
  scheduledFor?: string // ISO 8601 date
  validateBranding?: boolean // default: true
}

export interface PublishingResult {
  success: boolean
  postId?: string
  validationResults?: Record<string, { score: number; isValid: boolean }>
  warnings?: string[]
  errors?: string[]
}

/**
 * Publish content with brand validation
 */
export async function publishWithBrandValidation(
  request: PublishingRequest,
  organizationId: string,
  userId: string
): Promise<PublishingResult> {
  const errors: string[] = []
  const warnings: string[] = []
  const validationResults: Record<string, { score: number; isValid: boolean }> = {}

  // Validate brand if requested
  if (request.validateBranding !== false) {
    for (const assetId of request.assetIds) {
      const validation = await validateAssetBranding(assetId, organizationId)
      validationResults[assetId] = {
        score: validation.score,
        isValid: validation.isValid,
      }

      if (!validation.isValid) {
        warnings.push(
          `Asset ${assetId} has brand compliance score ${validation.score}/100. Issues: ${validation.issues.map((i) => i.message).join(', ')}`
        )
      }

      if (validation.warnings.length > 0) {
        warnings.push(`Asset ${assetId}: ${validation.warnings.join(', ')}`)
      }
    }

    // Check if we should proceed despite warnings
    const criticalIssues = Object.entries(validationResults).filter(([_, v]) => !v.isValid).length
    if (criticalIssues > 0) {
      errors.push(`${criticalIssues} asset(s) failed brand validation`)
    }
  }

  // If there are critical errors, don't proceed
  if (errors.length > 0) {
    return {
      success: false,
      errors,
      warnings,
      validationResults,
    }
  }

  try {
    // Create post record
    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .insert({
        organization_id: organizationId,
        created_by: userId,
        platform: request.platform,
        caption: request.caption,
        asset_ids: request.assetIds,
        status: request.scheduledFor ? 'scheduled' : 'published',
        published_at: request.scheduledFor ? null : new Date().toISOString(),
        scheduled_for: request.scheduledFor,
        brand_validated: true,
        validation_score: Math.round(
          Object.values(validationResults).reduce((sum, v) => sum + v.score, 0) /
            Object.keys(validationResults).length
        ),
      })
      .select('id')
      .single()

    if (postError || !post) {
      errors.push(`Failed to create post: ${postError?.message || 'Unknown error'}`)
      return {
        success: false,
        errors,
        warnings,
        validationResults,
      }
    }

    return {
      success: true,
      postId: post.id,
      validationResults,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch (err) {
    errors.push(`Publishing failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    return {
      success: false,
      errors,
      warnings,
      validationResults,
    }
  }
}

/**
 * Bulk publish multiple posts
 */
export async function bulkPublishWithValidation(
  requests: PublishingRequest[],
  organizationId: string,
  userId: string
): Promise<PublishingResult[]> {
  return Promise.all(requests.map((req) => publishWithBrandValidation(req, organizationId, userId)))
}

/**
 * Get publishing history with brand metrics
 */
export async function getPublishingHistory(organizationId: string, limit: number = 50) {
  const { data: posts } = await supabaseAdmin
    .from('posts')
    .select('*')
    .eq('organization_id', organizationId)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (!posts) return []

  return posts.map((post) => ({
    id: post.id,
    platform: post.platform,
    status: post.status,
    publishedAt: post.published_at,
    scheduledFor: post.scheduled_for,
    caption: post.caption,
    brandValidationScore: post.validation_score,
    assetCount: post.asset_ids?.length || 0,
  }))
}

/**
 * Get publishing performance by platform
 */
export async function getPublishingPerformance(organizationId: string) {
  const { data: posts } = await supabaseAdmin
    .from('posts')
    .select('platform, validation_score')
    .eq('organization_id', organizationId)
    .not('published_at', 'is', null)

  if (!posts || posts.length === 0) {
    return {}
  }

  const performance: Record<
    string,
    { count: number; avgBrandScore: number; lastPublished: string | null }
  > = {}

  for (const post of posts) {
    if (!performance[post.platform]) {
      performance[post.platform] = {
        count: 0,
        avgBrandScore: 0,
        lastPublished: null,
      }
    }
    performance[post.platform].count++
    performance[post.platform].avgBrandScore += post.validation_score || 0
  }

  for (const platform in performance) {
    performance[platform].avgBrandScore = Math.round(
      performance[platform].avgBrandScore / performance[platform].count
    )
  }

  return performance
}
