/**
 * Job de sync de Meta Ads insights. Corre cada 6h:
 *   Por cada ad_campaign en estado 'active' o 'paused' (que tenga meta_campaign_id),
 *   pide insights diarios de los últimos 7 días y upsertea en kapi_pulse.ad_insights.
 *
 * Idempotente: usa UPSERT por (scope_type, scope_id, period_start) — re-correr el
 * mismo día reescribe la fila sin duplicar.
 *
 * Errores por campaña se logean y no tumban el job entero.
 *
 * Token: usa META_SYSTEM_USER_TOKEN (mismo que apps/api). NO toca social_accounts.
 */

import { createClient } from '@supabase/supabase-js'

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v25.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'kapi_pulse' },
  })
}

function getToken(): string | null {
  return process.env.META_SYSTEM_USER_TOKEN || null
}

interface InsightsRow {
  date_start?: string
  date_stop?: string
  campaign_id?: string
  spend?: string
  impressions?: string
  reach?: string
  clicks?: string
  ctr?: string
  cpc?: string
  cpm?: string
  frequency?: string
  actions?: Array<{ action_type: string; value: string }>
  action_values?: Array<{ action_type: string; value: string }>
  purchase_roas?: Array<{ action_type: string; value: string }>
}

type GraphError = { error?: { message?: string; code?: number } }

async function fetchCampaignInsights(
  metaCampaignId: string,
  token: string,
): Promise<InsightsRow[]> {
  const fields = [
    'date_start',
    'date_stop',
    'campaign_id',
    'spend',
    'impressions',
    'reach',
    'clicks',
    'ctr',
    'cpc',
    'cpm',
    'frequency',
    'actions',
    'action_values',
    'purchase_roas',
  ].join(',')

  const url =
    `${GRAPH_BASE}/${metaCampaignId}/insights` +
    `?fields=${fields}` +
    `&level=campaign` +
    `&date_preset=last_7d` +
    `&time_increment=1` +
    `&access_token=${encodeURIComponent(token)}`

  const res = await fetch(url)
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as GraphError
    throw new Error(`Insights ${metaCampaignId}: ${err.error?.message || res.statusText}`)
  }
  const data = (await res.json()) as { data?: InsightsRow[] }
  return data.data || []
}

function toCents(amount: string | undefined): number {
  if (!amount) return 0
  const v = parseFloat(amount)
  if (!Number.isFinite(v)) return 0
  return Math.round(v * 100)
}

function findActionValue(
  actions: Array<{ action_type: string; value: string }> | undefined,
  type: string,
): number | null {
  if (!actions) return null
  const found = actions.find((a) => a.action_type === type)
  if (!found) return null
  const v = parseFloat(found.value)
  return Number.isFinite(v) ? v : null
}

export async function syncAllAdsInsights() {
  const token = getToken()
  if (!token) {
    console.log('[ads-insights-sync] META_SYSTEM_USER_TOKEN no configurado — skip')
    return
  }

  const supabase = getSupabase()
  const startedAt = Date.now()

  const { data: campaigns, error } = await supabase
    .from('ad_campaigns')
    .select('id, organization_id, meta_campaign_id, status, name')
    .in('status', ['active', 'paused', 'approved'])
    .not('meta_campaign_id', 'is', null)

  if (error) {
    console.error('[ads-insights-sync] Error listando campañas:', error)
    return
  }
  if (!campaigns || campaigns.length === 0) {
    console.log('[ads-insights-sync] No hay campañas activas con meta_campaign_id')
    return
  }

  console.log(`[ads-insights-sync] Procesando ${campaigns.length} campañas...`)
  let okCount = 0
  let failCount = 0

  for (const camp of campaigns) {
    if (!camp.meta_campaign_id) continue
    try {
      const rows = await fetchCampaignInsights(camp.meta_campaign_id, token)
      if (rows.length === 0) {
        // Campaña sin gasto en los últimos 7d — no es error
        continue
      }

      for (const row of rows) {
        const periodStart = row.date_start ? new Date(`${row.date_start}T00:00:00Z`).toISOString() : null
        if (!periodStart) continue

        const spendCents = toCents(row.spend)
        const impressions = parseInt(row.impressions || '0', 10) || 0
        const reach = parseInt(row.reach || '0', 10) || 0
        const clicks = parseInt(row.clicks || '0', 10) || 0
        const ctr = row.ctr ? parseFloat(row.ctr) : null
        const cpcCents = toCents(row.cpc)
        const cpmCents = toCents(row.cpm)
        const frequency = row.frequency ? parseFloat(row.frequency) : null
        const purchaseValueRaw = findActionValue(row.action_values, 'purchase')
        const purchaseValueCents = purchaseValueRaw ? Math.round(purchaseValueRaw * 100) : null
        const roasRaw = findActionValue(row.purchase_roas, 'purchase')

        const { error: upErr } = await supabase.from('ad_insights').upsert(
          {
            organization_id: camp.organization_id,
            scope_type: 'campaign',
            scope_id: camp.id,
            meta_object_id: camp.meta_campaign_id,
            period_start: periodStart,
            collected_at: new Date().toISOString(),
            spend_cents: spendCents,
            impressions,
            reach,
            clicks,
            ctr,
            cpc_cents: cpcCents || null,
            cpm_cents: cpmCents || null,
            frequency,
            actions: row.actions || [],
            purchase_value_cents: purchaseValueCents,
            roas: roasRaw,
            raw: row as unknown as Record<string, unknown>,
          },
          { onConflict: 'scope_type,scope_id,period_start' },
        )

        if (upErr) {
          console.error(`[ads-insights-sync] upsert ${camp.id} ${periodStart}:`, upErr.message)
          failCount++
        } else {
          okCount++
        }
      }
    } catch (err) {
      console.warn(
        `[ads-insights-sync] campaña ${camp.id} (${camp.name}):`,
        err instanceof Error ? err.message : err,
      )
      failCount++
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(
    `[ads-insights-sync] Completado en ${elapsed}s — rows ok=${okCount}, fail=${failCount}`,
  )
}
