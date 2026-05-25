'use client'

import { useEffect, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'

import { cn } from '@/lib/utils'
import { listAssets, type JobAsset } from '@/lib/studio/api'
import { createClient } from '@/lib/supabase/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'

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
    const controller = new AbortController()
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const supabase = createClient()
        const { data } = (await supabase.auth.getSession()) as { data: { session: Session | null } }
        if (controller.signal.aborted) return
        const res = await listAssets(orgId, kind || undefined, data.session?.access_token)
        if (controller.signal.aborted) return
        setAssets(res.assets)
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()

    return () => controller.abort()
  }, [orgId, kind])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {KIND_FILTERS.map((f) => {
          const active = kind === f.value
          return (
            <button
              key={f.value || 'all'}
              onClick={() => setKind(f.value)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm font-medium transition-all',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-foreground hover:border-primary/40',
              )}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando…
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : assets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <FileText className="size-6 text-primary" />
            </span>
            <p className="text-sm text-muted-foreground">
              Aún no hay assets. Generá tu primera campaña desde Studio.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {assets.map((a) => (
            <li
              key={a.id}
              className="overflow-hidden rounded-xl border border-border bg-card transition-all hover:shadow-md"
            >
              {a.signed_url ? (
                a.kind === 'video' || a.kind === 'avatar_video' ? (
                  <video src={a.signed_url} controls className="aspect-square w-full bg-black" />
                ) : a.kind === 'copy_bundle' ? (
                  <div className="flex aspect-square items-center justify-center bg-primary/10 p-3 text-center text-xs font-medium text-primary">
                    Bundle de copy
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.signed_url}
                    alt={a.kind}
                    className="aspect-square w-full object-cover"
                  />
                )
              ) : (
                <div className="aspect-square bg-muted" />
              )}
              <div className="border-t border-border p-2 text-xs">
                <p className="font-medium capitalize text-foreground">
                  {a.kind.replace(/_/g, ' ')}
                </p>
                {a.duration_seconds && (
                  <p className="text-muted-foreground tabular-nums">
                    {Number(a.duration_seconds).toFixed(1)}s
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
