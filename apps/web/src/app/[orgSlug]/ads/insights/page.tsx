'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  BarChart3,
  Database,
  DollarSign,
  Eye,
  Loader2,
  MousePointerClick,
  RefreshCw,
  TrendingUp,
  Zap,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  formatMoney,
  formatPercent,
  listCampaigns,
  listInsights,
  type AdCampaign,
  type AdInsight,
} from '@/lib/ads/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function AdsInsightsPage() {
  const params = useParams<{ orgSlug: string }>()
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [insights, setInsights] = useState<AdInsight[]>([])
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'cached' | 'live'>('cached')
  const [liveCampaignId, setLiveCampaignId] = useState<string>('')
  const [liveData, setLiveData] = useState<Array<Record<string, unknown>>>([])
  const [liveLoading, setLiveLoading] = useState(false)
  const [liveError, setLiveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) return
      setUserId(user.id)
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', params.orgSlug)
        .single()
      if (cancelled || !org) return
      setOrgId((org as { id: string }).id)
    })()
    return () => { cancelled = true }
  }, [params.orgSlug, supabase])

  const load = useCallback(async () => {
    if (!userId || !orgId) return
    setLoading(true)
    setError(null)
    try {
      const [ins, camps] = await Promise.all([
        listInsights(orgId, userId, { scope: 'campaign' }),
        listCampaigns(orgId, userId),
      ])
      setInsights(ins.insights)
      setCampaigns(camps.campaigns)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando insights')
    } finally {
      setLoading(false)
    }
  }, [userId, orgId])

  useEffect(() => { load() }, [load])

  const loadLive = useCallback(async () => {
    if (!orgId || !userId || !liveCampaignId) return
    const camp = campaigns.find((c) => c.id === liveCampaignId)
    if (!camp?.meta_campaign_id) {
      setLiveError('Esta campaña no tiene ID de Meta — no hay datos live.')
      setLiveData([])
      return
    }
    setLiveLoading(true)
    setLiveError(null)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const qs = new URLSearchParams({
        org_id: orgId,
        scope: 'campaign',
        scope_id: camp.meta_campaign_id,
        date_preset: 'last_7d',
        live: '1',
      })
      const res = await fetch(`${apiUrl}/api/ads/insights?${qs}`, {
        headers: { 'X-User-Id': userId },
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
      setLiveData(body.insights || [])
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'Error')
      setLiveData([])
    } finally {
      setLiveLoading(false)
    }
  }, [orgId, userId, liveCampaignId, campaigns])

  useEffect(() => {
    if (mode === 'live' && liveCampaignId) loadLive()
  }, [mode, liveCampaignId, loadLive])

  const totals = useMemo(() => {
    let spend = 0, impressions = 0, clicks = 0, reach = 0
    for (const i of insights) {
      spend += i.spend_cents || 0
      impressions += i.impressions || 0
      clicks += i.clicks || 0
      reach += i.reach || 0
    }
    const ctr = impressions > 0 ? clicks / impressions : null
    return { spend, impressions, clicks, reach, ctr }
  }, [insights])

  const spendByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const i of insights) {
      const day = i.period_start.slice(0, 10)
      map.set(day, (map.get(day) || 0) + (i.spend_cents || 0))
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, spend]) => ({ date, spend: spend / 100 }))
  }, [insights])

  const byCampaign = useMemo(() => {
    const map = new Map<
      string,
      { name: string; spend: number; impressions: number; clicks: number; ctr: number | null }
    >()
    for (const i of insights) {
      const camp = campaigns.find((c) => c.id === i.scope_id)
      if (!camp) continue
      const existing = map.get(i.scope_id) || {
        name: camp.name,
        spend: 0,
        impressions: 0,
        clicks: 0,
        ctr: null,
      }
      existing.spend += i.spend_cents || 0
      existing.impressions += i.impressions || 0
      existing.clicks += i.clicks || 0
      map.set(i.scope_id, existing)
    }
    for (const v of map.values()) {
      v.ctr = v.impressions > 0 ? v.clicks / v.impressions : null
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }))
  }, [insights, campaigns])

  if (!userId || !orgId || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${params.orgSlug}/ads`}>
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          <BarChart3 className="size-6 text-primary" />
          Insights de campañas
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Datos sincronizados desde Meta cada 6h. Para tiempo real, usá el modo Live.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Toggle Cached / Live */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-6">
          <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
            <button
              onClick={() => setMode('cached')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                mode === 'cached'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Database className="size-3.5" />
              Cached (6h)
            </button>
            <button
              onClick={() => setMode('live')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                mode === 'live'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Zap className="size-3.5" />
              Live desde Meta
            </button>
          </div>
          {mode === 'live' && (
            <>
              <Select value={liveCampaignId} onValueChange={setLiveCampaignId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Elegí campaña" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns
                    .filter((c) => c.meta_campaign_id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {liveCampaignId && (
                <Button size="sm" variant="outline" onClick={loadLive} loading={liveLoading}>
                  {!liveLoading && <RefreshCw className="size-3.5" />}
                  Refrescar
                </Button>
              )}
              <p className="text-xs text-muted-foreground">Llama directo a Meta · cuenta hacia tus rate limits.</p>
            </>
          )}
        </CardContent>
      </Card>

      {mode === 'live' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="size-4 text-warning-foreground" />
              Datos en vivo
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {liveError && (
              <Alert variant="destructive" className="mx-6 mb-4">
                <AlertDescription>{liveError}</AlertDescription>
              </Alert>
            )}
            {!liveCampaignId && (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                Elegí una campaña para consultar Meta en tiempo real.
              </p>
            )}
            {liveLoading && (
              <div className="flex items-center justify-center gap-2 px-6 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Consultando Meta…
              </div>
            )}
            {!liveLoading && liveData.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Fecha</th>
                      <th className="px-6 py-3 text-right font-semibold">Gasto</th>
                      <th className="px-6 py-3 text-right font-semibold">Impresiones</th>
                      <th className="px-6 py-3 text-right font-semibold">Clicks</th>
                      <th className="px-6 py-3 text-right font-semibold">CTR</th>
                      <th className="px-6 py-3 text-right font-semibold">CPC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {liveData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-accent/50">
                        <td className="px-6 py-3 font-mono text-xs text-foreground">
                          {(row.date_start as string) || '—'}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-foreground">
                          ${String(row.spend || '0')}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-foreground">
                          {Number(row.impressions || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-foreground">
                          {Number(row.clicks || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-foreground">
                          {row.ctr ? `${Number(row.ctr).toFixed(2)}%` : '—'}
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums text-foreground">
                          {row.cpc ? `$${Number(row.cpc).toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!liveLoading && liveCampaignId && liveData.length === 0 && !liveError && (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                Sin datos para esta campaña en los últimos 7 días.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {mode === 'cached' &&
        (insights.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <TrendingUp className="size-6 text-primary" />
              </span>
              <div>
                <p className="text-base font-medium text-foreground">Sin datos todavía</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cuando una campaña esté ACTIVE y empiece a gastar, los datos aparecen acá
                  en la siguiente sincronización (hasta 6h).
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi icon={DollarSign} label="Gasto total" value={formatMoney(totals.spend)} tone="primary" />
              <Kpi icon={Eye} label="Impresiones" value={totals.impressions.toLocaleString()} tone="muted" />
              <Kpi icon={MousePointerClick} label="Clicks" value={totals.clicks.toLocaleString()} tone="success" />
              <Kpi icon={TrendingUp} label="CTR promedio" value={formatPercent(totals.ctr)} tone="warning" />
            </div>

            {spendByDay.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Gasto diario</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={spendByDay}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString('es', { day: '2-digit', month: 'short' })
                          }
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                          tickFormatter={(v) => `$${v}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--popover)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            color: 'var(--foreground)',
                          }}
                          formatter={(value: number) => [`$${value.toFixed(2)}`, 'Gasto']}
                          labelFormatter={(v) =>
                            new Date(v).toLocaleDateString('es', {
                              weekday: 'short',
                              day: '2-digit',
                              month: 'short',
                            })
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="spend"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          dot={{ fill: 'var(--primary)', r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Por campaña</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Campaña</th>
                        <th className="px-6 py-3 text-right font-semibold">Gasto</th>
                        <th className="px-6 py-3 text-right font-semibold">Impresiones</th>
                        <th className="px-6 py-3 text-right font-semibold">Clicks</th>
                        <th className="px-6 py-3 text-right font-semibold">CTR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {byCampaign.map((row) => (
                        <tr key={row.id} className="hover:bg-accent/50">
                          <td className="px-6 py-3 font-medium text-foreground">{row.name}</td>
                          <td className="px-6 py-3 text-right tabular-nums text-foreground">
                            {formatMoney(row.spend)}
                          </td>
                          <td className="px-6 py-3 text-right tabular-nums text-foreground">
                            {row.impressions.toLocaleString()}
                          </td>
                          <td className="px-6 py-3 text-right tabular-nums text-foreground">
                            {row.clicks.toLocaleString()}
                          </td>
                          <td className="px-6 py-3 text-right tabular-nums text-foreground">
                            {formatPercent(row.ctr)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        ))}
    </div>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof DollarSign
  label: string
  value: string
  tone: 'primary' | 'success' | 'warning' | 'muted'
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-primary/10 text-primary'
      : tone === 'success'
        ? 'bg-success/10 text-success'
        : tone === 'warning'
          ? 'bg-warning/15 text-warning-foreground'
          : 'bg-muted text-muted-foreground'
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className={cn('flex size-9 items-center justify-center rounded-lg', toneClass)}>
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
