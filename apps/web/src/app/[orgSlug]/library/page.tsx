import { redirect } from 'next/navigation'
import { Folder } from 'lucide-react'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { LibraryClient } from './library-client'

interface Props {
  params: Promise<{ orgSlug: string }>
}

export default async function LibraryPage({ params }: Props) {
  const { orgSlug } = await params
  const supabase = await createServerSupabaseClient()
  if (!supabase) redirect('/')

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .single()
  if (!org) redirect('/onboarding')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          <Folder className="size-6 text-primary" />
          Librería de assets
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Todas las imágenes, videos y avatares generados por tu equipo.
        </p>
      </div>

      <LibraryClient orgId={org.id as string} />
    </div>
  )
}
