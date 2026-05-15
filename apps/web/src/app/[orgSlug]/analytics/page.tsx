'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart3,
  TrendingUp,
  Users,
  Eye,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type Range = '7d' | '30d' | '90d'
const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90 }

const PROVIDER_LABEL: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  x: 'X / Twitter',
  threads: 'Threads',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  whatsapp: 'WhatsApp',
}

interface Overview {
  totalPosts: number
  totalImpressions: number
  totalReach: number
  totalEngagement: number
  engagementRate: number
  byProvider: Array<{ provider: string; posts: number; impressions: number; engagement: number }>
}

interface TimelinePoint {
  date: string
  impressions: number
  reach: number
  engagement: number
}

interface TopPost {
  variantId: string
  title: string | null
  content: string | null
  provider: string | null
  accountName: string | null
  publishedAt: string | null
  impressions: number
  reach: number
  engagement: number
  engagement_rate: number | null
}

interface AccountSummary {
  id: string
  provider: string
  displayName: string | null
  avatarUrl: string | null
  status: string
  followers: number | null
  impressions: number | null
  reach: number | null
  lastSync: string | null
}

export default function AnalyticsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const supabase = createClient()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('30d')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [timeline, setTimeline] = useState<TimelinePoint[]>([])
  const [topPosts, setTopPosts] = useState<TopPost[]>([])
  const [accounts, setAccounts] = useState<AccountSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'overview' | 'posts' | 'accounts'>('overview')

  useEffect(() => {
    supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single()
      .then((res: { data: { id: string } | null }) => setOrgId(res.data?.id ?? null))
  }, [orgSlug, supabase])

  const loadData = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError(null)
    const days = RANGE_DAYS[range]
    const to = new Date().toISOString()
    const from = new Date(Date.now() - days * 86400_000).toISOString()
    const qs = `org_id=${orgId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    try {
      const [oRes, tRes, pRes, aRes] = await Promise.all([
        fetch(`${API_URL}/api/metrics/overview?${qs}`),
        fetch(`${API_URL}/api/metrics/timeline?${qs}`),
        fetch(`${API_URL}/api/metrics/top-posts?${qs}&limit=10`),
        fetch(`${API_URL}/api/metrics/accounts?org_id=${orgId}`),
      ])
      if (!oRes.ok) throw new Error(`overview ${oRes.status}`)
      const [oData, tData, pData, aData] = await Promise.all([
        oRes.json(),
        tRes.json(),
        pRes.json(),
        aRes.json(),
      ])
      setOverview(oData)
      setTimeline(tData.points || [])
      setTopPosts(pData.posts || [])
      setAccounts(aData.accounts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar métricas')
    } finally {
      setLoading(false)
    }
  }, [orgId, range])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch(`${API_URL}/api/metrics/sync`, { method: 'POST' })
      if (!res.ok && res.status !== 202) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Error ${res.status}`)
      }
      // El job corre en segundo plano — esperamos un cachito y recargamos
      setTimeout(loadData, 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al encolar sync')
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (syncing) {
      const t = setTimeout(() => setSyncing(false), 6000)
      return () => clearTimeout(t)
    }
  }, [syncing])

  const hasData = (overview?.totalPosts ?? 0) > 0 || timeline.length > 0 || accounts.length > 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <BarChart3 className="h-6 w-6" /> Analíticas
          </h1>
          <p className="text-sm text-gray-600">Métricas agregadas de tus publicaciones en redes.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 bg-white p-1">
            {(['7d', '30d', '90d'] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded px-3 py-1 text-sm font-medium transition ${
                  range === r ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {r === '7d' ? '7 días' : r === '30d' ? '30 días' : '90 días'}
              </button>
            ))}
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sincronizar
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Resumen</TabBtn>
        <TabBtn active={tab === 'posts'} onClick={() => setTab('posts')}>Top posts</TabBtn>
        <TabBtn active={tab === 'accounts'} onClick={() => setTab('accounts')}>Cuentas</TabBtn>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : !hasData ? (
        <EmptyState />
      ) : tab === 'overview' ? (
        <OverviewTab overview={overview} timeline={timeline} />
      ) : tab === 'posts' ? (
        <TopPostsTab posts={topPosts} />
      ) : (
        <AccountsTab accounts={accounts} />
      )}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
        active ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
      <BarChart3 className="mx-auto h-12 w-12 text-gray-300" />
      <p className="mt-3 text-gray-600">Todavía no hay métricas para este rango.</p>
      <p className="mt-1 text-sm text-gray-400">
        Conectá una cuenta, publicá posts, y volvé en unas horas. El sync corre cada 6h.
      </p>
    </div>
  )
}

