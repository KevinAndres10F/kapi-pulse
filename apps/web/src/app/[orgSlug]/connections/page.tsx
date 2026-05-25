'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

const PROVIDER_CONFIG: Record<string, { label: string; tint: string }> = {
  facebook: { label: 'Facebook', tint: 'oklch(0.55 0.18 250)' },
  instagram: { label: 'Instagram', tint: 'oklch(0.6 0.22 0)' },
  threads: { label: 'Threads', tint: 'oklch(0.4 0 0)' },
  linkedin: { label: 'LinkedIn', tint: 'oklch(0.48 0.15 240)' },
  tiktok: { label: 'TikTok', tint: 'oklch(0.45 0 0)' },
  x: { label: 'X (Twitter)', tint: 'oklch(0.2 0 0)' },
  youtube: { label: 'YouTube', tint: 'oklch(0.55 0.22 27)' },
  pinterest: { label: 'Pinterest', tint: 'oklch(0.55 0.22 27)' },
  whatsapp: { label: 'WhatsApp', tint: 'oklch(0.6 0.18 145)' },
}

const AVAILABLE_PROVIDERS: Array<{
  key: string
  label: string
  description: string
  disabled?: boolean
}> = [
  {
    key: 'meta',
    label: 'Facebook',
    description: 'Conectá Pages de Facebook. Si tu Page tiene Instagram Business vinculado, también lo importa.',
  },
  {
    key: 'instagram',
    label: 'Instagram',
    description: 'Conectá directo con tu cuenta de Instagram Business o Creator, sin Facebook Page.',
  },
  { key: 'linkedin', label: 'LinkedIn', description: 'Publicá como perfil personal.' },
  { key: 'tiktok', label: 'TikTok', description: 'Disponible pronto.', disabled: true },
  { key: 'x', label: 'X (Twitter)', description: 'Disponible pronto.', disabled: true },
  { key: 'youtube', label: 'YouTube', description: 'Disponible pronto.', disabled: true },
  { key: 'pinterest', label: 'Pinterest', description: 'Disponible pronto.', disabled: true },
]

type StatusKey = 'active' | 'expired' | 'disconnected' | 'error'

const STATUS_CONFIG: Record<StatusKey, { icon: typeof CheckCircle2; label: string; tone: 'success' | 'warning' | 'destructive' }> = {
  active: { icon: CheckCircle2, label: 'Activa', tone: 'success' },
  expired: { icon: AlertTriangle, label: 'Token expirado', tone: 'warning' },
  disconnected: { icon: XCircle, label: 'Desconectada', tone: 'destructive' },
  error: { icon: XCircle, label: 'Error', tone: 'destructive' },
}

function errorLabelFor(
  code: string | null,
  reason: string | null,
  description: string | null,
  message: string | null,
): string {
  if (!code) return ''

  const baseMessages: Record<string, string> = {
    access_denied: 'Rechazaste los permisos requeridos. Sin acceso a tus Pages no podemos publicar contenido en tu nombre.',
    no_pages: 'Tu cuenta de Facebook no administra ninguna Page. Creá una Page de negocio o pedí acceso a una existente, y reconectá.',
    state_expired: 'La sesión de conexión expiró. Volvé a iniciar el flujo desde "Conectar red social".',
    provider_unsupported: 'Este proveedor todavía no está soportado.',
    db_error: 'No pudimos guardar la conexión. Intentá de nuevo.',
    token_exchange_failed: 'Facebook rechazó el intercambio del código de autorización. Verificá que la app de Meta esté en modo Live y el redirect URI registrado.',
    user_denied: 'Cancelaste el inicio de sesión con Facebook.',
    config_missing: 'La configuración OAuth del backend está incompleta.',
  }

  const reasonOrCode = reason || code
  const base = baseMessages[reasonOrCode] || baseMessages[code] || `Error: ${code}`
  if (message) return `${base}\n${message}`
  if (description) return `${base}\n${decodeURIComponent(description)}`
  return base
}

