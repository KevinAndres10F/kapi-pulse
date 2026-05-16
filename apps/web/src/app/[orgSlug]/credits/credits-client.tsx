'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { fetchHistory, fetchPricing } from '@/lib/studio/api'

interface Tx {
  id: string
  type: string
  amount: number
  balance_after: number
  reason: string
  created_at: string
}

interface Price {
  operation: string
  model: string
  credits_per_unit: number
  notes?: string
}

const TYPE_LABEL: Record<string, { label: string; color: string }> = {
  grant: { label: 'Asignación', color: 'text-emerald-700' },
  consume: { label: 'Consumo', color: 'text-red-700' },
  refund: { label: 'Reembolso', color: 'text-blue-700' },
  plan_renewal: { label: 'Renovación', color: 'text-emerald-700' },
  admin_adjust: { label: 'Ajuste', color: 'text-amber-700' },
}

export function CreditsClient({
  orgId,
  balance,
  totalGranted,
  totalConsumed,
  plan,
}: {
  orgId: string
  balance: number
  totalGranted: number
  totalConsumed: number
  plan: { code: string; name: string; monthly_credits: number; bonus_credits: number } | null
}) {
  const [tab, setTab] = useState<'history' | 'pricing'>('history')
  const [transactions, setTransactions] = useState<Tx[]>([])
  const [pricing, setPricing] = useState<Price[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchHistory(orgId, 100), fetchPricing()])
      .then(([h, p]) => {
        setTransactions(h.transactions)
        setPricing(p.pricing)
      })
      .catch((err) => console.warn('[credits] load failed:', err))
      .finally(() => setLoading(false))
  }, [orgId])

  const monthlyPct = plan?.monthly_credits ? Math.min(100, (totalConsumed / plan.monthly_credits) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium text-amber-700">Balance actual</p>
          <p className="mt-1 text-3xl font-bold text-amber-900">{balance.toLocaleString()}</p>
          <p className="mt-1 text-xs text-amber-700">créditos disponibles</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Plan</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{plan?.name || 'Free'}</p>
          <p className="mt-1 text-xs text-gray-500">{plan?.monthly_credits || 0} créditos/mes</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Otorgados</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{totalGranted.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Consumidos</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totalConsumed.toLocaleString()}</p>
          {plan?.monthly_credits && (
            <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${monthlyPct}%` }} />
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'history' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500'
          }`}
        >
          Historial
        </button>
        <button
          onClick={() => setTab('pricing')}
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'pricing' ? 'border-b-2 border-blue-600 text-blue-700' : 'text-gray-500'
          }`}
        >
          Precios
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
        </div>
      ) : tab === 'history' ? (
        transactions.length === 0 ? (
          <p className="text-sm text-gray-500">Sin transacciones todavía.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Razón</th>
                  <th className="px-4 py-2 text-right">Cantidad</th>
                  <th className="px-4 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((t) => {
                  const meta = TYPE_LABEL[t.type] || { label: t.type, color: 'text-gray-700' }
                  return (
                    <tr key={t.id}>
                      <td className="px-4 py-2 text-xs text-gray-500">{new Date(t.created_at).toLocaleString()}</td>
                      <td className={`px-4 py-2 text-xs font-medium ${meta.color}`}>{meta.label}</td>
                      <td className="px-4 py-2 text-xs text-gray-700">{t.reason}</td>
                      <td className={`px-4 py-2 text-right font-mono text-xs ${t.amount < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {t.amount > 0 ? '+' : ''}
                        {t.amount}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-gray-900">{t.balance_after}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Operación</th>
                <th className="px-4 py-2">Modelo</th>
                <th className="px-4 py-2 text-right">Créditos</th>
                <th className="px-4 py-2">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pricing.map((p) => (
                <tr key={p.operation}>
                  <td className="px-4 py-2 font-medium text-gray-900">{p.operation}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">{p.model}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-gray-900">{p.credits_per_unit}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{p.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
