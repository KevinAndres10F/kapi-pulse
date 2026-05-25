'use client'

import { Check, Loader2 } from 'lucide-react'
import type { JobAsset } from '@/lib/studio/api'

export function ImageGrid({
  assets,
  selectedIds,
  onToggle,
  loading,
  expectedCount,
}: {
  assets: JobAsset[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  loading?: boolean
  expectedCount?: number
}) {
  const placeholders = loading ? Array.from({ length: expectedCount || 4 }) : []

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {assets.map((a) => {
        const selected = selectedIds.has(a.id)
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onToggle(a.id)}
            className={`relative aspect-square overflow-hidden rounded-xl border-2 transition ${
              selected ? 'border-blue-600 ring-2 ring-blue-300' : 'border-border hover:border-gray-400'
            }`}
          >
            {a.signed_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.signed_url} alt={a.kind} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted/40 text-xs text-muted-foreground">sin preview</div>
            )}
            {selected && (
              <div className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white shadow">
                <Check className="h-4 w-4" />
              </div>
            )}
          </button>
        )
      })}
      {placeholders.map((_, i) => (
        <div
          key={`ph-${i}`}
          className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-input bg-muted/40"
        >
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ))}
    </div>
  )
}
