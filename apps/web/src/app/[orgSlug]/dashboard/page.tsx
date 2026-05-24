import { createServerSupabaseClient } from '@/lib/supabase/server'

interface DashboardPageProps {
    params: Promise<{ orgSlug: string }>
}

export default async function DashboardPage({ params }: DashboardPageProps) {
    const { orgSlug } = await params
    const supabase = await createServerSupabaseClient()

  const { data: org } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('slug', orgSlug)
      .single()

  const { count: connectedCount } = org
      ? await supabase
            .from('social_accounts')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('status', 'active')
        : { count: 0 }

  return (
        <div className="space-y-6">
              <div>
                      <h1 className="text-2xl font-bold text-gray-900">
                                Dashboard — {org?.name}
                      </h1>h1>
                      <p className="mt-1 text-gray-600">
                                Bienvenido a tu centro de control de redes sociales.
                      </p>p>
              </div>div>
        
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                      <DashboardCard title="Seguidores" value="—" change="" />
                      <DashboardCard title="Engagement" value="—" change="" />
                      <DashboardCard title="Publicaciones" value="0" change="este mes" />
                      <DashboardCard title="Cuentas conectadas" value={String(connectedCount ?? 0)} change="" />
              </div>div>
        
              <div className="rounded-lg border border-gray-200 bg-white p-6">
                      <h2 className="text-lg font-semibold text-gray-900">Próximos pasos</h2>h2>
                      <ul className="mt-4 space-y-3">
                                <li className="flex items-center gap-3 text-gray-700">
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">1</span>span>
                                            Conecta tu primera red social
                                </li>li>
                                <li className="flex items-center gap-3 text-gray-700">
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">2</span>span>
                                            Crea y programa tu primer post
                                </li>li>
                                <li className="flex items-center gap-3 text-gray-700">
                                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">3</span>span>
                                            Configura alertas por Telegram
                                </li>li>
                      </ul>ul>
              </div>div>
        </div>div>
      )
}

function DashboardCard({ title, value, change }: { title: string; value: string; change: string }) {
    return (
          <div className="rounded-lg border border-gray-200 bg-white p-5">
                <p className="text-sm font-medium text-gray-500">{title}</p>p>
                <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>p>
            {change && <p className="mt-1 text-sm text-gray-400">{change}</p>p>}
          </div>div>
        )
}
</div>
