'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check } from 'lucide-react'
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
}: {
  orgId: string
  selectedAvatarId: string | null
  selectedVoiceId: string | null
  onAvatarSelect: (id: string) => void
  onVoiceSelect: (id: string) => void
}) {
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [voices, setVoices] = useState<Voice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([listAvatars(orgId), listVoices(orgId, 'spanish')])
      .then(([a, v]) => {
        if (!mounted) return
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
  }, [orgId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando avatares HeyGen...
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-600">No se pudo cargar el catálogo: {error}</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Avatar</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {avatars.slice(0, 24).map((a) => {
            const selected = selectedAvatarId === a.id
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onAvatarSelect(a.id)}
                className={`relative overflow-hidden rounded-lg border-2 transition ${
                  selected ? 'border-blue-600 ring-2 ring-blue-300' : 'border-gray-200 hover:border-gray-400'
                }`}
                title={a.name}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.previewUrl} alt={a.name} className="aspect-square w-full object-cover" />
                {selected && (
                  <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Voz</h3>
        <select
          value={selectedVoiceId || ''}
          onChange={(e) => onVoiceSelect(e.target.value)}
          className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
