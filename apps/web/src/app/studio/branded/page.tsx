/**
 * Branded Content Generation Studio
 * Main page for creating professional, branded marketing content
 */

'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CharacterSelector,
  BrandGuidelinesViewer,
  ImageGenerationForm,
  ValidationViewer,
  PublishingForm,
  DashboardOverview,
} from '@/components/studio/branded'
import { PageHeader } from '@/components/page-header'
import { Sparkles, Palette, Image, CheckCircle, Send, BarChart3 } from 'lucide-react'

export default function BrandedStudioPage() {
  const [selectedCharacterId, setSelectedCharacterId] = useState('gema')
  const [generatedAssetIds, setGeneratedAssetIds] = useState<string[]>([])
  const [orgId] = useState(process.env.NEXT_PUBLIC_ORG_ID || 'test-org')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branded Content Studio"
        description="Create professional marketing content with your character and brand identity"
        icon={<Sparkles className="h-6 w-6" />}
      />

      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            <span className="hidden sm:inline">Generate</span>
          </TabsTrigger>
          <TabsTrigger value="validate" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Validate</span>
          </TabsTrigger>
          <TabsTrigger value="publish" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Publish</span>
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-6">
              <CharacterSelector />
              <BrandGuidelinesViewer />
            </div>
            <div>
              <ImageGenerationForm characterId={selectedCharacterId} orgId={orgId} />
            </div>
          </div>
        </TabsContent>

        {/* Validate Tab */}
        <TabsContent value="validate" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="rounded-lg bg-slate-50 p-6 space-y-4">
                <h3 className="font-semibold">Generated Assets</h3>
                {generatedAssetIds.length === 0 ? (
                  <p className="text-sm text-slate-600">No assets generated yet. Create some in the Generate tab.</p>
                ) : (
                  <div className="space-y-2">
                    {generatedAssetIds.map((id) => (
                      <div key={id} className="rounded bg-white p-2 text-sm text-slate-600 truncate">
                        {id.slice(0, 20)}...
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {generatedAssetIds.length > 0 && (
              <ValidationViewer assetId={generatedAssetIds[0]} />
            )}
          </div>
        </TabsContent>

        {/* Publish Tab */}
        <TabsContent value="publish" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <div className="rounded-lg bg-slate-50 p-6 space-y-4">
                <h3 className="font-semibold">Ready to Publish?</h3>
                {generatedAssetIds.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    Generate content in the Generate tab, validate it, then publish here.
                  </p>
                ) : (
                  <p className="text-sm text-slate-600">
                    {generatedAssetIds.length} asset(s) ready to publish
                  </p>
                )}
              </div>
            </div>

            {generatedAssetIds.length > 0 && (
              <PublishingForm assetIds={generatedAssetIds} orgId={orgId} />
            )}
          </div>
        </TabsContent>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <DashboardOverview />
        </TabsContent>
      </Tabs>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <h4 className="font-semibold text-sm">Smart Generation</h4>
          </div>
          <p className="text-xs text-slate-600">
            Your character and brand colors are automatically injected into prompts.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <h4 className="font-semibold text-sm">Auto Validation</h4>
          </div>
          <p className="text-xs text-slate-600">
            Every asset is validated for brand compliance before publishing.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-purple-500" />
            <h4 className="font-semibold text-sm">Multi-Platform</h4>
          </div>
          <p className="text-xs text-slate-600">
            Publish to Instagram, TikTok, LinkedIn, Facebook, and more.
          </p>
        </div>
      </div>
    </div>
  )
}
