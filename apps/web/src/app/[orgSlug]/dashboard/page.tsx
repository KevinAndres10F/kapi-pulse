import { createServerSupabaseClient } from '@/lib/supabase/server'

interface DashboardPageProps {
  params: Promise<{ orgSlug: string }>
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { orgSlug } = await params
  const supabase = await createServerSupabaseClient()

  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('slug', orgSlug)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Dashboard — {org?.name}
        </h1>
        <p className="mt-1 text-gray-600">
          Bienvenido a tu centro de control de redes sociales.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardCard title="Seguidores" value="—" change="" />
        <DashboardCard title="Engagement" value="—" change="" />
        <DashboardCard title="Publicaciones" value="0" change="este mes" />
        <DashboardCard title="Cuentas conectadas" value="0" change="" />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Próximos pasos</h2>
        <ul className="mt-4 space-y-3">
          <li className="flex items-center gap-3 text-gray-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">1</span>
            Conecta tu primera red social
          </li>
          <li className="flex items-center gap-3 text-gray-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">2</span>
            Crea y programa tu primer post
          </li>
          <li className="flex items-center gap-3 text-gray-700">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">3</span>
            Configura alertas por Telegram
          </li>
        </ul>
      </div>
    </div>
  )
}

function DashboardCard({ title, value, change }: { title: string; value: string; change: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {change && <p className="mt-1 text-sm text-gray-400">{change}</p>}
    </div>
  )
}
