'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Save, Settings } from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

    const { error: updateError } = await supabase
      .from('organizations')
      .update({ name, slug, timezone, locale, updated_at: new Date().toISOString() })
      .eq('id', orgId)

    if (updateError) {
      setError('Error al guardar. Verificá los permisos.')
    } else {
      toast.success('Cambios guardados.')
      if (slug !== orgSlug) {
        window.location.href = `/${slug}/settings`
      }
    }
    setLoading(false)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          <Settings className="size-6 text-primary" />
          Configuración
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Ajustá los datos de tu organización.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información general</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre de la organización</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="max-w-md"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug">URL del espacio</Label>
              <div className="flex max-w-md items-stretch overflow-hidden rounded-md border border-input bg-background shadow-xs focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
                <span className="flex items-center bg-muted px-3 text-xs text-muted-foreground">
                  kapi-pulse.com/
                </span>
                <input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={(e) =>
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                  }
                  required
                  className="w-full bg-transparent px-3 py-2 text-sm text-foreground outline-none"
                />
              </div>
              <p className="text-xs text-muted-foreground">Solo minúsculas, números y guiones.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tz">Zona horaria</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="tz" className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz.replace('America/', '')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="locale">Idioma</Label>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger id="locale" className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" loading={loading} variant="gradient">
              {!loading && <Save className="size-4" />}
              {loading ? 'Guardando' : 'Guardar cambios'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
