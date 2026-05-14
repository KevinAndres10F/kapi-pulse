import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import 'dotenv/config'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({
  origin: process.env.APP_URL || 'http://localhost:3000',
  credentials: true,
}))

app.get('/', (c) => c.json({ service: 'kapi-pulse-api', status: 'ok' }))

app.get('/health', (c) => c.json({ status: 'healthy', timestamp: new Date().toISOString() }))

const port = Number(process.env.PORT) || 3001
console.log(`API escuchando en http://localhost:${port}`)

serve({ fetch: app.fetch, port })

export default app
