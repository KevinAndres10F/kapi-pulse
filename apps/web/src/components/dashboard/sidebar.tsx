'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard,
  Link2,
  Calendar,
  BarChart3,
  Bot,
  Bell,
  Settings,
  ChevronDown,
  LogOut,
  Users,
  CreditCard,
  X,
} from 'lucide-react'

interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  role: string
}

interface SidebarProps {
  currentOrg: { id: string; name: string; slug: string; logo_url: string | null }
  organizations: Organization[]
  userRole: string
  userName: string
  userEmail: string
  /** Si el drawer móvil está abierto. En desktop el sidebar siempre se ve. */
  mobileOpen?: boolean
  /** Cierra el drawer móvil — usar en links + backdrop. */
  onMobileClose?: () => void
}

const NAV_ITEMS = [
  { href: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: 'connections', label: 'Conexiones', icon: Link2 },
  { href: 'calendar', label: 'Calendario', icon: Calendar },
  { href: 'analytics', label: 'Analíticas', icon: BarChart3 },
  { href: 'ai', label: 'IA Editorial', icon: Bot },
  { href: 'alerts', label: 'Alertas', icon: Bell },
  { href: 'team', label: 'Equipo', icon: Users },
  { href: 'billing', label: 'Facturación', icon: CreditCard },
  { href: 'settings', label: 'Configuración', icon: Settings },
]

export function Sidebar({
  currentOrg,
  organizations,
  userRole,
  userName,
  userEmail,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const [orgMenuOpen, setOrgMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // Cerrar drawer al cambiar de pagina
  useEffect(() => {
    onMobileClose?.()
  }, [pathname, onMobileClose])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Backdrop solo móvil */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Org Switcher + close button (solo móvil) */}
        <div className="relative border-b border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOrgMenuOpen(!orgMenuOpen)}
              className="flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50"
            >
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
                {currentOrg.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{currentOrg.name}</p>
                <p className="text-xs text-gray-500">{userRole}</p>
              </div>
              <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
            </button>
            <button
              onClick={onMobileClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 lg:hidden"
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {orgMenuOpen && (
            <div className="absolute left-4 right-4 top-full z-50 mt-1 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {organizations.map((org) => (
                <Link
                  key={org.id}
                  href={`/${org.slug}/dashboard`}
                  onClick={() => setOrgMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2 text-sm hover:bg-gray-50 ${
                    org.slug === currentOrg.slug ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-gray-200 text-xs font-bold">
                    {org.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate">{org.name}</span>
                </Link>
              ))}
              <hr className="my-1 border-gray-200" />
              <Link
                href="/onboarding"
                onClick={() => setOrgMenuOpen(false)}
                className="block px-4 py-2 text-sm text-blue-600 hover:bg-gray-50"
              >
                + Crear nueva organización
              </Link>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const href = `/${currentOrg.slug}/${item.href}`
              const isActive = pathname === href || pathname.startsWith(href + '/')
              return (
                <li key={item.href}>
                  <Link
                    href={href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User menu */}
        <div className="relative border-t border-gray-200 p-4">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-gray-50"
          >
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">
              {userName.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{userName}</p>
              <p className="truncate text-xs text-gray-500">{userEmail}</p>
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute bottom-full left-4 right-4 mb-1 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