function OverviewTab({ overview, timeline }: { overview: Overview | null; timeline: TimelinePoint[] }) {
  if (!overview) return null
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={<TrendingUp />} label="Posts publicados" value={fmt(overview.totalPosts)} />
        <KpiCard icon={<Eye />} label="Impresiones" value={fmt(overview.totalImpressions)} />
        <KpiCard icon={<Users />} label="Alcance" value={fmt(overview.totalReach)} />
        <KpiCard
          icon={<BarChart3 />}
          label="Engagement rate"
          value={`${overview.engagementRate.toFixed(2)}%`}
          hint={`${fmt(overview.totalEngagement)} interacciones`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Evolución diaria</h3>
          {timeline.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">Sin datos en el rango.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timeline} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="impressions" stroke="#3b82f6" name="Impresiones" dot={false} />
                <Line type="monotone" dataKey="reach" stroke="#8b5cf6" name="Alcance" dot={false} />
                <Line type="monotone" dataKey="engagement" stroke="#10b981" name="Interacciones" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Por red</h3>
          {overview.byProvider.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">Sin breakdown.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={overview.byProvider.map((p) => ({ ...p, name: PROVIDER_LABEL[p.provider] || p.provider }))}
                margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="impressions" fill="#3b82f6" name="Impresiones" />
                <Bar dataKey="engagement" fill="#10b981" name="Interacciones" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

function TopPostsTab({ posts }: { posts: TopPost[] }) {
  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
        Sin posts publicados en este rango.
      </div>
    )
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-4 py-2">Post</th>
            <th className="px-4 py-2">Red</th>
            <th className="px-4 py-2 text-right">Impresiones</th>
            <th className="px-4 py-2 text-right">Alcance</th>
            <th className="px-4 py-2 text-right">Engagement</th>
            <th className="px-4 py-2 text-right">Tasa</th>
            <th className="px-4 py-2">Publicado</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.variantId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <td className="max-w-md px-4 py-3">
                <div className="truncate font-medium text-gray-900">{p.title || (p.content?.slice(0, 80) || '—')}</div>
                {p.content && p.title && (
                  <div className="mt-0.5 truncate text-xs text-gray-500">{p.content.slice(0, 80)}</div>
                )}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {p.provider ? PROVIDER_LABEL[p.provider] || p.provider : '—'}
              </td>
              <td className="px-4 py-3 text-right font-mono text-gray-900">{fmt(p.impressions)}</td>
              <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(p.reach)}</td>
              <td className="px-4 py-3 text-right font-mono text-gray-700">{fmt(p.engagement)}</td>
              <td className="px-4 py-3 text-right font-mono text-gray-700">
                {p.engagement_rate != null ? `${(p.engagement_rate * 100).toFixed(2)}%` : '—'}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('es-EC') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AccountsTab({ accounts }: { accounts: AccountSummary[] }) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
        No hay cuentas conectadas. Andá a Conexiones para vincular tu primera red.
      </div>
    )
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {accounts.map((a) => (
        <div key={a.id} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-3">
            {a.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500">
                {(PROVIDER_LABEL[a.provider] || a.provider).slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-gray-900">{a.displayName || '(sin nombre)'}</p>
              <p className="text-xs text-gray-500">{PROVIDER_LABEL[a.provider] || a.provider}</p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                a.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {a.status}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Seguidores" value={fmt(a.followers)} />
            <Stat label="Impresiones" value={fmt(a.impressions)} />
            <Stat label="Alcance" value={fmt(a.reach)} />
          </div>
          {a.lastSync && (
            <p className="mt-3 text-right text-xs text-gray-400">
              Última sync: {new Date(a.lastSync).toLocaleString('es-EC')}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between text-gray-400">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>
        <span className="h-4 w-4">{icon}</span>
      </div>
      <p className="mt-1.5 text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-gray-50 px-2 py-1.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
