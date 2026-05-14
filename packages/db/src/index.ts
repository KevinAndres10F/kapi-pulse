import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Schema PostgreSQL donde viven todas las tablas de KAPI Pulse.
 * Importante: este proyecto Supabase aloja otros productos en `public`,
 * así que aislamos KAPI Pulse en su propio schema.
 *
 * Para que supabase-js consulte este schema, hay que pasarlo en `db.schema`
 * al crear el cliente. Además, en el Dashboard de Supabase debe estar
 * agregado a "Exposed schemas" en API Settings.
 */
export const KAPI_PULSE_SCHEMA = 'kapi_pulse' as const

export function createSupabaseClient(url: string, anonKey: string) {
  return createClient<Database, 'kapi_pulse'>(url, anonKey, {
    db: { schema: KAPI_PULSE_SCHEMA },
  })
}

export function createSupabaseAdmin(url: string, serviceRoleKey: string) {
  return createClient<Database, 'kapi_pulse'>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: KAPI_PULSE_SCHEMA },
  })
}

export type { Database, MemberRole, SocialProvider, AccountStatus, PostStatus, Json } from './types'
export type { SupabaseClient } from '@supabase/supabase-js'
