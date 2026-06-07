'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Loader2, TrendingUp, Image, Music, Video, Send } from 'lucide-react'

interface DashboardData {
  complianceReport: {
    totalAssets: number
    brandCompliance: number
    byKind: Record<string, { count: number; avgScore: number }>
    topIssues: Array<{ message: string; occurrences: number }>
  }
  characters: Array<{ id: string; name: string; is_default: boolean }>
  brand: { primary_color: string; secondary_color: string; accent_color: string }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export function DashboardOverview({ orgId, accessToken }: { orgId: string; accessToken?: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const headers: Record<string, string> = {}
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

        const response = await fetch(
          `${API_URL}/api/studio/dashboard/brand-overview?org_id=${encodeURIComponent(orgId)}`,
          { headers },
        )
        const result = await response.json()
        setData(result)
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, orgId])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const complianceReport = data.complianceReport

  return (
    <div className="space-y-6">
      {/* Main Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Brand Compliance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Brand Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold">{complianceReport.brandCompliance}%</div>
              <Progress value={complianceReport.brandCompliance} className="h-2" />
              <p className="text-xs text-slate-500">Overall score</p>
            </div>
          </CardContent>
        </Card>

        {/* Total Assets */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold">{complianceReport.totalAssets}</div>
              <p className="text-xs text-slate-500">Generated</p>
            </div>
          </CardContent>
        </Card>

        {/* Characters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Characters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-3xl font-bold">{data.characters.length}</div>
              {data.characters.find((c) => c.is_default) && (
                <p className="text-xs text-slate-500">
                  Default: {data.characters.find((c) => c.is_default)?.name}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Brand Colors */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Brand Colors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="h-8 w-8 rounded-lg border" style={{ backgroundColor: data.brand.primary_color }} />
              <div className="h-8 w-8 rounded-lg border" style={{ backgroundColor: data.brand.secondary_color }} />
              <div className="h-8 w-8 rounded-lg border" style={{ backgroundColor: data.brand.accent_color }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assets by Kind */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Assets by Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(complianceReport.byKind).map(([kind, stats]) => {
            const icon =
              kind === 'image' ? (
                <Image className="h-4 w-4" />
              ) : kind === 'audio' ? (
                <Music className="h-4 w-4" />
              ) : kind === 'video' ? (
                <Video className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )

            return (
              <div key={kind} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {icon}
                    <span className="capitalize text-sm font-medium">{kind}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">{stats.count}</span>
                    <Badge variant="secondary">{stats.avgScore}/100</Badge>
                  </div>
                </div>
                <Progress value={(stats.avgScore / 100) * 100} className="h-2" />
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Top Issues */}
      {complianceReport.topIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top Issues</CardTitle>
            <CardDescription>Most common brand compliance issues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {complianceReport.topIssues.map((issue, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                  <p className="text-sm text-slate-600">{issue.message}</p>
                  <Badge variant="secondary">{issue.occurrences}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
