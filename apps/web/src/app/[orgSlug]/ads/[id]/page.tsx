'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Pause,
  Play,
  Send,
  Target,
  Trash2,
  XCircle,
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
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  approveCampaign,
  deleteCampaign,
  formatMoney,
  formatPercent,
  launchCampaign,
  listCampaigns,
  listInsights,
  objectiveLabel,
  pauseCampaign,
  rejectCampaign,
  statusLabel,
  submitForApproval,
  type AdCampaign,
  type AdInsight,
} from '@/lib/ads/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function statusVariant(status: string): 'muted' | 'default' | 'success' | 'destructive' | 'warning' | 'secondary' {
  switch (status) {
    case 'draft': return 'muted'
    case 'pending_approval': return 'warning'
    case 'approved': return 'secondary'
    case 'active': return 'success'
    case 'paused': return 'muted'
    case 'rejected': return 'destructive'
    case 'archived': return 'muted'
    default: return 'default'
  }
}

export default function AdCampaignDetailPage() {
  const params = useParams<{ orgSlug: string; id: string }>()
  const router = useRouter()
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [campaign, setCampaign] = useState<AdCampaign | null>(null)
  const [insights, setInsights] = useState<AdInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

      const { data: memberships } = await supabase
        .from('organization_members')
        .select('organizations(slug)')
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin'])
      const ms = (memberships || []) as Array<{ organizations: { slug: string } | null }>
      setIsAdmin(ms.some((m) => m.organizations?.slug === 'kapi'))
    })()
    return () => { cancelled = true }
  }, [params.orgSlug, supabase])

  const load = useCallback(async () => {
    if (!orgId || !userId) return
    setLoading(true)
    setError(null)
    try {
      const [camps, ins] = await Promise.all([
        listCampaigns(orgId, userId),
        listInsights(orgId, userId, { scope: 'campaign' }),
      ])
      const c = camps.campaigns.find((c) => c.id === params.id)
      if (!c) {
        setError('Campaña no encontrada.')
        return
      }
      setCampaign(c)
      setInsights(ins.insights.filter((i) => i.scope_id === params.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando campaña')
    } finally {
      setLoading(false)
    }
  }, [orgId, userId, params.id])

  useEffect(() => { load() }, [load])

  async function withAction(name: string, fn: () => Promise<void>) {
    setActing(name)
    try {
      await fn()
      await load()
    } catch (e) {
      toast.error('Acción falló', { description: e instanceof Error ? e.message : 'desconocido' })
    } finally {
      setActing(null)
    }
  }

  async function handleSubmit() {
    if (!userId || !campaign) return
    if (!confirm('¿Enviar a aprobación del equipo KAPI?')) return
    await withAction('submit', async () => {
      await submitForApproval(campaign.id, userId)
      toast.success('Enviada a aprobación.')
    })
  }
  async function handleDelete() {
    if (!userId || !campaign) return
    if (!confirm(`¿Eliminar "${campaign.name}"? Si fue aprobada, también se borra en Meta.`)) return
    await withAction('delete', async () => {
      await deleteCampaign(campaign.id, userId)
      toast.success('Campaña eliminada.')
      router.push(`/${params.orgSlug}/ads`)
    })
  }
  async function handleApprove() {
    if (!userId || !campaign) return
    if (!confirm('¿Aprobar y crear en Meta (PAUSED)?\n\nNo empieza a gastar hasta lanzarla.')) return
    await withAction('approve', async () => {
      const r = await approveCampaign(campaign.id, userId)
      toast.success('Creada en Meta', { description: `Campaign ID: ${r.meta.campaignId}` })
    })
  }
  async function handleReject() {
    if (!userId || !campaign) return
    const reason = prompt('Razón del rechazo:')
    if (!reason) return
    await withAction('reject', async () => {
      await rejectCampaign(campaign.id, reason, userId)
      toast.success('Rechazada.')
    })
  }
  async function handleLaunch() {
    if (!userId || !campaign) return
    if (!confirm('⚠️ LANZAR en Meta (ACTIVE)?\n\nEmpieza a gastar el presupuesto inmediatamente.')) return
    await withAction('launch', async () => {
      await launchCampaign(campaign.id, userId)
      toast.success('Campaña activa en Meta.')
    })
  }
  async function handlePause() {
    if (!userId || !campaign) return
    if (!confirm('¿Pausar la campaña? Deja de gastar.')) return
    await withAction('pause', async () => {
      await pauseCampaign(campaign.id, userId)
      toast.success('Campaña pausada.')
    })
  }

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
    return insights
      .slice()
      .sort((a, b) => a.period_start.localeCompare(b.period_start))
      .map((i) => ({
        date: i.period_start.slice(0, 10),
        spend: (i.spend_cents || 0) / 100,
        clicks: i.clicks || 0,
      }))
  }, [insights])

  if (!userId || !orgId || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando…
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${params.orgSlug}/ads`}>
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertDescription>{error || 'No encontrada'}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const st = statusLabel(campaign.status)
  const accountCurrency = campaign.ad_accounts?.currency || 'USD'
  const adSet = campaign.ad_sets?.[0]
  const creative = campaign.ad_creatives?.[0]

  const actions: Array<{
    key: string
    label: string
    icon: typeof Send
    onClick: () => void
    variant: 'default' | 'destructive' | 'outline' | 'gradient' | 'secondary'
    show: boolean
  }> = [
    { key: 'submit', label: 'Enviar a aprobación', icon: Send, onClick: handleSubmit, variant: 'gradient', show: campaign.status === 'draft' },
    { key: 'delete', label: 'Eliminar', icon: Trash2, onClick: handleDelete, variant: 'outline', show: campaign.status === 'draft' || campaign.status === 'rejected' || (isAdmin && campaign.status !== 'active') },
    { key: 'reject', label: 'Rechazar', icon: XCircle, onClick: handleReject, variant: 'outline', show: isAdmin && campaign.status === 'pending_approval' },
    { key: 'approve', label: 'Aprobar (PAUSED)', icon: CheckCircle2, onClick: handleApprove, variant: 'default', show: isAdmin && campaign.status === 'pending_approval' },
    { key: 'launch', label: 'Lanzar (ACTIVE)', icon: Play, onClick: handleLaunch, variant: 'gradient', show: isAdmin && (campaign.status === 'approved' || campaign.status === 'paused') },
    { key: 'pause', label: 'Pausar', icon: Pause, onClick: handlePause, variant: 'secondary', show: isAdmin && campaign.status === 'active' },
  ]
  const visibleActions = actions.filter((a) => a.show)

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${params.orgSlug}/ads`}>
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              <Megaphone className="size-6 text-primary" />
              <span className="truncate">{campaign.name}</span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(campaign.status)}>{st.label}</Badge>
              <span className="text-sm text-muted-foreground">{objectiveLabel(campaign.objective)}</span>
              {campaign.meta_campaign_id && (
                <a
                  href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${campaign.meta_campaign_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Ver en Meta Ads Manager <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </div>
          {visibleActions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {visibleActions.map((a) => {
                const Icon = a.icon
                const isLoading = acting === a.key
                return (
                  <Button
                    key={a.key}
                    onClick={a.onClick}
                    disabled={!!acting}
                    loading={isLoading}
                    variant={a.variant}
                    size="sm"
                  >
                    {!isLoading && <Icon className="size-4" />}
                    {a.label}
                  </Button>
                )
              })}
            </div>
          )}
        </div>
        {campaign.rejection_reason && (
          <Alert variant="destructive" className="mt-3">
            <AlertTitle>Razón del rechazo</AlertTitle>
            <AlertDescription>{campaign.rejection_reason}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rendimiento (últimos 7 días)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Kpi label="Gasto" value={formatMoney(totals.spend, accountCurrency)} />
                  <Kpi label="Impresiones" value={totals.impressions.toLocaleString()} />
                  <Kpi label="Clicks" value={totals.clicks.toLocaleString()} />
                  <Kpi label="CTR" value={formatPercent(totals.ctr)} />
                </div>
                {spendByDay.length > 1 && (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={spendByDay}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                          tickFormatter={(v) =>
                            new Date(v).toLocaleDateString('es', { day: '2-digit', month: 'short' })
                          }
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                          tickFormatter={(v) => `$${v}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--popover)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            color: 'var(--foreground)',
                          }}
                          formatter={(v: number) => [`$${v.toFixed(2)}`, 'Gasto']}
                          labelFormatter={(v) => new Date(v).toLocaleDateString('es')}
                        />
                        <Line type="monotone" dataKey="spend" stroke="var(--primary)" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {adSet && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conjunto de anuncios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Row label="Nombre" value={adSet.name} />
                <Row label="Estado" value={adSet.status} />
                {adSet.meta_adset_id && <Row label="Meta AdSet ID" value={adSet.meta_adset_id} mono />}
              </CardContent>
            </Card>
          )}

          {creative && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Creativo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Row label="Nombre" value={creative.name} />
                {creative.headline && <Row label="Titular" value={creative.headline} />}
                {creative.body && <Row label="Mensaje" value={creative.body} multiline />}
                {creative.link_url && (
                  <Row
                    label="URL"
                    value={
                      <a
                        href={creative.link_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {creative.link_url}
                      </a>
                    }
                  />
                )}
                {creative.meta_creative_id && (
                  <Row label="Meta Creative ID" value={creative.meta_creative_id} mono />
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="size-4 text-muted-foreground" />
                Configuración
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Row
                label="Presupuesto"
                value={
                  campaign.daily_budget_cents
                    ? `${formatMoney(campaign.daily_budget_cents, accountCurrency)}/día`
                    : campaign.lifetime_budget_cents
                      ? `${formatMoney(campaign.lifetime_budget_cents, accountCurrency)} total`
                      : '—'
                }
              />
              <Row label="Objetivo" value={objectiveLabel(campaign.objective)} />
              {campaign.start_time && (
                <Row label="Inicio" value={new Date(campaign.start_time).toLocaleString()} />
              )}
              {campaign.end_time && (
                <Row label="Fin" value={new Date(campaign.end_time).toLocaleString()} />
              )}
              {campaign.ad_accounts && (
                <Row label="Cuenta" value={campaign.ad_accounts.meta_ad_account_id} mono />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="size-4 text-muted-foreground" />
                Historial
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Row label="Creada" value={new Date(campaign.created_at).toLocaleString()} />
              {campaign.approved_at && (
                <Row label="Aprobada" value={new Date(campaign.approved_at).toLocaleString()} />
              )}
              {campaign.launched_at && (
                <Row label="Lanzada" value={new Date(campaign.launched_at).toLocaleString()} />
              )}
              {campaign.meta_campaign_id && (
                <Row label="Meta Campaign ID" value={campaign.meta_campaign_id} mono />
              )}
            </CardContent>
          </Card>

          {campaign.status === 'draft' && (
            <Alert variant="info">
              <ImageIcon className="size-4" />
              <AlertTitle>Borrador</AlertTitle>
              <AlertDescription>
                Cuando estés listo, enviá a aprobación. El equipo KAPI lo revisa y lo lanza en Meta.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  mono,
  multiline,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  multiline?: boolean
}) {
  if (multiline) {
    return (
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{value}</p>
      </div>
    )
  }
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('text-right text-foreground', mono && 'truncate font-mono text-xs')}>{value}</span>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}
