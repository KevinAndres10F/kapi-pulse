import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WizardClient } from './wizard-client'

interface Props {
  params: Promise<{ orgSlug: string }>
}

export default async function NewCampaignPage({ params }: Props) {
  const { orgSlug } = await params
  const supabase = await createServerSupabaseClient()
  if (!supabase) redirect('/')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', orgSlug)
    .single()
  if (!org) redirect('/onboarding')

  return <WizardClient orgId={org.id as string} orgSlug={orgSlug} />
}
