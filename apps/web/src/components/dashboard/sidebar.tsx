'use client'

import { useEffect, useRef } from 'react'
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
  ChevronsUpDown,
  LogOut,
  Users,
  CreditCard,
  Sparkles,
  Folder,
  Coins,
  Megaphone,
  X,
  Plus,
  Check,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ThemeToggle } from '@/components/ui/theme-toggle'

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
  mobileOpen?: boolean
  onMobileClose?: () => void
}

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  group: 'main' | 'create' | 'admin'
}

const NAV_ITEMS: NavItem[] = [
  { href: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
  { href: 'calendar', label: 'Calendario', icon: Calendar, group: 'main' },
  { href: 'analytics', label: 'Analíticas', icon: BarChart3, group: 'main' },

  { href: 'studio', label: 'Studio', icon: Sparkles, group: 'create' },
  { href: 'ai', label: 'IA Editorial', icon: Bot, group: 'create' },
  { href: 'ads', label: 'Anuncios', icon: Megaphone, group: 'create' },
  { href: 'library', label: 'Librería', icon: Folder, group: 'create' },

  { href: 'connections', label: 'Conexiones', icon: Link2, group: 'admin' },
  { href: 'team', label: 'Equipo', icon: Users, group: 'admin' },
  { href: 'credits', label: 'Créditos', icon: Coins, group: 'admin' },
  { href: 'billing', label: 'Facturación', icon: CreditCard, group: 'admin' },
  { href: 'alerts', label: 'Alertas', icon: Bell, group: 'admin' },
  { href: 'settings', label: 'Configuración', icon: Settings, group: 'admin' },
]

const GROUP_LABELS = {
  main: 'General',
  create: 'Crear',
  admin: 'Administración',
} as const

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

export function Sidebar({
  currentOrg,
  organizations,
  userRole,
  userName,
  userEmail,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const onMobileCloseRef = useRef(onMobileClose)
  useEffect(() => {
    onMobileCloseRef.current = onMobileClose
  }, [onMobileClose])

  useEffect(() => {
    onMobileCloseRef.current?.()
  }, [pathname])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const groupedNav = (Object.keys(GROUP_LABELS) as Array<keyof typeof GROUP_LABELS>).map((g) => ({
    group: g,
    label: GROUP_LABELS[g],
    items: NAV_ITEMS.filter((i) => i.group === g),
  }))

  return (
    <>
      {/* Backdrop solo móvil */}
      <div
        onClick={onMobileClose}
        aria-hidden="true"
        className={cn(
          'fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm transition-opacity duration-300 ease-out lg:hidden',
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar shadow-2xl transition-transform duration-300 ease-out will-change-transform',
          'lg:static lg:w-64 lg:translate-x-0 lg:shadow-none',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        role="dialog"
        aria-modal={mobileOpen ? 'true' : undefined}
        aria-label="Menú de navegación"
      >
        {/* Org switcher + close button */}
        <div className="flex items-center gap-2 border-b border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                <Avatar className="size-9 rounded-lg bg-gradient-to-br from-primary to-[oklch(0.55_0.22_290)] text-primary-foreground">
                  <AvatarFallback className="rounded-lg bg-transparent text-sm font-semibold text-primary-foreground">
                    {initials(currentOrg.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-sidebar-foreground">{currentOrg.name}</p>
                  <p className="truncate text-xs text-muted-foreground capitalize">{userRole}</p>
                </div>
                <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={6} className="w-[--radix-dropdown-menu-trigger-width] min-w-64">
              <DropdownMenuLabel>Organizaciones</DropdownMenuLabel>
              {organizations.map((org) => {
                const isCurrent = org.slug === currentOrg.slug
                return (
                  <DropdownMenuItem key={org.id} asChild>
                    <Link href={`/${org.slug}/dashboard`} className="gap-3">
                      <Avatar className="size-7 rounded-md bg-muted">
                        <AvatarFallback className="rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                          {initials(org.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{org.name}</p>
                        <p className="truncate text-xs text-muted-foreground capitalize">{org.role}</p>
                      </div>
                      {isCurrent && <Check className="size-4 text-primary" />}
                    </Link>
                  </DropdownMenuItem>
                )
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/onboarding" className="gap-2 text-primary">
                  <Plus className="size-4" />
                  Crear nueva organización
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onMobileClose}
            aria-label="Cerrar menú"
            className="shrink-0 lg:hidden"
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1">
          <nav className="px-3 py-4">
            {groupedNav.map((grp) => (
              <div key={grp.group} className={cn('mb-4 last:mb-0')}>
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {grp.label}
                </p>
                <ul className="space-y-0.5">
                  {grp.items.map((item) => {
                    const href = `/${currentOrg.slug}/${item.href}`
                    const isActive = pathname === href || pathname.startsWith(href + '/')
                    return (
                      <li key={item.href}>
                        <Link
                          href={href}
                          className={cn(
                            'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                          )}
                        >
                          <item.icon
                            className={cn(
                              'size-4 shrink-0 transition-colors',
                              isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground',
                            )}
                          />
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* User menu + theme toggle */}
        <div className="flex items-center gap-1 border-t border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs font-semibold">{initials(userName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-sidebar-foreground">{userName}</p>
                  <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={6} className="w-56">
              <DropdownMenuLabel className="font-normal normal-case tracking-normal">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-foreground">{userName}</span>
                  <span className="text-xs text-muted-foreground">{userEmail}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/${currentOrg.slug}/settings`}>
                  <Settings className="size-4" />
                  Configuración
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/${currentOrg.slug}/team`}>
                  <Building2 className="size-4" />
                  Cambiar de cuenta
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} destructive>
                <LogOut className="size-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ThemeToggle />
        </div>
      </aside>
    </>
  )
}

// Mantengo este export por si alguna page consume el badge del rol fuera de la sidebar
export function RoleBadge({ role }: { role: string }) {
  const variant: 'default' | 'success' | 'muted' = role === 'owner' ? 'default' : role === 'admin' ? 'success' : 'muted'
  return (
    <Badge variant={variant} className="capitalize">
      {role}
    </Badge>
  )
}
