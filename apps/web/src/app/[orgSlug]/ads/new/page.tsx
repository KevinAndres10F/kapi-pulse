'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Loader2, Megaphone, Save } from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  checkFunding,
  createDraft,
  listAdAccounts,
  listPages,
  type AdAccount,
  type AdObjective,
  type BusinessPage,
} from '@/lib/ads/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const OBJECTIVES: Array<{ value: AdObjective; label: string; help: string }> = [
  { value: 'OUTCOME_TRAFFIC', label: 'Tráfico', help: 'Mandar gente a tu web/landing' },
  { value: 'OUTCOME_AWARENESS', label: 'Reconocimiento', help: 'Máximo alcance e impresiones' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Interacción', help: 'Reacciones, comentarios, compartidos' },
  { value: 'OUTCOME_LEADS', label: 'Leads', help: 'Formularios de contacto desde el anuncio' },
  { value: 'OUTCOME_SALES', label: 'Ventas', help: 'Conversiones (requiere Pixel)' },
]

const CTAS = [
  'LEARN_MORE',
  'SHOP_NOW',
  'SIGN_UP',
  'CONTACT_US',
  'GET_QUOTE',
  'SUBSCRIBE',
  'DOWNLOAD',
  'BOOK_TRAVEL',
]

const COUNTRIES = [
  { code: 'EC', name: 'Ecuador' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Perú' },
  { code: 'MX', name: 'México' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'ES', name: 'España' },
]

const PLATFORMS = [
  { v: 'facebook', l: 'Facebook' },
  { v: 'instagram', l: 'Instagram' },
  { v: 'audience_network', l: 'Audience Network' },
  { v: 'messenger', l: 'Messenger' },
]

export default function NewAdPage() {
  const params = useParams<{ orgSlug: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [orgId, setOrgId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<AdAccount[]>([])
  const [pages, setPages] = useState<BusinessPage[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [pagesError, setPagesError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fundingWarning, setFundingWarning] = useState<string | null>(null)

  const [adAccountId, setAdAccountId] = useState('')
  const [name, setName] = useState('')
  const [objective, setObjective] = useState<AdObjective>('OUTCOME_TRAFFIC')
  const [dailyBudgetUsd, setDailyBudgetUsd] = useState('5.00')
  const [countries, setCountries] = useState<string[]>(['EC'])
  const [ageMin, setAgeMin] = useState(18)
  const [ageMax, setAgeMax] = useState(45)
  const [platforms, setPlatforms] = useState<string[]>(['facebook', 'instagram'])
  const [pageId, setPageId] = useState('')
  const [headline, setHeadline] = useState('')
  const [message, setMessage] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [cta, setCta] = useState('LEARN_MORE')
  const [imageUrl, setImageUrl] = useState('')

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
      const oid = (org as { id: string }).id
      setOrgId(oid)

      try {
        const [acc, pg] = await Promise.all([
          listAdAccounts(oid, user.id),
          listPages(user.id).catch((e) => {
            setPagesError(
              e instanceof Error && e.message.includes('admin')
                ? 'No tenés permiso para listar Pages. Pegá el Page ID manualmente.'
                : `Error cargando Pages: ${e instanceof Error ? e.message : 'desconocido'}`,
            )
            return { pages: [] }
          }),
        ])
        if (cancelled) return
        setAccounts(acc.accounts)
        setPages(pg.pages)
        if (acc.accounts.length === 1) setAdAccountId(acc.accounts[0].id)
        if (pg.pages.length === 1) setPageId(pg.pages[0].id)
      } finally {
        if (!cancelled) setLoadingMeta(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [params.orgSlug, supabase])

  const validateFunding = useCallback(
    async (accId: string) => {
      if (!userId) return
      setFundingWarning(null)
      try {
        const status = await checkFunding(accId, userId)
        if (!status.hasFunding) {
          if (!status.fundingSource) {
            setFundingWarning(
              'Esta cuenta no tiene método de pago configurado. Podés guardar el borrador pero la aprobación va a fallar hasta que agregues una tarjeta en Meta Ads Manager.',
            )
          } else if (status.accountStatus !== 1) {
            setFundingWarning(
              `Esta cuenta tiene status ${status.accountStatus} (no activa). La aprobación va a fallar hasta que se reactive en Meta.`,
            )
          }
        }
      } catch {
        // No bloqueante
      }
    },
    [userId],
  )

  useEffect(() => {
    if (adAccountId) validateFunding(adAccountId)
  }, [adAccountId, validateFunding])

  function togglePlatform(p: string) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
  }

  function toggleCountry(code: string) {
    setCountries((cur) => (cur.includes(code) ? cur.filter((x) => x !== code) : [...cur, code]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId || !userId) return
    if (!adAccountId) return setSubmitError('Elegí una cuenta publicitaria.')
    if (!pageId) return setSubmitError('Elegí o pegá el Page ID.')
    if (countries.length === 0) return setSubmitError('Elegí al menos un país.')
    if (platforms.length === 0) return setSubmitError('Elegí al menos una plataforma.')

    setSubmitting(true)
    setSubmitError(null)
    try {
      const dailyCents = Math.round(parseFloat(dailyBudgetUsd) * 100)
      if (!Number.isFinite(dailyCents) || dailyCents < 100) {
        throw new Error('Presupuesto diario debe ser al menos $1.00')
      }

      await createDraft(
        {
          organizationId: orgId,
          adAccountId,
          createdBy: userId,
          name,
          objective,
          dailyBudgetCents: dailyCents,
          adSet: {
            name: `${name} — AdSet`,
            optimizationGoal: objective === 'OUTCOME_TRAFFIC' ? 'LINK_CLICKS' : 'REACH',
            billingEvent: 'IMPRESSIONS',
            targeting: {
              geo_locations: { countries },
              age_min: ageMin,
              age_max: ageMax,
              publisher_platforms: platforms,
            },
          },
          creative: {
            name: `${name} — Creative`,
            pageId,
            message: message || undefined,
            headline: headline || undefined,
            linkUrl,
            callToActionType: cta,
            mediaUrl: imageUrl || undefined,
          },
        },
        userId,
      )

      toast.success('Borrador creado.')
      router.push(`/${params.orgSlug}/ads`)
    } catch (e) {
      const err = e as Error & { details?: unknown }
      setSubmitError(err.message)
      console.error('createDraft failed', err.details || err)
    } finally {
      setSubmitting(false)
    }
  }

  if (!userId || !orgId || loadingMeta) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={`/${params.orgSlug}/ads`}>
            <ArrowLeft className="size-4" />
            Volver
          </Link>
        </Button>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          <Megaphone className="size-6 text-primary" />
          Nueva campaña
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Esto crea un borrador. El equipo KAPI lo revisa antes de lanzarlo en Meta.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuración general</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Nombre de la campaña <Required />
              </Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Lanzamiento Marzo 2026"
                required
                minLength={3}
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="acc">
                Cuenta publicitaria <Required />
              </Label>
              <Select value={adAccountId} onValueChange={setAdAccountId}>
                <SelectTrigger id="acc">
                  <SelectValue placeholder="Elegí una cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name || a.meta_ad_account_id}{' '}
                      <span className="text-muted-foreground">· {a.currency}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {accounts.length === 0 && (
                <p className="text-xs text-warning-foreground">
                  No tenés cuentas. Contactá al equipo KAPI.
                </p>
              )}
            </div>

            {fundingWarning && (
              <Alert variant="warning">
                <AlertTriangle className="size-4" />
                <AlertDescription>{fundingWarning}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label>
                Objetivo <Required />
              </Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {OBJECTIVES.map((o) => {
                  const active = objective === o.value
                  return (
                    <button
                      type="button"
                      key={o.value}
                      onClick={() => setObjective(o.value)}
                      className={cn(
                        'flex items-start gap-2 rounded-lg border p-3 text-left transition-all',
                        active
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border bg-card hover:border-primary/40',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2',
                          active ? 'border-primary' : 'border-input',
                        )}
                      >
                        {active && <span className="size-2 rounded-full bg-primary" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{o.label}</p>
                        <p className="text-xs text-muted-foreground">{o.help}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="budget">
                Presupuesto diario <Required />
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">USD</span>
                <Input
                  id="budget"
                  type="number"
                  step="0.50"
                  min="1.00"
                  value={dailyBudgetUsd}
                  onChange={(e) => setDailyBudgetUsd(e.target.value)}
                  required
                  className="w-32 tabular-nums"
                />
                <span className="text-sm text-muted-foreground">por día</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Segmentación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Países</Label>
              <div className="flex flex-wrap gap-2">
                {COUNTRIES.map((c) => (
                  <Chip
                    key={c.code}
                    active={countries.includes(c.code)}
                    onClick={() => toggleCountry(c.code)}
                  >
                    {c.name}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="age-min">Edad mínima</Label>
                <Input
                  id="age-min"
                  type="number"
                  min="13"
                  max="65"
                  value={ageMin}
                  onChange={(e) => setAgeMin(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="age-max">Edad máxima</Label>
                <Input
                  id="age-max"
                  type="number"
                  min="13"
                  max="65"
                  value={ageMax}
                  onChange={(e) => setAgeMax(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Plataformas</Label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <Chip
                    key={p.v}
                    active={platforms.includes(p.v)}
                    onClick={() => togglePlatform(p.v)}
                  >
                    {p.l}
                  </Chip>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Creativo del anuncio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="page">
                Página de Facebook <Required />
              </Label>
              {pages.length > 0 ? (
                <Select value={pageId} onValueChange={setPageId}>
                  <SelectTrigger id="page">
                    <SelectValue placeholder="Elegí una página" />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name || p.id}
                        {p.kind === 'client' && (
                          <Badge variant="muted" className="ml-1">
                            cliente
                          </Badge>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="page"
                  type="text"
                  value={pageId}
                  onChange={(e) => setPageId(e.target.value)}
                  placeholder="123456789012345"
                  required
                  className="font-mono"
                />
              )}
              {pagesError && <p className="text-xs text-warning-foreground">{pagesError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="headline">Titular (headline)</Label>
              <Input
                id="headline"
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                maxLength={255}
                placeholder="¡Hasta 50% OFF!"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="message">Texto principal</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Mensaje que aparece arriba del anuncio"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="link">
                URL de destino <Required />
              </Label>
              <Input
                id="link"
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://kapi.ec/promo"
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cta">Botón de acción</Label>
                <Select value={cta} onValueChange={setCta}>
                  <SelectTrigger id="cta">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CTAS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="img">Imagen (URL)</Label>
                <Input
                  id="img"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Pegá una URL pública. Más adelante podés vincular un asset de Studio.
            </p>
          </CardContent>
        </Card>

        {submitError && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end gap-2">
          <Button asChild variant="outline">
            <Link href={`/${params.orgSlug}/ads`}>Cancelar</Link>
          </Button>
          <Button type="submit" loading={submitting} variant="gradient">
            {!submitting && <Save className="size-4" />}
            {submitting ? 'Guardando' : 'Guardar borrador'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-all',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card text-foreground hover:border-primary/40',
      )}
    >
      {children}
    </button>
  )
}

function Required() {
  return <span className="text-destructive">*</span>
}
