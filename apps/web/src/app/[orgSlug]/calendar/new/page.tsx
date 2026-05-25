'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { Send, Save, ArrowLeft, Plus, X, Sparkles, Loader2, Upload, Image as ImageIcon, Video as VideoIcon } from 'lucide-react'

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

// Redes que requieren al menos 1 media para publicar
const MEDIA_REQUIRED_PROVIDERS = new Set(['instagram', 'tiktok'])
const VIDEO_EXTS = new Set(['mp4', 'mov'])
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp'])

const PROVIDER_COLORS: Record<string, string> = {
  facebook: 'border-blue-500 bg-blue-50',
  instagram: 'border-pink-500 bg-pink-50',
  linkedin: 'border-blue-700 bg-blue-50',
  tiktok: 'border-gray-800 bg-gray-50',
  x: 'border-gray-900 bg-gray-50',
  youtube: 'border-red-600 bg-red-50',
  threads: 'border-gray-600 bg-gray-50',
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
  const [networkPickerOpen, setNetworkPickerOpen] = useState(false)
  const networkPickerRef = useRef<HTMLDivElement | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!networkPickerOpen) return
    function onPointerDown(e: PointerEvent) {
      if (!networkPickerRef.current?.contains(e.target as Node)) {
        setNetworkPickerOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [networkPickerOpen])

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
        setError('Sesión no válida. Recarga la página.')
        return
      }
      const newMedia: MediaItem[] = []
      for (const file of list) {
        const extRaw = (file.name.split('.').pop() || '').toLowerCase()
        const ext = extRaw === 'jpg' ? 'jpg' : extRaw
        if (!IMAGE_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) {
          setError(`Tipo no soportado: ${file.name}. Usa png/jpg/jpeg/webp/mp4/mov.`)
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
          setError(body.error || `Error iniciando upload de ${file.name}`)
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
          setError(`Error subiendo ${file.name}`)
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
          updated[activeTab] = { ...updated[activeTab], media: [...(updated[activeTab].media || []), ...newMedia] }
          return updated
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error subiendo media')
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
    } catch {
      // silent — el modal queda con suggestions vacío
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
  }

  const loadAccounts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: org } = await supabase.from('organizations').select('id').eq('slug', orgSlug).single()
    if (!org) return
    setOrgId(org.id)

    const { data } = await supabase
      .from('social_accounts')
      .select('id, provider, display_name, avatar_url, status')
      .eq('organization_id', org.id)
      .eq('status', 'active')

    if (data) setAccounts(data)
  }, [supabase, orgSlug])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  function addVariant(account: SocialAccount) {
    setNetworkPickerOpen(false)
    if (variants.find((v) => v.socialAccountId === account.id)) return
    setVariants([...variants, {
      socialAccountId: account.id,
      provider: account.provider,
      displayName: account.display_name || account.provider,
      content: '',
      hashtags: '',
      linkUrl: '',
      media: [],
    }])
    setActiveTab(variants.length)
  }

  function removeVariant(index: number) {
    setVariants(variants.filter((_, i) => i !== index))
    if (activeTab >= variants.length - 1) setActiveTab(Math.max(0, variants.length - 2))
  }

  function updateVariant(index: number, field: keyof Variant, value: string) {
    const updated = [...variants]
    updated[index] = { ...updated[index], [field]: value }
    setVariants(updated)
  }

  async function handleSave(asDraft: boolean) {
    if (variants.length === 0) {
      setError('Agrega al menos una red social.')
      return
    }

    if (variants.some((v) => !v.content.trim())) {
      setError('Todas las variantes deben tener contenido.')
      return
    }

    const missingMedia = variants.find((v) => MEDIA_REQUIRED_PROVIDERS.has(v.provider) && (v.media?.length ?? 0) === 0)
    if (missingMedia) {
      setError(`${missingMedia.provider} requiere al menos una imagen o video. Súbelo en la pestaña correspondiente.`)
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
        hashtags: v.hashtags ? v.hashtags.split(',').map((h) => h.trim()).filter(Boolean) : [],
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

      router.push(`/${orgSlug}/calendar`)
    } catch {
      setError('Error de conexion con el servidor.')
      setSaving(false)
    }
  }

  const currentVariant = variants[activeTab]
  const charLimit = currentVariant ? CHAR_LIMITS[currentVariant.provider] || 5000 : 5000

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="rounded-lg p-2 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nuevo post</h1>
          <p className="text-gray-600">Crea contenido para una o varias redes sociales.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Panel izquierdo: editor */}
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titulo interno (opcional)"
              className="w-full text-lg font-semibold border-0 border-b border-gray-200 pb-2 focus:outline-none focus:border-blue-500"
            />

            {/* Tabs por red social */}
            <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
              {variants.map((v, i) => (
                <button
                  key={v.socialAccountId}
                  onClick={() => setActiveTab(i)}
                  className={`flex items-center gap-1.5 rounded-t-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                    activeTab === i
                      ? `border-b-2 ${PROVIDER_COLORS[v.provider]?.split(' ')[0] || 'border-blue-500'} text-gray-900`
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {v.displayName}
                  <button onClick={(e) => { e.stopPropagation(); removeVariant(i) }} className="ml-1 rounded-full p-0.5 hover:bg-gray-200">
                    <X className="h-3 w-3" />
                  </button>
                </button>
              ))}
              {/* Dropdown para agregar red */}
              <div className="relative" ref={networkPickerRef}>
                <button
                  type="button"
                  onClick={() => setNetworkPickerOpen((v) => !v)}
                  aria-expanded={networkPickerOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
                >
                  <Plus className="h-4 w-4" /> Red
                </button>
                {networkPickerOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-full z-10 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                  >
                    {accounts.filter((a) => !variants.find((v) => v.socialAccountId === a.id)).map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => addVariant(account)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {account.display_name || account.provider}
                        <span className="text-xs text-gray-400">({account.provider})</span>
                      </button>
                    ))}
                    {accounts.length === 0 && (
                      <p className="px-3 py-2 text-xs text-gray-400">Sin cuentas conectadas</p>
                    )}
                    {accounts.length > 0 && accounts.every((a) => variants.find((v) => v.socialAccountId === a.id)) && (
                      <p className="px-3 py-2 text-xs text-gray-400">Ya agregaste todas tus cuentas.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Editor de la variante activa */}
            {currentVariant ? (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <button
                    onClick={() => setAiOpen(true)}
                    type="button"
                    className="flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Generar con IA
                  </button>
                </div>
                <div>
                  <textarea
                    value={currentVariant.content}
                    onChange={(e) => updateVariant(activeTab, 'content', e.target.value)}
                    rows={6}
                    maxLength={charLimit}
                    placeholder={`Escribe tu contenido para ${currentVariant.displayName}...`}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>{currentVariant.provider} — limite {charLimit.toLocaleString()} caracteres</span>
                    <span className={currentVariant.content.length > charLimit * 0.9 ? 'text-red-500' : ''}>
                      {currentVariant.content.length}/{charLimit}
                    </span>
                  </div>
                </div>

                {/* Media uploader */}
                <div className="rounded-lg border border-dashed border-gray-300 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-600">
                      Media {MEDIA_REQUIRED_PROVIDERS.has(currentVariant.provider) && <span className="text-red-500">*</span>}
                      <span className="ml-1 text-gray-400">(imágenes y videos)</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingMedia}
                      className="flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                      {uploadingMedia ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                      {uploadingMedia ? 'Subiendo...' : 'Subir archivo'}
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
                    multiple
                    className="hidden"
                    onChange={(e) => { if (e.target.files) uploadMediaFiles(e.target.files) }}
                  />
                  {currentVariant.media && currentVariant.media.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {currentVariant.media.map((m, i) => (
                        <div key={m.assetId} className="relative aspect-square rounded-md border border-gray-200 bg-gray-50 overflow-hidden">
                          {m.mediaType === 'image' ? (
                            <img src={m.previewUrl} alt={m.name} className="h-full w-full object-cover" />
                          ) : (
                            <video src={m.previewUrl} className="h-full w-full object-cover" muted />
                          )}
                          <div className="absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                            {m.mediaType === 'image' ? <ImageIcon className="inline h-3 w-3" /> : <VideoIcon className="inline h-3 w-3" />}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMedia(activeTab, i)}
                            className="absolute top-1 right-1 rounded-full bg-white/90 p-0.5 shadow hover:bg-white"
                          >
                            <X className="h-3 w-3 text-gray-700" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">
                      {MEDIA_REQUIRED_PROVIDERS.has(currentVariant.provider)
                        ? `${currentVariant.provider} requiere al menos 1 imagen o video`
                        : 'Sin archivos. Acepta png, jpg, webp, mp4, mov.'}
                    </p>
                  )}
                </div>

                <input
                  type="text"
                  value={currentVariant.hashtags}
                  onChange={(e) => updateVariant(activeTab, 'hashtags', e.target.value)}
                  placeholder="Hashtags (separados por coma)"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />

                <input
                  type="url"
                  value={currentVariant.linkUrl}
                  onChange={(e) => updateVariant(activeTab, 'linkUrl', e.target.value)}
                  placeholder="URL (opcional)"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            ) : (
              <div className="py-12 text-center text-gray-400">
                <p>Selecciona una red social para empezar a crear contenido.</p>
              </div>
            )}
          </div>

          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            rows={2}
            placeholder="Notas internas (solo tu equipo las ve)"
            className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Panel derecho: programacion y acciones */}
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Programacion</h3>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <p className="text-xs text-gray-400">
              Deja vacio para guardar como borrador.
            </p>
          </div>

          {/* Preview */}
          {currentVariant && currentVariant.content && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
              <h3 className="font-semibold text-gray-900">Preview</h3>
              <div className={`rounded-lg border-l-4 p-4 ${PROVIDER_COLORS[currentVariant.provider] || 'border-gray-300 bg-gray-50'}`}>
                <p className="text-xs font-semibold text-gray-500 mb-2">{currentVariant.provider.toUpperCase()}</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{currentVariant.content}</p>
                {currentVariant.hashtags && (
                  <p className="mt-2 text-sm text-blue-600">
                    {currentVariant.hashtags.split(',').map((h) => `#${h.trim()}`).join(' ')}
                  </p>
                )}
                {currentVariant.linkUrl && (
                  <p className="mt-1 text-xs text-gray-400 truncate">{currentVariant.linkUrl}</p>
                )}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="space-y-2">
            <button
              onClick={() => handleSave(false)}
              disabled={saving || variants.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {saving ? 'Guardando...' : scheduledAt ? 'Programar post' : 'Guardar como borrador'}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving || variants.length === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Guardar borrador
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Generar con IA */}
      {aiOpen && currentVariant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                Generar con IA para {currentVariant.displayName}
              </h3>
              <button onClick={() => setAiOpen(false)} className="rounded p-1 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Tema o idea del post</label>
                <textarea
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Ej: Lanzamiento de nuestro nuevo servicio de consultoría para PyMEs..."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <button
                onClick={generateWithAI}
                disabled={aiLoading || aiTopic.trim().length < 3}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {aiLoading ? 'Generando con Claude...' : 'Generar 3 variantes'}
              </button>

              {aiSuggestions.map((s, i) => (
                <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-500">Sugerencia {i + 1}</p>
                  <p className="whitespace-pre-wrap text-sm text-gray-900">{s.content}</p>
                  {s.hashtags.length > 0 && (
                    <p className="text-xs text-blue-600">
                      {s.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}
                    </p>
                  )}
                  <p className="text-xs italic text-gray-500">💡 {s.rationale}</p>
                  <button
                    onClick={() => applyAISuggestion(s)}
                    className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Usar este texto
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
