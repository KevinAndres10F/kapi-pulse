/**
 * Proxy de /api/ai/* hacia el servicio interno apps/ai (kapi-ai en Coolify).
 *
 * Diseño: apps/ai NO se expone públicamente — solo apps/api lo alcanza por
 * red interna de Docker. Esto evita que un atacante invoque /api/ai/generate
 * directamente y gaste créditos de Claude sin auth.
 *
 * TODO (Fase 4a+): validar el JWT del usuario contra Supabase antes de proxy
 * y registrar el uso por organization_id para rate-limiting y billing.
 */
import { Hono } from 'hono'

const ai = new Hono()

const AI_URL = process.env.AI_URL || 'http://kapi-ai:3002'

async function proxy(c: any, path: string) {
  try {
    const body = await c.req.json()
    const upstream = await fetch(`${AI_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000), // 2 min — Claude puede tardar con thinking
    })
    const data = await upstream.json()
    return c.json(data, upstream.status as 200 | 400 | 500)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[ai-proxy] Error en ${path}:`, message)
    return c.json(
      { error: 'AI service unreachable', detail: message },
      503,
    )
  }
}

ai.post('/generate', (c) => proxy(c, '/api/ai/generate'))
ai.post('/improve', (c) => proxy(c, '/api/ai/improve'))
ai.post('/analyze-competitors', (c) => proxy(c, '/api/ai/analyze-competitors'))
ai.post('/studio/copy', (c) => proxy(c, '/api/ai/studio/copy'))

ai.get('/health', async (c) => {
  try {
    const upstream = await fetch(`${AI_URL}/health`, {
      signal: AbortSignal.timeout(5_000),
    })
    const data = await upstream.json()
    return c.json(data, upstream.status as 200 | 503)
  } catch {
    return c.json({ status: 'unreachable', upstream: AI_URL }, 503)
  }
})

export { ai }
