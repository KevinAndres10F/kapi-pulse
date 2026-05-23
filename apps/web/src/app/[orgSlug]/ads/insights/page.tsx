'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  DollarSign,
  Eye,
  MousePointerClick,
  Loader2,
  Zap,
  Database,
  RefreshCw,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import {
  listInsights,
  listCampaigns,
  type AdInsight,
  type AdCampaign,
  formatMoney,
  formatPercent,
} from '@/lib/ads/api'

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
    return () => {
      cancelled = true
    }
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

  useEffect(() => {
    load()
  }, [load])

  // Live mode — llamar a Meta directamente para una campaña específica
  const loadLive = useCallback(async () => {
    if (!orgId || !userId || !liveCampaignId) return
    const camp = campaigns.find((c) => c.id === liveCampaignId)
    if (!camp?.meta_campaign_id) {
      setLiveError('Esta campaña no tiene ID de Meta — no hay datos live')
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

  // Métricas agregadas
  const totals = useMemo(() => {
    let spend = 0
    let impressions = 0
    let clicks = 0
    let reach = 0
    for (const i of insights) {
      spend += i.spend_cents || 0
      impressions += i.impressions || 0
      clicks += i.clicks || 0
      reach += i.reach || 0
    }
    const ctr = impressions > 0 ? clicks / impressions : null
    return { spend, impressions, clicks, reach, ctr }
  }, [insights])

  // Serie temporal: spend por día (agregado de todas las campañas)
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

  // Tabla: insights agrupados por campaña
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
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${params.orgSlug}/ads`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          Insights de campañas
        </h1>
        <p className="mt-1 text-gray-600">
          Datos sincronizados desde Meta cada 6h. Para datos en tiempo real,
          consulta directamente Ads Manager.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Toggle Cached / Live */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex rounded-md border border-gray-300 p-0.5">
          <button
            onClick={() => setMode('cached')}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm ${
              mode === 'cached' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            Cached (cada 6h)
          </button>
          <button
            onClick={() => setMode('live')}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm ${
              mode === 'live' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Live desde Meta
          </button>
        </div>
        {mode === 'live' && (
          <>
            <select
              value={liveCampaignId}
              onChange={(e) => setLiveCampaignId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">— Elige campaña —</option>
              {campaigns
                .filter((c) => c.meta_campaign_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            {liveCampaignId && (
              <button
                onClick={loadLive}
                disabled={liveLoading}
                className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${liveLoading ? 'animate-spin' : ''}`} />
                Refrescar
              </button>
            )}
            <p className="text-xs text-gray-500">
              Llama directo a Meta. Cuenta hacia tus rate limits.
            </p>
          </>
        )}
      </div>

      {/* Live mode data */}
      {mode === 'live' && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-gray-900">
              <Zap className="h-4 w-4 text-yellow-500" />
              Datos en vivo
            </h2>
          </div>
          {liveError && (
            <div className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700">
              {liveError}
            </div>
          )}
          {!liveCampaignId && (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              Elige una campaña para consultar Meta en tiempo real.
            </div>
          )}
          {liveLoading && (
            <div className="flex items-center gap-2 px-6 py-10 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Consultando Meta...
            </div>
          )}
          {!liveLoading && liveData.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Fecha</th>
                    <th className="px-6 py-3 text-right">Gasto</th>
                    <th className="px-6 py-3 text-right">Impresiones</th>
                    <th className="px-6 py-3 text-right">Clicks</th>
                    <th className="px-6 py-3 text-right">CTR</th>
                    <th className="px-6 py-3 text-right">CPC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {liveData.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-3 font-mono text-xs">
                        {(row.date_start as string) || '—'}
                      </td>
                      <td className="px-6 py-3 text-right">${String(row.spend || '0')}</td>
                      <td className="px-6 py-3 text-right">
                        {Number(row.impressions || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {Number(row.clicks || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {row.ctr ? `${Number(row.ctr).toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {row.cpc ? `$${Number(row.cpc).toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!liveLoading && liveCampaignId && liveData.length === 0 && !liveError && (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              Sin datos para esta campaña en los últimos 7 días.
            </div>
          )}
        </div>
      )}

      {mode === 'cached' && (insights.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white py-16 text-center">
          <TrendingUp className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-gray-700">No hay datos de insights todavía</p>
          <p className="mt-1 text-sm text-gray-500">
            Una vez que lances una campaña en ACTIVE y empiece a gastar, los datos aparecen
            aquí en la siguiente sincronización (hasta 6h).
          </p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi
              icon={DollarSign}
              label="Gasto total"
              value={formatMoney(totals.spend)}
              color="text-blue-600"
            />
            <Kpi
              icon={Eye}
              label="Impresiones"
              value={totals.impressions.toLocaleString()}
              color="text-purple-600"
            />
            <Kpi
              icon={MousePointerClick}
              label="Clicks"
              value={totals.clicks.toLocaleString()}
              color="text-green-600"
            />
            <Kpi
              icon={TrendingUp}
              label="CTR promedio"
              value={formatPercent(totals.ctr)}
              color="text-orange-600"
            />
          </div>

          {/* Gráfico de spend */}
          {spendByDay.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 font-semibold text-gray-900">Gasto diario</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={spendByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => new Date(v).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Gasto']}
                      labelFormatter={(v) => new Date(v).toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: 'short' })}
                    />
                    <Line
                      type="monotone"
                      dataKey="spend"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={{ fill: '#2563eb', r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tabla por campaña */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="font-semibold text-gray-900">Por campaña</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Campaña</th>
                    <th className="px-6 py-3 text-right">Gasto</th>
                    <th className="px-6 py-3 text-right">Impresiones</th>
                    <th className="px-6 py-3 text-right">Clicks</th>
                    <th className="px-6 py-3 text-right">CTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {byCampaign.map((row) => (
                    <tr key={row.id}>
                      <td className="px-6 py-3 font-medium text-gray-900">{row.name}</td>
                      <td className="px-6 py-3 text-right">{formatMoney(row.spend)}</td>
                      <td className="px-6 py-3 text-right">{row.impressions.toLocaleString()}</td>
                      <td className="px-6 py-3 text-right">{row.clicks.toLocaleString()}</td>
                      <td className="px-6 py-3 text-right">{formatPercent(row.ctr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ))}
    </div>
  )
}

function Kpi({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof DollarSign
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <p className="text-xs font-medium text-gray-500">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
