import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Link2,
  Megaphone,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface DashboardPageProps {
  params: Promise<{ orgSlug: string }>
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { orgSlug } = await params
  const supabase = await createServerSupabaseClient()
  if (!supabase) redirect('/')

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('slug', orgSlug)
    .single()

  if (!org) redirect('/onboarding')

  const orgId = org.id
  const now = new Date()
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const [accountsRes, postsLast30, scheduledNext, draftsCount, activeCampaignsRes] = await Promise.all([
    supabase
      .from('social_accounts')
      .select('id, provider, display_name, avatar_url', { count: 'exact' })
      .eq('organization_id', orgId)
      .eq('status', 'active'),
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('published_at', last30d),
    supabase
      .from('posts')
      .select('id, title, status, scheduled_at')
      .eq('organization_id', orgId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', nextWeek)
      .order('scheduled_at', { ascending: true })
      .limit(5),
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'draft'),
    supabase
      .from('ad_campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .in('status', ['active', 'approved']),
  ])

  const accounts = accountsRes.data || []
  const connectedCount = accountsRes.count ?? 0
  const publishedCount = postsLast30.count ?? 0
  const scheduledPosts = scheduledNext.data || []
  const draftCount = draftsCount.count ?? 0
  const activeCampaigns = activeCampaignsRes.count ?? 0

  const hasAccounts = connectedCount > 0
  const hasPosts = publishedCount > 0 || draftCount > 0 || scheduledPosts.length > 0
  const stepsDone = (hasAccounts ? 1 : 0) + (hasPosts ? 1 : 0)

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8 gradient-mesh-light">
        <div className="relative">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Bienvenido de vuelta
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {org.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Tu centro de control para contenido, anuncios y analítica de redes sociales.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild variant="gradient" size="lg">
              <Link href={`/${orgSlug}/calendar/new`}>
                <Plus className="size-4" />
                Crear post
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={`/${orgSlug}/calendar`}>
                <Calendar className="size-4" />
                Ver calendario
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={Link2}
          label="Cuentas conectadas"
          value={connectedCount}
          tone="primary"
          href={`/${orgSlug}/connections`}
          cta={connectedCount === 0 ? 'Conectar primera red' : 'Gestionar'}
        />
        <KpiCard
          icon={TrendingUp}
          label="Publicados · 30d"
          value={publishedCount}
          tone="success"
        />
        <KpiCard
          icon={Calendar}
          label="Borradores"
          value={draftCount}
          tone="muted"
          href={`/${orgSlug}/calendar`}
          cta="Ver"
        />
        <KpiCard
          icon={Megaphone}
          label="Campañas activas"
          value={activeCampaigns}
          tone="primary"
          href={`/${orgSlug}/ads`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Próximos pasos */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Próximos pasos</CardTitle>
                <CardDescription>
                  {stepsDone} de 3 completados — terminá la configuración para empezar a publicar.
                </CardDescription>
              </div>
              <Badge variant={stepsDone === 3 ? 'success' : 'muted'}>
                {Math.round((stepsDone / 3) * 100)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Step
              done={hasAccounts}
              number={1}
              title="Conectá tu primera red social"
              description="Vinculá Facebook, Instagram, LinkedIn o cualquier red para empezar."
              href={`/${orgSlug}/connections`}
            />
            <Step
              done={hasPosts}
              number={2}
              title="Creá tu primer post"
              description="Programá o guardá un borrador con el editor multi-red."
              href={`/${orgSlug}/calendar/new`}
            />
            <Step
              done={false}
              number={3}
              title="Configurá alertas por Telegram"
              description="Recibí notificaciones de aprobaciones, lanzamientos y problemas."
              href={`/${orgSlug}/alerts`}
            />
          </CardContent>
        </Card>

        {/* Próximos posts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="size-4 text-primary" />
              Próximos 7 días
            </CardTitle>
            <CardDescription>
              {scheduledPosts.length === 0
                ? 'Sin posts programados.'
                : `${scheduledPosts.length} programado${scheduledPosts.length > 1 ? 's' : ''}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {scheduledPosts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
                <p>No tenés nada programado esta semana.</p>
                <Button asChild variant="link" className="mt-1 h-auto p-0 text-primary">
                  <Link href={`/${orgSlug}/calendar/new`}>Programar ahora →</Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {scheduledPosts.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/${orgSlug}/calendar`}
                      className="flex items-center gap-3 rounded-md p-2 -m-2 transition-colors hover:bg-accent"
                    >
                      <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-md bg-muted text-center">
                        <span className="text-[10px] font-medium uppercase text-muted-foreground">
                          {new Date(p.scheduled_at!).toLocaleDateString('es-EC', { month: 'short' })}
                        </span>
                        <span className="text-sm font-semibold leading-none text-foreground">
                          {new Date(p.scheduled_at!).getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {p.title || 'Sin título'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.scheduled_at!).toLocaleTimeString('es-EC', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cuentas conectadas + Quick actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-primary" />
              Cuentas conectadas
            </CardTitle>
            <CardDescription>
              {accounts.length === 0
                ? 'Aún no conectaste ninguna red.'
                : `${accounts.length} red${accounts.length > 1 ? 'es' : ''} activa${accounts.length > 1 ? 's' : ''}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <Button asChild>
                <Link href={`/${orgSlug}/connections`}>
                  <Link2 className="size-4" />
                  Conectar primera red
                </Link>
              </Button>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {accounts.slice(0, 8).map((acc) => (
                  <li
                    key={acc.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold uppercase text-muted-foreground">
                      {acc.provider.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {acc.display_name || acc.provider}
                      </p>
                      <p className="truncate text-xs text-muted-foreground capitalize">{acc.provider}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              Acciones rápidas
            </CardTitle>
            <CardDescription>Lo más usado, a un click.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <QuickAction href={`/${orgSlug}/studio/new`} icon={Sparkles} label="Studio IA" />
            <QuickAction href={`/${orgSlug}/ads/new`} icon={Megaphone} label="Nuevo anuncio" />
            <QuickAction href={`/${orgSlug}/analytics`} icon={TrendingUp} label="Analíticas" />
            <QuickAction href={`/${orgSlug}/library`} icon={Calendar} label="Librería" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
  href,
  cta,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  tone: 'primary' | 'success' | 'muted'
  href?: string
  cta?: string
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-primary/10 text-primary'
      : tone === 'success'
        ? 'bg-success/10 text-success'
        : 'bg-muted text-muted-foreground'

  const content = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className={`flex size-9 items-center justify-center rounded-lg ${toneClass}`}>
          <Icon className="size-4" />
        </span>
        {href && <ArrowRight className="size-4 text-muted-foreground" />}
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
        {cta && <p className="mt-1 text-xs text-primary">{cta}</p>}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="group block rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {content}
      </Link>
    )
  }

  return <div className="rounded-xl border border-border bg-card p-5 shadow-sm">{content}</div>
}

function Step({
  done,
  number,
  title,
  description,
  href,
}: {
  done: boolean
  number: number
  title: string
  description: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-md p-2 -m-2 transition-colors hover:bg-accent"
    >
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
          done
            ? 'bg-success text-success-foreground'
            : 'bg-muted text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground'
        }`}
      >
        {done ? <CheckCircle2 className="size-4" /> : number}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm font-medium ${done ? 'text-muted-foreground line-through' : 'text-foreground'}`}
        >
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  )
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card px-3 py-4 text-center transition-all hover:border-foreground/20 hover:bg-accent"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="size-4" />
      </span>
      <span className="text-xs font-medium text-foreground">{label}</span>
    </Link>
  )
}
