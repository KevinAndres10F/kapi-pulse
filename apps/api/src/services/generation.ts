import { supabaseAdmin } from '../lib/supabase'
import { deductCredits, refundCredits, getPriceForOperation, InsufficientCreditsError } from './credits'
import { getGenerationQueue } from '../lib/queues'

export type GenKind = 'image' | 'video' | 'avatar_video' | 'copy_bundle' | 'audio' | 'video_with_audio'
export type GenProvider = 'fal' | 'replicate' | 'heygen' | 'hedra' | 'claude' | 'eleven_labs' | 'banana'

export interface DispatchOpts {
  orgId: string
  userId: string
  kind: GenKind
  provider: GenProvider
  model: string
  operation: string // matches credit_pricing.operation
  input: Record<string, unknown>
  campaignId?: string
  stepId?: string
}

export interface DispatchResult {
  jobId: string
  status: 'reserved'
  creditsCharged: number
  balanceAfter: number
}

const MAX_CONCURRENT_PER_ORG = 5

async function countActiveJobs(orgId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('generation_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .in('status', ['pending', 'reserved', 'running'])
  if (error) throw error
  return count ?? 0
}

const QUEUE_BY_KIND: Record<GenKind, string> = {
  image: 'generate-image',
  video: 'generate-video',
  avatar_video: 'generate-avatar',
  copy_bundle: 'generate-copy',
  audio: 'generate-audio',
  video_with_audio: 'generate-video-with-audio',
}

export async function dispatchGenerationJob(opts: DispatchOpts): Promise<DispatchResult> {
  const active = await countActiveJobs(opts.orgId)
  if (active >= MAX_CONCURRENT_PER_ORG) {
    throw Object.assign(new Error('too many concurrent jobs'), { code: 'CONCURRENCY_LIMIT', status: 429 })
  }

  const price = await getPriceForOperation(opts.operation)
  if (price.provider !== opts.provider) {
    throw new Error(`operation ${opts.operation} does not belong to provider ${opts.provider}`)
  }

  // 1. Create the job row first (status=pending) so we have an id to reference
  const { data: job, error: jobErr } = await supabaseAdmin
    .from('generation_jobs')
    .insert({
      organization_id: opts.orgId,
      created_by: opts.userId,
      campaign_id: opts.campaignId ?? null,
      step_id: opts.stepId ?? null,
      kind: opts.kind,
      provider: opts.provider,
      model: opts.model,
      operation: opts.operation,
      input: opts.input,
      credits_cost: price.credits_per_unit,
      status: 'pending',
    })
    .select('id')
    .single()

  if (jobErr || !job) {
    throw jobErr || new Error('failed to create generation job')
  }

  // 2. Atomic credit deduction. If insufficient, mark job cancelled.
  let deduction: Awaited<ReturnType<typeof deductCredits>>
  try {
    deduction = await deductCredits({
      orgId: opts.orgId,
      operation: opts.operation,
      referenceType: 'generation_job',
      referenceId: job.id,
      metadata: { kind: opts.kind, provider: opts.provider, model: opts.model },
    })
  } catch (err) {
    await supabaseAdmin
      .from('generation_jobs')
      .update({ status: 'cancelled', error: err instanceof Error ? err.message : String(err) })
      .eq('id', job.id)
    if (err instanceof InsufficientCreditsError) throw err
    throw err
  }

  // 3. Mark reserved and enqueue. If enqueue fails, refund.
  await supabaseAdmin
    .from('generation_jobs')
    .update({ status: 'reserved', credit_tx_id: deduction.txId })
    .eq('id', job.id)

  const queue = await getGenerationQueue()
  if (!queue) {
    // Redis not configured — refund and surface a clear error
    await refundCredits({ orgId: opts.orgId, amount: price.credits_per_unit, reason: 'queue_unavailable', referenceId: job.id })
    await supabaseAdmin
      .from('generation_jobs')
      .update({ status: 'failed', error: 'queue_unavailable' })
      .eq('id', job.id)
    throw Object.assign(new Error('generation queue unavailable'), { code: 'QUEUE_UNAVAILABLE', status: 503 })
  }

  try {
    const bullJob = await queue.add(
      QUEUE_BY_KIND[opts.kind],
      { jobId: job.id },
      {
        jobId: `gen-${job.id}`,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
      },
    )
    await supabaseAdmin
      .from('generation_jobs')
      .update({ bullmq_job_id: bullJob.id })
      .eq('id', job.id)
  } catch (err) {
    await refundCredits({ orgId: opts.orgId, amount: price.credits_per_unit, reason: 'enqueue_failed', referenceId: job.id })
    await supabaseAdmin
      .from('generation_jobs')
      .update({ status: 'failed', error: `enqueue_failed: ${err instanceof Error ? err.message : String(err)}` })
      .eq('id', job.id)
    throw err
  }

  return {
    jobId: job.id,
    status: 'reserved',
    creditsCharged: price.credits_per_unit,
    balanceAfter: deduction.balanceAfter,
  }
}

export async function getJob(jobId: string) {
  const { data, error } = await supabaseAdmin
    .from('generation_jobs')
    .select('*')
    .eq('id', jobId)
    .single()
  if (error) throw error
  return data
}

export async function listJobsByCampaign(campaignId: string) {
  const { data, error } = await supabaseAdmin
    .from('generation_jobs')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function listAssetsByJob(jobId: string) {
  const { data, error } = await supabaseAdmin
    .from('generated_assets')
    .select('*')
    .eq('job_id', jobId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}
