import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Plus, Sparkles, Clock } from 'lucide-react'

interface Props {
  params: Promise<{ orgSlug: string }>
}

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: 'Borrador', bg: 'bg-muted', color: 'text-foreground' },
  generating: { label: 'Generando', bg: 'bg-blue-100', color: 'text-primary' },
  review: { label: 'En revisión', bg: 'bg-amber-100', color: 'text-amber-700' },
  approved: { label: 'Aprobada', bg: 'bg-emerald-100', color: 'text-emerald-700' },
  published: { label: 'Publicada', bg: 'bg-emerald-100', color: 'text-emerald-700' },
  archived: { label: 'Archivada', bg: 'bg-muted', color: 'text-muted-foreground' },
  failed: { label: 'Falló', bg: 'bg-red-100', color: 'text-destructive' },
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Sparkles className="h-6 w-6 text-primary" />
            Studio
          </h1>
          <p className="mt-1 text-muted-foreground">
            Genera imágenes, videos y UGC con IA. Cobra créditos solo por lo que producís.
          </p>
        </div>
        <Link
          href={`/${orgSlug}/studio/new`}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Nueva campaña
        </Link>
      </div>

      {!campaigns || campaigns.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-input bg-card p-12 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">Aún no tienes campañas</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea tu primera campaña y dejá que la IA genere imágenes, videos y copy listos para publicar.
          </p>
          <Link
            href={`/${orgSlug}/studio/new`}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Crear campaña
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => {
            const meta = STATUS_LABEL[c.status as string] || STATUS_LABEL.draft
            return (
              <li key={c.id as string}>
                <Link
                  href={`/${orgSlug}/studio/${c.id}`}
                  className="block rounded-xl border border-border bg-card p-4 transition hover:border-blue-400 hover:shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 font-semibold text-foreground">{c.name as string}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.bg} ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(c.created_at as string).toLocaleDateString()}
                    </span>
                    <span>{c.total_credits_spent ?? 0} créditos</span>
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
