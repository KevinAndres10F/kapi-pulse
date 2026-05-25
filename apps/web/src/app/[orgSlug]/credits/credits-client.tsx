'use client'

import { useEffect, useState } from 'react'
import { Loader2, TrendingDown, TrendingUp, Wallet } from 'lucide-react'

import { fetchHistory, fetchPricing } from '@/lib/studio/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

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

const TYPE_VARIANT: Record<string, { label: string; variant: 'success' | 'destructive' | 'default' | 'warning' | 'muted' }> = {
  grant: { label: 'Asignación', variant: 'success' },
  consume: { label: 'Consumo', variant: 'destructive' },
  refund: { label: 'Reembolso', variant: 'default' },
  plan_renewal: { label: 'Renovación', variant: 'success' },
  admin_adjust: { label: 'Ajuste', variant: 'warning' },
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

  const monthlyPct = plan?.monthly_credits
    ? Math.min(100, (totalConsumed / plan.monthly_credits) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden">
          <CardContent className="space-y-3 pt-5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-warning/15 text-warning-foreground">
              <Wallet className="size-4" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Balance actual
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">
                {balance.toLocaleString()}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">créditos disponibles</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Badge variant="default" className="bg-primary text-primary-foreground px-1.5 py-0">
                P
              </Badge>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Plan</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{plan?.name || 'Free'}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {plan?.monthly_credits || 0} créditos/mes
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-success/10 text-success">
              <TrendingUp className="size-4" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Otorgados
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-success">
                {totalGranted.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <TrendingDown className="size-4" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Consumidos
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {totalConsumed.toLocaleString()}
              </p>
              {plan?.monthly_credits && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      monthlyPct > 85 ? 'bg-destructive' : monthlyPct > 60 ? 'bg-warning' : 'bg-primary',
                    )}
                    style={{ width: `${monthlyPct}%` }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Historial</TabsTrigger>
          <TabsTrigger value="pricing">Precios</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando…
            </div>
          ) : transactions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Sin transacciones todavía.
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Fecha</th>
                      <th className="px-4 py-3 font-semibold">Tipo</th>
                      <th className="px-4 py-3 font-semibold">Razón</th>
                      <th className="px-4 py-3 text-right font-semibold">Cantidad</th>
                      <th className="px-4 py-3 text-right font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((t) => {
                      const meta = TYPE_VARIANT[t.type] || { label: t.type, variant: 'muted' as const }
                      return (
                        <tr key={t.id} className="hover:bg-accent/50">
                          <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
                            {new Date(t.created_at).toLocaleString('es-EC', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-foreground">{t.reason}</td>
                          <td
                            className={cn(
                              'px-4 py-2.5 text-right font-mono text-xs tabular-nums',
                              t.amount < 0 ? 'text-destructive' : 'text-success',
                            )}
                          >
                            {t.amount > 0 ? '+' : ''}
                            {t.amount}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-foreground">
                            {t.balance_after}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pricing">
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Operación</th>
                    <th className="px-4 py-3 font-semibold">Modelo</th>
                    <th className="px-4 py-3 text-right font-semibold">Créditos</th>
                    <th className="px-4 py-3 font-semibold">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pricing.map((p) => (
                    <tr key={p.operation} className="hover:bg-accent/50">
                      <td className="px-4 py-2.5 font-medium capitalize text-foreground">
                        {p.operation.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.model}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-foreground">
                        {p.credits_per_unit}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.notes || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
