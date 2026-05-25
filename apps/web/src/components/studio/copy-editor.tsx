'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export interface CopyVariant {
  platform: string
  content: string
  hashtags: string[]
  cta?: string
  rationale?: string
}

const PLATFORM_LIMITS: Record<string, number> = {
  linkedin: 3000,
  facebook: 500,
  instagram: 2200,
  x: 280,
  tiktok: 2200,
  threads: 500,
  youtube: 5000,
}

export function CopyEditor({
  variants,
  onChange,
}: {
  variants: CopyVariant[]
  onChange: (variants: CopyVariant[]) => void
}) {
  const [activeIdx, setActiveIdx] = useState(0)

  if (variants.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay copy generado todavía.</p>
  }

  const active = variants[activeIdx]
  const limit = PLATFORM_LIMITS[active.platform] || 2200

  function updateActive(patch: Partial<CopyVariant>) {
    const next = [...variants]
    next[activeIdx] = { ...active, ...patch }
    onChange(next)
  }

  function removeHashtag(tag: string) {
    updateActive({ hashtags: active.hashtags.filter((h) => h !== tag) })
  }

  function addHashtag(input: string) {
    const cleaned = input.replace(/^#/, '').trim()
    if (!cleaned) return
    if (active.hashtags.includes(cleaned)) return
    updateActive({ hashtags: [...active.hashtags, cleaned] })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-border">
        {variants.map((v, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveIdx(idx)}
            className={`px-3 py-2 text-sm font-medium ${
              idx === activeIdx
                ? 'border-b-2 border-blue-600 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {v.platform}
          </button>
        ))}
      </div>

      <div>
        <textarea
          value={active.content}
          onChange={(e) => updateActive({ content: e.target.value })}
          rows={6}
          className="w-full rounded-lg border border-input px-3 py-2 text-sm"
        />
        <p
          className={`mt-1 text-xs ${
            active.content.length > limit ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          {active.content.length} / {limit}
        </p>
      </div>

      {active.cta && (
        <div>
          <label className="mb-1 block text-xs font-semibold text-foreground">CTA</label>
          <input
            value={active.cta}
            onChange={(e) => updateActive({ cta: e.target.value })}
            className="w-full rounded-lg border border-input px-3 py-2 text-sm"
          />
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-semibold text-foreground">Hashtags</label>
        <div className="mb-2 flex flex-wrap gap-1">
          {active.hashtags.map((h) => (
            <span
              key={h}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary"
            >
              #{h}
              <button
                type="button"
                onClick={() => removeHashtag(h)}
                className="text-blue-500 hover:text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <input
          placeholder="Añadir hashtag y presiona Enter"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addHashtag((e.target as HTMLInputElement).value)
              ;(e.target as HTMLInputElement).value = ''
            }
          }}
          className="w-full rounded-lg border border-input px-3 py-2 text-xs"
        />
      </div>

      {active.rationale && (
        <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs italic text-muted-foreground">
          {active.rationale}
        </p>
      )}
    </div>
  )
}
