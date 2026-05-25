'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  CheckCircle2,
  ImageIcon,
  Loader2,
  Plus,
  Save,
  Send,
  Sparkles,
  Upload,
  Video as VideoIcon,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

interface SocialAccount {
  id: string
  provider: string
  display_name: string | null
  avatar_url: string | null
  status: string
}

interface MediaItem {
  assetId: string
  storagePath: string
  bucket: string
  mediaType: 'image' | 'video'
  mimeType: string
  previewUrl: string
  name: string
}

interface Variant {
  socialAccountId: string
  provider: string
  displayName: string
  content: string
  hashtags: string
  linkUrl: string
  media: MediaItem[]
}

const MEDIA_REQUIRED_PROVIDERS = new Set(['instagram', 'tiktok'])
const VIDEO_EXTS = new Set(['mp4', 'mov'])
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp'])

const PROVIDER_TINT: Record<string, string> = {
  facebook: 'oklch(0.55 0.18 250)',
  instagram: 'oklch(0.6 0.22 0)',
  linkedin: 'oklch(0.48 0.15 240)',
  tiktok: 'oklch(0.45 0 0)',
  x: 'oklch(0.2 0 0)',
  youtube: 'oklch(0.55 0.22 27)',
  threads: 'oklch(0.4 0 0)',
}

const CHAR_LIMITS: Record<string, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  tiktok: 2200,
  x: 280,
  youtube: 5000,
  threads: 500,
}

function providerLabel(p: string): string {
  return p.charAt(0).toUpperCase() + p.slice(1)
}

