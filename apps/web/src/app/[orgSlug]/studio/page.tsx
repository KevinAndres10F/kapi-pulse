import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Plus, Sparkles, Clock } from 'lucide-react'

interface Props {
  params: Promise<{ orgSlug: string }>
}

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: 'Borrador', bg: 'bg-gray-100', color: 'text-gray-700' },
  generating: { label: 'Generando', bg: 'bg-blue-100', color: 'text-blue-700' },
  review: { label: 'En revisión', bg: 'bg-amber-100', color: 'text-amber-700' },
  approved: { label: 'Aprobada', bg: 'bg-emerald-100', color: 'text-emerald-700' },
  published: { label: 'Publicada', bg: 'bg-emerald-100', color: 'text-emerald-700' },
  archived: { label: 'Archivada', bg: 'bg-gray-100', color: 'text-gray-500' },
  failed: { label: 'Falló', bg: 'bg-red-100', color: 'text-red-700' },
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
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Sparkles className="h-6 w-6 text-blue-600" />
            Studio
          </h1>
          <p className="mt-1 text-gray-600">
            Genera imágenes, videos y UGC con IA. Cobra créditos solo por lo que producís.
          </p>
        </div>
        <Link
          href={`/${orgSlug}/studio/new`}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" /> Nueva campaña
        </Link>
      </div>

      {!campaigns || campaigns.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-gray-400" />
          <h3 className="mt-3 text-sm font-semibold text-gray-900">Aún no tienes campañas</h3>
          <p className="mt-1 text-sm text-gray-500">
            Crea tu primera campaña y dejá que la IA genere imágenes, videos y copy listos para publicar.
          </p>
          <Link
            href={`/${orgSlug}/studio/new`}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
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
                  className="block rounded-xl border border-gray-200 bg-white p-4 transition hover:border-blue-400 hover:shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 font-semibold text-gray-900">{c.name as string}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.bg} ${meta.color}`}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
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
