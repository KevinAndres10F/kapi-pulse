'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react'

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

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-200 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  publishing: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
}

const PROVIDER_EMOJI: Record<string, string> = {
  facebook: 'FB', instagram: 'IG', linkedin: 'LI',
  tiktok: 'TK', x: 'X', youtube: 'YT', threads: 'TH',
}

export default function CalendarPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const supabase = createClient()

  const loadPosts = useCallback(async () => {
    const { data: org } = await supabase
      .from('organizations').select('id').eq('slug', orgSlug).single()
    if (!org) return

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const start = new Date(year, month, 1).toISOString()
    const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

    const { data } = await supabase
      .from('posts')
      .select('id, title, status, scheduled_at, post_variants(id, content, status, social_accounts(provider, display_name))')
      .eq('organization_id', org.id)
      .gte('scheduled_at', start).lte('scheduled_at', end)
      .order('scheduled_at', { ascending: true })

    if (data) setPosts(data as unknown as Post[])
  }, [supabase, orgSlug, currentDate])

  useEffect(() => { loadPosts() }, [loadPosts])

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
    day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear()

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <CalendarIcon className="h-6 w-6" /> Calendario
          </h1>
          <p className="mt-1 text-gray-600">Visualiza y programa tus publicaciones.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center rounded-lg border border-gray-200 bg-white">
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-gray-50"><ChevronLeft className="h-4 w-4" /></button>
            <span className="px-3 text-sm font-semibold capitalize sm:px-4">{monthName}</span>
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-gray-50"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <button onClick={() => router.push(`/${orgSlug}/calendar/new`)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Nuevo post
          </button>
        </div>
      </div>

      {/* Scroll horizontal en móvil — un calendario de 7 cols no entra abajo de ~640px */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold uppercase text-gray-500">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
            {getDaysInMonth().map((day, i) => {
              const dayPosts = day.isCurrentMonth ? getPostsForDay(day.date) : []
              return (
                <div key={i} className={`min-h-[90px] p-1.5 sm:min-h-[100px] ${day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'}`}>
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday(day.date) && day.isCurrentMonth ? 'bg-blue-600 font-bold text-white' : day.isCurrentMonth ? 'text-gray-900' : 'text-gray-300'}`}>{day.date}</span>
                  <div className="mt-1 space-y-1">
                    {dayPosts.slice(0, 3).map((post) => (
                      <div key={post.id} className={`cursor-pointer truncate rounded px-1.5 py-0.5 text-xs hover:opacity-80 ${STATUS_COLORS[post.status] || 'bg-gray-100'}`}>
                        <span className="font-medium">{post.scheduled_at && new Date(post.scheduled_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}</span>
                        {' '}{post.post_variants.map((v) => PROVIDER_EMOJI[v.social_accounts?.provider || ''] || '').join(' ')}
                        {' '}{post.title || (post.post_variants[0]?.content || '').slice(0, 20)}
                      </div>
                    ))}
                    {dayPosts.length > 3 && <span className="text-xs text-gray-400">+{dayPosts.length - 3} mas</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500">
        {Object.entries(STATUS_COLORS).map(([status, className]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded ${className.split(' ')[0]}`} />
            {status}
          </div>
        ))}
      </div>
    </div>
  )
}
