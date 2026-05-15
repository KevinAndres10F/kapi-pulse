'use client'

import { useState, useEffect, useCallback } from 'react'
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
 * datos; este client component maneja el toggle del drawer móvil:
 *   - body scroll lock cuando está abierto
 *   - ESC key cierra
 *   - resize a desktop (>=1024px) cierra automaticamente para evitar
 *     estado inconsistente al rotar el dispositivo
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

  // Estable a traves de renders. Sin esto, cada render del Shell crea una
  // funcion nueva, lo que dispara los useEffect de Sidebar que la tienen
  // en sus deps -> el drawer se cierra apenas se abre (loop visible como
  // "se cuelga").
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  // Body scroll lock cuando el drawer está abierto (evita scroll fantasma del fondo)
  useEffect(() => {
    if (mobileOpen) {
      const previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = previousOverflow
      }
    }
  }, [mobileOpen])

  // ESC cierra el drawer
  useEffect(() => {
    if (!mobileOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [mobileOpen])

  // Si el viewport pasa a desktop (>=1024px) mientras el drawer está abierto,
  // lo reseteo para que no quede el state inconsistente al rotar.
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024 && mobileOpen) setMobileOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [mobileOpen])

  return (
    <div className="flex h-screen bg-gray-100">
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
        <header className="sticky top-0 z-30 flex h-14 flex-shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 shadow-sm lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200"
            aria-label="Abrir menú"
            aria-expanded={mobileOpen}
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
