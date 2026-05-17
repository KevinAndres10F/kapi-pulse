import { Hono } from 'hono'
import { randomBytes } from 'node:crypto'
import { getProvider } from '../providers/index'
import { savePendingState } from '../lib/oauth-state'

const connect = new Hono()

/**
 * Verifica que las env vars necesarias para iniciar el flow estén configuradas.
 * Devuelve un mensaje legible si falta algo, null si está OK.
 */
function checkProviderConfig(name: string): string | null {
  switch (name) {
    case 'meta':
    case 'facebook':
    case 'instagram':
      if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
        return 'META_APP_ID o META_APP_SECRET no están configurados en el backend.'
      }
      if (!process.env.API_URL) {
        return 'API_URL no está configurado. Es necesario para construir el redirect_uri que Facebook espera.'
      }
      return null
    case 'linkedin':
      if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
        return 'LINKEDIN_CLIENT_ID o LINKEDIN_CLIENT_SECRET no están configurados.'
      }
      return null
    default:
      return null
  }
}

/**
 * GET /api/connect/:provider
 * Inicia el flujo OAuth redirigiendo al proveedor.
 */
connect.get('/:provider', async (c) => {
  const providerName = c.req.param('provider')
  const orgId = c.req.query('org_id')
  const userId = c.req.query('user_id')
  const appUrl = process.env.APP_URL || 'http://localhost:3000'

  if (!orgId || !userId) {
    return c.json({ error: 'Faltan parámetros org_id y user_id' }, 400)
  }

  const provider = getProvider(providerName)
  if (!provider) {
    return c.json({ error: `Proveedor "${providerName}" no soportado` }, 400)
  }

  const configError = checkProviderConfig(providerName)
  if (configError) {
    console.error(`[oauth] Config error for ${providerName}:`, configError)
    // Volver al frontend con un error legible en lugar de mandarlo a Meta a tener
    // una pantalla de error opaca.
    const qs = new URLSearchParams({
      error: 'config_missing',
      provider: providerName,
      message: configError,
    })
    return c.redirect(`${appUrl}/connections?${qs.toString()}`)
  }

  const state = randomBytes(32).toString('hex')
  savePendingState(state, { orgId, userId, provider: providerName })

  const redirectUri = `${process.env.API_URL}/api/callback/${providerName}`
  const authUrl = provider.getAuthUrl(state, redirectUri)

  console.log(`[oauth] Starting ${providerName} flow for org ${orgId}; redirect_uri=${redirectUri}`)
  return c.redirect(authUrl)
})

export { connect }
