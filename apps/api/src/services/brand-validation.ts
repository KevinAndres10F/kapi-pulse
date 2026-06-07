/**
 * Brand Validation Service
 * Validates generated content for brand consistency before publishing
 */

import { supabaseAdmin } from '../lib/supabase'

export interface BrandValidationResult {
  isValid: boolean
  score: number // 0-100
  issues: ValidationIssue[]
  warnings: string[]
  suggestions: string[]
}

export interface ValidationIssue {
  type: 'error' | 'warning'
  field: string
  message: string
  severity: 'critical' | 'high' | 'medium' | 'low'
}

/**
 * Validate a generated asset for brand consistency
 */
export async function validateAssetBranding(
  assetId: string,
  organizationId: string
): Promise<BrandValidationResult> {
  const issues: ValidationIssue[] = []
  const warnings: string[] = []
  const suggestions: string[] = []
  let score = 100

  // Fetch asset with metadata
  const { data: asset } = await supabaseAdmin
    .from('generated_assets')
    .select('*, generation_jobs(character_profile_id, brand_guidelines_id, input)')
    .eq('id', assetId)
    .eq('organization_id', organizationId)
    .single()

  if (!asset) {
    return {
      isValid: false,
      score: 0,
      issues: [{ type: 'error', field: 'asset', message: 'Asset not found', severity: 'critical' }],
      warnings: [],
      suggestions: [],
    }
  }

  // Get brand guidelines
  const { data: brandGuidelines } = await supabaseAdmin
    .from('brand_guidelines')
    .select('*')
    .eq('organization_id', organizationId)
    .single()

  if (!brandGuidelines) {
    warnings.push('No brand guidelines configured for this organization')
  }

  // Validate asset metadata
  const metadata = asset.metadata || {}

  // Check 1: Character usage
  if (asset.kind === 'image' || asset.kind === 'video') {
    if (!metadata.character) {
      issues.push({
        type: 'warning',
        field: 'character',
        message: 'Asset generated without explicit character profile',
        severity: 'medium',
      })
      score -= 10
      suggestions.push('Regenerate asset with character profile for better brand consistency')
    }
  }

  // Check 2: Brand colors mentioned
  if (asset.kind === 'image') {
    const brandColors = metadata.brand_colors || []
    if (brandColors.length === 0) {
      warnings.push('No brand colors detected in asset metadata')
      score -= 5
    } else if (brandColors.length < 2) {
      suggestions.push('Consider using more brand colors for stronger visual identity')
      score -= 5
    }
  }

  // Check 3: Watermark presence (for social media)
  if (asset.kind === 'image' && brandGuidelines?.watermark_enabled) {
    if (!metadata.has_watermark) {
      warnings.push('Watermark not applied - recommended for branded assets')
      score -= 10
      suggestions.push('Apply KAPI watermark before publishing on social media')
    }
  }

  // Check 4: Aspect ratio compliance
  if (asset.kind === 'image' && asset.width && asset.height) {
    const aspectRatio = `${asset.width}:${asset.height}`
    const recommendedRatios = brandGuidelines?.recommended_aspect_ratios || ['1:1', '16:9', '9:16']

    const isValid = recommendedRatios.some((ratio) => {
      const [w, h] = ratio.split(':').map(Number)
      const thumbRatio = Math.round((asset.width / asset.height) * 100) / 100
      const expectedRatio = Math.round((w / h) * 100) / 100
      return Math.abs(thumbRatio - expectedRatio) < 0.1
    })

    if (!isValid) {
      issues.push({
        type: 'warning',
        field: 'aspect_ratio',
        message: `Aspect ratio ${aspectRatio} not in recommended ratios`,
        severity: 'low',
      })
      score -= 5
    }
  }

  // Check 5: Image size compliance
  if (asset.kind === 'image') {
    const maxWidth = brandGuidelines?.max_image_width || 1080
    const maxHeight = brandGuidelines?.max_image_height || 1350

    if (asset.width && asset.width > maxWidth) {
      warnings.push(`Image width ${asset.width}px exceeds recommended ${maxWidth}px`)
      score -= 5
    }
    if (asset.height && asset.height > maxHeight) {
      warnings.push(`Image height ${asset.height}px exceeds recommended ${maxHeight}px`)
      score -= 5
    }
  }

  // Check 6: Video duration
  if (asset.kind === 'video' && asset.duration_seconds) {
    const maxDuration = 60 // 1 minute max for social media
    if (asset.duration_seconds > maxDuration) {
      issues.push({
        type: 'warning',
        field: 'duration',
        message: `Video duration ${asset.duration_seconds}s exceeds recommended ${maxDuration}s`,
        severity: 'low',
      })
      score -= 5
      suggestions.push('Trim video to under 60 seconds for better social media performance')
    }
  }

  // Check 7: Audio sync for video+audio
  if (asset.kind === 'video' && metadata.has_audio) {
    if (!metadata.audio_asset_id) {
      issues.push({
        type: 'warning',
        field: 'audio',
        message: 'Video marked as having audio but no audio asset linked',
        severity: 'high',
      })
      score -= 15
      suggestions.push('Ensure audio is properly linked to video asset')
    }
  }

  // Check 8: File size optimization
  if (asset.size_bytes) {
    const maxSize = 50 * 1024 * 1024 // 50MB max
    if (asset.size_bytes > maxSize) {
      warnings.push(`Asset size ${(asset.size_bytes / 1024 / 1024).toFixed(1)}MB exceeds optimal ${maxSize / 1024 / 1024}MB`)
      score -= 10
      suggestions.push('Compress asset for better performance on social media')
    }
  }

  // Ensure score doesn't go below 0
  score = Math.max(0, score)

  const isValid = issues.filter((i) => i.severity === 'critical').length === 0 && score >= 60

  return {
    isValid,
    score,
    issues,
    warnings,
    suggestions,
  }
}

