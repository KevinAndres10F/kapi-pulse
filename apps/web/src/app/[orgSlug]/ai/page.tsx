'use client'

import { useState } from 'react'
import { Sparkles, Wand2, Search, Copy, Check, Loader2, AlertCircle } from 'lucide-react'

// Llamamos directo al API (no via Netlify proxy) porque Claude puede tardar
// >26s y el proxy CDN de Netlify timea con 504 HTML. El API tiene que tener
// el origen del front en ALLOWED_ORIGINS para que CORS pase.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function parseJsonOr(res: Response): Promise<{ data: any; error: string | null }> {
  const text = await res.text()
  try {
    return { data: JSON.parse(text), error: null }
  } catch {
    const snippet = text.slice(0, 120).replace(/\s+/g, ' ').trim()
    return {
      data: null,
      error: `Respuesta no-JSON del API (HTTP ${res.status}). ${
        res.status >= 500 ? 'Servidor caido o timeout.' : 'Endpoint inexistente?'
      } Snippet: "${snippet}..."`,
    }
  }
}

const PLATFORMS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'threads', label: 'Threads' },
  { value: 'youtube', label: 'YouTube' },
] as const

type Platform = (typeof PLATFORMS)[number]['value']
type Tab = 'generate' | 'improve' | 'analyze'

