import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Clock, Plus, Sparkles } from 'lucide-react'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  params: Promise<{ orgSlug: string }>
}

const STATUS_VARIANT: Record<string, { label: string; variant: 'muted' | 'default' | 'success' | 'destructive' | 'warning' | 'secondary' }> = {
  draft: { label: 'Borrador', variant: 'muted' },
  generating: { label: 'Generando', variant: 'default' },
  review: { label: 'En revisión', variant: 'warning' },
  approved: { label: 'Aprobada', variant: 'success' },
  published: { label: 'Publicada', variant: 'success' },
  archived: { label: 'Archivada', variant: 'muted' },
  failed: { label: 'Falló', variant: 'destructive' },
}

export default async function StudioPage({ params }: Props) {
  const { orgSlug } = await params
  const supabase = await createServerSupabaseClient()
  if (!supabase) redirect('/')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', orgSlug)
    .single()
  if (!org) redirect('/onboarding')

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, status, total_credits_spent, created_at')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            <Sparkles className="size-6 text-primary" />
            Studio
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Generá imágenes, videos y UGC con IA. Cobra créditos solo por lo que producís.
          </p>
        </div>
        <Button asChild variant="gradient" size="sm">
          <Link href={`/${orgSlug}/studio/new`}>
            <Plus className="size-4" />
            Nueva campaña
          </Link>
        </Button>
      </div>

      {!campaigns || campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="size-6 text-primary" />
            </span>
            <div>
              <p className="text-base font-medium text-foreground">Aún no tenés campañas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Creá tu primera campaña y dejá que la IA genere imágenes, videos y copy listos para publicar.
              </p>
            </div>
            <Button asChild variant="gradient">
              <Link href={`/${orgSlug}/studio/new`}>
                <Plus className="size-4" />
                Crear campaña
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => {
            const meta = STATUS_VARIANT[c.status as string] || STATUS_VARIANT.draft
            return (
              <li key={c.id as string}>
                <Link
                  href={`/${orgSlug}/studio/${c.id}`}
                  className="group block h-full rounded-xl border border-border bg-card p-5 transition-all hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 font-semibold text-foreground">{c.name as string}</h3>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      {new Date(c.created_at as string).toLocaleDateString('es-EC', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="size-3" />
                      {c.total_credits_spent ?? 0} créditos
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