export default function ConnectionsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const searchParams = useSearchParams()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAssignPageModal, setShowAssignPageModal] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState<string | null>(null)
  const supabase = createClient()

  const successParam = searchParams.get('success')
  const errorParam = searchParams.get('error')
  const errorMessageParam = searchParams.get('message')
  const errorReasonParam = searchParams.get('error_reason')
  const errorDescriptionParam = searchParams.get('error_description')
  const providerParam = searchParams.get('provider')
  const pagesParam = searchParams.get('pages')
  const instagramParam = searchParams.get('instagram')

  const errorLabel = errorLabelFor(errorParam, errorReasonParam, errorDescriptionParam, errorMessageParam)

  const loadAccounts = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
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
      .select(
        'id, provider, external_id, display_name, avatar_url, status, expires_at, metadata, connected_at',
      )
      .eq('organization_id', org.id)
      .order('connected_at', { ascending: false })

    if (data) setAccounts(data)

    const { data: memberships } = await supabase
      .from('organization_members')
      .select('role, organizations(slug)')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])
    const ms = (memberships || []) as Array<{
      role: string
      organizations: { slug: string } | null
    }>
    setIsAdmin(ms.some((m) => m.organizations?.slug === 'kapi'))
  }, [supabase, orgSlug])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  function handleConnect(providerKey: string) {
    if (!orgId || !userId) return
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    window.location.href = `${apiUrl}/api/connect/${providerKey}?org_id=${orgId}&user_id=${userId}`
  }

  async function handleDisconnect(account: SocialAccount) {
    if (!confirm(`¿Seguro que querés desconectar ${account.display_name || account.provider}?`)) return
    setLoadingDelete(account.id)
    const { error } = await supabase.from('social_accounts').delete().eq('id', account.id)
    if (error) {
      toast.error('No se pudo desconectar.', { description: error.message })
    } else {
      setAccounts((prev) => prev.filter((a) => a.id !== account.id))
      toast.success('Cuenta desconectada.')
    }
    setLoadingDelete(null)
  }

  function handleReconnect(account: SocialAccount) {
    const authMethod = (account.metadata?.auth_method as string | undefined) || ''
    let providerKey: string
    if (account.provider === 'instagram' && authMethod === 'instagram_login') {
      providerKey = 'instagram'
    } else if (account.provider === 'facebook' || account.provider === 'instagram') {
      providerKey = 'meta'
    } else {
      providerKey = account.provider
    }
    handleConnect(providerKey)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            <Link2 className="size-6 text-primary" />
            Conexiones
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestioná las cuentas de redes sociales vinculadas a esta organización.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowAssignPageModal(true)}>
              <ShieldCheck className="size-4" />
              Asignar Page <Badge variant="muted" className="ml-1">admin</Badge>
            </Button>
          )}
          <Button variant="gradient" size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="size-4" />
            Conectar red social
          </Button>
        </div>
      </div>

      {/* Mensajes de estado */}
      {successParam && (
        <Alert variant="success">
          <CheckCircle2 className="size-4" />
          <AlertTitle>
            {providerParam === 'meta' || providerParam === 'facebook'
              ? 'Facebook conectado'
              : providerParam === 'instagram'
                ? 'Instagram conectado'
                : 'Cuenta conectada'}
          </AlertTitle>
          {(providerParam === 'meta' || providerParam === 'facebook') && pagesParam && (
            <AlertDescription>
              {pagesParam} Page(s) de Facebook
              {instagramParam && Number(instagramParam) > 0
                ? ` y ${instagramParam} cuenta(s) de Instagram Business`
                : ''}{' '}
              vinculadas.
            </AlertDescription>
          )}
        </Alert>
      )}

      {errorParam && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>
            No se pudo conectar
            {providerParam ? ` con ${PROVIDER_CONFIG[providerParam]?.label || providerParam}` : ''}
          </AlertTitle>
          <AlertDescription className="whitespace-pre-line">{errorLabel}</AlertDescription>
        </Alert>
      )}

      {/* Lista de cuentas */}
      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <Link2 className="size-6 text-primary" />
            </span>
            <div>
              <p className="text-base font-medium text-foreground">Sin cuentas conectadas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Conectá tu primera red social para empezar a publicar.
              </p>
            </div>
            <Button onClick={() => setShowAddModal(true)} variant="gradient">
              <Plus className="size-4" />
              Conectar ahora
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const config = PROVIDER_CONFIG[account.provider] || {
              label: account.provider,
              tint: 'oklch(0.5 0 0)',
            }
            const statusKey = (STATUS_CONFIG[account.status as StatusKey] ? account.status : 'error') as StatusKey
            const statusCfg = STATUS_CONFIG[statusKey]
            const StatusIcon = statusCfg.icon
            const statusToneClass =
              statusCfg.tone === 'success'
                ? 'text-success'
                : statusCfg.tone === 'warning'
                  ? 'text-warning-foreground'
                  : 'text-destructive'

            return (
              <Card key={account.id} className="transition-all hover:shadow-md">
                <CardHeader className="flex flex-row items-start gap-3 space-y-0">
                  <Avatar className="size-11 shrink-0">
                    {account.avatar_url && <AvatarImage src={account.avatar_url} alt="" />}
                    <AvatarFallback
                      className="text-base font-semibold text-background"
                      style={{ backgroundColor: config.tint }}
                    >
                      {(account.display_name || account.provider).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <CardTitle className="truncate text-base">
                      {account.display_name || 'Sin nombre'}
                    </CardTitle>
                    <Badge variant="outline" className="gap-1.5">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: config.tint }}
                        aria-hidden
                      />
                      {config.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <StatusIcon className={cn('size-4 shrink-0', statusToneClass)} />
                    <span className={cn('font-medium', statusToneClass)}>{statusCfg.label}</span>
                  </div>
                  {account.expires_at && (
                    <p className="text-xs text-muted-foreground">
                      Token expira el{' '}
                      {new Date(account.expires_at).toLocaleDateString('es-EC', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    {statusKey !== 'active' && (
                      <Button size="sm" variant="outline" onClick={() => handleReconnect(account)}>
                        <RefreshCw className="size-3.5" />
                        Reconectar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDisconnect(account)}
                      disabled={loadingDelete === account.id}
                      loading={loadingDelete === account.id}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      {loadingDelete !== account.id && <Trash2 className="size-3.5" />}
                      Desconectar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal: conectar red social */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar red social</DialogTitle>
            <DialogDescription>Seleccioná la plataforma que querés conectar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
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
                className={cn(
                  'flex w-full items-start justify-between gap-3 rounded-lg border p-4 text-left transition-all',
                  provider.disabled
                    ? 'cursor-not-allowed border-border bg-muted/30 opacity-50'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-accent',
                )}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor:
                          PROVIDER_CONFIG[provider.key]?.tint || 'var(--muted-foreground)',
                      }}
                      aria-hidden
                    />
                    <p className="font-medium text-foreground">{provider.label}</p>
                    {provider.disabled && <Badge variant="muted">Pronto</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{provider.description}</p>
                </div>
                {!provider.disabled && <Plus className="size-4 shrink-0 text-primary" />}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showAssignPageModal && userId && orgId && (
        <AssignPageModal
          open={showAssignPageModal}
          userId={userId}
          defaultOrgId={orgId}
          onClose={() => setShowAssignPageModal(false)}
          onSuccess={() => {
            setShowAssignPageModal(false)
            loadAccounts()
          }}
        />
      )}
    </div>
  )
}

interface OrgOption {
  id: string
  name: string
  slug: string
}

interface AvailablePageRow {
  id: string
  name: string | null
  kind: 'owned' | 'client'
  canPublish: boolean
  hasInstagram: boolean
  tasks: string[]
}

function AssignPageModal({
  open,
  userId,
  defaultOrgId,
  onClose,
  onSuccess,
}: {
  open: boolean
  userId: string
  defaultOrgId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const supabase = createClient()
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [pages, setPages] = useState<AvailablePageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedOrgId, setSelectedOrgId] = useState(defaultOrgId)
  const [selectedPageId, setSelectedPageId] = useState('')
  const [includeIg, setIncludeIg] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [success, setSuccess] = useState<{ fb: string; ig: string | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { listAvailablePages } = await import('@/lib/admin-social/api')
        const [orgsData, pagesData] = await Promise.all([
          supabase.from('organizations').select('id, name, slug').order('name'),
          listAvailablePages(userId).catch((e: Error) => {
            setLoadError(`No se pudieron cargar Pages del Business: ${e.message}`)
            return { pages: [] }
          }),
        ])
        if (cancelled) return
        setOrgs((orgsData.data || []) as OrgOption[])
        setPages(pagesData.pages)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, userId])

  const selectedPage = pages.find((p) => p.id === selectedPageId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedOrgId || !selectedPageId) {
      setSubmitError('Elegí organización y Page.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    setWarnings([])
    setSuccess(null)
    try {
      const { assignPage } = await import('@/lib/admin-social/api')
      const r = await assignPage(
        {
          organizationId: selectedOrgId,
          pageId: selectedPageId,
          includeLinkedInstagram: includeIg,
        },
        userId,
      )
      setWarnings(r.warnings || [])
      setSuccess({
        fb: r.facebook?.display_name || '?',
        ig: r.instagram?.display_name || null,
      })
      toast.success('Page asignada correctamente.')
      setTimeout(onSuccess, 1500)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Asignar Page de Business a organización</DialogTitle>
          <DialogDescription>
            Usá esto cuando una Page vive en tu Business Manager pero el OAuth de Facebook no la
            devuelve (modelo agencia). Las credenciales vienen del System User en server.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Cargando Pages del Business…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {loadError && (
              <Alert variant="destructive">
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="org">
                Organización destino <span className="text-destructive">*</span>
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
              <Label htmlFor="page">
                Page <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                <SelectTrigger id="page">
                  <SelectValue placeholder="Elegí Page" />
                </SelectTrigger>
                <SelectContent>
                  {pages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name || p.id}
                      <span className="ml-1 text-xs text-muted-foreground">
                        · {p.kind === 'client' ? 'cliente' : 'owned'}
                      </span>
                      {!p.canPublish && <span className="ml-1 text-xs text-warning-foreground">· ⚠</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {pages.length === 0 && !loadError && (
                <p className="text-xs text-warning-foreground">
                  No hay Pages disponibles. Verificá que el System User tenga Pages asignadas en
                  Business Settings.
                </p>
              )}
            </div>

            {selectedPage?.hasInstagram && (
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox checked={includeIg} onCheckedChange={(v) => setIncludeIg(!!v)} />
                Importar también la Instagram Business vinculada
              </label>
            )}

            {selectedPage && !selectedPage.canPublish && (
              <Alert variant="warning">
                <AlertTriangle className="size-4" />
                <AlertTitle>El System User no puede publicar</AlertTitle>
                <AlertDescription>
                  Le falta <code className="rounded bg-muted px-1 py-0.5">CREATE_CONTENT</code> o{' '}
                  <code className="rounded bg-muted px-1 py-0.5">MANAGE</code> sobre esta Page. Se
                  puede asignar pero las publicaciones van a fallar.
                </AlertDescription>
              </Alert>
            )}

            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert variant="success">
                <CheckCircle2 className="size-4" />
                <AlertTitle>Asignada</AlertTitle>
                <AlertDescription>
                  <strong>{success.fb}</strong>
                  {success.ig && <> + Instagram <strong>{success.ig}</strong></>}
                </AlertDescription>
              </Alert>
            )}

            {warnings.length > 0 && (
              <Alert variant="warning">
                <AlertTriangle className="size-4" />
                <AlertTitle>Advertencias</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 list-disc pl-5">
                    {warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cerrar
              </Button>
              <Button type="submit" loading={submitting} disabled={submitting || !!success}>
                {submitting ? 'Asignando' : 'Asignar'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