export default function NewPostPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [variants, setVariants] = useState<Variant[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const [orgId, setOrgId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiTopic, setAiTopic] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<
    Array<{ content: string; hashtags: string[]; rationale: string }>
  >([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const supabase = createClient()

  async function getAuthToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }

  async function uploadMediaFiles(files: FileList | File[]) {
    if (!orgId || variants.length === 0) return
    const list = Array.from(files)
    if (list.length === 0) return
    setUploadingMedia(true)
    setError(null)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const token = await getAuthToken()
      if (!token) {
        toast.error('Sesión no válida. Recarga la página.')
        return
      }
      const newMedia: MediaItem[] = []
      for (const file of list) {
        const extRaw = (file.name.split('.').pop() || '').toLowerCase()
        const ext = extRaw === 'jpg' ? 'jpg' : extRaw
        if (!IMAGE_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) {
          toast.error(`Tipo no soportado: ${file.name}`, {
            description: 'Acepta png, jpg, jpeg, webp, mp4 o mov.',
          })
          continue
        }
        const isVideo = VIDEO_EXTS.has(ext)
        const initRes = await fetch(`${apiUrl}/api/assets/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ orgId, ext, kind: isVideo ? 'video' : 'image', bucket: 'campaign-uploads' }),
        })
        if (!initRes.ok) {
          const body = await initRes.json().catch(() => ({}))
          toast.error(body.error || `Error iniciando upload de ${file.name}`)
          continue
        }
        const init = await initRes.json()

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const uploadUrl = `${supabaseUrl}/storage/v1/object/upload/sign/${init.bucket}/${init.storagePath}?token=${init.token}`
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || (isVideo ? 'video/mp4' : 'image/jpeg') },
          body: file,
        })
        if (!uploadRes.ok) {
          toast.error(`Error subiendo ${file.name}`)
          continue
        }

        newMedia.push({
          assetId: init.assetId,
          storagePath: init.storagePath,
          bucket: init.bucket,
          mediaType: isVideo ? 'video' : 'image',
          mimeType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
          previewUrl: URL.createObjectURL(file),
          name: file.name,
        })
      }
      if (newMedia.length > 0) {
        setVariants((prev) => {
          const updated = [...prev]
          updated[activeTab] = {
            ...updated[activeTab],
            media: [...(updated[activeTab].media || []), ...newMedia],
          }
          return updated
        })
        toast.success(`${newMedia.length} archivo${newMedia.length > 1 ? 's' : ''} subido${newMedia.length > 1 ? 's' : ''}.`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error subiendo media')
    } finally {
      setUploadingMedia(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removeMedia(variantIndex: number, mediaIndex: number) {
    setVariants((prev) => {
      const updated = [...prev]
      const media = [...(updated[variantIndex].media || [])]
      const removed = media.splice(mediaIndex, 1)[0]
      if (removed?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(removed.previewUrl)
      updated[variantIndex] = { ...updated[variantIndex], media }
      return updated
    })
  }

  async function generateWithAI() {
    if (aiTopic.trim().length < 3 || !currentVariant) return
    setAiLoading(true)
    setAiSuggestions([])
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
      const res = await fetch(`${apiUrl}/api/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic,
          platform: currentVariant.provider,
          tone: 'profesional, cercano',
          n_variants: 3,
        }),
      })
      const data = await res.json()
      if (res.ok && data.variants) setAiSuggestions(data.variants)
      else toast.error(data?.error || 'No se pudieron generar variantes.')
    } catch {
      toast.error('Error generando con IA.')
    } finally {
      setAiLoading(false)
    }
  }

  function applyAISuggestion(s: { content: string; hashtags: string[] }) {
    updateVariant(activeTab, 'content', s.content)
    updateVariant(activeTab, 'hashtags', s.hashtags.join(', '))
    setAiOpen(false)
    setAiSuggestions([])
    setAiTopic('')
    toast.success('Variante aplicada.')
  }

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
      .select('id, provider, display_name, avatar_url, status')
      .eq('organization_id', org.id)
      .eq('status', 'active')

    if (data) setAccounts(data)
  }, [supabase, orgSlug])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  function addVariant(account: SocialAccount) {
    if (variants.find((v) => v.socialAccountId === account.id)) return
    setVariants([
      ...variants,
      {
        socialAccountId: account.id,
        provider: account.provider,
        displayName: account.display_name || providerLabel(account.provider),
        content: '',
        hashtags: '',
        linkUrl: '',
        media: [],
      },
    ])
    setActiveTab(variants.length)
  }

  function removeVariant(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index))
    setActiveTab((tab) => (tab >= index ? Math.max(0, tab - 1) : tab))
  }

  function updateVariant(index: number, field: keyof Variant, value: string) {
    const updated = [...variants]
    updated[index] = { ...updated[index], [field]: value }
    setVariants(updated)
  }

  async function handleSave(asDraft: boolean) {
    if (variants.length === 0) {
      setError('Agregá al menos una red social.')
      return
    }
    if (variants.some((v) => !v.content.trim())) {
      setError('Todas las variantes deben tener contenido.')
      return
    }
    const missingMedia = variants.find(
      (v) => MEDIA_REQUIRED_PROVIDERS.has(v.provider) && (v.media?.length ?? 0) === 0,
    )
    if (missingMedia) {
      setError(
        `${providerLabel(missingMedia.provider)} requiere al menos una imagen o video. Subilo en la pestaña correspondiente.`,
      )
      return
    }

    setSaving(true)
    setError(null)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

    const body = {
      organizationId: orgId,
      createdBy: userId,
      title: title || undefined,
      internalNotes: internalNotes || undefined,
      scheduledAt: !asDraft && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      variants: variants.map((v) => ({
        socialAccountId: v.socialAccountId,
        content: v.content,
        hashtags: v.hashtags
          ? v.hashtags
              .split(',')
              .map((h) => h.trim())
              .filter(Boolean)
          : [],
        linkUrl: v.linkUrl || undefined,
        media: (v.media || []).map((m, i) => ({
          assetId: m.assetId,
          mediaType: m.mediaType,
          mimeType: m.mimeType,
          position: i,
        })),
      })),
    }

    try {
      const res = await fetch(`${apiUrl}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Error al guardar el post.')
        setSaving(false)
        return
      }

      toast.success(asDraft ? 'Borrador guardado.' : scheduledAt ? 'Post programado.' : 'Borrador guardado.')
      router.push(`/${orgSlug}/calendar`)
    } catch {
      setError('Error de conexión con el servidor.')
      setSaving(false)
    }
  }

  const currentVariant = variants[activeTab]
  const charLimit = currentVariant ? CHAR_LIMITS[currentVariant.provider] || 5000 : 5000
  const charsUsed = currentVariant?.content.length ?? 0
  const charsOver = charsUsed > charLimit * 0.9
  const availableAccounts = accounts.filter((a) => !variants.find((v) => v.socialAccountId === a.id))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Volver">
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Nuevo post</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Creá contenido para una o varias redes sociales en una sola pasada.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Editor */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-1.5">
                <Label htmlFor="post-title" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Título interno
                </Label>
                <Input
                  id="post-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Solo lo ve tu equipo (opcional)"
                  className="border-0 border-b border-input bg-transparent px-0 text-lg font-semibold shadow-none rounded-none focus-visible:ring-0 focus-visible:border-ring"
                />
              </div>

              {/* Tabs por red social */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3">
                {variants.map((v, i) => {
                  const active = activeTab === i
                  return (
                    <button
                      key={v.socialAccountId}
                      onClick={() => setActiveTab(i)}
                      className={cn(
                        'group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                        active
                          ? 'border-transparent bg-foreground text-background shadow-sm'
                          : 'border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                      )}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: PROVIDER_TINT[v.provider] || 'currentColor' }}
                        aria-hidden
                      />
                      <span className="truncate max-w-[140px]">{v.displayName}</span>
                      <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation()
                          removeVariant(i)
                        }}
                        className={cn(
                          'ml-0.5 rounded-full p-0.5 transition-colors',
                          active
                            ? 'hover:bg-background/20 text-background/80'
                            : 'hover:bg-muted text-muted-foreground',
                        )}
                        aria-label={`Quitar ${v.displayName}`}
                      >
                        <X className="size-3" />
                      </span>
                    </button>
                  )
                })}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="sm" variant="outline" className="gap-1.5 rounded-full">
                      <Plus className="size-4" />
                      Red
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-60">
                    <DropdownMenuLabel>Agregar variante</DropdownMenuLabel>
                    {availableAccounts.length === 0 ? (
                      <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                        {accounts.length === 0 ? (
                          <>
                            No tenés cuentas conectadas.{' '}
                            <a href={`/${orgSlug}/connections`} className="underline">
                              Conectar →
                            </a>
                          </>
                        ) : (
                          'Ya agregaste todas tus cuentas.'
                        )}
                      </div>
                    ) : (
                      availableAccounts.map((account) => (
                        <DropdownMenuItem
                          key={account.id}
                          onSelect={() => addVariant(account)}
                          className="gap-2"
                        >
                          <span
                            className="size-2 rounded-full shrink-0"
                            style={{ backgroundColor: PROVIDER_TINT[account.provider] || 'currentColor' }}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {account.display_name || providerLabel(account.provider)}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">{account.provider}</p>
                          </div>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Editor de variante */}
              {currentVariant ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="outline" className="capitalize">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: PROVIDER_TINT[currentVariant.provider] || 'currentColor' }}
                        aria-hidden
                      />
                      {currentVariant.provider}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setAiOpen(true)}
                      className="gap-1.5"
                    >
                      <Sparkles className="size-3.5 text-primary" />
                      Generar con IA
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="content">Contenido</Label>
                    <Textarea
                      id="content"
                      value={currentVariant.content}
                      onChange={(e) => updateVariant(activeTab, 'content', e.target.value)}
                      rows={7}
                      maxLength={charLimit}
                      placeholder={`Escribí tu contenido para ${currentVariant.displayName}...`}
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Límite {charLimit.toLocaleString()} caracteres
                      </span>
                      <span className={cn('tabular-nums', charsOver ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                        {charsUsed} / {charLimit}
                      </span>
                    </div>
                  </div>

                  {/* Media uploader */}
                  <div className="rounded-lg border border-dashed border-input bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Media
                          {MEDIA_REQUIRED_PROVIDERS.has(currentVariant.provider) && (
                            <span className="ml-1 text-destructive" aria-label="requerido">
                              *
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, MP4 o MOV.</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingMedia}
                        loading={uploadingMedia}
                      >
                        {!uploadingMedia && <Upload className="size-4" />}
                        {uploadingMedia ? 'Subiendo' : 'Subir archivo'}
                      </Button>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) uploadMediaFiles(e.target.files)
                      }}
                    />
                    {currentVariant.media && currentVariant.media.length > 0 ? (
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {currentVariant.media.map((m, i) => (
                          <div
                            key={m.assetId}
                            className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                          >
                            {m.mediaType === 'image' ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.previewUrl} alt={m.name} className="size-full object-cover" />
                            ) : (
                              <video src={m.previewUrl} className="size-full object-cover" muted />
                            )}
                            <div className="absolute left-1.5 top-1.5 rounded-md bg-foreground/70 px-1.5 py-0.5 backdrop-blur-sm">
                              {m.mediaType === 'image' ? (
                                <ImageIcon className="size-3 text-background" />
                              ) : (
                                <VideoIcon className="size-3 text-background" />
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeMedia(activeTab, i)}
                              className="absolute right-1.5 top-1.5 rounded-md bg-background/90 p-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus:opacity-100"
                              aria-label="Quitar archivo"
                            >
                              <X className="size-3 text-foreground" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {MEDIA_REQUIRED_PROVIDERS.has(currentVariant.provider)
                          ? `${providerLabel(currentVariant.provider)} requiere al menos 1 imagen o video.`
                          : 'Sin archivos adjuntos todavía.'}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="hashtags">Hashtags</Label>
                      <Input
                        id="hashtags"
                        value={currentVariant.hashtags}
                        onChange={(e) => updateVariant(activeTab, 'hashtags', e.target.value)}
                        placeholder="ventas, ecommerce, kapi"
                      />
                      <p className="text-xs text-muted-foreground">Separados por coma. Sin el #.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="link">URL</Label>
                      <Input
                        id="link"
                        type="url"
                        value={currentVariant.linkUrl}
                        onChange={(e) => updateVariant(activeTab, 'linkUrl', e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
                  <div className="rounded-full bg-muted p-3">
                    <Plus className="size-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Aún no agregaste una red</p>
                    <p className="text-xs text-muted-foreground">
                      Tocá &ldquo;+ Red&rdquo; arriba para empezar a escribir.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Notas internas
                </Label>
                <Textarea
                  id="notes"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={2}
                  placeholder="Solo tu equipo las ve."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel derecho */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarIcon className="size-4 text-primary" />
                Programación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Dejá vacío para guardar como borrador.
              </p>
            </CardContent>
          </Card>

          {currentVariant && currentVariant.content && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="rounded-lg border-l-4 bg-muted/40 p-4"
                  style={{ borderLeftColor: PROVIDER_TINT[currentVariant.provider] || 'var(--border)' }}
                >
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {currentVariant.provider}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {currentVariant.content}
                  </p>
                  {currentVariant.hashtags && (
                    <p className="mt-2 text-sm text-primary">
                      {currentVariant.hashtags
                        .split(',')
                        .map((h) => `#${h.trim().replace(/^#/, '')}`)
                        .join(' ')}
                    </p>
                  )}
                  {currentVariant.linkUrl && (
                    <p className="mt-2 truncate text-xs text-muted-foreground">{currentVariant.linkUrl}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>No se pudo guardar</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Button
              size="lg"
              onClick={() => handleSave(false)}
              disabled={variants.length === 0}
              loading={saving}
              className="w-full"
            >
              {!saving && <Send className="size-4" />}
              {saving ? 'Guardando' : scheduledAt ? 'Programar post' : 'Guardar como borrador'}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => handleSave(true)}
              disabled={variants.length === 0 || saving}
              className="w-full"
            >
              <Save className="size-4" />
              Guardar borrador
            </Button>
          </div>
        </div>
      </div>

      {/* Modal IA */}
      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              Generar con IA {currentVariant && <span className="text-muted-foreground">· {currentVariant.displayName}</span>}
            </DialogTitle>
            <DialogDescription>
              Claude genera 3 variantes de copy ajustadas al límite y tono de la red elegida.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ai-topic">Tema o idea</Label>
              <Textarea
                id="ai-topic"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Ej: lanzamiento de nuestro servicio de consultoría para PyMEs..."
              />
            </div>

            <Button
              onClick={generateWithAI}
              disabled={aiTopic.trim().length < 3}
              loading={aiLoading}
              className="w-full"
              variant="gradient"
            >
              {!aiLoading && <Sparkles className="size-4" />}
              {aiLoading ? 'Generando con Claude' : 'Generar 3 variantes'}
            </Button>

            {aiSuggestions.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  {aiSuggestions.map((s, i) => (
                    <Card key={i} className="bg-muted/30">
                      <CardContent className="space-y-2 pt-4">
                        <div className="flex items-center justify-between">
                          <Badge variant="muted">Sugerencia {i + 1}</Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applyAISuggestion(s)}
                            className="gap-1.5"
                          >
                            <CheckCircle2 className="size-3.5" />
                            Usar
                          </Button>
                        </div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{s.content}</p>
                        {s.hashtags.length > 0 && (
                          <p className="text-xs text-primary">
                            {s.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
                          </p>
                        )}
                        {s.rationale && (
                          <p className="text-xs italic text-muted-foreground">
                            <span className="not-italic">💡</span> {s.rationale}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
