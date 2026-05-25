'use client'

import { useCallback, useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from './sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ui/theme-toggle'

interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  role: string
}

interface DashboardShellProps {
  currentOrg: { id: string; name: string; slug: string; logo_url: string | null }
  organizations: Organization[]
  userRole: string
  userName: string
  userEmail: string
  children: React.ReactNode
}

function initials(name: string): string {
  return name.charAt(0).toUpperCase() || '?'
}

export function DashboardShell({
  currentOrg,
  organizations,
  userRole,
  userName,
  userEmail,
  children,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  useEffect(() => {
    if (mobileOpen) {
      const previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = previousOverflow
      }
    }
  }, [mobileOpen])

  useEffect(() => {
    if (!mobileOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [mobileOpen])

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024 && mobileOpen) setMobileOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [mobileOpen])

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <Sidebar
        currentOrg={currentOrg}
        organizations={organizations}
        userRole={userRole}
        userName={userName}
        userEmail={userEmail}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobile}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar móvil */}
        <header className="sticky top-0 z-30 flex h-14 flex-shrink-0 items-center justify-between gap-2 border-b border-border bg-background/85 px-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
              aria-expanded={mobileOpen}
            >
              <Menu className="size-5" />
            </Button>
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="size-7 rounded-md bg-gradient-to-br from-primary to-[oklch(0.55_0.22_290)]">
                <AvatarFallback className="rounded-md bg-transparent text-xs font-semibold text-primary-foreground">
                  {initials(currentOrg.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm font-semibold text-foreground">{currentOrg.name}</span>
            </div>
          </div>
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
