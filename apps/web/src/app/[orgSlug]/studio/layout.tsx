import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreditBadge } from '@/components/studio/credit-badge'

interface Props {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}

export default async function StudioLayout({ children, params }: Props) {
  const { orgSlug } = await params
  const supabase = await createServerSupabaseClient()
  if (!supabase) redirect('/')

  const { data: org } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .single()
  if (!org) redirect('/onboarding')

  const { data: creditsRow } = await supabase
    .from('organization_credits')
    .select('balance')
    .eq('organization_id', org.id)
    .maybeSingle()

  const balance = (creditsRow?.balance as number) ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <CreditBadge orgId={org.id} balance={balance} />
      </div>
      {children}
    </div>
  )
}
