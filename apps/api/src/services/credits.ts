import { supabaseAdmin } from '../lib/supabase'

export class InsufficientCreditsError extends Error {
  code = 'INSUFFICIENT_CREDITS'
  balance: number
  required: number
  constructor(balance: number, required: number) {
    super(`Insufficient credits: balance=${balance} required=${required}`)
    this.balance = balance
    this.required = required
  }
}

export class CreditLedgerMissingError extends Error {
  code = 'CREDIT_LEDGER_MISSING'
  constructor(orgId: string) {
    super(`Organization ${orgId} has no credit ledger`)
  }
}

export interface CreditPriceRow {
  operation: string
  provider: string
  model: string
  unit: string
  credits_per_unit: number
  upstream_usd_cost: number
}

export async function getPriceForOperation(operation: string): Promise<CreditPriceRow> {
  const { data, error } = await supabaseAdmin
    .from('credit_pricing')
    .select('operation, provider, model, unit, credits_per_unit, upstream_usd_cost')
    .eq('operation', operation)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    throw new Error(`Unknown or inactive pricing operation: ${operation}`)
  }
  return data as CreditPriceRow
}

export async function getBalance(orgId: string) {
  const { data, error } = await supabaseAdmin
    .from('organization_credits')
    .select('balance, total_granted, total_consumed, last_reset_at, updated_at')
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error) throw error

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('plan_id, plans:plan_id(code, name, monthly_credits, bonus_credits)')
    .eq('id', orgId)
    .maybeSingle()

  return {
    balance: data?.balance ?? 0,
    totalGranted: data?.total_granted ?? 0,
    totalConsumed: data?.total_consumed ?? 0,
    lastResetAt: data?.last_reset_at ?? null,
    updatedAt: data?.updated_at ?? null,
    plan: org?.plans ?? null,
  }
}

export interface DeductCreditsOpts {
  orgId: string
  operation: string
  referenceType?: string
  referenceId?: string
  metadata?: Record<string, unknown>
}

export interface DeductCreditsResult {
  txId: string
  balanceAfter: number
  creditsCharged: number
}

export async function deductCredits(opts: DeductCreditsOpts): Promise<DeductCreditsResult> {
  const price = await getPriceForOperation(opts.operation)

  const { data, error } = await supabaseAdmin.rpc('deduct_credits', {
    p_org_id: opts.orgId,
    p_amount: price.credits_per_unit,
    p_reason: opts.operation,
    p_reference_type: opts.referenceType ?? null,
    p_reference_id: opts.referenceId ?? null,
    p_metadata: opts.metadata ?? {},
  })

  if (error) {
    if (error.code === '23514') {
      const current = await getBalance(opts.orgId)
      throw new InsufficientCreditsError(current.balance, price.credits_per_unit)
    }
    if (error.code === '02000') {
      throw new CreditLedgerMissingError(opts.orgId)
    }
    throw error
  }

  const row = Array.isArray(data) ? data[0] : data
  return {
    txId: row.id,
    balanceAfter: row.balance_after,
    creditsCharged: price.credits_per_unit,
  }
}

export async function refundCredits(opts: {
  orgId: string
  amount: number
  reason: string
  referenceId?: string
}): Promise<void> {
  if (opts.amount <= 0) return
  const { error } = await supabaseAdmin.rpc('refund_credits', {
    p_org_id: opts.orgId,
    p_amount: opts.amount,
    p_reason: opts.reason,
    p_reference_id: opts.referenceId ?? null,
  })
  if (error) throw error
}

export async function listTransactions(orgId: string, opts: { limit?: number; offset?: number; type?: string } = {}) {
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = opts.offset ?? 0

  let query = supabaseAdmin
    .from('credit_transactions')
    .select('id, type, amount, balance_after, reason, reference_type, reference_id, metadata, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts.type) query = query.eq('type', opts.type)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function listPricing() {
  const { data, error } = await supabaseAdmin
    .from('credit_pricing')
    .select('operation, provider, model, unit, credits_per_unit, upstream_usd_cost, notes')
    .eq('is_active', true)
    .order('credits_per_unit', { ascending: true })

  if (error) throw error
  return data ?? []
}
