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
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  listCampaigns,
  listAdAccounts,
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
    return <div className="text-gray-500">Cargando sesión...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Megaphone className="h-6 w-6 text-blue-600" />
            Anuncios pagados
          </h1>
          <p className="mt-1 text-gray-600">
            Campañas en Meta (Facebook + Instagram). Las creas como borrador y
            el equipo KAPI las aprueba antes de publicar.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/${params.orgSlug}/ads/insights`}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <BarChart3 className="h-4 w-4" />
            Insights
          </Link>
          {isAdmin && (
            <Link
              href={`/${params.orgSlug}/ads/admin`}
              className="flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
            >
              <ShieldAlert className="h-4 w-4" />
              Panel admin
            </Link>
          )}
          <Link
            href={`/${params.orgSlug}/ads/new`}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Nueva campaña
          </Link>
        </div>
      </div>

      {/* Aviso si no hay ad accounts conectadas */}
      {accounts.length === 0 && !loading && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
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
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{acc.name || 'Sin nombre'}</p>
                  <p className="mt-1 text-xs text-gray-500">{acc.meta_ad_account_id}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  <CheckCircle2 className="h-3 w-3" />
                  {acc.currency}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Listado de campañas */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Mis campañas</h2>
        </div>

        {error && (
          <div className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="px-6 py-10 text-center text-gray-500">Cargando...</div>
        )}

        {!loading && campaigns.length === 0 && (
          <div className="px-6 py-10 text-center">
            <Megaphone className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-3 text-gray-600">Aún no tienes campañas</p>
            <p className="mt-1 text-sm text-gray-500">
              Crea tu primera campaña y envíala a aprobación.
            </p>
          </div>
        )}

        {!loading && campaigns.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {campaigns.map((c) => {
              const st = statusLabel(c.status)
              const budget = c.daily_budget_cents
                ? `${formatMoney(c.daily_budget_cents, c.ad_accounts?.currency || 'USD')}/día`
                : c.lifetime_budget_cents
                  ? `${formatMoney(c.lifetime_budget_cents, c.ad_accounts?.currency || 'USD')} total`
                  : '—'

              return (
                <li key={c.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-gray-900">{c.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        {objectiveLabel(c.objective)} · {budget}
                        {c.meta_campaign_id && (
                          <>
                            {' · '}
                            <a
                              href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?selected_campaign_ids=${c.meta_campaign_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-0.5 text-blue-600 hover:underline"
                            >
                              Ver en Meta <ExternalLink className="h-3 w-3" />
                            </a>
                          </>
                        )}
                      </p>
                      {c.rejection_reason && (
                        <p className="mt-1 text-sm text-red-600">
                          Razón de rechazo: {c.rejection_reason}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      {c.status === 'draft' && (
                        <>
                          <button
                            onClick={() => handleSubmit(c.id)}
                            className="flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            <Send className="h-3 w-3" />
                            Enviar a aprobación
                          </button>
                          <button
                            onClick={() => handleDelete(c.id, c.name)}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {c.status === 'rejected' && (
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
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
