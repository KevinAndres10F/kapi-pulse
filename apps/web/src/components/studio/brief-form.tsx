'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { uploadFileAsset } from '@/lib/studio/upload'

export interface Brief {
  product: string
  audience: string
  tone: string
  format: 'single' | 'carousel' | 'reel' | 'story'
  notes?: string
  referenceAssetIds?: string[]
}

const TONES = ['Profesional', 'Casual', 'Aspiracional', 'Divertido', 'Premium', 'Cercano']
const FORMATS: Array<{ value: Brief['format']; label: string }> = [
  { value: 'single', label: 'Foto única' },
  { value: 'carousel', label: 'Carrusel' },
  { value: 'reel', label: 'Reel / video' },
  { value: 'story', label: 'Story' },
]

export function BriefForm({
  orgId,
  initialBrief,
  onSubmit,
  submitLabel = 'Continuar',
}: {
  orgId: string
  initialBrief?: Partial<Brief>
  onSubmit: (brief: Brief) => Promise<void> | void
  submitLabel?: string
}) {
  const [brief, setBrief] = useState<Brief>({
    product: initialBrief?.product || '',
    audience: initialBrief?.audience || '',
    tone: initialBrief?.tone || 'Profesional',
    format: initialBrief?.format || 'single',
    notes: initialBrief?.notes || '',
    referenceAssetIds: initialBrief?.referenceAssetIds || [],
  })
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const { assetId } = await uploadFileAsset(orgId, file, 'reference')
        uploaded.push(assetId)
      }
      setBrief((b) => ({ ...b, referenceAssetIds: [...(b.referenceAssetIds || []), ...uploaded] }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!brief.product.trim()) {
      setError('Describe el producto antes de continuar')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(brief)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Producto / oferta <span className="text-red-500">*</span>
        </label>
        <textarea
          value={brief.product}
          onChange={(e) => setBrief({ ...brief, product: e.target.value })}
          rows={3}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Crema facial antioxidante con extracto de quinua. Empaque vidrio ámbar 50ml. Precio $39."
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Audiencia objetivo</label>
        <input
          value={brief.audience}
          onChange={(e) => setBrief({ ...brief, audience: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Mujeres 30-50 años, urbanas, interés en skincare natural"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Tono</label>
          <select
            value={brief.tone}
            onChange={(e) => setBrief({ ...brief, tone: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {TONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Formato</label>
          <select
            value={brief.format}
            onChange={(e) => setBrief({ ...brief, format: e.target.value as Brief['format'] })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Notas adicionales</label>
        <textarea
          value={brief.notes}
          onChange={(e) => setBrief({ ...brief, notes: e.target.value })}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Inspiración, claims a destacar, lo que NO querés mostrar..."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Imágenes de referencia (opcional)</label>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          disabled={uploading}
          onChange={(e) => handleFileChange(e.target.files)}
          className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
        />
        {uploading && (
          <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Subiendo...
          </p>
        )}
        {brief.referenceAssetIds && brief.referenceAssetIds.length > 0 && (
          <p className="mt-1 text-xs text-emerald-600">{brief.referenceAssetIds.length} referencia(s) subida(s).</p>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || uploading}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitLabel}
      </button>
    </form>
  )
}
