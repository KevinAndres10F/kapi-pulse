import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Coins } from 'lucide-react'
import { CreditsClient } from './credits-client'

interface Props {
  params: Promise<{ orgSlug: string }>
}

export default async function CreditsPage({ params }: Props) {
  const { orgSlug } = await params
  const supabase = await createServerSupabaseClient()
  if (!supabase) redirect('/')

  // Layout already validates org membership; we only need id + plan_id here.
  // Keep the join out of this query so an RLS miss on `plans` can't null the
  // entire row and trigger the redirect below.
  const { data: org } = await supabase
    .from('organizations')
    .select('id, plan_id')
    .eq('slug', orgSlug)
    .single()
  if (!org) redirect('/onboarding')

  // Fetch credits and plan in parallel; plan is optional (maybeSingle so it
  // never throws even when plan_id is null or RLS blocks reads).
  const [{ data: credits }, { data: plan }] = await Promise.all([
    supabase
      .from('organization_credits')
      .select('balance, total_granted, total_consumed, last_reset_at')
      .eq('organization_id', org.id)
      .maybeSingle(),
    org.plan_id
      ? supabase
          .from('plans')
          .select('code, name, monthly_credits, bonus_credits')
          .eq('id', org.plan_id as string)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Coins className="h-6 w-6 text-amber-500" />
          Créditos
        </h1>
        <p className="mt-1 text-gray-600">Balance, historial y precios por operación.</p>
      </div>

      <CreditsClient
        orgId={org.id as string}
        balance={(credits?.balance as number) ?? 0}
        totalGranted={(credits?.total_granted as number) ?? 0}
        totalConsumed={(credits?.total_consumed as number) ?? 0}
        plan={
          (plan as unknown as { code: string; name: string; monthly_credits: number; bonus_credits: number } | null) ||
          null
        }
      />
    </div>
  )
}
