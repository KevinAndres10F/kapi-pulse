'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, AlertCircle, Loader2, XCircle } from 'lucide-react'

interface ValidationResult {
  isValid: boolean
  score: number
  issues: Array<{ type: 'error' | 'warning'; field: string; message: string; severity: string }>
  warnings: string[]
  suggestions: string[]
}

interface ValidationViewerProps {
  assetId: string
}

export function ValidationViewer({ assetId }: ValidationViewerProps) {
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [loading, setLoading] = useState(true)

  const validateAsset = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/studio/brand-validation/assets/${assetId}/validate`)
      const data = await response.json()
      setValidation(data)
    } catch (error) {
      console.error('Validation failed:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!validation && !loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Brand Validation</CardTitle>
          <CardDescription>Check brand compliance before publishing</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={validateAsset} className="w-full">
            Validate Asset
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (!validation) return null

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Validation Results</CardTitle>
        <CardDescription>Brand compliance check</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Brand Compliance</span>
            <span className={`text-2xl font-bold ${getScoreColor(validation.score)}`}>
              {validation.score}/100
            </span>
          </div>
          <Progress value={validation.score} className="h-3" />
          {validation.isValid ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Ready to publish</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Needs revision</span>
            </div>
          )}
        </div>

        {/* Issues */}
        {validation.issues.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Issues</h4>
            <div className="space-y-2">
              {validation.issues.map((issue, idx) => (
                <div key={idx} className="flex gap-3 rounded-lg bg-slate-50 p-3">
                  {issue.severity === 'critical' ? (
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{issue.field}</p>
                    <p className="text-sm text-slate-600">{issue.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {validation.warnings.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Warnings</h4>
            <div className="space-y-2">
              {validation.warnings.map((warning, idx) => (
                <div key={idx} className="flex gap-2 text-sm text-slate-600">
                  <span className="text-yellow-600">⚠</span>
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {validation.suggestions.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Suggestions</h4>
            <div className="space-y-2">
              {validation.suggestions.map((suggestion, idx) => (
                <div key={idx} className="flex gap-2 text-sm text-slate-600">
                  <span className="text-blue-600">💡</span>
                  <span>{suggestion}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
