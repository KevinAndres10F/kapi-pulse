import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import 'dotenv/config'
import { connect } from './routes/connect'
import { callback } from './routes/callback'
import { posts } from './routes/posts'
import { ai } from './routes/ai'
import { supabaseAdmin } from './lib/supabase'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({
  origin: process.env.APP_URL || 'http://localhost:3000',
  credentials: true,
}))

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
