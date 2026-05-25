'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { AuthShell } from '@/components/auth/auth-shell'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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

export default function OnboardingPage() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [timezone, setTimezone] = useState('America/Guayaquil')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkOrgs() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
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

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('Sesión expirada. Volvé a iniciar sesión.')
      setLoading(false)
      return
    }

    const { data: org, error: orgError } = await supabase.rpc('create_organization_with_owner', {
      p_name: name,
      p_slug: slug,
      p_timezone: timezone,
    })

    if (orgError) {
      if (orgError.code === '23505') {
        setError('Ya existe una organización con ese nombre. Elegí otro.')
      } else {
        setError(orgError.message || 'Error al crear la organización. Probá de nuevo.')
      }
      setLoading(false)
      return
    }

    router.push(`/${(org as { slug: string }).slug}/dashboard`)
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">Verificando tu cuenta...</span>
        </div>
      </div>
    )
  }

  return (
    <AuthShell
      title="Creá tu organización"
      description="Configurá tu espacio de trabajo. Vas a poder invitar a tu equipo después."
    >
      <form onSubmit={handleCreate} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre de la organización</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            placeholder="Mi Empresa"
            autoComplete="organization"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slug">URL del espacio</Label>
          <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-background shadow-xs focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/40">
            <span className="flex items-center bg-muted px-3 text-xs text-muted-foreground">kapi-pulse.com/</span>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              required
              className="w-full bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
              placeholder="mi-empresa"
              autoComplete="off"
            />
          </div>
          <p className="text-xs text-muted-foreground">Solo letras minúsculas, números y guiones.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="timezone">Zona horaria</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone">
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

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" loading={loading} className="w-full" size="lg">
          {loading ? 'Creando organización' : 'Crear organización'}
        </Button>
      </form>
    </AuthShell>
  )
}
