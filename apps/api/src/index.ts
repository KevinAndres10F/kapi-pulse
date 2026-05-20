import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import 'dotenv/config'
import { connect } from './routes/connect'
import { callback } from './routes/callback'
import { posts } from './routes/posts'
import { ai } from './routes/ai'
import { metrics } from './routes/metrics'
import { credits } from './routes/credits'
import { assets } from './routes/assets'
import { campaigns as studioCampaigns } from './routes/studio/campaigns'
import { studioGenerate } from './routes/studio/generate'
import { ads, adsAdmin } from './routes/ads'
import { supabaseAdmin } from './lib/supabase'

const app = new Hono()

// CORS: aceptamos lista de origenes separados por coma en ALLOWED_ORIGINS
// (fallback a APP_URL para retrocompat). Soportamos wildcards de subdominio
// con sintaxis "*.netlify.app" para que los preview deploys tambien pasen.
// El IA Editor llama al API DIRECTAMENTE desde el browser para evitar
// timeouts del proxy de Netlify (>26s en respuestas largas de Claude).
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  process.env.APP_URL ||
  'http://localhost:3000'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function originMatches(origin: string): boolean {
  for (const allowed of allowedOrigins) {
    if (allowed === '*' || allowed === origin) return true
    // wildcard de subdominio: "*.netlify.app" matchea "https://foo.netlify.app"
    if (allowed.startsWith('*.')) {
      const suffix = allowed.slice(1) // ".netlify.app"
      try {
        const host = new URL(origin).host
        if (host.endsWith(suffix.slice(1)) && host !== suffix.slice(1)) {
          return true
        }
      } catch {
        // origin no es URL valida — ignorar
      }
    }
  }
  return false
}

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return origin
      return originMatches(origin) ? origin : null
    },
    credentials: true,
  }),
)

// Health check
app.get('/', (c) => c.json({ service: 'kapi-pulse-api', status: 'ok' }))
app.get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }))

// OAuth: initiator y callback en routers separados para no colisionar
// con otras rutas bajo /api/*
app.route('/api/connect', connect)
app.route('/api/callback', callback)

// Posts routes
app.route('/api/posts', posts)

// AI routes (proxy a apps/ai en la red interna)
app.route('/api/ai', ai)

// Metrics / analytics routes
app.route('/api/metrics', metrics)

// Studio (generación visual con IA + créditos)
app.route('/api/credits', credits)
app.route('/api/assets', assets)
app.route('/api/studio/campaigns', studioCampaigns)
app.route('/api/studio/generate', studioGenerate)

// Meta Ads (modelo agencia central — System User token)
app.route('/api/ads', ads)
app.route('/api/admin/ads', adsAdmin)

// API de cuentas sociales
app.get('/api/social-accounts', async (c) => {
  const orgId = c.req.query('org_id')
  if (!orgId) return c.json({ error: 'Falta org_id' }, 400)

  const { data, error } = await supabaseAdmin
    .from('social_accounts')
    .select('id, provider, external_id, display_name, avatar_url, status, scopes, expires_at, metadata, connected_at')
    .eq('organization_id', orgId)
    .order('connected_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ accounts: data })
})

// Desconectar cuenta
app.delete('/api/social-accounts/:id', async (c) => {
  const accountId = c.req.param('id')

  const { error } = await supabaseAdmin
    .from('social_accounts')
    .delete()
    .eq('id', accountId)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ success: true })
})

const port = Number(process.env.PORT) || 3001
console.log(`API escuchando en http://localhost:${port}`)

serve({ fetch: app.fetch, port })

export default app