export default function AIPage() {
  const [tab, setTab] = useState<Tab>('generate')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          IA Editorial
        </h1>
        <p className="mt-1 text-muted-foreground">
          Generá contenido, mejorá textos existentes y analizá competidores con Claude.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        <TabButton active={tab === 'generate'} onClick={() => setTab('generate')} icon={<Sparkles className="h-4 w-4" />}>
          Generar
        </TabButton>
        <TabButton active={tab === 'improve'} onClick={() => setTab('improve')} icon={<Wand2 className="h-4 w-4" />}>
          Mejorar
        </TabButton>
        <TabButton active={tab === 'analyze'} onClick={() => setTab('analyze')} icon={<Search className="h-4 w-4" />}>
          Analizar competidor
        </TabButton>
      </div>

      {tab === 'generate' && <GenerateTab />}
      {tab === 'improve' && <ImproveTab />}
      {tab === 'analyze' && <AnalyzeTab />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'border-b-2 border-blue-600 text-primary'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

// ============== Tab: Generar ==============
function GenerateTab() {
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState<Platform>('linkedin')
  const [tone, setTone] = useState('profesional, cercano')
  const [context, setContext] = useState('')
  const [nVariants, setNVariants] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [variants, setVariants] = useState<
    Array<{ content: string; hashtags: string[]; rationale: string }>
  >([])

  async function handleGenerate() {
    if (topic.trim().length < 3) {
      setError('Describí el tema con al menos 3 caracteres.')
      return
    }
    setLoading(true)
    setError(null)
    setVariants([])

    try {
      const res = await fetch(`${API_URL}/api/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          platform,
          tone,
          context: context || undefined,
          n_variants: nVariants,
        }),
      })
      const { data, error: parseErr } = await parseJsonOr(res)
      if (parseErr) {
        setError(parseErr)
        return
      }
      if (!res.ok) {
        setError(data.error?.detail || data.error || `Error ${res.status}`)
        return
      }
      setVariants(data.variants || [])
    } catch (err) {
      setError(
        err instanceof Error
          ? `No se pudo conectar con la API: ${err.message}`
          : 'Error de red',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-lg border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">Sobre qué querés escribir</h2>

        <div>
          <label className="block text-sm font-medium text-foreground">Tema o idea</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Ej: Lanzamiento de nuestra nueva línea de productos sustentables hecha por mujeres artesanas del Ecuador"
            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus-visible:ring-ring/40"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground">Red social</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Variantes</label>
            <select
              value={nVariants}
              onChange={(e) => setNVariants(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
            >
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">Tono</label>
          <input
            type="text"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            maxLength={200}
            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">
            Contexto de marca / audiencia <span className="text-muted-foreground">(opcional)</span>
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Ej: Somos KAPI, agencia de marketing en Quito. Audiencia: PyMEs ecuatorianas."
            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
          />
        </div>

        {error && <ErrorBox message={error} />}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? 'Generando con Claude...' : 'Generar variantes'}
        </button>
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="rounded-lg border border-dashed border-input bg-muted/40 p-8 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
            <p className="mt-2 text-sm">Claude está pensando...</p>
          </div>
        )}
        {!loading && variants.length === 0 && (
          <div className="rounded-lg border border-dashed border-input bg-muted/40 p-12 text-center text-muted-foreground">
            <Sparkles className="mx-auto h-8 w-8" />
            <p className="mt-2 text-sm">Las variantes aparecerán acá.</p>
          </div>
        )}
        {variants.map((v, i) => (
          <VariantCard key={i} index={i} variant={v} />
        ))}
      </div>
    </div>
  )
}

function VariantCard({
  index,
  variant,
}: {
  index: number
  variant: { content: string; hashtags: string[]; rationale: string }
}) {
  const [copied, setCopied] = useState(false)
  const fullText = `${variant.content}\n\n${variant.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}`

  async function copy() {
    await navigator.clipboard.writeText(fullText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-primary">
          Variante {index + 1}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{variant.content}</p>
      {variant.hashtags.length > 0 && (
        <p className="mt-3 text-sm text-primary">
          {variant.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
        </p>
      )}
      <div className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-xs italic text-muted-foreground">
        💡 {variant.rationale}
      </div>
    </div>
  )
}

// ============== Tab: Mejorar ==============
function ImproveTab() {
  const [text, setText] = useState('')
  const [platform, setPlatform] = useState<Platform | ''>('')
  const [goal, setGoal] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    analysis: string
    variants: Array<{ content: string; changes: string }>
  } | null>(null)

  async function handleImprove() {
    if (text.trim().length < 10) {
      setError('Pegá un texto de al menos 10 caracteres.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`${API_URL}/api/ai/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          platform: platform || undefined,
          goal: goal || undefined,
        }),
      })
      const { data, error: parseErr } = await parseJsonOr(res)
      if (parseErr) {
        setError(parseErr)
        return
      }
      if (!res.ok) {
        setError(data.error?.detail || data.error || `Error ${res.status}`)
        return
      }
      setResult({ analysis: data.analysis, variants: data.variants })
    } catch (err) {
      setError(
        err instanceof Error
          ? `No se pudo conectar con la API: ${err.message}`
          : 'Error de red',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-lg border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">Texto a mejorar</h2>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          maxLength={5000}
          placeholder="Pegá acá el texto que querés mejorar..."
          className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus-visible:ring-ring/40"
        />

        <div>
          <label className="block text-sm font-medium text-foreground">
            Red social <span className="text-muted-foreground">(opcional, Claude la detecta si no la indicás)</span>
          </label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform | '')}
            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
          >
            <option value="">— Auto-detectar —</option>
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">
            Qué querés mejorar <span className="text-muted-foreground">(opcional)</span>
          </label>
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            maxLength={500}
            placeholder="Ej: que sea más corto, gancho más fuerte, tono más casual..."
            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
          />
        </div>

        {error && <ErrorBox message={error} />}

        <button
          onClick={handleImprove}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {loading ? 'Mejorando...' : 'Mejorar texto'}
        </button>
      </div>

      <div className="space-y-3">
        {loading && (
          <div className="rounded-lg border border-dashed border-input bg-muted/40 p-8 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
            <p className="mt-2 text-sm">Claude está pensando...</p>
          </div>
        )}
        {!loading && !result && (
          <div className="rounded-lg border border-dashed border-input bg-muted/40 p-12 text-center text-muted-foreground">
            <Wand2 className="mx-auto h-8 w-8" />
            <p className="mt-2 text-sm">Las versiones mejoradas aparecerán acá.</p>
          </div>
        )}
        {result && (
          <>
            <div className="rounded-lg border-l-4 border-amber-400 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Diagnóstico:</p>
              <p className="mt-1 text-sm text-amber-800">{result.analysis}</p>
            </div>
            {result.variants.map((v, i) => (
              <ImprovedCard key={i} index={i} variant={v} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function ImprovedCard({
  index,
  variant,
}: {
  index: number
  variant: { content: string; changes: string }
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(variant.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
          Versión {index + 1}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{variant.content}</p>
      <div className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-xs italic text-muted-foreground">
        ✏️ {variant.changes}
      </div>
    </div>
  )
}

// ============== Tab: Analizar competidor ==============
interface Sample {
  platform: string
  content: string
  metric: string
  url: string
}

function AnalyzeTab() {
  const [competitorName, setCompetitorName] = useState('')
  const [industry, setIndustry] = useState('')
  const [focusQuestion, setFocusQuestion] = useState('')
  const [samples, setSamples] = useState<Sample[]>([
    { platform: 'linkedin', content: '', metric: '', url: '' },
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    summary: string
    patterns: Array<{ category: string; observation: string; evidence: string }>
    strengths: string[]
    weaknesses: string[]
    recommendations: string[]
  } | null>(null)

  function addSample() {
    if (samples.length >= 20) return
    setSamples([...samples, { platform: 'linkedin', content: '', metric: '', url: '' }])
  }

  function removeSample(i: number) {
    if (samples.length === 1) return
    setSamples(samples.filter((_, idx) => idx !== i))
  }

  function updateSample(i: number, field: keyof Sample, value: string) {
    const next = [...samples]
    next[i] = { ...next[i], [field]: value }
    setSamples(next)
  }

  async function handleAnalyze() {
    if (!competitorName.trim()) {
      setError('Indicá el nombre del competidor.')
      return
    }
    const validSamples = samples.filter((s) => s.content.trim().length >= 10)
    if (validSamples.length === 0) {
      setError('Pegá al menos una muestra con 10+ caracteres.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`${API_URL}/api/ai/analyze-competitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitor_name: competitorName,
          industry: industry || undefined,
          focus_question: focusQuestion || undefined,
          samples: validSamples.map((s) => ({
            platform: s.platform || undefined,
            content: s.content,
            metric: s.metric || undefined,
            url: s.url || undefined,
          })),
        }),
      })
      const { data, error: parseErr } = await parseJsonOr(res)
      if (parseErr) {
        setError(parseErr)
        return
      }
      if (!res.ok) {
        setError(data.error?.detail || data.error || `Error ${res.status}`)
        return
      }
      setResult(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? `No se pudo conectar con la API: ${err.message}`
          : 'Error de red',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground">Datos del competidor</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-foreground">Nombre / marca</label>
            <input
              type="text"
              value={competitorName}
              onChange={(e) => setCompetitorName(e.target.value)}
              placeholder="Ej: Acme Marketing Agency"
              className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground">Sector (opcional)</label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Ej: Marketing digital B2B"
              className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground">
            Pregunta específica (opcional)
          </label>
          <input
            type="text"
            value={focusQuestion}
            onChange={(e) => setFocusQuestion(e.target.value)}
            maxLength={500}
            placeholder="Ej: ¿qué hace que sus posts de LinkedIn tengan tanto engagement?"
            className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">
            Muestras de posts ({samples.length}/20)
          </h2>
          <button
            onClick={addSample}
            disabled={samples.length >= 20}
            className="rounded-md border border-input px-3 py-1 text-xs font-medium text-foreground hover:bg-muted/40 disabled:opacity-50"
          >
            + Agregar muestra
          </button>
        </div>

        {samples.map((s, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={s.platform}
                onChange={(e) => updateSample(i, 'platform', e.target.value)}
                className="rounded border border-input px-2 py-1 text-xs"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={s.metric}
                onChange={(e) => updateSample(i, 'metric', e.target.value)}
                placeholder="Engagement: ej. '450 likes, 23 comentarios' (opcional)"
                className="flex-1 rounded border border-input px-2 py-1 text-xs"
              />
              {samples.length > 1 && (
                <button
                  onClick={() => removeSample(i)}
                  className="text-xs text-red-500 hover:text-destructive"
                  title="Quitar muestra"
                >
                  Quitar
                </button>
              )}
            </div>
            <textarea
              value={s.content}
              onChange={(e) => updateSample(i, 'content', e.target.value)}
              rows={3}
              maxLength={10000}
              placeholder="Pegá acá el texto del post..."
              className="w-full rounded border border-input px-2 py-1.5 text-sm"
            />
          </div>
        ))}

        {error && <ErrorBox message={error} />}

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? 'Analizando con Claude...' : 'Analizar competidor'}
        </button>
      </div>

      {loading && (
        <div className="rounded-lg border border-dashed border-input bg-muted/40 p-8 text-center text-muted-foreground">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
          <p className="mt-2 text-sm">Claude está analizando las muestras (puede tardar 20-40s)...</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground">Resumen ejecutivo</h3>
            <p className="mt-2 text-sm text-foreground">{result.summary}</p>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground">Patrones detectados</h3>
            <ul className="mt-3 space-y-3">
              {result.patterns.map((p, i) => (
                <li key={i} className="border-l-4 border-blue-400 pl-3">
                  <p className="text-xs font-bold uppercase text-primary">{p.category}</p>
                  <p className="text-sm font-medium text-foreground">{p.observation}</p>
                  <p className="mt-0.5 text-xs italic text-muted-foreground">↳ {p.evidence}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border-l-4 border-green-500 bg-success/10 p-4">
              <h3 className="font-semibold text-green-900">Fortalezas</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-success">
                {result.strengths.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border-l-4 border-red-500 bg-destructive/10 p-4">
              <h3 className="font-semibold text-red-900">Debilidades / oportunidades</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-destructive">
                {result.weaknesses.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-lg border-l-4 border-purple-500 bg-purple-50 p-4">
            <h3 className="font-semibold text-purple-900">Recomendaciones para diferenciarse</h3>
            <ul className="mt-2 space-y-2 text-sm text-purple-800">
              {result.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-bold">{i + 1}.</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  )
}
