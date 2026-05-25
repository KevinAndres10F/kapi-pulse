'use client'

import { Coins, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { fetchBalance, type CreditBalance } from '@/lib/studio/api'

export function CreditBadge({ orgId, balance: initialBalance }: { orgId: string; balance?: number }) {
  const [data, setData] = useState<CreditBalance | null>(
    initialBalance !== undefined ? { balance: initialBalance, totalGranted: 0, totalConsumed: 0, plan: null } : null,
  )
  const [loading, setLoading] = useState(initialBalance === undefined)

  useEffect(() => {
    let mounted = true
    if (initialBalance === undefined) {
      fetchBalance(orgId)
        .then((d) => {
          if (mounted) setData(d)
        })
        .catch((err) => console.warn('[credit-badge] balance fetch failed:', err))
        .finally(() => mounted && setLoading(false))
    }
    return () => {
      mounted = false
    }
  }, [orgId, initialBalance])

  const balance = data?.balance ?? 0
  const monthly = data?.plan?.monthly_credits ?? 0
  const isLow = monthly > 0 && balance < monthly * 0.1

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
        isLow
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-amber-200 bg-amber-50 text-amber-800'
      }`}
      title={data?.plan ? `Plan ${data.plan.name} · ${monthly}/mes` : undefined}
    >
      <Coins className="h-4 w-4" />
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>{balance.toLocaleString()} créditos</span>}
    </div>
  )
}
