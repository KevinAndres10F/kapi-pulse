import type { Context, MiddlewareHandler } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../lib/supabase'

export type OrgRole = 'viewer' | 'editor' | 'admin' | 'owner'

const ROLE_RANK: Record<OrgRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
}

export interface AuthContext {
  userId: string
  orgId: string
  role: OrgRole
}

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext
  }
}

/**
 * Extracts a JWT from the Authorization header or cookie and returns the
 * authenticated user id. Throws if invalid.
 */
async function resolveUserFromRequest(c: Context): Promise<string | null> {
  const authHeader = c.req.header('authorization') || c.req.header('Authorization')
  let token: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim()
  } else {
    const cookie = c.req.header('cookie') || ''
    const match = cookie.match(/sb-[^=]*-auth-token=([^;]+)/)
    if (match) {
      try {
        const raw = decodeURIComponent(match[1])
        const parsed = JSON.parse(raw)
        token = parsed?.access_token ?? null
      } catch {
        // ignore
      }
    }
  }

  if (!token) return null

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user.id
}

async function resolveOrgMembership(userId: string, orgId: string): Promise<OrgRole | null> {
  const { data, error } = await supabaseAdmin
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error) {
    console.error('[withOrgAuth] resolveOrgMembership error:', error)
    return null
  }
  if (!data) return null
  return data.role as OrgRole
}

function extractOrgId(c: Context): string | null {
  const fromQuery = c.req.query('org_id') || c.req.query('orgId')
  if (fromQuery) return fromQuery
  const fromParam = c.req.param('orgId') || c.req.param('org_id')
  if (fromParam) return fromParam
  return null
}

async function extractOrgIdFromBody(c: Context): Promise<string | null> {
  try {
    const cloned = c.req.raw.clone()
    const body = (await cloned.json()) as Record<string, unknown>
    const val = body?.orgId ?? body?.organization_id ?? body?.organizationId
    return typeof val === 'string' ? val : null
  } catch {
    return null
  }
}

/**
 * Hono middleware: requires the caller to be a member of the org (resolved
 * from query/param/body) with at least the given role. Populates c.var.auth.
 */
export function withOrgAuth(minRole: OrgRole = 'viewer'): MiddlewareHandler {
  return async (c, next) => {
    try {
      const userId = await resolveUserFromRequest(c)
      if (!userId) return c.json({ error: 'unauthorized' }, 401)

      let orgId = extractOrgId(c)
      if (!orgId && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(c.req.method)) {
        orgId = await extractOrgIdFromBody(c)
      }
      if (!orgId) return c.json({ error: 'missing org_id' }, 400)

      const role = await resolveOrgMembership(userId, orgId)
      if (!role) return c.json({ error: 'forbidden: not a member' }, 403)

      if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
        return c.json({ error: `forbidden: ${minRole} role required`, role }, 403)
      }

      c.set('auth', { userId, orgId, role })
      await next()
    } catch (err) {
      console.error('[withOrgAuth] unexpected error:', err)
      return c.json({ error: err instanceof Error ? err.message : 'unknown' }, 500)
    }
  }
}
