'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Megaphone,
  ExternalLink,
  Loader2,
  Send,
  Trash2,
  Play,
  Pause,
  CheckCircle2,
  XCircle,
  Clock,
  Image as ImageIcon,
  Target,
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
  listCampaigns,
  listInsights,
  submitForApproval,
  deleteCampaign,
  approveCampaign,
  launchCampaign,
  pauseCampaign,
  rejectCampaign,
  type AdCampaign,
  type AdInsight,
  formatMoney,
  formatPercent,
  statusLabel,
  objectiveLabel,
} from '@/lib/ads/api'

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
    return () => {
      cancelled = true
    }
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
        setError('Campaña no encontrada')
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

  useEffect(() => {
    load()
  }, [load])

  // Acciones
  async function withAction(name: string, fn: () => Promise<void>) {
    setActing(name)
    try {
      await fn()
      await load()
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : 'desconocido'}`)
    } finally {
      setActing(null)
    }
  }

  async function handleSubmit() {
    if (!userId || !campaign) return
    if (!confirm('Enviar a aprobación del equipo KAPI?')) return
    await withAction('submit', async () => {
      await submitForApproval(campaign.id, userId)
    })
  }

  async function handleDelete() {
    if (!userId || !campaign) return
    if (!confirm(`¿Eliminar "${campaign.name}"? Si fue aprobada, también se borra en Meta.`)) return
    await withAction('delete', async () => {
      await deleteCampaign(campaign.id, userId)
      router.push(`/${params.orgSlug}/ads`)
    })
  }

  async function handleApprove() {
    if (!userId || !campaign) return
    if (
      !confirm(
        `Aprobar y crear en Meta (PAUSED)?\n\nNo empieza a gastar hasta lanzar.`,
      )
    )
      return
    await withAction('approve', async () => {
      const r = await approveCampaign(campaign.id, userId)
      alert(`✅ Creada en Meta\n\nCampaign ID: ${r.meta.campaignId}`)
    })
  }

  async function handleReject() {
    if (!userId || !campaign) return
    const reason = prompt('Razón del rechazo:')
    if (!reason) return
    await withAction('reject', async () => {
      await rejectCampaign(campaign.id, reason, userId)
    })
  }

  async function handleLaunch() {
    if (!userId || !campaign) return
    if (
      !confirm(
        `⚠️ LANZAR en Meta (ACTIVE)?\n\nEMPIEZA A GASTAR el presupuesto diario inmediatamente.`,
      )
    )
      return
    await withAction('launch', async () => {
      await launchCampaign(campaign.id, userId)
    })
  }

  async function handlePause() {
    if (!userId || !campaign) return
    if (!confirm('Pausar la campaña? Deja de gastar.')) return
    await withAction('pause', async () => {
      await pauseCampaign(campaign.id, userId)
    })
  }

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
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando...
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="space-y-3">
        <Link
          href={`/${params.orgSlug}/ads`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error || 'No encontrada'}
        </div>
      </div>
    )
  }

  const st = statusLabel(campaign.status)
  const accountCurrency = campaign.ad_accounts?.currency || 'USD'
  const adSet = campaign.ad_sets?.[0]
  const creative = campaign.ad_creatives?.[0]

  // Definir acciones disponibles según rol + estado
  const actions: Array<{
    key: string
    label: string
    icon: typeof Send
    onClick: () => void
    style: string
    show: boolean
  }> = [
    {
      key: 'submit',
      label: 'Enviar a aprobación',
      icon: Send,
      onClick: handleSubmit,
      style: 'bg-primary hover:bg-primary/90 text-white',
      show: campaign.status === 'draft',
    },
    {
      key: 'delete',
      label: 'Eliminar',
      icon: Trash2,
      onClick: handleDelete,
      style: 'border border-destructive/30 bg-card text-destructive hover:bg-destructive/10',
      show: campaign.status === 'draft' || campaign.status === 'rejected' || (isAdmin && campaign.status !== 'active'),
    },
    {
      key: 'reject',
      label: 'Rechazar',
      icon: XCircle,
      onClick: handleReject,
      style: 'border border-destructive/30 bg-card text-destructive hover:bg-destructive/10',
      show: isAdmin && campaign.status === 'pending_approval',
    },
    {
      key: 'approve',
      label: 'Aprobar (PAUSED)',
      icon: CheckCircle2,
      onClick: handleApprove,
      style: 'bg-primary hover:bg-primary/90 text-white',
      show: isAdmin && campaign.status === 'pending_approval',
    },
    {
      key: 'launch',
      label: 'Lanzar (ACTIVE)',
      icon: Play,
      onClick: handleLaunch,
      style: 'bg-green-600 hover:bg-green-700 text-white',
      show: isAdmin && (campaign.status === 'approved' || campaign.status === 'paused'),
    },
    {
      key: 'pause',
      label: 'Pausar',
      icon: Pause,
      onClick: handlePause,
      style: 'bg-orange-500 hover:bg-orange-600 text-white',
      show: isAdmin && campaign.status === 'active',
    },
  ]
  const visibleActions = actions.filter((a) => a.show)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/${params.orgSlug}/ads`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Megaphone className="h-6 w-6 text-primary" />
              <span className="truncate">{campaign.name}</span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
                {st.label}
              </span>
              <span className="text-sm text-muted-foreground">
                {objectiveLabel(campaign.objective)}
              </span>
              {campaign.meta_campaign_id && (
                <a
                  href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${campaign.meta_campaign_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Ver en Meta Ads Manager <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
          {visibleActions.length > 0 && (
            <div className="flex flex-shrink-0 flex-wrap justify-end gap-2">
              {visibleActions.map((a) => {
                const Icon = a.icon
                const isLoading = acting === a.key
                return (
                  <button
                    key={a.key}
                    onClick={a.onClick}
                    disabled={!!acting}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${a.style}`}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                    {a.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {campaign.rejection_reason && (
          <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <strong>Razón del rechazo:</strong> {campaign.rejection_reason}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="space-y-6 lg:col-span-2">
          {/* Insights */}
          {insights.length > 0 && (
            <Section title="Rendimiento (últimos 7 días)">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kpi label="Gasto" value={formatMoney(totals.spend, accountCurrency)} />
                <Kpi label="Impresiones" value={totals.impressions.toLocaleString()} />
                <Kpi label="Clicks" value={totals.clicks.toLocaleString()} />
                <Kpi label="CTR" value={formatPercent(totals.ctr)} />
              </div>
              {spendByDay.length > 1 && (
                <div className="mt-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={spendByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) =>
                          new Date(v).toLocaleDateString('es', { day: '2-digit', month: 'short' })
                        }
                      />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        formatter={(v: number) => [`$${v.toFixed(2)}`, 'Gasto']}
                        labelFormatter={(v) => new Date(v).toLocaleDateString('es')}
                      />
                      <Line type="monotone" dataKey="spend" stroke="#2563eb" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Section>
          )}

          {/* Conjunto de anuncios */}
          {adSet && (
            <Section title="Conjunto de anuncios">
              <Row label="Nombre" value={adSet.name} />
              <Row label="Estado" value={adSet.status} />
              {adSet.meta_adset_id && (
                <Row label="Meta AdSet ID" value={adSet.meta_adset_id} mono />
              )}
            </Section>
          )}

          {/* Creativo */}
          {creative && (
            <Section title="Creativo">
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
            </Section>
          )}
        </div>

        {/* Sidebar info */}
        <div className="space-y-6">
          <Section title="Configuración" icon={Target}>
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
          </Section>

          <Section title="Historial" icon={Clock}>
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
          </Section>

          {campaign.status === 'draft' && (
            <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-blue-800">
              <ImageIcon className="mb-1 inline h-4 w-4" />{' '}
              <strong>Borrador.</strong> Cuando estés listo, envía a aprobación.
              El equipo KAPI lo revisa y lo lanza en Meta.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon?: typeof Target
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-semibold text-foreground">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
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
  return (
    <div className={multiline ? '' : 'flex justify-between gap-2 text-sm'}>
      <span className="text-muted-foreground">{label}</span>
      <span className={`${mono ? 'font-mono text-xs' : ''} ${multiline ? 'mt-1 block whitespace-pre-wrap' : 'text-right text-foreground'}`}>
        {value}
      </span>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
    </div>
  )
}
