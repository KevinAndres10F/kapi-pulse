'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Sidebar } from './sidebar'

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

/**
 * Shell del dashboard. Server component (layout.tsx) hace auth y carga
 * datos; este client component maneja el toggle del drawer móvil.
 */
export function DashboardShell({
  currentOrg,
  organizations,
  userRole,
  userName,
  userEmail,
  children,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        currentOrg={currentOrg}
        organizations={organizations}
        userRole={userRole}
        userName={userName}
        userEmail={userEmail}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar móvil */}
        <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
              {currentOrg.name.charAt(0).toUpperCase()}
            </div>
            <span className="truncate text-sm font-semibold text-gray-900">{currentOrg.name}</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-3 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
