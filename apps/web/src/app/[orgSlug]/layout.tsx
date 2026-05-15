import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'

interface OrgLayoutProps {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgSlug } = await params
  const supabase = await createServerSupabaseClient()

  // Si Supabase no esta configurado, redirigir a home
  if (!supabase) redirect('/')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verificar que el usuario pertenece a esta org
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, logo_url')
    .eq('slug', orgSlug)
    .single()

  if (!org) redirect('/onboarding')

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', org.id)
    .eq('user_id', user.id)
    .single()

  if (!membership) redirect('/onboarding')

  // Obtener todas las orgs del usuario para el switcher
  const { data: userOrgs } = await supabase
    .from('organization_members')
    .select('organization_id, role, organizations(id, name, slug, logo_url)')
    .eq('user_id', user.id)

  const organizations = (userOrgs || []).map((m) => ({
    ...(m.organizations as unknown as { id: string; name: string; slug: string; logo_url: string | null }),
    role: m.role,
  }))

  return (
    <DashboardShell
      currentOrg={org}
      organizations={organizations}
      userRole={membership.role}
      userName={user.user_metadata?.full_name || user.email || ''}
      userEmail={user.email || ''}
    >
      {children}
    </DashboardShell>
  )
}
