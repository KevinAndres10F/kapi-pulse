import { createClient } from '@supabase/supabase-js'

// Cliente admin (service role) para operaciones del backend.
// Todas las tablas de KAPI Pulse viven en el schema kapi_pulse para
// no colisionar con otros productos que comparten el mismo proyecto Supabase.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'kapi_pulse' },
  },
)
