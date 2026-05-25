'use client'

import { useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { fetchCampaign, type JobAsset } from '@/lib/studio/api'

interface InitialCampaign {
  id: string
  name: string
  status: string
  brief: Record<string, unknown>
  total_credits_spent: number
  created_at: string
}

export function CampaignDetailClient({
  orgId,
  campaignId,
  initialCampaign,
}: {
  orgId: string
  campaignId: string
  initialCampaign: InitialCampaign
}) {
  const [loading, setLoading] = useState(true)
  const [steps, setSteps] = useState<Array<{ step_number: number; step_type: string; state: string; selected_asset_ids: string[]; result: Record<string, unknown> }>>([])
  const [assets, setAssets] = useState<JobAsset[]>([])

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetchCampaign(orgId, campaignId)
      setSteps(res.steps)
      setAssets(res.assets)
    } catch (err) {
      console.warn('[detail] fetch failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, campaignId])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{initialCampaign.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Creada {new Date(initialCampaign.created_at).toLocaleString()} · {initialCampaign.total_credits_spent ?? 0} créditos consumidos
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-lg border border-input px-3 py-1.5 text-sm text-foreground hover:bg-muted/40"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Pasos</h2>
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s.step_number} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span>
                <strong className="mr-2">#{s.step_number}</strong>
                {s.step_type}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  s.state === 'done'
                    ? 'bg-emerald-100 text-emerald-700'
                    : s.state === 'failed'
                      ? 'bg-red-100 text-destructive'
                      : s.state === 'skipped'
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-amber-100 text-amber-700'
                }`}
              >
                {s.state}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Assets seleccionados ({assets.length})</h2>
        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay assets seleccionados en esta campaña aún.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((a) => (
              <li key={a.id} className="overflow-hidden rounded-lg border border-border bg-card">
                {a.signed_url ? (
                  a.kind === 'video' || a.kind === 'avatar_video' ? (
                    <video src={a.signed_url} controls className="aspect-square w-full bg-black" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.signed_url} alt={a.kind} className="aspect-square w-full object-cover" />
                  )
                ) : (
                  <div className="aspect-square bg-muted" />
                )}
                <div className="p-2 text-xs text-muted-foreground">{a.kind}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
