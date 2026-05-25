'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Sparkles } from 'lucide-react'

import { fetchCampaign, type JobAsset } from '@/lib/studio/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface InitialCampaign {
  id: string
  name: string
  status: string
  brief: Record<string, unknown>
  total_credits_spent: number
  created_at: string
}

function stateVariant(state: string): 'success' | 'destructive' | 'muted' | 'warning' {
  if (state === 'done') return 'success'
  if (state === 'failed') return 'destructive'
  if (state === 'skipped') return 'muted'
  return 'warning'
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
  const [steps, setSteps] = useState<
    Array<{
      step_number: number
      step_type: string
      state: string
      selected_asset_ids: string[]
      result: Record<string, unknown>
    }>
  >([])
  const [assets, setAssets] = useState<JobAsset[]>([])

  const refresh = useCallback(async () => {
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
  }, [orgId, campaignId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            <Sparkles className="size-6 text-primary" />
            {initialCampaign.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Creada{' '}
            {new Date(initialCampaign.created_at).toLocaleString('es-EC', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            · {initialCampaign.total_credits_spent ?? 0} créditos consumidos
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} loading={loading} disabled={loading}>
          {!loading && <RefreshCw className="size-4" />}
          Actualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pasos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {steps.map((s) => (
              <li
                key={s.step_number}
                className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                    {s.step_number}
                  </span>
                  <span className="capitalize text-foreground">{s.step_type.replace(/_/g, ' ')}</span>
                </span>
                <Badge variant={stateVariant(s.state)}>{s.state}</Badge>
              </li>
            ))}
            {steps.length === 0 && !loading && (
              <li className="text-center text-sm text-muted-foreground">Sin pasos registrados aún.</li>
            )}
            {steps.length === 0 && loading && (
              <li className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Cargando…
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Assets seleccionados ({assets.length})
        </h2>
        {assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay assets seleccionados en esta campaña aún.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((a) => (
              <li key={a.id} className="overflow-hidden rounded-xl border border-border bg-card">
                {a.signed_url ? (
                  a.kind === 'video' || a.kind === 'avatar_video' ? (
                    <video src={a.signed_url} controls className="aspect-square w-full bg-black" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.signed_url}
                      alt={a.kind}
                      className="aspect-square w-full object-cover"
                    />
                  )
                ) : (
                  <div className="aspect-square bg-muted" />
                )}
                <div className="p-2 text-xs capitalize text-muted-foreground">
                  {a.kind.replace(/_/g, ' ')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
