'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  BarChart3,
  ExternalLink,
  Link2,
  Loader2,
  Megaphone,
  Plus,
  Send,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  deleteCampaign,
  formatMoney,
  listAdAccounts,
  listBusinessAdAccounts,
  listCampaigns,
  objectiveLabel,
  registerAdAccount,
  statusLabel,
  submitForApproval,
  type AdAccount,
  type AdCampaign,
} from '@/lib/ads/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function statusVariant(status: string): 'muted' | 'default' | 'success' | 'destructive' | 'warning' | 'secondary' {
  switch (status) {
    case 'draft':
      return 'muted'
    case 'pending_approval':
      return 'warning'
    case 'approved':
      return 'secondary'
    case 'active':
      return 'success'
    case 'paused':
      return 'muted'
    case 'rejected':
      return 'destructive'
    case 'archived':
      return 'muted'
    default:
      return 'default'
  }
}

export default function AdsPage() {
  const params = useParams<{ orgSlug: string }>()
  const supabase = createClient()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([])
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showConnectModal, setShowConnectModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
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
        .select('role, organizations(slug, name)')
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin'])
      const ms = (memberships || []) as Array<{
        role: string
        organizations: { slug: string; name: string } | null
      }>
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
      const [c, a] = await Promise.all([
        listCampaigns(orgId, userId),
        listAdAccounts(orgId, userId),
      ])
      setCampaigns(c.campaigns)
      setAccounts(a.accounts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando campañas')
    } finally {
      setLoading(false)
    }
  }, [orgId, userId])

  useEffect(() => {
    load()
  }, [load])

  async function handleDelete(id: string, name: string) {
    if (!userId) return
    if (!confirm(`¿Eliminar "${name}"? Esto la borra también en Meta si fue aprobada.`)) return
    try {
      await deleteCampaign(id, userId)
      toast.success('Campaña eliminada.')
      await load()
    } catch (e) {
      toast.error(`Error eliminando`, {
        description: e instanceof Error ? e.message : 'desconocido',
      })
    }
  }

  async function handleSubmit(id: string) {
    if (!userId) return
    if (!confirm('¿Enviar esta campaña a aprobación del equipo KAPI?')) return
    try {
      await submitForApproval(id, userId)
      toast.success('Enviada a aprobación.')
      await load()
    } catch (e) {
      toast.error('Error enviando', {
        description: e instanceof Error ? e.message : 'desconocido',
      })
    }
  }

  if (!userId || !orgId) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando sesión…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            <Megaphone className="size-6 text-primary" />
            Anuncios pagados
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Campañas en Meta (Facebook + Instagram). Las creás como borrador y el equipo KAPI las
            aprueba antes de publicar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${params.orgSlug}/ads/insights`}>
              <BarChart3 className="size-4" />
              Insights
            </Link>
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowConnectModal(true)}>
                <Link2 className="size-4" />
                Conectar cuenta
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/${params.orgSlug}/ads/admin`}>
                  <ShieldAlert className="size-4" />
                  Panel admin
                  <Badge variant="muted" className="ml-1">
                    admin
                  </Badge>
                </Link>
              </Button>
            </>
          )}
          <Button asChild variant="gradient" size="sm">
            <Link href={`/${params.orgSlug}/ads/new`}>
              <Plus className="size-4" />
              Nueva campaña
            </Link>
          </Button>
        </div>
      </div>

      {accounts.length === 0 && !loading && (
        <Alert variant="warning">
          <AlertTriangle className="size-4" />
          <AlertTitle>Sin cuentas publicitarias conectadas</AlertTitle>
          <AlertDescription>
            Contactá al equipo KAPI para que asocie tu cuenta de Meta Ads a esta organización.
          </AlertDescription>
        </Alert>
      )}

      {accounts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => (
            <Card key={acc.id}>
              <CardContent className="flex items-start justify-between gap-3 pt-6">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{acc.name || 'Sin nombre'}</p>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {acc.meta_ad_account_id}
                  </p>
                </div>
                <Badge variant="success">{acc.currency}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showConnectModal && userId && (
        <ConnectAccountModal
          open={showConnectModal}
          userId={userId}
          onClose={() => setShowConnectModal(false)}
          onSuccess={() => {
            setShowConnectModal(false)
            load()
          }}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mis campañas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <Alert variant="destructive" className="mx-6 mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando campañas…
            </div>
          )}

          {!loading && campaigns.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Megaphone className="size-5 text-primary" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">Aún no tenés campañas</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Creá tu primera campaña y enviála a aprobación.
                </p>
              </div>
              <Button asChild variant="gradient" size="sm">
                <Link href={`/${params.orgSlug}/ads/new`}>
                  <Plus className="size-4" />
                  Crear campaña
                </Link>
              </Button>
            </div>
          )}

          {!loading && campaigns.length > 0 && (
            <ul className="divide-y divide-border">
              {campaigns.map((c) => {
                const st = statusLabel(c.status)
                const budget = c.daily_budget_cents
                  ? `${formatMoney(c.daily_budget_cents, c.ad_accounts?.currency || 'USD')}/día`
                  : c.lifetime_budget_cents
                    ? `${formatMoney(c.lifetime_budget_cents, c.ad_accounts?.currency || 'USD')} total`
                    : '—'

                return (
                  <li key={c.id} className="px-6 py-4 transition-colors hover:bg-accent">
                    <div className="flex items-start justify-between gap-4">
                      <Link href={`/${params.orgSlug}/ads/${c.id}`} className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-foreground">{c.name}</p>
                          <Badge variant={statusVariant(c.status)}>{st.label}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {objectiveLabel(c.objective)} · {budget}
                          {c.meta_campaign_id && (
                            <>
                              {' · '}
                              <a
                                href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${c.meta_campaign_id}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-0.5 text-primary hover:underline"
                              >
                                Ver en Meta <ExternalLink className="size-3" />
                              </a>
                            </>
                          )}
                        </p>
                        {c.rejection_reason && (
                          <p className="mt-1 text-sm text-destructive">
                            Razón de rechazo: {c.rejection_reason}
                          </p>
                        )}
                      </Link>
                      <div className="flex shrink-0 items-center gap-1">
                        {c.status === 'draft' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.preventDefault()
                              handleSubmit(c.id)
                            }}
                          >
                            <Send className="size-3.5" />
                            <span className="hidden sm:inline">Enviar</span>
                          </Button>
                        )}
                        {(c.status === 'draft' || c.status === 'rejected') && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.preventDefault()
                              handleDelete(c.id, c.name)
                            }}
                            aria-label="Eliminar"
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface OrgOption {
  id: string
  name: string
  slug: string
}

function ConnectAccountModal({
  open,
  userId,
  onClose,
  onSuccess,
}: {
  open: boolean
  userId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const supabase = createClient()
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [businessAccounts, setBusinessAccounts] = useState<
    Array<{ id: string; name?: string; currency?: string }>
  >([])
  const [loading, setLoading] = useState(true)
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [selectedMetaId, setSelectedMetaId] = useState('')
  const [manualMetaId, setManualMetaId] = useState('')
  const [useManual, setUseManual] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [{ data: orgsData }, biz] = await Promise.all([
          supabase.from('organizations').select('id, name, slug').order('name'),
          listBusinessAdAccounts(userId).catch(() => ({ accounts: [] })),
        ])
        if (cancelled) return
        setOrgs((orgsData || []) as OrgOption[])
        setBusinessAccounts(biz.accounts)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, userId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setWarnings([])
    const metaId = useManual ? manualMetaId.trim() : selectedMetaId
    if (!selectedOrgId || !metaId) {
      setError('Elegí organización y cuenta.')
      return
    }
    if (!/^act_\d+$/.test(metaId)) {
      setError('El Meta Ad Account ID debe tener formato act_XXXXX.')
      return
    }
    setSubmitting(true)
    try {
      const r = await registerAdAccount(
        { organizationId: selectedOrgId, metaAdAccountId: metaId },
        userId,
      )
      if (r.warnings && r.warnings.length > 0) {
        setWarnings(r.warnings)
        toast.warning('Cuenta registrada con advertencias.')
        setTimeout(onSuccess, 2000)
      } else {
        toast.success('Cuenta publicitaria conectada.')
        onSuccess()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Conectar cuenta publicitaria</DialogTitle>
          <DialogDescription>
            Asigná una Ad Account de tu Business Portfolio a una organización cliente.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando cuentas de tu Business…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="org">
                Organización <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger id="org">
                  <SelectValue placeholder="Elegí org" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} <span className="text-muted-foreground">· {o.slug}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="meta-id">
                Cuenta publicitaria de Meta <span className="text-destructive">*</span>
              </Label>
              {businessAccounts.length > 0 && !useManual ? (
                <>
                  <Select value={selectedMetaId} onValueChange={setSelectedMetaId}>
                    <SelectTrigger id="meta-id">
                      <SelectValue placeholder="Elegí cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {businessAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name || a.id}{' '}
                          <span className="text-muted-foreground">· {a.currency || 'USD'}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() => setUseManual(true)}
                    className="h-auto p-0 text-xs"
                  >
                    Pegar ID manualmente
                  </Button>
                </>
              ) : (
                <>
                  <Input
                    id="meta-id"
                    type="text"
                    value={manualMetaId}
                    onChange={(e) => setManualMetaId(e.target.value)}
                    placeholder="act_1234567890"
                    pattern="act_\d+"
                    className="font-mono"
                  />
                  {businessAccounts.length > 0 && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => setUseManual(false)}
                      className="h-auto p-0 text-xs"
                    >
                      Elegir de la lista
                    </Button>
                  )}
                </>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {warnings.length > 0 && (
              <Alert variant="warning">
                <AlertTriangle className="size-4" />
                <AlertTitle>Cuenta registrada con advertencias</AlertTitle>
                <AlertDescription>
                  <ul className={cn('mt-1 list-disc pl-5 text-xs')}>
                    {warnings.map((w) => (
                      <li key={w}>
                        {w === 'no_payment_method'
                          ? 'No tiene método de pago configurado.'
                          : w.startsWith('account_status_')
                            ? `Status ${w.replace('account_status_', '')} en Meta.`
                            : w}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" loading={submitting}>
                {!submitting && <Link2 className="size-4" />}
                {submitting ? 'Conectando' : 'Conectar'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
