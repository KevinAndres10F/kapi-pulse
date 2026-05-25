import Link from 'next/link'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

export function KapiLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'size-8' : size === 'lg' ? 'size-12' : 'size-10'
  const text = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base'
  return (
    <Link href="/" className="inline-flex items-center gap-2">
      <span
        className={`${dim} flex items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.55_0.22_290)] font-bold text-primary-foreground shadow-md`}
        aria-hidden
      >
        K
      </span>
      <span className={`font-semibold tracking-tight text-foreground ${text}`}>KAPI Pulse</span>
    </Link>
  )
}

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="absolute inset-0 -z-10 gradient-mesh-light" aria-hidden />
      <header className="flex items-center justify-between px-6 py-5">
        <KapiLogo />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
            {description && <p className="text-sm text-muted-foreground sm:text-base">{description}</p>}
          </div>
          <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-xl backdrop-blur-sm sm:p-8">
            {children}
          </div>
          {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </main>
      <footer className="px-6 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} KAPI Pulse · <Link href="/privacy" className="hover:text-foreground">Privacidad</Link> · <Link href="/terms" className="hover:text-foreground">Términos</Link>
      </footer>
    </div>
  )
}
