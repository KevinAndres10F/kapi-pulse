'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useSearchParams } from 'next/navigation'
import {
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react'

interface SocialAccount {
  id: string
  provider: string
  external_id: string
  display_name: string | null
  avatar_url: string | null
  status: string
  expires_at: string | null
  metadata: Record<string, unknown>
  connected_at: string
}

const PROVIDER_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  facebook: { label: 'Facebook', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  instagram: { label: 'Instagram', color: 'text-pink-700', bgColor: 'bg-pink-100' },
  threads: { label: 'Threads', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  linkedin: { label: 'LinkedIn', color: 'text-blue-800', bgColor: 'bg-blue-50' },
  tiktok: { label: 'TikTok', color: 'text-gray-900', bgColor: 'bg-gray-100' },
  x: { label: 'X (Twitter)', color: 'text-gray-900', bgColor: 'bg-gray-100' },
  youtube: { label: 'YouTube', color: 'text-red-700', bgColor: 'bg-red-100' },
  pinterest: { label: 'Pinterest', color: 'text-red-600', bgColor: 'bg-red-50' },
  whatsapp: { label: 'WhatsApp', color: 'text-green-700', bgColor: 'bg-green-100' },
}

const AVAILABLE_PROVIDERS = [
  { key: 'meta', label: 'Facebook + Instagram', description: 'Conecta Pages de Facebook e Instagram Business' },
  { key: 'linkedin', label: 'LinkedIn', description: 'Publica como perfil personal' },
  // Proveedores futuros
  { key: 'tiktok', label: 'TikTok', description: 'Disponible pronto', disabled: true },
  { key: 'x', label: 'X (Twitter)', description: 'Disponible pronto', disabled: true },
  { key: 'youtube', label: 'YouTube', description: 'Disponible pronto', disabled: true },
  { key: 'pinterest', label: 'Pinterest', description: 'Disponible pronto', disabled: true },
]

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; label: string; className: string }> = {
  active: { icon: CheckCircle2, label: 'Activa', className: 'text-green-600' },
  expired: { icon: AlertTriangle, label: 'Token expirado', className: 'text-yellow-600' },
  disconnected: { icon: XCircle, label: 'Desconectada', className: 'text-red-600' },
  error: { icon: XCircle, label: 'Error', className: 'text-red-600' },
}

export default function ConnectionsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState<string | null>(null)
  const supabase = createClient()

  const successParam = searchParams.get('success')
  const errorParam = searchParams.get('error')

  const loadAccounts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single()

    if (!org) return
    setOrgId(org.id)

    const { data } = await supabase
      .from('social_accounts')
      .select('id, provider, external_id, display_name, avatar_url, status, expires_at, metadata, connected_at')
      .eq('organization_id', org.id)
      .order('connected_at', { ascending: false })

    if (data) setAccounts(data)
  }, [supabase, orgSlug])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  function handleConnect(providerKey: string) {
    if (!orgId || !userId) return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    window.location.href = `${apiUrl}/api/connect/${providerKey}?org_id=${orgId}&user_id=${userId}`
  }

  async function handleDisconnect(accountId: string) {
    if (!confirm('¿Seguro que quieres desconectar esta cuenta?')) return
    setLoadingDelete(accountId)

    await supabase.from('social_accounts').delete().eq('id', accountId)
    setAccounts((prev) => prev.filter((a) => a.id !== accountId))
    setLoadingDelete(null)
  }

  async function handleReconnect(provider: string) {
    // Reconectar = iniciar nuevo flujo OAuth
    const providerKey = provider === 'facebook' || provider === 'instagram' ? 'meta' : provider
    handleConnect(providerKey)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Link2 className="h-6 w-6" />
            Conexiones
          </h1>
          <p className="mt-1 text-gray-600">Gestiona tus cuentas de redes sociales conectadas.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 sm:justify-start"
        >
          <Plus className="h-4 w-4" />
          Conectar red social
        </button>
      </div>

      {/* Mensajes de estado */}
      {successParam && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800">
          Cuenta conectada exitosamente.
        </div>
      )}
      {errorParam && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-800">
          Error al conectar: {errorParam}
        </div>
      )}

      {/* Lista de cuentas */}
      {accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
          <Link2 className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-4 text-lg font-medium text-gray-600">Sin cuentas conectadas</p>
          <p className="mt-1 text-gray-400">Conecta tu primera red social para empezar.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Conectar ahora
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const config = PROVIDER_CONFIG[account.provider] || { label: account.provider, color: 'text-gray-700', bgColor: 'bg-gray-100' }
            const statusCfg = STATUS_CONFIG[account.status] || STATUS_CONFIG.error
            const StatusIcon = statusCfg.icon

            return (
              <div key={account.id} className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {account.avatar_url ? (
                      <img src={account.avatar_url} alt="" className="h-10 w-10 rounded-full" />
                    ) : (
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${config.bgColor} text-sm font-bold ${config.color}`}>
                        {(account.display_name || account.provider).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">{account.display_name || 'Sin nombre'}</p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${config.bgColor} ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-1.5">
                  <StatusIcon className={`h-4 w-4 ${statusCfg.className}`} />
                  <span className={`text-sm ${statusCfg.className}`}>{statusCfg.label}</span>
                </div>

                {account.expires_at && (
                  <p className="mt-1 text-xs text-gray-400">
                    Token expira: {new Date(account.expires_at).toLocaleDateString('es')}
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  {account.status !== 'active' && (
                    <button
                      onClick={() => handleReconnect(account.provider)}
                      className="flex items-center gap-1 rounded-lg border border-yellow-300 px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-50"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Reconectar
                    </button>
                  )}
                  <button
                    onClick={() => handleDisconnect(account.id)}
                    disabled={loadingDelete === account.id}
                    className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    {loadingDelete === account.id ? 'Eliminando...' : 'Desconectar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal para agregar conexión */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Conectar red social</h2>
            <p className="mt-1 text-sm text-gray-500">Selecciona la plataforma que quieres conectar.</p>

            <div className="mt-4 space-y-2">
              {AVAILABLE_PROVIDERS.map((provider) => (
                <button
                  key={provider.key}
                  onClick={() => {
                    if (!provider.disabled) {
                      setShowAddModal(false)
                      handleConnect(provider.key)
                    }
                  }}
                  disabled={provider.disabled}
                  className={`flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors ${
                    provider.disabled
                      ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <div>
                    <p className={`font-medium ${provider.disabled ? 'text-gray-400' : 'text-gray-900'}`}>
                      {provider.label}
                    </p>
                    <p className="text-sm text-gray-500">{provider.description}</p>
                  </div>
                  {provider.disabled ? (
                    <span className="text-xs text-gray-400">Pronto</span>
                  ) : (
                    <Plus className="h-5 w-5 text-blue-600" />
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAddModal(false)}
              className="mt-4 w-full rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
