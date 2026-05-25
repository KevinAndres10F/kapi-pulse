'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Mail, Trash2, UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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

function roleVariant(role: string): 'default' | 'success' | 'muted' | 'secondary' {
  if (role === 'owner') return 'default'
  if (role === 'admin') return 'secondary'
  if (role === 'editor') return 'success'
  return 'muted'
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
  const supabase = createClient()

  const loadData = useCallback(async () => {
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single()

    if (!org) return
    setOrgId(org.id)

    const { data: membersData } = await supabase
      .from('organization_members')
      .select('user_id, role, joined_at, profiles(id, full_name, avatar_url)')
      .eq('organization_id', org.id)

    if (membersData) setMembers(membersData as unknown as Member[])

    const { data: invitationsData } = await supabase
      .from('invitations')
      .select('id, email, role, expires_at, accepted_at')
      .eq('organization_id', org.id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())

    if (invitationsData) setInvitations(invitationsData)
  }, [supabase, orgSlug])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!orgId) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error: invError } = await supabase.from('invitations').insert({
      organization_id: orgId,
      email: inviteEmail,
      role: inviteRole,
      invited_by: user?.id,
    })

    if (invError) {
      setError('Error al crear la invitación. Verificá los permisos.')
      setLoading(false)
      return
    }

    toast.success(`Invitación enviada a ${inviteEmail}.`)
    setInviteEmail('')
    setLoading(false)
    loadData()
  }

  async function handleDeleteInvitation(invitationId: string) {
    const { error } = await supabase.from('invitations').delete().eq('id', invitationId)
    if (error) {
      toast.error('No se pudo eliminar.', { description: error.message })
    } else {
      toast.success('Invitación cancelada.')
      loadData()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          <Users className="size-6 text-primary" />
          Equipo
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administrá los miembros de tu organización y sus permisos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="size-4 text-primary" />
            Invitar miembro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="persona@ejemplo.com"
                required
              />
            </div>
            <div className="space-y-1.5 sm:w-40">
              <Label htmlFor="role">Rol</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" loading={loading} variant="gradient">
              {!loading && <Mail className="size-4" />}
              Invitar
            </Button>
          </form>
          {error && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Miembros</CardTitle>
            <Badge variant="muted">{members.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {members.map((member) => (
              <li key={member.user_id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar>
                    <AvatarFallback>
                      {(member.profiles?.full_name || '?').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {member.profiles?.full_name || 'Sin nombre'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Desde{' '}
                      {new Date(member.joined_at).toLocaleDateString('es-EC', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <Badge variant={roleVariant(member.role)} className="capitalize">
                  {member.role}
                </Badge>
              </li>
            ))}
            {members.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                Sin miembros todavía.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="size-4 text-primary" />
                Invitaciones pendientes
              </CardTitle>
              <Badge variant="warning">{invitations.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Rol <span className="capitalize">{inv.role}</span> · expira{' '}
                      {new Date(inv.expires_at).toLocaleDateString('es-EC')}
                    </p>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => handleDeleteInvitation(inv.id)}
                    aria-label="Cancelar invitación"
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
