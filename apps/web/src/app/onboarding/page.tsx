'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const TIMEZONES = [
  'America/Guayaquil',
  'America/Bogota',
  'America/Mexico_City',
  'America/Buenos_Aires',
  'America/Lima',
  'America/Santiago',
  'America/Sao_Paulo',
]

export default function OnboardingPage() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [timezone, setTimezone] = useState('America/Guayaquil')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // Verificar si ya tiene una org, redirigir al dashboard
  useEffect(() => {
    async function checkOrgs() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: memberships } = await supabase
        .from('organization_members')
        .select('organization_id, organizations(slug)')
        .eq('user_id', user.id)
        .limit(1)

      if (memberships && memberships.length > 0) {
        const org = memberships[0].organizations as unknown as { slug: string }
        router.push(`/${org.slug}/dashboard`)
        return
      }
      setChecking(false)
    }
    checkOrgs()
  }, [supabase, router])

  function generateSlug(orgName: string) {
    return orgName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  function handleNameChange(value: string) {
    setName(value)
    setSlug(generateSlug(value))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (slug.length < 2) {
      setError('El nombre de la organización es muy corto.')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Sesión expirada. Vuelve a iniciar sesión.')
      setLoading(false)
      return
    }

    // Crear org + membership owner atómicamente via RPC (evita race con RLS).
    const { data: org, error: orgError } = await supabase.rpc(
      'create_organization_with_owner',
      { p_name: name, p_slug: slug, p_timezone: timezone },
    )

    if (orgError) {
      if (orgError.code === '23505') {
        setError('Ya existe una organización con ese nombre. Elige otro.')
      } else {
        setError(orgError.message || 'Error al crear la organización. Intenta de nuevo.')
      }
      setLoading(false)
      return
    }

    router.push(`/${(org as { slug: string }).slug}/dashboard`)
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg space-y-8 rounded-xl bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Crea tu organización</h1>
          <p className="mt-2 text-gray-600">
            Configura tu espacio de trabajo para gestionar redes sociales.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Nombre de la organización
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Mi Empresa"
            />
          </div>

          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
              URL del espacio
            </label>
            <div className="mt-1 flex items-center rounded-lg border border-gray-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200">
              <span className="px-3 text-sm text-gray-500">kapi-pulse.com/</span>
              <input
                id="slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
                className="w-full rounded-r-lg border-0 px-2 py-2 focus:outline-none"
                placeholder="mi-empresa"
              />
            </div>
          </div>

          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700">
              Zona horaria
            </label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace('America/', '')}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Crear organización'}
          </button>
        </form>
      </div>
    </div>
  )
}
