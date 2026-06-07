/**
 * Studio Publishing Routes
 * Endpoints for publishing content with brand validation
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { withOrgAuth } from '../../services/auth'
import {
  publishWithBrandValidation,
  bulkPublishWithValidation,
  getPublishingHistory,
  getPublishingPerformance,
} from '../../services/publishing'

const publishing = new Hono()

const PublishSchema = z.object({
  assetIds: z.array(z.string().uuid()).min(1),
  platform: z.enum(['instagram', 'tiktok', 'linkedin', 'facebook', 'twitter']),
  caption: z.string().max(3000).optional(),
  scheduledFor: z.string().datetime().optional(),
  validateBranding: z.boolean().optional(),
})

// Publish a post
publishing.post('/posts', withOrgAuth('editor'), async (c) => {
  const body = await c.req.json()
  const parsed = PublishSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'invalid', details: parsed.error.flatten() }, 400)
  }

  const { orgId, userId } = c.var.auth
  const data = parsed.data

  try {
    const result = await publishWithBrandValidation(data, orgId, userId)

    if (!result.success) {
      return c.json(result, 400)
    }

    return c.json(result, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Publishing failed'
    return c.json({ error: message }, 500)
  }
})

// Bulk publish
publishing.post('/posts/bulk', withOrgAuth('editor'), async (c) => {
  const body = await c.req.json()
  const { posts } = body as { posts: z.infer<typeof PublishSchema>[] }

  if (!Array.isArray(posts) || posts.length === 0) {
    return c.json({ error: 'posts array required' }, 400)
  }

  const { orgId, userId } = c.var.auth

  // Validate each post
  const validated = posts.map((p) => PublishSchema.safeParse(p))
  const invalidIndex = validated.findIndex((v) => !v.success)

  if (invalidIndex !== -1) {
    return c.json(
      { error: `Invalid post at index ${invalidIndex}`, details: validated[invalidIndex]?.error?.flatten() },
      400
    )
  }

  try {
    const results = await bulkPublishWithValidation(
      validated.map((v) => v.data!),
      orgId,
      userId
    )
    return c.json({ results }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bulk publishing failed'
    return c.json({ error: message }, 500)
  }
})

// Get publishing history
publishing.get('/history', withOrgAuth('viewer'), async (c) => {
  const { orgId } = c.var.auth
  const limit = Number(c.req.query('limit')) || 50

  try {
    const history = await getPublishingHistory(orgId, limit)
    return c.json({ history })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch history'
    return c.json({ error: message }, 500)
  }
})

// Get performance metrics
publishing.get('/performance', withOrgAuth('viewer'), async (c) => {
  const { orgId } = c.var.auth

  try {
    const performance = await getPublishingPerformance(orgId)
    return c.json(performance)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch performance'
    return c.json({ error: message }, 500)
  }
})

export default publishing
