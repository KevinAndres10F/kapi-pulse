import Link from 'next/link'
import { KapiLogo } from '@/components/auth/auth-shell'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export function LegalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <KapiLogo />
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 leading-relaxed sm:py-16">
        {children}
      </main>
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} KAPI Service Group · Ecuador ·{' '}
        <Link href="/privacy" className="hover:text-foreground">
          Privacidad
        </Link>{' '}
        ·{' '}
        <Link href="/terms" className="hover:text-foreground">
          Términos
        </Link>{' '}
        ·{' '}
        <Link href="/data-deletion" className="hover:text-foreground">
          Eliminar datos
        </Link>
      </footer>
    </div>
  )
}
