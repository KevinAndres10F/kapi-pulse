import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CampaignDetailClient } from './detail-client'

interface Props {
  params: Promise<{ orgSlug: string; id: string }>
}

export default async function CampaignDetailPage({ params }: Props) {
  const { orgSlug, id } = await params
  const supabase = await createServerSupabaseClient()
  if (!supabase) redirect('/')

  const { data: org } = await supabase.from('organizations').select('id, name').eq('slug', orgSlug).single()
  if (!org) redirect('/onboarding')

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, status, brief, total_credits_spent, created_at')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!campaign) notFound()

  return (
    <div className="space-y-6">
      <Link
        href={`/${orgSlug}/studio`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a Studio
      </Link>
      <CampaignDetailClient orgId={org.id as string} campaignId={id} initialCampaign={campaign as { id: string; name: string; status: string; brief: Record<string, unknown>; total_credits_spent: number; created_at: string }} />
    </div>
  )
}
