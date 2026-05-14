import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/dashboard/sidebar'

interface OrgLayoutProps {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgSlug } = await params
  const supabase = await createServerSupabaseClient()

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
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        currentOrg={org}
        organizations={organizations}
        userRole={membership.role}
        userName={user.user_metadata?.full_name || user.email || ''}
        userEmail={user.email || ''}
      />
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
