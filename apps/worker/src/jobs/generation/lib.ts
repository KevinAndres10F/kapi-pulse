import { getSupabase } from '../../lib/supabase.js'
import { refundCredits } from '../../lib/credits.js'

export interface GenJobRow {
  id: string
  organization_id: string
  campaign_id: string | null
  step_id: string | null
  kind: 'image' | 'video' | 'avatar_video' | 'audio' | 'copy_bundle'
  provider: 'fal' | 'replicate' | 'heygen' | 'hedra' | 'claude' | 'upload'
  model: string
  operation: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  credits_cost: number
  status: 'pending' | 'reserved' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'refunded'
  external_id: string | null
  created_by: string | null
}

export async function fetchJob(jobId: string): Promise<GenJobRow> {
  const { data, error } = await getSupabase()
    .from('generation_jobs')
    .select('*')
    .eq('id', jobId)
    .single()
  if (error || !data) throw error || new Error(`Job ${jobId} not found`)
  return data as unknown as GenJobRow
}

export async function markRunning(jobId: string, patch: Record<string, unknown> = {}) {
  await getSupabase()
    .from('generation_jobs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...patch,
    })
    .eq('id', jobId)
}

export async function markSucceeded(jobId: string, output: Record<string, unknown> = {}) {
  await getSupabase()
    .from('generation_jobs')
    .update({
      status: 'succeeded',
      output,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

export async function markFailed(jobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  await getSupabase()
    .from('generation_jobs')
    .update({
      status: 'failed',
      error: message,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

export async function markRefunded(jobId: string, refundedAmount: number) {
  await getSupabase()
    .from('generation_jobs')
    .update({
      status: 'refunded',
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      output: { refunded_credits: refundedAmount },
    })
    .eq('id', jobId)
}

/**
 * Final-attempt failure handler: marks job failed AND refunds credits.
 * Called from the BullMQ "failed" event handler when attempts are exhausted.
 */
export async function refundIfNotRefunded(jobId: string) {
  const job = await fetchJob(jobId).catch(() => null)
  if (!job) return
  if (job.status === 'refunded') return

  if (job.credits_cost > 0) {
    try {
      await refundCredits({
        orgId: job.organization_id,
        amount: job.credits_cost,
        reason: `${job.operation}_refund`,
        referenceId: job.id,
      })
      await markRefunded(jobId, job.credits_cost)
    } catch (err) {
      console.error(`[refund] failed for job ${jobId}:`, err)
    }
  }
}

export interface NewAssetInput {
  orgId: string
  jobId: string
  kind: GenJobRow['kind']
  source: GenJobRow['provider']
  storagePath: string
  storageBucket: string
  mimeType?: string
  width?: number
  height?: number
  durationSeconds?: number
  sizeBytes?: number
  prompt?: string
  seed?: number
  parentAssetId?: string
  metadata?: Record<string, unknown>
  createdBy?: string | null
}

export async function insertAsset(input: NewAssetInput): Promise<string> {
  const { data, error } = await getSupabase()
    .from('generated_assets')
    .insert({
      organization_id: input.orgId,
      job_id: input.jobId,
      kind: input.kind,
      source: input.source,
      storage_bucket: input.storageBucket,
      storage_path: input.storagePath,
      mime_type: input.mimeType,
      width: input.width,
      height: input.height,
      duration_seconds: input.durationSeconds,
      size_bytes: input.sizeBytes,
      prompt: input.prompt,
      seed: input.seed,
      parent_asset_id: input.parentAssetId ?? null,
      metadata: input.metadata ?? {},
      created_by: input.createdBy ?? null,
    })
    .select('id')
    .single()
  if (error || !data) throw error || new Error('failed to insert asset')
  return data.id as string
}

export async function getAssetSignedUrl(assetId: string, opts: { expiresIn?: number } = {}) {
  const { data, error } = await getSupabase()
    .from('generated_assets')
    .select('storage_path, storage_bucket')
    .eq('id', assetId)
    .single()
  if (error || !data) throw error || new Error('asset not found')

  const { getSignedDownloadUrl } = await import('../../lib/storage.js')
  return getSignedDownloadUrl(data.storage_path as string, {
    bucket: (data.storage_bucket as string) || 'generated-assets',
    expiresIn: opts.expiresIn,
  })
}
