import { Hono } from 'hono'
import { randomBytes } from 'node:crypto'
import { getProvider } from '../providers/index'
import { savePendingState } from '../lib/oauth-state'

const connect = new Hono()

/**
 * GET /api/connect/:provider
 * Inicia el flujo OAuth redirigiendo al proveedor.
 */
connect.get('/:provider', async (c) => {
  const providerName = c.req.param('provider')
  const orgId = c.req.query('org_id')
  const userId = c.req.query('user_id')

  if (!orgId || !userId) {
    return c.json({ error: 'Faltan parámetros org_id y user_id' }, 400)
  }

  const provider = getProvider(providerName)
  if (!provider) {
    return c.json({ error: `Proveedor "${providerName}" no soportado` }, 400)
  }

  const state = randomBytes(32).toString('hex')
  savePendingState(state, { orgId, userId, provider: providerName })

  const redirectUri = `${process.env.API_URL}/api/callback/${providerName}`
  const authUrl = provider.getAuthUrl(state, redirectUri)

  return c.redirect(authUrl)
})

export { connect }
