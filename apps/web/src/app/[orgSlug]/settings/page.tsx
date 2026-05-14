'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { Settings, Save } from 'lucide-react'

const TIMEZONES = [
  'America/Guayaquil',
  'America/Bogota',
  'America/Mexico_City',
  'America/Buenos_Aires',
  'America/Lima',
  'America/Santiago',
  'America/Sao_Paulo',
]

const LOCALES = [
  { value: 'es-EC', label: 'Español (Ecuador)' },
  { value: 'es-MX', label: 'Español (México)' },
  { value: 'es-AR', label: 'Español (Argentina)' },
  { value: 'es-CO', label: 'Español (Colombia)' },
  { value: 'es', label: 'Español (General)' },
]

export default function SettingsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [timezone, setTimezone] = useState('America/Guayaquil')
  const [locale, setLocale] = useState('es-EC')
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function loadOrg() {
      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('slug', orgSlug)
        .single()

      if (org) {
        setOrgId(org.id)
        setName(org.name)
        setSlug(org.slug)
        setTimezone(org.timezone)
        setLocale(org.locale)
      }
    }
    loadOrg()
  }, [supabase, orgSlug])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId) return
    setLoading(true)
    setError(null)
    setSaved(false)

    const { error: updateError } = await supabase
      .from('organizations')
      .update({ name, slug, timezone, locale, updated_at: new Date().toISOString() })
      .eq('id', orgId)

    if (updateError) {
      setError('Error al guardar. Verifica los permisos.')
    } else {
      setSaved(true)
      // Si cambió el slug, redirigir
      if (slug !== orgSlug) {
        window.location.href = `/${slug}/settings`
      }
    }
    setLoading(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Configuración
        </h1>
        <p className="mt-1 text-gray-600">Ajusta los datos de tu organización.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Slug (URL)</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            required
            className="mt-1 w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Zona horaria</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-1 w-full max-w-md rounded-lg border border-gray-300 px-4 py-2"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz.replace('America/', '')}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Idioma</label>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="mt-1 w-full max-w-md rounded-lg border border-gray-300 px-4 py-2"
          >
            {LOCALES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">Cambios guardados correctamente.</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
