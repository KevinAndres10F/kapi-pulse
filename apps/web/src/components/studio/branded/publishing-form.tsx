'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface PublishingFormProps {
  assetIds: string[]
  orgId: string
  accessToken?: string
}

export function PublishingForm({ assetIds, orgId, accessToken }: PublishingFormProps) {
  const [platform, setPlatform] = useState<string>('instagram')
  const [caption, setCaption] = useState('')
  const [scheduleDate, setScheduleDate] = useState('')
  const [validateBranding, setValidateBranding] = useState(true)
  const [loading, setLoading] = useState(false)
  const [published, setPublished] = useState(false)

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()

    if (assetIds.length === 0) {
      toast.error('Select at least one asset to publish')
      return
    }

    setLoading(true)

    try {
      const payload: Record<string, unknown> = {
        assetIds,
        platform,
        validateBranding,
      }

      if (caption) payload.caption = caption
      if (scheduleDate) payload.scheduledFor = new Date(scheduleDate).toISOString()

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

      const response = await fetch(`${API_URL}/studio/publishing/posts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        // Show validation issues if any
        if (data.validationResults) {
          const issues = Object.entries(data.validationResults).map(
            ([assetId, result]) => `${assetId}: ${(result as { score: number }).score}/100`
          )
          toast.error(`Some assets need review: ${issues.join(', ')}`)
        } else {
          throw new Error(data.message || 'Publishing failed')
        }
        return
      }

      setPublished(true)
      toast.success(scheduleDate ? 'Post scheduled successfully' : 'Post published successfully')

      // Reset form
      setCaption('')
      setScheduleDate('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Publishing failed')
    } finally {
      setLoading(false)
    }
  }

  if (published) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <div className="text-4xl">🎉</div>
            <p className="font-semibold">Published successfully!</p>
            <Button onClick={() => setPublished(false)} variant="outline" className="w-full">
              Publish Another
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Publish Post
        </CardTitle>
        <CardDescription>Share your branded content</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handlePublish} className="space-y-6">
          {/* Assets */}
          <div className="space-y-2">
            <Label>Assets</Label>
            <div className="flex flex-wrap gap-2">
              {assetIds.map((id) => (
                <Badge key={id} variant="secondary">
                  {id.slice(0, 8)}...
                </Badge>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div className="space-y-2">
            <Label htmlFor="platform">Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="twitter">Twitter/X</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              placeholder="Write a caption for your post..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="min-h-20"
            />
          </div>

          {/* Schedule */}
          <div className="space-y-2">
            <Label htmlFor="schedule">Schedule (Optional)</Label>
            <Input
              id="schedule"
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
            />
            <p className="text-xs text-slate-500">Leave empty to publish now</p>
          </div>

          {/* Validation */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="validate"
              checked={validateBranding}
              onCheckedChange={(checked) => setValidateBranding(checked === true)}
            />
            <Label htmlFor="validate" className="font-normal cursor-pointer">
              Validate brand compliance before publishing
            </Label>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Publishing...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Publish Post
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
