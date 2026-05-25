'use client'

import { useState } from 'react'
import { Check, Copy, Loader2, Lightbulb, Search, Sparkles, Wand2 } from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function parseJsonOr(
  res: Response,
): Promise<{ data: any; error: string | null }> {
  const text = await res.text()
  try {
    return { data: JSON.parse(text), error: null }
  } catch {
    const snippet = text.slice(0, 120).replace(/\s+/g, ' ').trim()
    return {
      data: null,
      error: `Respuesta no-JSON del API (HTTP ${res.status}). ${
        res.status >= 500 ? 'Servidor caído o timeout.' : 'Endpoint inexistente?'
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

export default function AIPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          <Sparkles className="size-6 text-primary" />
          IA Editorial
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Generá contenido, mejorá textos existentes y analizá competidores con Claude.
        </p>
      </div>

      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate">
            <Sparkles className="size-4" />
            Generar
          </TabsTrigger>
          <TabsTrigger value="improve">
            <Wand2 className="size-4" />
            Mejorar
          </TabsTrigger>
          <TabsTrigger value="analyze">
            <Search className="size-4" />
            Analizar competidor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <GenerateTab />
        </TabsContent>
        <TabsContent value="improve">
          <ImproveTab />
        </TabsContent>
        <TabsContent value="analyze">
          <AnalyzeTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============== Generar ==============

function GenerateTab() {
  const [topic, setTopic] = useState('')
  const [platform, setPlatform] = useState<Platform>('linkedin')
  const [tone, setTone] = useState('profesional, cercano')
  const [context, setContext] = useState('')
  const [nVariants, setNVariants] = useState('3')
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
          n_variants: Number(nVariants),
        }),
      })
      const { data, error: parseErr } = await parseJsonOr(res)
      if (parseErr) return setError(parseErr)
      if (!res.ok) return setError(data.error?.detail || data.error || `Error ${res.status}`)
      setVariants(data.variants || [])
    } catch (err) {
      setError(err instanceof Error ? `No se pudo conectar: ${err.message}` : 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sobre qué querés escribir</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="topic">Tema o idea</Label>
            <Textarea
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Ej: Lanzamiento de nuestra nueva línea sustentable hecha por artesanas ecuatorianas..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="platform">Red social</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
                <SelectTrigger id="platform">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n">Variantes</Label>
              <Select value={nVariants} onValueChange={setNVariants}>
                <SelectTrigger id="n">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tone">Tono</Label>
            <Input
              id="tone"
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="context">
              Contexto de marca / audiencia <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Ej: Somos KAPI, agencia de marketing en Quito. Audiencia: PyMEs ecuatorianas."
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleGenerate} loading={loading} disabled={loading} variant="gradient" className="w-full">
            {!loading && <Sparkles className="size-4" />}
            {loading ? 'Generando con Claude' : 'Generar variantes'}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm">Claude está pensando…</p>
            </CardContent>
          </Card>
        )}
        {!loading && variants.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <Sparkles className="size-8" />
              <p className="text-sm">Las variantes aparecerán acá.</p>
            </CardContent>
          </Card>
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
    toast.success('Copiado al portapapeles.')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between">
          <Badge>Variante {index + 1}</Badge>
          <Button variant="ghost" size="sm" onClick={copy} className="gap-1.5">
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{variant.content}</p>
        {variant.hashtags.length > 0 && (
          <p className="text-sm text-primary">
            {variant.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
          </p>
        )}
        <Alert variant="info" className="py-2">
          <Lightbulb className="size-4" />
          <AlertDescription className="text-xs italic">{variant.rationale}</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

// ============== Mejorar ==============

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
      if (parseErr) return setError(parseErr)
      if (!res.ok) return setError(data.error?.detail || data.error || `Error ${res.status}`)
      setResult({ analysis: data.analysis, variants: data.variants })
    } catch (err) {
      setError(err instanceof Error ? `No se pudo conectar: ${err.message}` : 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Texto a mejorar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            maxLength={5000}
            placeholder="Pegá acá el texto que querés mejorar…"
          />

          <div className="space-y-1.5">
            <Label htmlFor="platform2">
              Red social <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Select value={platform || 'auto'} onValueChange={(v) => setPlatform(v === 'auto' ? '' : (v as Platform))}>
              <SelectTrigger id="platform2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detectar</SelectItem>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal">
              Qué querés mejorar <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="goal"
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              maxLength={500}
              placeholder="Más corto, gancho más fuerte, tono casual…"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleImprove} loading={loading} disabled={loading} variant="gradient" className="w-full">
            {!loading && <Wand2 className="size-4" />}
            {loading ? 'Mejorando' : 'Mejorar texto'}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {loading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm">Claude está pensando…</p>
            </CardContent>
          </Card>
        )}
        {!loading && !result && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
              <Wand2 className="size-8" />
              <p className="text-sm">Las versiones mejoradas aparecerán acá.</p>
            </CardContent>
          </Card>
        )}
        {result && (
          <>
            <Alert variant="warning">
              <Lightbulb className="size-4" />
              <AlertDescription>
                <span className="font-semibold text-foreground">Diagnóstico: </span>
                {result.analysis}
              </AlertDescription>
            </Alert>
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
    toast.success('Copiado al portapapeles.')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">Versión {index + 1}</Badge>
          <Button variant="ghost" size="sm" onClick={copy} className="gap-1.5">
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            {copied ? 'Copiado' : 'Copiar'}
          </Button>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{variant.content}</p>
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs italic text-muted-foreground">
          ✏️ {variant.changes}
        </div>
      </CardContent>
    </Card>
  )
}

// ============== Analizar competidor ==============

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
    if (!competitorName.trim()) return setError('Indicá el nombre del competidor.')
    const validSamples = samples.filter((s) => s.content.trim().length >= 10)
    if (validSamples.length === 0) return setError('Pegá al menos una muestra con 10+ caracteres.')
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
      if (parseErr) return setError(parseErr)
      if (!res.ok) return setError(data.error?.detail || data.error || `Error ${res.status}`)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? `No se pudo conectar: ${err.message}` : 'Error de red')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del competidor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="comp-name">Nombre / marca</Label>
              <Input
                id="comp-name"
                type="text"
                value={competitorName}
                onChange={(e) => setCompetitorName(e.target.value)}
                placeholder="Acme Marketing Agency"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="industry">Sector (opcional)</Label>
              <Input
                id="industry"
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Marketing digital B2B"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="focus">Pregunta específica (opcional)</Label>
            <Input
              id="focus"
              type="text"
              value={focusQuestion}
              onChange={(e) => setFocusQuestion(e.target.value)}
              maxLength={500}
              placeholder="¿Qué hace que sus posts de LinkedIn tengan tanto engagement?"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Muestras de posts</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="muted">{samples.length}/20</Badge>
              <Button variant="outline" size="sm" onClick={addSample} disabled={samples.length >= 20}>
                Agregar muestra
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {samples.map((s, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={s.platform}
                  onValueChange={(v) => updateSample(i, 'platform', v)}
                >
                  <SelectTrigger className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="text"
                  value={s.metric}
                  onChange={(e) => updateSample(i, 'metric', e.target.value)}
                  placeholder="Ej: 450 likes, 23 comentarios (opcional)"
                  className="h-8 flex-1 text-xs"
                />
                {samples.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSample(i)}
                    className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    Quitar
                  </Button>
                )}
              </div>
              <Textarea
                value={s.content}
                onChange={(e) => updateSample(i, 'content', e.target.value)}
                rows={3}
                maxLength={10000}
                placeholder="Pegá acá el texto del post…"
              />
            </div>
          ))}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleAnalyze} loading={loading} disabled={loading} variant="gradient" className="w-full">
            {!loading && <Search className="size-4" />}
            {loading ? 'Analizando con Claude' : 'Analizar competidor'}
          </Button>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm">Claude está analizando las muestras (20-40s)…</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen ejecutivo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-foreground">{result.summary}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Patrones detectados</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {result.patterns.map((p, i) => (
                  <li key={i} className="border-l-2 border-primary pl-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                      {p.category}
                    </p>
                    <p className="text-sm font-medium text-foreground">{p.observation}</p>
                    <p className="mt-0.5 text-xs italic text-muted-foreground">↳ {p.evidence}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-success/30 bg-success/5">
              <CardHeader>
                <CardTitle className="text-base text-success">Fortalezas</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-foreground">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-success">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-base text-destructive">Debilidades / oportunidades</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm text-foreground">
                  {result.weaknesses.map((w, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-destructive">•</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base text-primary">Recomendaciones para diferenciarse</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-foreground">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-bold tabular-nums text-primary">{i + 1}.</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
