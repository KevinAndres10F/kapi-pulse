'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Sparkles, Video, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { fetchJob, type JobAsset } from '@/lib/studio/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ImageGenerationFormProps {
  characterId: string
  orgId: string
  accessToken?: string
  onAssetsGenerated?: (assetIds: string[]) => void
}

const TERMINAL_FAIL = ['failed', 'cancelled', 'refunded']
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function ImageGenerationForm({ characterId, orgId, accessToken, onAssetsGenerated }: ImageGenerationFormProps) {
  const [prompt, setPrompt] = useState('')
  const [numImages, setNumImages] = useState(1)
  const [isCarousel, setIsCarousel] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [images, setImages] = useState<JobAsset[]>([])
  // assetId del video en curso (para spinner por-imagen) y videos listos
  const [videoLoadingFor, setVideoLoadingFor] = useState<string | null>(null)
  const [videos, setVideos] = useState<JobAsset[]>([])

  function authHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) h['Authorization'] = `Bearer ${accessToken}`
    return h
  }

  /** Hace polling del job hasta que termine; devuelve los assets generados. */
  async function pollUntilDone(jobId: string, onStatus?: (s: string) => void): Promise<JobAsset[]> {
    const maxAttempts = 150 // ~7.5 min a 3s
    for (let i = 0; i < maxAttempts; i++) {
      const { job, assets } = await fetchJob(jobId, orgId, accessToken)
      onStatus?.(job.status)
      if (job.status === 'succeeded') return assets
      if (TERMINAL_FAIL.includes(job.status)) throw new Error(job.error || 'La generación falló')
      await sleep(3000)
    }
    throw new Error('Timeout esperando la generación')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) {
      toast.error('Escribe un prompt')
      return
    }

    setLoading(true)
    setImages([])
    setVideos([])
    setStatus('encolando…')

    try {
      const response = await fetch(`${API_URL}/api/studio/branded/image-branded`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          orgId,
          prompt,
          characterId: characterId || undefined,
          numImages: isCarousel ? 3 : numImages,
          isCarousel,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.error || 'La generación falló')

      toast.success('Generación iniciada')
      const assets = await pollUntilDone(data.jobId, setStatus)
      const imgs = assets.filter((a) => a.kind === 'image')
      setImages(imgs)
      onAssetsGenerated?.(imgs.map((a) => a.id))
      if (imgs.length === 0) toast.error('El job terminó sin imágenes')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'La generación falló')
    } finally {
      setLoading(false)
      setStatus('')
    }
  }

  const handleCreateVideo = async (sourceAsset: JobAsset) => {
    setVideoLoadingFor(sourceAsset.id)
    try {
      const response = await fetch(`${API_URL}/api/studio/branded/video-with-audio`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          orgId,
          prompt: prompt || 'Animación profesional del personaje, movimiento sutil y natural',
          sourceAssetId: sourceAsset.id,
          characterId: characterId || undefined,
          duration: 5,
          aspectRatio: '9:16',
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || data.error || 'El video falló')

      toast.success('Video en proceso…')
      const assets = await pollUntilDone(data.jobId)
      const vids = assets.filter((a) => a.kind === 'video')
      setVideos((prev) => [...prev, ...vids])
      onAssetsGenerated?.(vids.map((a) => a.id))
      if (vids.length === 0) toast.error('El job terminó sin video')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'El video falló')
    } finally {
      setVideoLoadingFor(null)
    }
  }

  // ===== Resultados =====
  if (images.length > 0 && !loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Resultado
          </CardTitle>
          <CardDescription>Genera un video a partir de cualquier imagen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {images.map((img) => (
              <div key={img.id} className="space-y-2">
                {img.signed_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.signed_url}
                    alt="Imagen generada"
                    className="w-full rounded-lg border object-cover"
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
                    URL no disponible
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={videoLoadingFor !== null}
                  onClick={() => handleCreateVideo(img)}
                >
                  {videoLoadingFor === img.id ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creando video…
                    </>
                  ) : (
                    <>
                      <Video className="mr-2 h-4 w-4" />
                      Crear video
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>

          {videos.length > 0 && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Videos</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {videos.map((vid) =>
                  vid.signed_url ? (
                    <video key={vid.id} src={vid.signed_url} controls className="w-full rounded-lg border" />
                  ) : null,
                )}
              </div>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setImages([])
              setVideos([])
              setPrompt('')
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Generar otra
          </Button>
        </CardContent>
      </Card>
    )
  }

  // ===== Progreso =====
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Generando…</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Estado: {status || 'procesando'}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Esto puede tardar entre 10 y 60 segundos.
          </p>
        </CardContent>
      </Card>
    )
  }

  // ===== Formulario =====
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Generar Imagen
        </CardTitle>
        <CardDescription>Crea imágenes con tu personaje y marca</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="Describe la imagen que quieres generar…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-24"
            />
            <p className="text-xs text-muted-foreground">
              Tu personaje y los colores de marca se incluyen automáticamente.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="carousel"
              checked={isCarousel}
              onCheckedChange={(checked) => setIsCarousel(checked === true)}
            />
            <Label htmlFor="carousel" className="cursor-pointer font-normal">
              Generar carrusel (3 imágenes coordinadas)
            </Label>
          </div>

          {!isCarousel && (
            <div className="space-y-2">
              <Label htmlFor="num-images">Número de imágenes</Label>
              <Select value={numImages.toString()} onValueChange={(v) => setNumImages(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 imagen</SelectItem>
                  <SelectItem value="2">2 imágenes</SelectItem>
                  <SelectItem value="3">3 imágenes</SelectItem>
                  <SelectItem value="4">4 imágenes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            <Sparkles className="mr-2 h-4 w-4" />
            Generar Imagen
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
