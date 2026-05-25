'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import {
  approveCampaign,
  formatMoney,
  launchCampaign,
  listCampaigns,
  listPending,
  objectiveLabel,
  pauseCampaign,
  rejectCampaign,
  statusLabel,
  type AdCampaign,
  type PendingCampaign,
} from '@/lib/ads/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type ActionState = { type: 'approving' | 'rejecting' | 'launching' | 'pausing'; id: string } | null
type ActionType = 'approving' | 'rejecting' | 'launching' | 'pausing'

function statusVariant(status: string): 'muted' | 'default' | 'success' | 'destructive' | 'warning' | 'secondary' {
  switch (status) {
    case 'draft': return 'muted'
    case 'pending_approval': return 'warning'
    case 'approved': return 'secondary'
    case 'active': return 'success'
    case 'paused': return 'muted'
    case 'rejected': return 'destructive'
    default: return 'default'
  }
}

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
    return () => { cancelled = true }
  }, [params.orgSlug, supabase])

  const load = useCallback(async () => {
    if (!userId || !orgId) return
    setLoading(true)
    setError(null)
    try {
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
      if (err.status === 403) setForbidden(true)
      else setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId, orgId])

  useEffect(() => { load() }, [load])

  async function handleApprove(id: string, name: string) {
    if (!userId) return
    if (!confirm(`Aprobar "${name}"?\n\nCrea en Meta como PAUSED. No empieza a gastar hasta lanzarla.`)) return
    setAction({ type: 'approving', id })
    try {
      const result = await approveCampaign(id, userId)
      toast.success('Aprobada', {
        description: `Meta Campaign: ${result.meta.campaignId}`,
      })
      await load()
    } catch (e) {
      const err = e as Error & { details?: unknown }
      toast.error('Error aprobando', { description: err.message })
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
      toast.success('Campaña rechazada.')
      await load()
    } catch (e) {
      toast.error('Error rechazando', { description: e instanceof Error ? e.message : 'desconocido' })
    } finally {
      setAction(null)
    }
  }

  async function handleLaunch(id: string, name: string) {
    if (!userId) return
    if (!confirm(`⚠️ LANZAR "${name}" en Meta?\n\nPasa a ACTIVE y empieza a gastar el presupuesto diario.`)) return
    setAction({ type: 'launching', id })
    try {
      await launchCampaign(id, userId)
      toast.success('Campaña lanzada.')
      await load()
    } catch (e) {
      toast.error('Error lanzando', { description: e instanceof Error ? e.message : 'desconocido' })
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
      toast.success('Campaña pausada.')
      await load()
    } catch (e) {
      toast.error('Error pausando', { description: e instanceof Error ? e.message : 'desconocido' })
    } finally {
      setAction(null)
    }
  }

  if (forbidden) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="size-6 text-destructive" />
          </span>
          <div>
            <p className="text-base font-semibold text-foreground">No tenés acceso</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Esta vista es solo para owner/admin de la organización operadora (KAPI).
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={`/${params.orgSlug}/ads`}>
              <ArrowLeft className="size-4" />
              Volver
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

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
            Volver a mis campañas
          </Link>
        </Button>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          <ShieldAlert className="size-6 text-primary" />
          Panel admin · Aprobaciones
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Aprobar crea la campaña en PAUSED. Lanzar la pasa a ACTIVE y empieza a gastar.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Pendientes de aprobación</CardTitle>
              <CardDescription>Campañas enviadas por clientes esperando revisión.</CardDescription>
            </div>
            <Badge variant={pending.length > 0 ? 'warning' : 'muted'}>{pending.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {pending.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">No hay campañas en cola.</p>
          ) : (
            <ul className="divide-y divide-border">
              {pending.map((c) => {
                const budget = c.daily_budget_cents
                  ? `${formatMoney(c.daily_budget_cents, c.currency)}/día`
                  : c.lifetime_budget_cents
                    ? `${formatMoney(c.lifetime_budget_cents, c.currency)} total`
                    : '—'
                const isThis = action?.id === c.id
                return (
                  <li key={c.id} className="px-6 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{c.name}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {objectiveLabel(c.objective)} · {budget} ·{' '}
                          <span className="font-mono text-xs">{c.meta_ad_account_id}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Enviada {new Date(c.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(c.id, c.name)}
                          disabled={!!action}
                          loading={isThis && action?.type === 'rejecting'}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          {!(isThis && action?.type === 'rejecting') && <XCircle className="size-3.5" />}
                          Rechazar
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleApprove(c.id, c.name)}
                          disabled={!!action}
                          loading={isThis && action?.type === 'approving'}
                        >
                          {!(isThis && action?.type === 'approving') && <CheckCircle2 className="size-3.5" />}
                          Aprobar (PAUSED)
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Aprobadas · listas para lanzar</CardTitle>
              <CardDescription>Creadas en Meta como PAUSED. No gastan hasta lanzar.</CardDescription>
            </div>
            <Badge variant="secondary">{approved.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {approved.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              Ninguna campaña aprobada en esta org.
            </p>
          ) : (
            <ul className="divide-y divide-border">
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
                      variant: 'gradient',
                      actionType: 'launching',
                    },
                  ]}
                />
              ))}
            </ul>
          )}
          {approved.length > 0 && (
            <Alert variant="warning" className="mx-6 my-4">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                Al lanzar, la campaña empieza a gastar el presupuesto diario inmediatamente.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Activas</CardTitle>
              <CardDescription>Campañas corriendo y gastando ahora mismo.</CardDescription>
            </div>
            <Badge variant="success">{active.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {active.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">Ninguna campaña activa.</p>
          ) : (
            <ul className="divide-y divide-border">
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
                      variant: 'secondary',
                      actionType: 'pausing',
                    },
                  ]}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface ActionBtn {
  label: string
  icon: typeof Play
  onClick: () => void
  variant: 'default' | 'gradient' | 'outline' | 'destructive' | 'secondary'
  actionType: ActionType
}

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

  return (
    <li className="px-6 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">{campaign.name}</p>
            <Badge variant={statusVariant(campaign.status)}>{st.label}</Badge>
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
                  Meta <ExternalLink className="size-3" />
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {buttons.map((b) => {
            const Icon = b.icon
            const isLoading = action === b.actionType
            return (
              <Button
                key={b.label}
                size="sm"
                variant={b.variant}
                onClick={b.onClick}
                disabled={!!action}
                loading={isLoading}
              >
                {!isLoading && <Icon className="size-3.5" />}
                {b.label}
              </Button>
            )
          })}
        </div>
      </div>
    </li>
  )
}
