import { createBrowserClient } from '@supabase/ssr'

const KAPI_PULSE_SCHEMA = 'kapi_pulse'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Durante el build estático (SSG) sin env vars, devolvemos un mock que
  // permite que el bundle se genere. En runtime, si las env vars no están
  // configuradas, falla ruidosamente para evitar que "¡Revisa tu email!"
  // se muestre cuando ningún signup llegó realmente a Supabase.
  if (!url || !key) {
    if (typeof window !== 'undefined') {
      throw new Error(
        '[KAPI] Supabase no está configurado: faltan NEXT_PUBLIC_SUPABASE_URL ' +
        'y/o NEXT_PUBLIC_SUPABASE_ANON_KEY en las env vars del deploy. ' +
        'Verifica Netlify → Site settings → Environment variables y haz un ' +
        'rebuild (las NEXT_PUBLIC_* se inyectan en build-time).',
      )
    }
    return createBuildTimeMockClient()
  }

  if (!client) {
    client = createBrowserClient(url, key, {
      db: { schema: KAPI_PULSE_SCHEMA },
    })
  }
  return client
}

// Mock solo para que el build estático de Next.js no crashee.
// NUNCA se ejecuta en el browser: si llegamos aquí en runtime, ya tiramos error arriba.
function createBuildTimeMockClient(): any {
  const noop = () => ({ data: null, error: null })
  const noopAsync = async () => ({ data: { user: null, session: null }, error: null })
  return {
    auth: {
      getUser: noopAsync,
      getSession: noopAsync,
      signInWithPassword: noopAsync,
      signInWithOAuth: noopAsync,
      signInWithOtp: noopAsync,
      signUp: noopAsync,
      signOut: noopAsync,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: noopAsync, limit: () => noopAsync, ...noop() }), ...noop() }),
      insert: () => ({ select: () => ({ single: noopAsync }), ...noop() }),
      update: noop,
      delete: noop,
      upsert: noop,
    }),
  }
}
