import { Hono } from 'hono'
import { withOrgAuth } from '../services/auth'
import { getBalance, listTransactions, listPricing } from '../services/credits'

const credits = new Hono()

credits.get('/balance', withOrgAuth('viewer'), async (c) => {
  const { orgId } = c.var.auth
  try {
    const data = await getBalance(orgId)
    return c.json(data)
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'unknown' }, 500)
  }
})

credits.get('/history', withOrgAuth('viewer'), async (c) => {
  const { orgId } = c.var.auth
  const limit = Number(c.req.query('limit')) || 50
  const offset = Number(c.req.query('offset')) || 0
  const type = c.req.query('type')
  try {
    const data = await listTransactions(orgId, { limit, offset, type })
    return c.json({ transactions: data })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'unknown' }, 500)
  }
})

// Public to authenticated callers (does not need org scoping)
credits.get('/pricing', async (c) => {
  try {
    const data = await listPricing()
    c.header('cache-control', 'public, max-age=300')
    return c.json({ pricing: data })
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'unknown' }, 500)
  }
})

export { credits }
