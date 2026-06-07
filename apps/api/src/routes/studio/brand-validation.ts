/**
 * Studio Brand Validation Routes
 * Endpoints for validating content against brand guidelines
 */

import { Hono } from 'hono'
import { withOrgAuth } from '../../services/auth'
import {
  validateAssetBranding,
  validateAssetsBranding,
  validateCampaignBranding,
  generateBrandComplianceReport,
} from '../../services/brand-validation'

const brandValidation = new Hono()

// Validate a single asset
brandValidation.get('/assets/:assetId/validate', withOrgAuth('viewer'), async (c) => {
  const assetId = c.req.param('assetId')
  const { orgId } = c.var.auth

  try {
    const result = await validateAssetBranding(assetId, orgId)
    return c.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Validation failed'
    return c.json({ error: message }, 500)
  }
})

// Validate multiple assets
brandValidation.post('/assets/validate-batch', withOrgAuth('viewer'), async (c) => {
  const body = await c.req.json()
  const { assetIds } = body as { assetIds: string[] }
  const { orgId } = c.var.auth

  if (!Array.isArray(assetIds) || assetIds.length === 0) {
    return c.json({ error: 'assetIds array required' }, 400)
  }

  try {
    const results = await validateAssetsBranding(assetIds, orgId)
    return c.json({ validations: results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Batch validation failed'
    return c.json({ error: message }, 500)
  }
})

// Validate campaign
brandValidation.get('/campaigns/:campaignId/validate', withOrgAuth('viewer'), async (c) => {
  const campaignId = c.req.param('campaignId')
  const { orgId } = c.var.auth

  try {
    const result = await validateCampaignBranding(campaignId, orgId)
    return c.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Campaign validation failed'
    return c.json({ error: message }, 500)
  }
})

// Get compliance report
brandValidation.get('/compliance-report', withOrgAuth('viewer'), async (c) => {
  const { orgId } = c.var.auth

  try {
    const report = await generateBrandComplianceReport(orgId)
    return c.json(report)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Report generation failed'
    return c.json({ error: message }, 500)
  }
})

export default brandValidation
