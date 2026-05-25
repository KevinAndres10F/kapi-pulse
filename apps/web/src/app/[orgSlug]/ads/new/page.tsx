'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Megaphone, AlertTriangle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  listAdAccounts,
  listPages,
  createDraft,
  checkFunding,
  type AdAccount,
  type BusinessPage,
  type AdObjective,
} from '@/lib/ads/api'

const OBJECTIVES: Array<{ value: AdObjective; label: string; help: string }> = [
  { value: 'OUTCOME_TRAFFIC', label: 'Tráfico', help: 'Mandar gente a tu web/landing' },
  { value: 'OUTCOME_AWARENESS', label: 'Reconocimiento', help: 'Máximo alcance e impresiones' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Interacción', help: 'Reacciones, comentarios, compartidos' },
  { value: 'OUTCOME_LEADS', label: 'Leads', help: 'Formularios de contacto desde el anuncio' },
  { value: 'OUTCOME_SALES', label: 'Ventas', help: 'Conversiones de compra (requiere Pixel)' },
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

  // Form state
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

  // Load context
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
      const oid = (org as { id: string }).id
      setOrgId(oid)

      // Cargar ad accounts y pages en paralelo
      try {
        const [acc, pg] = await Promise.all([
          listAdAccounts(oid, user.id),
          listPages(user.id).catch((e) => {
            // listPages requiere admin — si el cliente no es admin, no se le muestran pages.
            // En ese caso le tocará pegar el pageId a mano.
            setPagesError(
              e instanceof Error && e.message.includes('admin')
                ? 'No tienes permiso para listar Pages. Pega el Page ID manualmente.'
                : `Error cargando Pages: ${e instanceof Error ? e.message : 'desconocido'}`
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

  // Cuando se elige una ad account, validar funding en background
  const validateFunding = useCallback(async (accId: string) => {
    if (!userId) return
    setFundingWarning(null)
    try {
      const status = await checkFunding(accId, userId)
      if (!status.hasFunding) {
        if (!status.fundingSource) {
          setFundingWarning(
            'Esta cuenta publicitaria no tiene un método de pago configurado. ' +
              'Aunque puedes guardar el borrador, la aprobación va a fallar hasta que agregues una tarjeta en Meta Ads Manager.',
          )
        } else if (status.accountStatus !== 1) {
          setFundingWarning(
            `Esta cuenta tiene status ${status.accountStatus} (no activa). ` +
              'La aprobación va a fallar hasta que se reactive en Meta.',
          )
        }
      }
    } catch {
      // No bloqueante
    }
  }, [userId])

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
    if (!adAccountId) {
      setSubmitError('Elige una cuenta publicitaria')
      return
    }
    if (!pageId) {
      setSubmitError('Elige o pega el Page ID')
      return
    }
    if (countries.length === 0) {
      setSubmitError('Elige al menos un país')
      return
    }
    if (platforms.length === 0) {
      setSubmitError('Elige al menos una plataforma')
      return
    }

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
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/${params.orgSlug}/ads`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground">
          <Megaphone className="h-6 w-6 text-primary" />
          Nueva campaña
        </h1>
        <p className="mt-1 text-muted-foreground">
          Esto crea un borrador. El equipo KAPI lo revisa antes de lanzarlo en Meta.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Datos generales */}
        <Section title="Configuración general">
          <Field label="Nombre de la campaña" required>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Lanzamiento Marzo 2026"
              required
              minLength={3}
              maxLength={200}
              className="input"
            />
          </Field>

          <Field label="Cuenta publicitaria" required>
            <select
              value={adAccountId}
              onChange={(e) => setAdAccountId(e.target.value)}
              required
              className="input"
            >
              <option value="">— Elige una cuenta —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name || a.meta_ad_account_id} ({a.currency})
                </option>
              ))}
            </select>
            {accounts.length === 0 && (
              <p className="mt-1 text-xs text-warning-foreground">
                No tienes cuentas. Contacta al equipo KAPI.
              </p>
            )}
          </Field>

          {fundingWarning && (
            <div className="rounded-md border border-warning/30 bg-warning/15 p-3">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning-foreground" />
                <p className="text-sm text-yellow-800">{fundingWarning}</p>
              </div>
            </div>
          )}

          <Field label="Objetivo" required>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {OBJECTIVES.map((o) => (
                <label
                  key={o.value}
                  className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 ${
                    objective === o.value
                      ? 'border-ring bg-primary/10'
                      : 'border-border hover:border-input'
                  }`}
                >
                  <input
                    type="radio"
                    name="objective"
                    value={o.value}
                    checked={objective === o.value}
                    onChange={() => setObjective(o.value)}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">{o.label}</p>
                    <p className="text-xs text-muted-foreground">{o.help}</p>
                  </div>
                </label>
              ))}
            </div>
          </Field>

          <Field label="Presupuesto diario (USD)" required>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">$</span>
              <input
                type="number"
                step="0.50"
                min="1.00"
                value={dailyBudgetUsd}
                onChange={(e) => setDailyBudgetUsd(e.target.value)}
                required
                className="input w-32"
              />
              <span className="text-sm text-muted-foreground">por día</span>
            </div>
          </Field>
        </Section>

        {/* Segmentación */}
        <Section title="Segmentación">
          <Field label="Países">
            <div className="flex flex-wrap gap-2">
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => toggleCountry(c.code)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    countries.includes(c.code)
                      ? 'border-ring bg-blue-100 text-primary'
                      : 'border-input bg-card text-foreground hover:bg-muted/40'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Edad mínima">
              <input
                type="number"
                min="13"
                max="65"
                value={ageMin}
                onChange={(e) => setAgeMin(Number(e.target.value))}
                className="input"
              />
            </Field>
            <Field label="Edad máxima">
              <input
                type="number"
                min="13"
                max="65"
                value={ageMax}
                onChange={(e) => setAgeMax(Number(e.target.value))}
                className="input"
              />
            </Field>
          </div>

          <Field label="Plataformas">
            <div className="flex gap-2">
              {[
                { v: 'facebook', l: 'Facebook' },
                { v: 'instagram', l: 'Instagram' },
                { v: 'audience_network', l: 'Audience Network' },
                { v: 'messenger', l: 'Messenger' },
              ].map((p) => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => togglePlatform(p.v)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    platforms.includes(p.v)
                      ? 'border-ring bg-blue-100 text-primary'
                      : 'border-input bg-card text-foreground hover:bg-muted/40'
                  }`}
                >
                  {p.l}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* Creative */}
        <Section title="Creativo del anuncio">
          <Field label="Página de Facebook" required>
            {pages.length > 0 ? (
              <select
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                required
                className="input"
              >
                <option value="">— Elige una página —</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.id} {p.kind === 'client' ? '(cliente)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                placeholder="123456789012345"
                required
                className="input"
              />
            )}
            {pagesError && <p className="mt-1 text-xs text-warning-foreground">{pagesError}</p>}
          </Field>

          <Field label="Titular (headline)">
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              maxLength={255}
              placeholder="Ej: ¡Hasta 50% OFF!"
              className="input"
            />
          </Field>

          <Field label="Texto principal (message)">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              placeholder="Mensaje principal que aparece arriba del anuncio"
              rows={3}
              className="input"
            />
          </Field>

          <Field label="URL de destino" required>
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://kapi.ec/promo"
              required
              className="input"
            />
          </Field>

          <Field label="Botón de acción">
            <select value={cta} onChange={(e) => setCta(e.target.value)} className="input">
              {CTAS.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </Field>

          <Field label="URL de imagen (opcional)">
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="input"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Pega una URL pública. Más adelante podrás vincular un asset de Studio.
            </p>
          </Field>
        </Section>

        {submitError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {submitError}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Link
            href={`/${params.orgSlug}/ads`}
            className="rounded-md border border-input bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/40"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar borrador
          </button>
        </div>
      </form>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border: 1px solid rgb(209 213 219);
          border-radius: 0.375rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
        :global(.input:focus) {
          outline: none;
          border-color: rgb(59 130 246);
          box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1);
        }
      `}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 font-semibold text-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}
