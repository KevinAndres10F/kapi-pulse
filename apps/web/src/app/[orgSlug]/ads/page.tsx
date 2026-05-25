'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Megaphone,
  Plus,
  Trash2,
  Send,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  BarChart3,
  ExternalLink,
  Link2,
  X,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  listCampaigns,
  listAdAccounts,
  listBusinessAdAccounts,
  registerAdAccount,
  deleteCampaign,
  submitForApproval,
  type AdCampaign,
  type AdAccount,
  formatMoney,
  statusLabel,
  objectiveLabel,
} from '@/lib/ads/api'

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

  // Resolver orgId + userId desde la sesión
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

      // Verificar si el user es admin del ADMIN_ORG (la org operadora KAPI)
      // El frontend no conoce ADMIN_ORG_ID; lo descubre via API.
      // Simplificación: si el user tiene role owner/admin en alguna org cuyo
      // nombre/slug incluye "kapi", asumimos que es admin operador.
      const { data: memberships } = await supabase
        .from('organization_members')
        .select('role, organizations(slug, name)')
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin'])
      const ms = (memberships || []) as Array<{
        role: string
        organizations: { slug: string; name: string } | null
      }>
      const isOp = ms.some((m) => m.organizations?.slug === 'kapi')
      setIsAdmin(isOp)
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
    if (!confirm(`¿Eliminar la campaña "${name}"? Esto la borra también en Meta si fue aprobada.`))
      return
    try {
      await deleteCampaign(id, userId)
      await load()
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : 'desconocido'}`)
    }
  }

  async function handleSubmit(id: string) {
    if (!userId) return
    if (!confirm('Enviar esta campaña a aprobación del equipo KAPI?')) return
    try {
      await submitForApproval(id, userId)
      await load()
    } catch (e) {
      alert(`Error: ${e instanceof Error ? e.message : 'desconocido'}`)
    }
  }

  if (!userId || !orgId) {
    return <div className="text-muted-foreground">Cargando sesión...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Megaphone className="h-6 w-6 text-primary" />
            Anuncios pagados
          </h1>
          <p className="mt-1 text-muted-foreground">
            Campañas en Meta (Facebook + Instagram). Las creas como borrador y
            el equipo KAPI las aprueba antes de publicar.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/${params.orgSlug}/ads/insights`}
            className="flex items-center gap-2 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40"
          >
            <BarChart3 className="h-4 w-4" />
            Insights
          </Link>
          {isAdmin && (
            <>
              <button
                onClick={() => setShowConnectModal(true)}
                className="flex items-center gap-2 rounded-lg border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40"
              >
                <Link2 className="h-4 w-4" />
                Conectar cuenta
              </button>
              <Link
                href={`/${params.orgSlug}/ads/admin`}
                className="flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
              >
                <ShieldAlert className="h-4 w-4" />
                Panel admin
              </Link>
            </>
          )}
          <Link
            href={`/${params.orgSlug}/ads/new`}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Nueva campaña
          </Link>
        </div>
      </div>

      {/* Aviso si no hay ad accounts conectadas */}
      {accounts.length === 0 && !loading && (
        <div className="rounded-lg border border-warning/30 bg-warning/15 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning-foreground" />
            <div>
              <p className="font-medium text-yellow-900">
                No tienes cuentas publicitarias conectadas todavía.
              </p>
              <p className="mt-1 text-sm text-yellow-800">
                Contacta al equipo KAPI para que asocien tu cuenta de Meta Ads a esta organización.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tarjetas de cuentas */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-foreground">{acc.name || 'Sin nombre'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{acc.meta_ad_account_id}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  {acc.currency}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de conectar cuenta (solo admin) */}
      {showConnectModal && userId && (
        <ConnectAccountModal
          userId={userId}
          onClose={() => setShowConnectModal(false)}
          onSuccess={() => {
            setShowConnectModal(false)
            load()
          }}
        />
      )}

      {/* Listado de campañas */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-semibold text-foreground">Mis campañas</h2>
        </div>

        {error && (
          <div className="border-b border-red-100 bg-destructive/10 px-6 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <div className="px-6 py-10 text-center text-muted-foreground">Cargando...</div>
        )}

        {!loading && campaigns.length === 0 && (
          <div className="px-6 py-10 text-center">
            <Megaphone className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-muted-foreground">Aún no tienes campañas</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crea tu primera campaña y envíala a aprobación.
            </p>
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
                <li key={c.id} className="px-6 py-4 hover:bg-muted/40">
                  <div className="flex items-start justify-between gap-4">
                    <Link href={`/${params.orgSlug}/ads/${c.id}`} className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-foreground">{c.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
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
                              className="inline-flex items-center gap-0.5 text-primary hover:underline"
                            >
                              Ver en Meta <ExternalLink className="h-3 w-3" />
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
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {c.status === 'draft' && (
                        <>
                          <button
                            onClick={() => handleSubmit(c.id)}
                            className="flex items-center gap-1 rounded-md border border-blue-300 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-blue-100"
                          >
                            <Send className="h-3 w-3" />
                            Enviar a aprobación
                          </button>
                          <button
                            onClick={() => handleDelete(c.id, c.name)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {c.status === 'rejected' && (
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

interface OrgOption {
  id: string
  name: string
  slug: string
}

function ConnectAccountModal({
  userId,
  onClose,
  onSuccess,
}: {
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
      setError('Elige organización y cuenta')
      return
    }
    if (!/^act_\d+$/.test(metaId)) {
      setError('El Meta Ad Account ID debe tener formato act_XXXXX')
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
        // Esperar 2s antes de cerrar para que vea los warnings
        setTimeout(onSuccess, 2000)
      } else {
        onSuccess()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="font-semibold text-foreground">Conectar cuenta publicitaria</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-6 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando cuentas de tu Business...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
            <p className="text-sm text-muted-foreground">
              Asigna una Ad Account de tu Business Portfolio a una organización cliente.
              Después esa org puede crear borradores contra esa cuenta.
            </p>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Organización <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                required
                className="w-full rounded-md border border-input px-3 py-2 text-sm"
              >
                <option value="">— Elige org —</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.slug})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Cuenta publicitaria de Meta <span className="text-red-500">*</span>
              </label>
              {businessAccounts.length > 0 && !useManual ? (
                <>
                  <select
                    value={selectedMetaId}
                    onChange={(e) => setSelectedMetaId(e.target.value)}
                    required
                    className="w-full rounded-md border border-input px-3 py-2 text-sm"
                  >
                    <option value="">— Elige cuenta —</option>
                    {businessAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name || a.id} ({a.currency || 'USD'})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setUseManual(true)}
                    className="mt-1 text-xs text-primary hover:underline"
                  >
                    Pegar ID manualmente
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={manualMetaId}
                    onChange={(e) => setManualMetaId(e.target.value)}
                    placeholder="act_1234567890"
                    pattern="act_\d+"
                    required
                    className="w-full rounded-md border border-input px-3 py-2 text-sm font-mono"
                  />
                  {businessAccounts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setUseManual(false)}
                      className="mt-1 text-xs text-primary hover:underline"
                    >
                      Elegir de la lista
                    </button>
                  )}
                </>
              )}
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {warnings.length > 0 && (
              <div className="rounded-md border border-warning/30 bg-warning/15 p-3 text-sm text-yellow-800">
                <p className="font-medium">⚠️ Cuenta registrada con advertencias:</p>
                <ul className="mt-1 list-disc pl-5">
                  {warnings.map((w) => (
                    <li key={w}>
                      {w === 'no_payment_method'
                        ? 'No tiene método de pago configurado'
                        : w.startsWith('account_status_')
                          ? `Status ${w.replace('account_status_', '')} en Meta`
                          : w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Conectar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
