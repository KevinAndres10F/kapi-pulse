/**
 * Studio Dashboard Routes
 * Endpoints for brand and generation analytics
 */

import { Hono } from 'hono'
import { withOrgAuth } from '../../services/auth'
import { supabaseAdmin } from '../../lib/supabase'
import { generateBrandComplianceReport } from '../../services/brand-validation'

const dashboard = new Hono()

// Get brand overview
dashboard.get('/brand-overview', withOrgAuth('viewer'), async (c) => {
  const { orgId } = c.var.auth

  try {
    const report = await generateBrandComplianceReport(orgId)

    // Get recent characters
    const { data: characters } = await supabaseAdmin
      .from('character_profiles')
      .select('id, name, is_default')
      .eq('organization_id', orgId)

    // Get brand guidelines
    const { data: brand } = await supabaseAdmin
      .from('brand_guidelines')
      .select('primary_color, secondary_color, accent_color')
      .eq('organization_id', orgId)
      .single()

    return c.json({
      complianceReport: report,
      characters: characters || [],
      brand: brand || {},
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch overview'
    return c.json({ error: message }, 500)
  }
})

// Get generation analytics
dashboard.get('/generation-analytics', withOrgAuth('viewer'), async (c) => {
  const { orgId } = c.var.auth
  const days = Number(c.req.query('days')) || 30

  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // Generation stats
    const { data: generationJobs } = await supabaseAdmin
      .from('generation_jobs')
      .select('kind, provider, status, created_at')
      .eq('organization_id', orgId)
      .gte('created_at', cutoffDate.toISOString())

    // Group by kind
    const byKind: Record<string, { count: number; succeeded: number; failed: number }> = {}
    const byProvider: Record<string, { count: number; succeeded: number }> = {}

    for (const job of generationJobs || []) {
      // By kind
      if (!byKind[job.kind]) {
        byKind[job.kind] = { count: 0, succeeded: 0, failed: 0 }
      }
      byKind[job.kind].count++
      if (job.status === 'succeeded') byKind[job.kind].succeeded++
      if (job.status === 'failed') byKind[job.kind].failed++

      // By provider
      if (!byProvider[job.provider]) {
        byProvider[job.provider] = { count: 0, succeeded: 0 }
      }
      byProvider[job.provider].count++
      if (job.status === 'succeeded') byProvider[job.provider].succeeded++
    }

    // Character usage
    const { data: characterUsage } = await supabaseAdmin
      .from('character_usage_log')
      .select('character_id, count() as usage_count', { count: 'exact', head: false })
      .eq('organization_id', orgId)
      .gte('created_at', cutoffDate.toISOString())
      .groupBy('character_id')

    const totalJobs = (generationJobs || []).length
    const successRate = totalJobs > 0 ? Math.round((Object.values(byKind).reduce((sum, k) => sum + k.succeeded, 0) / totalJobs) * 100) : 0

    return c.json({
      period: `Last ${days} days`,
      totalGenerations: totalJobs,
      successRate,
      byKind,
      byProvider,
      characterUsage: characterUsage || [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch analytics'
    return c.json({ error: message }, 500)
  }
})

// Get posting statistics
dashboard.get('/posting-stats', withOrgAuth('viewer'), async (c) => {
  const { orgId } = c.var.auth
  const days = Number(c.req.query('days')) || 30

  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // Posts
    const { data: posts } = await supabaseAdmin
      .from('posts')
      .select('platform, status, validation_score')
      .eq('organization_id', orgId)
      .gte('created_at', cutoffDate.toISOString())

    const byPlatform: Record<string, { total: number; published: number; avgBrandScore: number }> = {}

    for (const post of posts || []) {
      if (!byPlatform[post.platform]) {
        byPlatform[post.platform] = { total: 0, published: 0, avgBrandScore: 0 }
      }
      byPlatform[post.platform].total++
      if (post.status === 'published') byPlatform[post.platform].published++
      byPlatform[post.platform].avgBrandScore += post.validation_score || 0
    }

    for (const platform in byPlatform) {
      byPlatform[platform].avgBrandScore = Math.round(
        byPlatform[platform].avgBrandScore / byPlatform[platform].total
      )
    }

    const totalPosts = (posts || []).length
    const publishedPosts = (posts || []).filter((p) => p.status === 'published').length

    return c.json({
      period: `Last ${days} days`,
      totalPosts,
      publishedPosts,
      avgBrandCompliance: totalPosts > 0
        ? Math.round((posts || []).reduce((sum, p) => sum + (p.validation_score || 0), 0) / totalPosts)
        : 0,
      byPlatform,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch posting stats'
    return c.json({ error: message }, 500)
  }
})

// Get quick stats
dashboard.get('/quick-stats', withOrgAuth('viewer'), async (c) => {
  const { orgId } = c.var.auth

  try {
    // Count characters
    const { count: characterCount } = await supabaseAdmin
      .from('character_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)

    // Count active campaigns
    const { count: campaignCount } = await supabaseAdmin
      .from('campaigns')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active')

    // Count recent posts (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { count: recentPosts } = await supabaseAdmin
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'published')
      .gte('published_at', sevenDaysAgo.toISOString())

    return c.json({
      characters: characterCount || 0,
      activeCampaigns: campaignCount || 0,
      postsLastWeek: recentPosts || 0,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch stats'
    return c.json({ error: message }, 500)
  }
})

export default dashboard
