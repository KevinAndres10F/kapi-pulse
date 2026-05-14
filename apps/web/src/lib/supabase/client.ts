import { createBrowserClient } from '@supabase/ssr'

const KAPI_PULSE_SCHEMA = 'kapi_pulse'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    // Retornar un proxy que no hace nada (para builds sin Supabase)
    return createMockClient()
  }

  if (!client) {
    client = createBrowserClient(url, key, {
      db: { schema: KAPI_PULSE_SCHEMA },
    })
  }
  return client
}

// Mock client que no crashea durante SSG/build
function createMockClient(): any {
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
