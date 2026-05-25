'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react'

import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface Post {
  id: string
  title: string | null
  status: string
  scheduled_at: string | null
  post_variants: Array<{
    id: string
    content: string | null
    status: string
    social_accounts: { provider: string; display_name: string } | null
  }>
}

const STATUS_STYLES: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  draft: {
    dot: 'bg-muted-foreground/50',
    bg: 'bg-muted',
    text: 'text-foreground',
    label: 'Borrador',
  },
  scheduled: {
    dot: 'bg-primary',
    bg: 'bg-primary/10',
    text: 'text-primary',
    label: 'Programado',
  },
  publishing: {
    dot: 'bg-warning',
    bg: 'bg-warning/15',
    text: 'text-warning-foreground',
    label: 'Publicando',
  },
  published: {
    dot: 'bg-success',
    bg: 'bg-success/10',
    text: 'text-success',
    label: 'Publicado',
  },
  failed: {
    dot: 'bg-destructive',
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    label: 'Fallido',
  },
  cancelled: {
    dot: 'bg-muted-foreground/40',
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    label: 'Cancelado',
  },
}

const PROVIDER_LABEL: Record<string, string> = {
  facebook: 'FB',
  instagram: 'IG',
  linkedin: 'LI',
  tiktok: 'TK',
  x: 'X',
  youtube: 'YT',
  threads: 'TH',
}

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function CalendarPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const supabase = createClient()

  const loadPosts = useCallback(async () => {
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single()
    if (!org) return

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const start = new Date(year, month, 1).toISOString()
    const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

    const { data } = await supabase
      .from('posts')
      .select(
        'id, title, status, scheduled_at, post_variants(id, content, status, social_accounts(provider, display_name))',
      )
      .eq('organization_id', org.id)
      .gte('scheduled_at', start)
      .lte('scheduled_at', end)
      .order('scheduled_at', { ascending: true })

    if (data) setPosts(data as unknown as Post[])
  }, [supabase, orgSlug, currentDate])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  function getDaysInMonth() {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days: Array<{ date: number; isCurrentMonth: boolean }> = []
    const prevMonthDays = new Date(year, month, 0).getDate()
    for (let i = firstDay - 1; i >= 0; i--) days.push({ date: prevMonthDays - i, isCurrentMonth: false })
    for (let i = 1; i <= daysInMonth; i++) days.push({ date: i, isCurrentMonth: true })
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) days.push({ date: i, isCurrentMonth: false })
    return days
  }

  function getPostsForDay(day: number): Post[] {
    return posts.filter((p) => {
      if (!p.scheduled_at) return false
      const d = new Date(p.scheduled_at)
      return d.getDate() === day && d.getMonth() === currentDate.getMonth()
    })
  }

  const monthName = currentDate.toLocaleDateString('es', { month: 'long', year: 'numeric' })
  const today = new Date()
  const isToday = (day: number) =>
    day === today.getDate() &&
    currentDate.getMonth() === today.getMonth() &&
    currentDate.getFullYear() === today.getFullYear()

  function goPrev() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }
  function goNext() {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }
  function goToday() {
    setCurrentDate(new Date())
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            <CalendarIcon className="size-6 text-primary" /> Calendario
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visualizá y programá tus publicaciones del mes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-md border border-border bg-card shadow-xs">
            <Button variant="ghost" size="icon-sm" onClick={goPrev} aria-label="Mes anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-32 px-2 text-center text-sm font-medium capitalize text-foreground">
              {monthName}
            </span>
            <Button variant="ghost" size="icon-sm" onClick={goNext} aria-label="Mes siguiente">
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={goToday}>
            Hoy
          </Button>
          <Button variant="gradient" size="sm" onClick={() => router.push(`/${orgSlug}/calendar/new`)}>
            <Plus className="size-4" />
            Nuevo post
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 border-b border-border bg-muted/50">
              {DAYS.map((d) => (
                <div
                  key={d}
                  className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-y divide-border">
              {getDaysInMonth().map((day, i) => {
                const dayPosts = day.isCurrentMonth ? getPostsForDay(day.date) : []
                return (
                  <div
                    key={i}
                    className={cn(
                      'min-h-[100px] p-1.5 sm:min-h-[110px]',
                      day.isCurrentMonth ? 'bg-card' : 'bg-muted/30',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums',
                        isToday(day.date) && day.isCurrentMonth
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : day.isCurrentMonth
                            ? 'text-foreground'
                            : 'text-muted-foreground/40',
                      )}
                    >
                      {day.date}
                    </span>
                    <div className="mt-1 space-y-1">
                      {dayPosts.slice(0, 3).map((post) => {
                        const style = STATUS_STYLES[post.status] || STATUS_STYLES.draft
                        const time =
                          post.scheduled_at &&
                          new Date(post.scheduled_at).toLocaleTimeString('es', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        const providers = Array.from(
                          new Set(
                            post.post_variants
                              .map((v) => v.social_accounts?.provider)
                              .filter(Boolean) as string[],
                          ),
                        )
                        const preview = post.title || post.post_variants[0]?.content || ''
                        return (
                          <button
                            key={post.id}
                            type="button"
                            className={cn(
                              'group flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] transition-colors',
                              style.bg,
                              style.text,
                              'hover:opacity-90',
                            )}
                          >
                            <span className={cn('size-1.5 shrink-0 rounded-full', style.dot)} aria-hidden />
                            {time && <span className="font-medium tabular-nums">{time}</span>}
                            {providers.length > 0 && (
                              <span className="font-medium tabular-nums">
                                {providers.map((p) => PROVIDER_LABEL[p] || '').join(' ')}
                              </span>
                            )}
                            <span className="truncate">{preview}</span>
                          </button>
                        )
                      })}
                      {dayPosts.length > 3 && (
                        <span className="block text-[10px] text-muted-foreground">
                          +{dayPosts.length - 3} más
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_STYLES).map(([status, style]) => (
          <Badge key={status} variant="outline" className="gap-1.5 capitalize">
            <span className={cn('size-1.5 rounded-full', style.dot)} aria-hidden />
            {style.label}
          </Badge>
        ))}
      </div>
    </div>
  )
}
