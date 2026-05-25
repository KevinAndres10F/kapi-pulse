'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { AuthShell, GoogleIcon } from '@/components/auth/auth-shell'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Credenciales incorrectas. Probá de nuevo.')
      setLoading(false)
      return
    }

    window.location.href = '/onboarding'
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError('Error al conectar con Google.')
  }

  async function handleMagicLink() {
    if (!email) {
      setError('Ingresá tu email para recibir el enlace mágico.')
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
    if (error) {
      setError('Error al enviar el enlace. Probá de nuevo.')
    } else {
      toast.success('Revisá tu email', { description: `Te enviamos el enlace a ${email}.` })
    }
  }

  return (
    <AuthShell
      title="Bienvenido de vuelta"
      description="Iniciá sesión para administrar tus redes sociales."
      footer={
        <>
          ¿No tenés cuenta?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Crear una
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="tu@email.com"
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-xs"
              onClick={handleMagicLink}
            >
              Olvidé mi contraseña
            </Button>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" loading={loading} className="w-full" size="lg">
          {loading ? 'Ingresando' : 'Iniciar sesión'}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">o continuá con</span>
        <Separator className="flex-1" />
      </div>

      <div className="space-y-2">
        <Button onClick={handleGoogleLogin} variant="outline" size="lg" className="w-full">
          <GoogleIcon className="size-4" />
          Google
        </Button>
        <Button onClick={handleMagicLink} variant="outline" size="lg" className="w-full" loading={loading}>
          {!loading && <Mail className="size-4" />}
          Enviar enlace mágico
        </Button>
      </div>
    </AuthShell>
  )
}
