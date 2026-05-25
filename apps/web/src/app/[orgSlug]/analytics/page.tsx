'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  BarChart3,
  Eye,
  Loader2,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--foreground)',
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
      toast.success('Sync encolado', { description: 'Refrescaremos los datos en unos segundos.' })
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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            <BarChart3 className="size-6 text-primary" />
            Analíticas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Métricas agregadas de tus publicaciones en redes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
            {(['7d', '30d', '90d'] as Range[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  range === r
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r === '7d' ? '7 días' : r === '30d' ? '30 días' : '90 días'}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={handleSync} loading={syncing} disabled={syncing}>
            {!syncing && <RefreshCw className="size-4" />}
            Sincronizar
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="posts">Top posts</TabsTrigger>
          <TabsTrigger value="accounts">Cuentas</TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : !hasData ? (
          <Card className="mt-4">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <BarChart3 className="size-6 text-primary" />
              </span>
              <div>
                <p className="text-base font-medium text-foreground">Sin métricas en este rango</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Conectá una cuenta, publicá posts y volvé en unas horas. El sync corre cada 6h.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <TabsContent value="overview">
              <OverviewTab overview={overview} timeline={timeline} />
            </TabsContent>
            <TabsContent value="posts">
              <TopPostsTab posts={topPosts} />
            </TabsContent>
            <TabsContent value="accounts">
              <AccountsTab accounts={accounts} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}

function OverviewTab({
  overview,
  timeline,
}: {
  overview: Overview | null
  timeline: TimelinePoint[]
}) {
  if (!overview) return null
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard icon={TrendingUp} label="Posts publicados" value={fmt(overview.totalPosts)} tone="primary" />
        <KpiCard icon={Eye} label="Impresiones" value={fmt(overview.totalImpressions)} tone="primary" />
        <KpiCard icon={Users} label="Alcance" value={fmt(overview.totalReach)} tone="success" />
        <KpiCard
          icon={BarChart3}
          label="Engagement rate"
          value={`${overview.engagementRate.toFixed(2)}%`}
          hint={`${fmt(overview.totalEngagement)} interacciones`}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Evolución diaria</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Sin datos en el rango.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={timeline} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted-foreground)' }} />
                  <Line type="monotone" dataKey="impressions" stroke="var(--chart-1)" name="Impresiones" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="reach" stroke="var(--chart-2)" name="Alcance" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="engagement" stroke="var(--chart-3)" name="Interacciones" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por red</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.byProvider.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Sin breakdown.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={overview.byProvider.map((p) => ({
                    ...p,
                    name: PROVIDER_LABEL[p.provider] || p.provider,
                  }))}
                  margin={{ top: 5, right: 5, bottom: 5, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="impressions" fill="var(--chart-1)" name="Impresiones" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="engagement" fill="var(--chart-3)" name="Interacciones" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TopPostsTab({ posts }: { posts: TopPost[] }) {
  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Sin posts publicados en este rango.
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Post</th>
              <th className="px-4 py-3 font-semibold">Red</th>
              <th className="px-4 py-3 text-right font-semibold">Impresiones</th>
              <th className="px-4 py-3 text-right font-semibold">Alcance</th>
              <th className="px-4 py-3 text-right font-semibold">Engagement</th>
              <th className="px-4 py-3 text-right font-semibold">Tasa</th>
              <th className="px-4 py-3 font-semibold">Publicado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {posts.map((p) => (
              <tr key={p.variantId} className="hover:bg-accent/50">
                <td className="max-w-md px-4 py-3">
                  <div className="truncate font-medium text-foreground">
                    {p.title || p.content?.slice(0, 80) || '—'}
                  </div>
                  {p.content && p.title && (
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {p.content.slice(0, 80)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {p.provider ? PROVIDER_LABEL[p.provider] || p.provider : '—'}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">{fmt(p.impressions)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">{fmt(p.reach)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">{fmt(p.engagement)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                  {p.engagement_rate != null ? `${(p.engagement_rate * 100).toFixed(2)}%` : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {p.publishedAt
                    ? new Date(p.publishedAt).toLocaleDateString('es-EC', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function AccountsTab({ accounts }: { accounts: AccountSummary[] }) {
  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No hay cuentas conectadas. Andá a Conexiones para vincular tu primera red.
        </CardContent>
      </Card>
    )
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {accounts.map((a) => (
        <Card key={a.id}>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-3">
              <Avatar>
                {a.avatarUrl && <AvatarImage src={a.avatarUrl} alt="" />}
                <AvatarFallback>
                  {(PROVIDER_LABEL[a.provider] || a.provider).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {a.displayName || '(sin nombre)'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {PROVIDER_LABEL[a.provider] || a.provider}
                </p>
              </div>
              <Badge variant={a.status === 'active' ? 'success' : 'warning'}>{a.status}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Seguidores" value={fmt(a.followers)} />
              <Stat label="Impresiones" value={fmt(a.impressions)} />
              <Stat label="Alcance" value={fmt(a.reach)} />
            </div>
            {a.lastSync && (
              <p className="text-right text-xs text-muted-foreground">
                Última sync:{' '}
                {new Date(a.lastSync).toLocaleString('es-EC', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: string
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
        <div className="flex items-start justify-between">
          <div className={cn('flex size-9 items-center justify-center rounded-lg', toneClass)}>
            <Icon className="size-4" />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}
