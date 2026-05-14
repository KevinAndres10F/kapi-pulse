import { createClient } from '@supabase/supabase-js'

export function createSupabaseClient(url: string, anonKey: string) {
  return createClient(url, anonKey)
}

export function createSupabaseAdmin(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export type { SupabaseClient } from '@supabase/supabase-js'
