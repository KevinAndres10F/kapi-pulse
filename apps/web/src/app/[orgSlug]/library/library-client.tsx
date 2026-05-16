'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { listAssets, type JobAsset } from '@/lib/studio/api'

const KIND_FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'image', label: 'Imágenes' },
  { value: 'video', label: 'Videos' },
  { value: 'avatar_video', label: 'Avatares' },
  { value: 'copy_bundle', label: 'Copies' },
]

export function LibraryClient({ orgId }: { orgId: string }) {
  const [assets, setAssets] = useState<JobAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    listAssets(orgId, kind || undefined)
      .then((res) => {
        if (!mounted) return
        setAssets(res.assets)
      })
      .catch((err) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [orgId, kind])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {KIND_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setKind(f.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              kind === f.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </div>
      ) : error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : assets.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          Aún no hay assets. Generá tu primera campaña desde Studio.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {assets.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              {a.signed_url ? (
                a.kind === 'video' || a.kind === 'avatar_video' ? (
                  <video src={a.signed_url} controls className="aspect-square w-full bg-black" />
                ) : a.kind === 'copy_bundle' ? (
                  <div className="flex aspect-square items-center justify-center bg-blue-50 p-3 text-xs text-blue-700">
                    Bundle de copy (JSON)
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.signed_url} alt={a.kind} className="aspect-square w-full object-cover" />
                )
              ) : (
                <div className="aspect-square bg-gray-100" />
              )}
              <div className="border-t border-gray-200 p-2 text-xs">
                <p className="font-medium text-gray-900">{a.kind}</p>
                {a.duration_seconds && <p className="text-gray-500">{Number(a.duration_seconds).toFixed(1)}s</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
