'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check, AlertCircle } from 'lucide-react'
import { listAvatars, listVoices } from '@/lib/studio/api'

interface Avatar {
  id: string
  name: string
  previewUrl: string
  gender?: string
}

interface Voice {
  id: string
  name: string
  language: string
  previewUrl?: string
  gender?: string
}

export function AvatarSelector({
  orgId,
  selectedAvatarId,
  selectedVoiceId,
  onAvatarSelect,
  onVoiceSelect,
  onUnavailable,
}: {
  orgId: string
  selectedAvatarId: string | null
  selectedVoiceId: string | null
  onAvatarSelect: (id: string) => void
  onVoiceSelect: (id: string) => void
  onUnavailable?: (reason: string) => void
}) {
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [voices, setVoices] = useState<Voice[]>([])
  const [loading, setLoading] = useState(true)
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([listAvatars(orgId), listVoices(orgId, 'spanish')])
      .then(([a, v]) => {
        if (!mounted) return
        if (a.available === false) {
          const reason = a.reason || 'Provider de avatares no configurado'
          setUnavailableReason(reason)
          onUnavailable?.(reason)
          return
        }
        setAvatars(a.avatars)
        setVoices(v.voices)
      })
      .catch((err) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando avatares...
      </div>
    )
  }

  if (unavailableReason) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">Generación de avatar no disponible</p>
          <p className="text-xs text-amber-700">
            Para habilitar avatares UGC, configurá <code className="rounded bg-amber-100 px-1">HEYGEN_API_KEY</code> o{' '}
            <code className="rounded bg-amber-100 px-1">HEDRA_API_KEY</code> en el backend. Saltá este paso por ahora.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">No se pudo cargar el catálogo: {error}</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Avatar</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {avatars.slice(0, 24).map((a) => {
            const selected = selectedAvatarId === a.id
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onAvatarSelect(a.id)}
                className={`relative overflow-hidden rounded-lg border-2 transition ${
                  selected ? 'border-blue-600 ring-2 ring-blue-300' : 'border-border hover:border-gray-400'
                }`}
                title={a.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.previewUrl} alt={a.name} className="aspect-square w-full object-cover" />
                {selected && (
                  <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Voz</h3>
        <select
          value={selectedVoiceId || ''}
          onChange={(e) => onVoiceSelect(e.target.value)}
          className="w-full max-w-md rounded-lg border border-input px-3 py-2 text-sm"
        >
          <option value="">Selecciona una voz</option>
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.language}{v.gender ? ` · ${v.gender}` : ''})
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
