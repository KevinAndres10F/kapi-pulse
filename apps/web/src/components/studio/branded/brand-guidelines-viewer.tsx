'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

interface BrandGuidelines {
  primary_color: string
  secondary_color: string
  accent_color: string
  text_primary: string
  text_secondary: string
  font_primary?: string
  font_secondary?: string
  watermark_enabled: boolean
  watermark_position: string
  border_radius?: string
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export function BrandGuidelinesViewer({ orgId, accessToken }: { orgId: string; accessToken?: string }) {
  const [brand, setBrand] = useState<BrandGuidelines | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId || !accessToken) return
    const fetchBrand = async () => {
      try {
        const headers: Record<string, string> = {}
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

        const response = await fetch(`${API_URL}/studio/branded/brand?orgId=${orgId}`, { headers })
        const data = await response.json()
        setBrand(data.brand)
      } catch (error) {
        console.error('Failed to fetch brand guidelines:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchBrand()
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

  if (!brand) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-500">
          No brand guidelines configured
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand Guidelines</CardTitle>
        <CardDescription>KAPI Service Group color palette</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Colors */}
        <div>
          <h3 className="font-semibold mb-3">Colors</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <div
                className="h-20 rounded-lg border"
                style={{ backgroundColor: brand.primary_color }}
              />
              <p className="text-xs font-medium">Primary</p>
              <p className="text-xs text-slate-500">{brand.primary_color}</p>
            </div>

            <div className="space-y-2">
              <div
                className="h-20 rounded-lg border"
                style={{ backgroundColor: brand.secondary_color }}
              />
              <p className="text-xs font-medium">Secondary</p>
              <p className="text-xs text-slate-500">{brand.secondary_color}</p>
            </div>

            <div className="space-y-2">
              <div
                className="h-20 rounded-lg border"
                style={{ backgroundColor: brand.accent_color }}
              />
              <p className="text-xs font-medium">Accent</p>
              <p className="text-xs text-slate-500">{brand.accent_color}</p>
            </div>
          </div>
        </div>

        {/* Typography */}
        <div>
          <h3 className="font-semibold mb-3">Typography</h3>
          <div className="space-y-2">
            {brand.font_primary && (
              <p className="text-sm">
                <span className="text-slate-500">Primary:</span> {brand.font_primary}
              </p>
            )}
            {brand.font_secondary && (
              <p className="text-sm">
                <span className="text-slate-500">Secondary:</span> {brand.font_secondary}
              </p>
            )}
          </div>
        </div>

        {/* Watermark */}
        <div>
          <h3 className="font-semibold mb-3">Watermark</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {brand.watermark_enabled ? (
                <Badge variant="default">Enabled</Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
            </div>
            {brand.watermark_position && (
              <p className="text-sm text-slate-600">
                Position: <span className="font-medium">{brand.watermark_position}</span>
              </p>
            )}
          </div>
        </div>

        {/* Border Radius */}
        {brand.border_radius && (
          <div>
            <h3 className="font-semibold mb-3">Border Radius</h3>
            <p className="text-sm text-slate-600">{brand.border_radius}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
