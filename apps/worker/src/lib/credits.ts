import { getSupabase } from './supabase.js'

export async function refundCredits(opts: {
  orgId: string
  amount: number
  reason: string
  referenceId?: string
}): Promise<void> {
  if (opts.amount <= 0) return
  const { error } = await getSupabase().rpc('refund_credits', {
    p_org_id: opts.orgId,
    p_amount: opts.amount,
    p_reason: opts.reason,
    p_reference_id: opts.referenceId ?? null,
  })
  if (error) {
    console.error('[credits] refund failed:', error)
    throw error
  }
}
