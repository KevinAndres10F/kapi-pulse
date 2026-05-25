import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  Megaphone,
  Sparkles,
} from 'lucide-react'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KapiLogo } from '@/components/auth/auth-shell'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()

  if (!supabase) {
    return <LandingPage />
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organizations(slug)')
    .eq('user_id', user.id)
    .limit(1)

  if (memberships && memberships.length > 0) {
    const org = memberships[0].organizations as unknown as { slug: string }
    redirect(`/${org.slug}/dashboard`)
  }

  redirect('/onboarding')
}

function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="absolute inset-0 -z-10 gradient-mesh-light" aria-hidden />

      <header className="flex items-center justify-between px-6 py-5">
        <KapiLogo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Iniciar sesión</Link>
          </Button>
          <Button asChild variant="gradient" size="sm">
            <Link href="/signup">Empezar gratis</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-6 py-12 sm:py-20">
        <section className="text-center">
          <Badge variant="muted" className="mb-6">
            <span className="size-1.5 rounded-full bg-success" />
            Beta · Ecuador
          </Badge>
          <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Tu equipo de social media,{' '}
            <span className="bg-gradient-to-r from-primary to-[oklch(0.55_0.22_290)] bg-clip-text text-transparent">
              en una sola plataforma
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            Programá posts, lanzá anuncios con aprobación de tu agencia, analizá métricas y recibí
            alertas inteligentes — todo desde un solo lugar.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="gradient" size="xl">
              <Link href="/signup">
                Empezar gratis
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="xl">
              <Link href="/login">Ya tengo cuenta</Link>
            </Button>
          </div>
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-success" />
              Sin tarjeta de crédito
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-success" />
              Setup en 5 minutos
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-success" />
              Soporte en español
            </li>
          </ul>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={Sparkles}
            title="Multi-red en un editor"
            description="Facebook, Instagram, LinkedIn, TikTok, X y más — adaptado al límite y tono de cada red."
          />
          <FeatureCard
            icon={Bot}
            title="IA editorial con Claude"
            description="Generá copy en español LatAm con perfiles de tono regionales que tu marca aprueba."
          />
          <FeatureCard
            icon={Megaphone}
            title="Anuncios con aprobación"
            description="Modelo agencia: tus clientes proponen, vos aprobás en Meta sin perder el control."
          />
          <FeatureCard
            icon={BarChart3}
            title="Analíticas en tiempo real"
            description="Métricas de posts y campañas en un dashboard que entendés sin un curso."
          />
          <FeatureCard
            icon={Bell}
            title="Alertas por Telegram"
            description="Notificaciones cuando se aprueba una campaña, falla un post o explota un anuncio."
          />
          <FeatureCard
            icon={CheckCircle2}
            title="RLS y multi-tenant"
            description="Cada org aislada por Supabase Row Level Security. Tus datos no se mezclan."
          />
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} KAPI Service Group · Ecuador ·{' '}
        <Link href="/privacy" className="hover:text-foreground">
          Privacidad
        </Link>{' '}
        ·{' '}
        <Link href="/terms" className="hover:text-foreground">
          Términos
        </Link>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <Card className="transition-all hover:border-foreground/20 hover:shadow-md">
      <CardHeader>
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <CardTitle className="mt-2">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  )
}
