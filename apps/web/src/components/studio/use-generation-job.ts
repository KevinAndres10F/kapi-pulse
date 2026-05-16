'use client'

import { useEffect, useState } from 'react'
import { subscribeJob, type JobAsset } from '@/lib/studio/api'

export type JobState = 'idle' | 'queued' | 'running' | 'succeeded' | 'failed'

export interface JobProgress {
  state: JobState
  assets: JobAsset[]
  error?: string
}

/**
 * Subscribes to a generation job via SSE and surfaces status + assets.
 * Pass `jobId=null` to remain idle (no subscription).
 */
export function useGenerationJob(jobId: string | null, orgId: string): JobProgress {
  const [state, setState] = useState<JobState>('idle')
  const [assets, setAssets] = useState<JobAsset[]>([])
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    if (!jobId) {
      setState('idle')
      setAssets([])
      setError(undefined)
      return
    }

    setState('queued')
    setAssets([])
    setError(undefined)

    const es = subscribeJob(jobId, orgId, (ev) => {
      if (ev.event === 'status') {
        if (ev.status === 'running') setState('running')
        else if (ev.status === 'reserved' || ev.status === 'pending') setState('queued')
      } else if (ev.event === 'completed') {
        setAssets(ev.assets || [])
        setState('succeeded')
        es.close()
      } else if (ev.event === 'failed') {
        setError(ev.error)
        setState('failed')
        es.close()
      } else if (ev.event === 'error') {
        setError(ev.message)
        setState('failed')
        es.close()
      }
    })

    es.onerror = () => {
      // Connection drop; let server-side polling continue if reconnect
    }

    return () => {
      es.close()
    }
  }, [jobId, orgId])

  return { state, assets, error }
}
