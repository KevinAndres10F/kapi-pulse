'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { UserPlus, Trash2, Mail } from 'lucide-react'

interface Member {
  user_id: string
  role: string
  joined_at: string
  profiles: { full_name: string | null; avatar_url: string | null; id: string }
}

interface Invitation {
  id: string
  email: string
  role: string
  expires_at: string
  accepted_at: string | null
}

export default function TeamPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('editor')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const supabase = createClient()

  const loadData = useCallback(async () => {
    // Obtener org ID
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single()

    if (!org) return
    setOrgId(org.id)

    // Cargar miembros
    const { data: membersData } = await supabase
      .from('organization_members')
      .select('user_id, role, joined_at, profiles(id, full_name, avatar_url)')
      .eq('organization_id', org.id)

    if (membersData) setMembers(membersData as unknown as Member[])

    // Cargar invitaciones pendientes
    const { data: invitationsData } = await supabase
      .from('invitations')
      .select('id, email, role, expires_at, accepted_at')
      .eq('organization_id', org.id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())

    if (invitationsData) setInvitations(invitationsData)
  }, [supabase, orgSlug])

  useEffect(() => { loadData() }, [loadData])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (!orgId) return

    const { data: { user } } = await supabase.auth.getUser()

    const { error: invError } = await supabase
      .from('invitations')
      .insert({
        organization_id: orgId,
        email: inviteEmail,
        role: inviteRole,
        invited_by: user?.id,
      })

    if (invError) {
      setError('Error al crear la invitación. Verifica los permisos.')
      setLoading(false)
      return
    }

    setSuccess(`Invitación enviada a ${inviteEmail}`)
    setInviteEmail('')
    setLoading(false)
    loadData()
  }

  async function handleDeleteInvitation(invitationId: string) {
    await supabase.from('invitations').delete().eq('id', invitationId)
    loadData()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Equipo</h1>
        <p className="mt-1 text-gray-600">Administra los miembros de tu organización.</p>
      </div>

      {/* Formulario de invitación */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Invitar miembro
        </h2>
        <form onSubmit={handleInvite} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="email@ejemplo.com"
            required
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
          <div className="flex gap-3">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 sm:flex-initial"
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Invitar
            </button>
          </div>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
      </div>

      {/* Miembros actuales */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900">Miembros ({members.length})</h2>
        </div>
        <ul className="divide-y divide-gray-200">
          {members.map((member) => (
            <li key={member.user_id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">
                  {(member.profiles?.full_name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{member.profiles?.full_name || 'Sin nombre'}</p>
                  <p className="text-sm text-gray-500">Desde {new Date(member.joined_at).toLocaleDateString('es')}</p>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                member.role === 'owner' ? 'bg-purple-100 text-purple-700' :
                member.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                member.role === 'editor' ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {member.role}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Invitaciones pendientes */}
      {invitations.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Invitaciones pendientes ({invitations.length})
            </h2>
          </div>
          <ul className="divide-y divide-gray-200">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-gray-900">{inv.email}</p>
                  <p className="text-sm text-gray-500">
                    Rol: {inv.role} · Expira: {new Date(inv.expires_at).toLocaleDateString('es')}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteInvitation(inv.id)}
                  className="rounded p-2 text-red-500 hover:bg-red-50"
                  title="Cancelar invitación"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
