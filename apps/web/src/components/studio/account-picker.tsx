'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { listSocialAccounts } from '@/lib/studio/api'

interface Account {
  id: string
  provider: string
  display_name: string
  avatar_url: string | null
  status: string
}

export function AccountPicker({
  orgId,
  selectedIds,
  onChange,
  filterProviders,
}: {
  orgId: string
  selectedIds: Set<string>
  onChange: (ids: Set<string>) => void
  filterProviders?: string[]
}) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    listSocialAccounts(orgId)
      .then((res) => {
        if (!mounted) return
        const filtered = filterProviders
          ? res.accounts.filter((a) => filterProviders.includes(a.provider))
          : res.accounts
        setAccounts(filtered.filter((a) => a.status === 'active'))
      })
      .catch((err) => console.warn('[account-picker] fetch failed:', err))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [orgId, filterProviders?.join(',')])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Cargando cuentas...
      </div>
    )
  }

  if (accounts.length === 0) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        No tienes cuentas {filterProviders?.join(' / ')} conectadas. Conéctalas en{' '}
        <span className="font-medium">Conexiones</span>.
      </p>
    )
  }

  function toggle(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  return (
    <ul className="space-y-1">
      {accounts.map((a) => {
        const selected = selectedIds.has(a.id)
        return (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => toggle(a.id)}
              className={`flex w-full items-center gap-3 rounded-lg border-2 px-3 py-2 text-left text-sm transition ${
                selected ? 'border-blue-600 bg-primary/10' : 'border-border hover:border-gray-400'
              }`}
            >
              {a.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.avatar_url} alt={a.display_name} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                  {a.display_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{a.display_name}</p>
                <p className="text-xs text-muted-foreground">{a.provider}</p>
              </div>
              {selected && <span className="text-xs font-semibold text-primary">Seleccionada</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
