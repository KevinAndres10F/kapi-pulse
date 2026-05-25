import { redirect } from 'next/navigation'
import { Coins } from 'lucide-react'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { CreditsClient } from './credits-client'

interface Props {
  params: Promise<{ orgSlug: string }>
}

export default async function CreditsPage({ params }: Props) {
  const { orgSlug } = await params
  const supabase = await createServerSupabaseClient()
  if (!supabase) redirect('/')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, plan_id')
    .eq('slug', orgSlug)
    .single()
  if (!org) redirect('/onboarding')

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
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          <Coins className="size-6 text-warning-foreground" />
          Créditos
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Balance, historial y precios por operación.</p>
      </div>

      <CreditsClient
        orgId={org.id as string}
        balance={(credits?.balance as number) ?? 0}
        totalGranted={(credits?.total_granted as number) ?? 0}
        totalConsumed={(credits?.total_consumed as number) ?? 0}
        plan={
          (plan as unknown as {
            code: string
            name: string
            monthly_credits: number
            bonus_credits: number
          } | null) || null
        }
      />
    </div>
  )
}
