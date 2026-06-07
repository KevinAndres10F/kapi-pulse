'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

interface ImageGenerationFormProps {
  characterId: string
  orgId: string
  accessToken?: string
}

export function ImageGenerationForm({ characterId, orgId, accessToken }: ImageGenerationFormProps) {
  const [prompt, setPrompt] = useState('')
  const [provider, setProvider] = useState<'fal' | 'banana'>('fal')
  const [numImages, setNumImages] = useState(1)
  const [isCarousel, setIsCarousel] = useState(false)
  const [loading, setLoading] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!prompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    setLoading(true)

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

      const response = await fetch(`${API_URL}/studio/branded/image-branded`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orgId,
          prompt,
          characterId,
          provider,
          numImages: isCarousel ? 3 : numImages,
          isCarousel,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Generation failed')
      }

      setJobId(data.jobId)
      toast.success('Image generation started')

      // Reset form
      setPrompt('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  if (jobId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Generation in Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            <p>Job ID: {jobId}</p>
          </div>
          <p className="text-sm text-slate-600">
            Your images are being generated. Check back in a few moments.
          </p>
          <Button onClick={() => setJobId(null)} variant="outline">
            Start Another Generation
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Generate Image
        </CardTitle>
        <CardDescription>Create branded images with your character</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Prompt */}
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="Describe the image you want to generate..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-24"
            />
            <p className="text-xs text-slate-500">
              Your character and brand colors will be automatically included.
            </p>
          </div>

          {/* Provider */}
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as 'fal' | 'banana')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fal">FAL (Fast, High Quality)</SelectItem>
                <SelectItem value="banana">Banana (Budget Friendly)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Carousel vs Single */}
          <div className="flex items-center gap-3">
            <Checkbox
              id="carousel"
              checked={isCarousel}
              onCheckedChange={(checked) => setIsCarousel(checked === true)}
            />
            <Label htmlFor="carousel" className="font-normal cursor-pointer">
              Generate Carousel (3 coordinated images)
            </Label>
          </div>

          {!isCarousel && (
            <div className="space-y-2">
              <Label htmlFor="num-images">Number of Images</Label>
              <Select value={numImages.toString()} onValueChange={(v) => setNumImages(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Image</SelectItem>
                  <SelectItem value="2">2 Images</SelectItem>
                  <SelectItem value="3">3 Images</SelectItem>
                  <SelectItem value="4">4 Images</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Image
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
