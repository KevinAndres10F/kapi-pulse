/**
 * Helpers de debug para OAuth de Meta.
 *
 * Activación: setea env var DEBUG_META_OAUTH=1 en el container kapi-api.
 * Cuando está activo, providers/meta.ts y routes/callback.ts emiten logs
 * estructurados con prefijo [meta-debug] para diagnosticar por qué un flow
 * termina con "0 Pages discovered" u otros fallos sutiles.
 *
 * Los tokens NUNCA se loguean crudos — se enmascaran con mask().
 */

export const DEBUG_META_OAUTH = process.env.DEBUG_META_OAUTH === '1'

/**
 * Enmascara un token o secret para log. Devuelve los primeros 6 y
 * los últimos 6 chars con ... en medio. Si es muy corto, ***.
 */
export function mask(v?: string | null): string | null {
  if (!v) return null
  if (v.length <= 12) return '***'
  return `${v.slice(0, 6)}...${v.slice(-6)}`
}

/**
 * Normaliza un valor de "scopes" que puede llegar como string CSV,
 * array de strings, o algo más raro. Devuelve siempre string[].
 */
export function toArray(v: unknown): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v.map(String)
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean)
  return []
}

export function dbg(event: string, payload: Record<string, unknown>): void {
  if (!DEBUG_META_OAUTH) return
  console.log(`[meta-debug] ${event}`, JSON.stringify(payload))
}