/**
 * Batch validate multiple assets
 */
export async function validateAssetsBranding(
  assetIds: string[],
  organizationId: string
): Promise<Record<string, BrandValidationResult>> {
  const results: Record<string, BrandValidationResult> = {}

  for (const assetId of assetIds) {
    results[assetId] = await validateAssetBranding(assetId, organizationId)
  }

  return results
}

/**
 * Check brand consistency across a campaign
 */
export async function validateCampaignBranding(
  campaignId: string,
  organizationId: string
): Promise<{
  overallScore: number
  assetScores: Record<string, number>
  criticalIssues: ValidationIssue[]
  recommendations: string[]
}> {
  // Fetch all assets in campaign
  const { data: assets } = await supabaseAdmin
    .from('generated_assets')
    .select('id, kind')
    .eq('organization_id', organizationId)
    .in('generation_jobs(campaign_id)', [campaignId])

  if (!assets || assets.length === 0) {
    return {
      overallScore: 0,
      assetScores: {},
      criticalIssues: [],
      recommendations: ['No assets found in campaign'],
    }
  }

  const validations = await validateAssetsBranding(
    assets.map((a) => a.id),
    organizationId
  )

  const scores = Object.values(validations).map((v) => v.score)
  const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

  const allIssues = Object.values(validations).flatMap((v) => v.issues)
  const criticalIssues = allIssues.filter((i) => i.severity === 'critical')

  const allSuggestions = Object.values(validations).flatMap((v) => v.suggestions)
  const uniqueSuggestions = [...new Set(allSuggestions)]

  const assetScores = Object.entries(validations).reduce(
    (acc, [id, validation]) => {
      acc[id] = validation.score
      return acc
    },
    {} as Record<string, number>
  )

  return {
    overallScore,
    assetScores,
    criticalIssues,
    recommendations: uniqueSuggestions,
  }
}

/**
 * Generate a brand compliance report
 */
export async function generateBrandComplianceReport(organizationId: string) {
  const { data: assets } = await supabaseAdmin
    .from('generated_assets')
    .select('id, kind, created_at, metadata')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (!assets || assets.length === 0) {
    return {
      period: 'Last 100 assets',
      totalAssets: 0,
      brandCompliance: 0,
      byKind: {},
      topIssues: [],
    }
  }

  const validations = await validateAssetsBranding(
    assets.map((a) => a.id),
    organizationId
  )

  const scores = Object.values(validations).map((v) => v.score)
  const avgCompliance = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

  // Count by kind
  const byKind: Record<string, { count: number; avgScore: number }> = {}
  for (const asset of assets) {
    if (!byKind[asset.kind]) {
      byKind[asset.kind] = { count: 0, avgScore: 0 }
    }
    byKind[asset.kind].count++
    byKind[asset.kind].avgScore += validations[asset.id].score
  }

  for (const kind in byKind) {
    byKind[kind].avgScore = Math.round(byKind[kind].avgScore / byKind[kind].count)
  }

  // Get top issues
  const allIssues = Object.values(validations).flatMap((v) => v.issues)
  const issueCount: Record<string, number> = {}
  for (const issue of allIssues) {
    issueCount[issue.message] = (issueCount[issue.message] || 0) + 1
  }
  const topIssues = Object.entries(issueCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([message, count]) => ({ message, occurrences: count }))

  return {
    period: 'Last 100 assets',
    totalAssets: assets.length,
    brandCompliance: avgCompliance,
    byKind,
    topIssues,
  }
}
