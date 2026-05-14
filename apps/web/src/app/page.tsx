import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = await createServerSupabaseClient()
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

  // Si no tiene org, ir a onboarding
  redirect('/onboarding')
}
