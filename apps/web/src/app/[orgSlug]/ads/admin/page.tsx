'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  Loader2,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  listPending,
  listCampaigns,
  approveCampaign,
  rejectCampaign,
  launchCampaign,
  pauseCampaign,
  type PendingCampaign,
  type AdCampaign,
  formatMoney,
  statusLabel,
  objectiveLabel,
} from '@/lib/ads/api'

type ActionState = { type: 'approving' | 'rejecting' | 'launching' | 'pausing'; id: string } | null

export default function AdsAdminPage() {
  const params = useParams<{ orgSlug: string }>()
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingCampaign[]>([])
  const [approved, setApproved] = useState<AdCampaign[]>([])
  const [active, setActive] = useState<AdCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<ActionState>(null)
  const [forbidden, setForbidden] = useState(false)

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
      // pending = global (admin); approved/active = de cualquier org admin
      const [p, ap, ac] = await Promise.all([
        listPending(userId),
        listCampaigns(orgId, userId, 'approved'),
        listCampaigns(orgId, userId, 'active'),
      ])
      setPending(p.pending)
      setApproved(ap.campaigns)
      setActive(ac.campaigns)
    } catch (e) {
      const err = e as Error & { status?: number }
      if (err.status === 403) {
        setForbidden(true)
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [userId, orgId])

  useEffect(() => {
    load()
  }, [load])

  async function handleApprove(id: string, name: string) {
    if (!userId) return
    if (
      !confirm(
        `Aprobar "${name}"?\n\nEsto va a CREAR la campaña en Meta Ads Manager con status PAUSED. No empieza a gastar hasta que la lances.`,
      )
    )
      return
    setAction({ type: 'approving', id })
    try {
      const result = await approveCampaign(id, userId)
      alert(
        `✅ Aprobada\n\nIDs en Meta:\nCampaign: ${result.meta.campaignId}\nAdSet: ${result.meta.adSetId}\nCreative: ${result.meta.creativeId}\nAd: ${result.meta.adId}`,
      )
      await load()
    } catch (e) {
      const err = e as Error & { details?: unknown }
      alert(`❌ Error: ${err.message}\n\n${JSON.stringify(err.details, null, 2)}`)
    } finally {
      setAction(null)
    }
  }

  async function handleReject(id: string, name: string) {
    if (!userId) return
    const reason = prompt(`Razón para rechazar "${name}":`)
    if (!reason) return
    setAction({ type: 'rejecting', id })
    try {
      await rejectCampaign(id, reason, userId)
      await load()
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : 'desconocido'}`)
    } finally {
      setAction(null)
    }
  }

  async function handleLaunch(id: string, name: string) {
    if (!userId) return
    if (
      !confirm(
        `⚠️ LANZAR "${name}" en Meta?\n\nLa campaña pasará a ACTIVE y EMPEZARÁ A GASTAR el presupuesto diario.\n\n¿Confirmar?`,
      )
    )
      return
    setAction({ type: 'launching', id })
    try {
      await launchCampaign(id, userId)
      await load()
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : 'desconocido'}`)
    } finally {
      setAction(null)
    }
  }

  async function handlePause(id: string, name: string) {
    if (!userId) return
    if (!confirm(`Pausar "${name}"? Deja de gastar inmediatamente.`)) return
    setAction({ type: 'pausing', id })
    try {
      await pauseCampaign(id, userId)
      await load()
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : 'desconocido'}`)
    } finally {
      setAction(null)
    }
  }

  if (forbidden) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-red-400" />
        <h2 className="mt-3 font-semibold text-red-900">No tienes acceso</h2>
        <p className="mt-1 text-sm text-destructive">
          Esta vista es solo para owner/admin de la organización operadora (KAPI).
        </p>
        <Link
          href={`/${params.orgSlug}/ads`}
          className="mt-4 inline-flex items-center gap-1 text-sm text-destructive underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </div>
    )
  }

  if (!userId || !orgId || loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
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
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a mis campañas
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground">
          <ShieldAlert className="h-6 w-6 text-purple-600" />
          Panel admin — Aprobaciones
        </h1>
        <p className="mt-1 text-muted-foreground">
          Acciones que afectan Meta directamente. Aprobar crea en PAUSED, Lanzar pasa a ACTIVE y empieza a gastar.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Pendientes */}
      <section>
        <h2 className="mb-3 font-semibold text-foreground">
          Pendientes de aprobación ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="rounded-lg border border-dashed border-input bg-card py-10 text-center text-sm text-muted-foreground">
            No hay campañas en cola.
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((c) => {
              const budget = c.daily_budget_cents
                ? `${formatMoney(c.daily_budget_cents, c.currency)}/día`
                : c.lifetime_budget_cents
                  ? `${formatMoney(c.lifetime_budget_cents, c.currency)} total`
                  : '—'
              const isThis = action?.id === c.id
              return (
                <li
                  key={c.id}
                  className="rounded-lg border border-warning/30 bg-warning/15 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{c.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {objectiveLabel(c.objective)} · {budget} · cuenta {c.meta_ad_account_id}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Enviada {new Date(c.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                      <button
                        onClick={() => handleReject(c.id, c.name)}
                        disabled={!!action}
                        className="flex items-center gap-1 rounded-md border border-destructive/30 bg-card px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        {isThis && action?.type === 'rejecting' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <XCircle className="h-3 w-3" />
                        )}
                        Rechazar
                      </button>
                      <button
                        onClick={() => handleApprove(c.id, c.name)}
                        disabled={!!action}
                        className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                      >
                        {isThis && action?.type === 'approving' ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        Aprobar (PAUSED)
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Aprobadas (listas para lanzar) */}
      <section>
        <h2 className="mb-3 font-semibold text-foreground">
          Aprobadas — listas para lanzar ({approved.length})
        </h2>
        {approved.length === 0 ? (
          <div className="rounded-lg border border-dashed border-input bg-card py-6 text-center text-sm text-muted-foreground">
            Ninguna campaña aprobada en esta org.
          </div>
        ) : (
          <ul className="space-y-2">
            {approved.map((c) => (
              <CampaignRow
                key={c.id}
                campaign={c}
                action={action?.id === c.id ? action.type : null}
                buttons={[
                  {
                    label: 'Lanzar (ACTIVE)',
                    icon: Play,
                    onClick: () => handleLaunch(c.id, c.name),
                    color: 'green',
                    actionType: 'launching',
                  },
                ]}
              />
            ))}
          </ul>
        )}
        {approved.length > 0 && (
          <p className="mt-2 flex items-center gap-1 text-xs text-warning-foreground">
            <AlertTriangle className="h-3 w-3" />
            Al lanzar, la campaña empieza a gastar el presupuesto diario inmediatamente.
          </p>
        )}
      </section>

      {/* Activas */}
      <section>
        <h2 className="mb-3 font-semibold text-foreground">
          Activas ({active.length})
        </h2>
        {active.length === 0 ? (
          <div className="rounded-lg border border-dashed border-input bg-card py-6 text-center text-sm text-muted-foreground">
            Ninguna campaña activa.
          </div>
        ) : (
          <ul className="space-y-2">
            {active.map((c) => (
              <CampaignRow
                key={c.id}
                campaign={c}
                action={action?.id === c.id ? action.type : null}
                buttons={[
                  {
                    label: 'Pausar',
                    icon: Pause,
                    onClick: () => handlePause(c.id, c.name),
                    color: 'orange',
                    actionType: 'pausing',
                  },
                ]}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

interface ActionBtn {
  label: string
  icon: typeof Play
  onClick: () => void
  color: 'green' | 'orange' | 'red' | 'blue'
  actionType: 'approving' | 'rejecting' | 'launching' | 'pausing'
}

type ActionType = 'approving' | 'rejecting' | 'launching' | 'pausing'

function CampaignRow({
  campaign,
  action,
  buttons,
}: {
  campaign: AdCampaign
  action: ActionType | null
  buttons: ActionBtn[]
}) {
  const st = statusLabel(campaign.status)
  const budget = campaign.daily_budget_cents
    ? `${formatMoney(campaign.daily_budget_cents, campaign.ad_accounts?.currency || 'USD')}/día`
    : '—'
  const colorMap = {
    green: 'bg-green-600 hover:bg-green-700 text-white',
    orange: 'bg-orange-500 hover:bg-orange-600 text-white',
    red: 'bg-red-600 hover:bg-red-700 text-white',
    blue: 'bg-primary hover:bg-primary/90 text-white',
  } as const

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">{campaign.name}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
              {st.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {objectiveLabel(campaign.objective)} · {budget}
            {campaign.meta_campaign_id && (
              <>
                {' · '}
                <a
                  href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${campaign.meta_campaign_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  Meta <ExternalLink className="h-3 w-3" />
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          {buttons.map((b) => {
            const Icon = b.icon
            const isLoading = action === b.actionType
            return (
              <button
                key={b.label}
                onClick={b.onClick}
                disabled={!!action}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${colorMap[b.color]}`}
              >
                {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
                {b.label}
              </button>
            )
          })}
        </div>
      </div>
    </li>
  )
}
