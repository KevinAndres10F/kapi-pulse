'use client'

import { Loader2, AlertCircle } from 'lucide-react'
import type { JobAsset } from '@/lib/studio/api'

export function VideoPreview({
  asset,
  state,
  error,
  label,
}: {
  asset?: JobAsset
  state: 'idle' | 'queued' | 'running' | 'succeeded' | 'failed'
  error?: string
  label?: string
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-black">
      <div className="relative aspect-[9/16] w-full max-w-xs bg-gray-900 sm:max-w-sm">
        {state === 'succeeded' && asset?.signed_url ? (
          <video
            src={asset.signed_url}
            controls
            playsInline
            className="h-full w-full"
          />
        ) : state === 'failed' ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-red-300">
            <AlertCircle className="h-8 w-8" />
            <p className="text-xs">{error || 'Falló la generación'}</p>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-gray-300">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-xs">{state === 'running' ? 'Generando...' : 'En cola...'}</p>
          </div>
        )}
      </div>
      {label && <div className="border-t border-border bg-card p-2 text-xs text-muted-foreground">{label}</div>}
    </div>
  )
}
