import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()

  // Si Supabase no esta configurado, mostrar landing
  if (!supabase) {
    return <LandingPage />
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Si tiene org, ir al dashboard de la primera
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <div className="mb-8 inline-flex items-center rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700">
          En desarrollo
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
          KAPI <span className="text-blue-600">Pulse</span>
        </h1>
        <p className="mt-6 text-xl leading-8 text-gray-600">
          Plataforma de gestion integral de redes sociales para PYMES y agencias en LatAm.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <FeatureCard
            title="Multi-red"
            description="Facebook, Instagram, LinkedIn, TikTok, WhatsApp y mas."
          />
          <FeatureCard
            title="IA Editorial"
            description="Genera contenido en espanol LatAm con perfiles de tono regionales."
          />
          <FeatureCard
            title="Alertas Telegram"
            description="Notificaciones inteligentes directamente en tu movil."
          />
        </div>

        <div className="mt-12 flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow-md hover:bg-blue-700 transition-colors"
          >
            Iniciar sesion
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Crear cuenta
          </Link>
        </div>

        <p className="mt-16 text-sm text-gray-400">
          KAPI Service Group - Ecuador
        </p>
      </div>
    </div>
  )
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
    </div>
  )
}
