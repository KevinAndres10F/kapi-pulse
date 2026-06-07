'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  CharacterSelector,
  BrandGuidelinesViewer,
  ImageGenerationForm,
  ValidationViewer,
  PublishingForm,
  DashboardOverview,
} from '@/components/studio/branded'
import { createClient } from '@/lib/supabase/client'
import { Image, CheckCircle, Send, BarChart3, Sparkles } from 'lucide-react'

export function BrandedClient({ orgId }: { orgId: string }) {
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('')
  const [generatedAssetIds, setGeneratedAssetIds] = useState<string[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token)
    })
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Branded Content Studio</h1>
          <p className="text-sm text-muted-foreground">
            Crea contenido profesional con tu personaje e identidad de marca
          </p>
        </div>
      </div>

      <Tabs defaultValue="generate" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="generate" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            <span className="hidden sm:inline">Generar</span>
          </TabsTrigger>
          <TabsTrigger value="validate" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Validar</span>
          </TabsTrigger>
          <TabsTrigger value="publish" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Publicar</span>
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
              <CharacterSelector orgId={orgId} accessToken={accessToken} onSelect={setSelectedCharacterId} />
              <BrandGuidelinesViewer orgId={orgId} accessToken={accessToken} />
            </div>
            <div>
              <ImageGenerationForm
                characterId={selectedCharacterId}
                orgId={orgId}
                accessToken={accessToken}
                onAssetsGenerated={(ids) =>
                  setGeneratedAssetIds((prev) => Array.from(new Set([...prev, ...ids])))
                }
              />
            </div>
          </div>
        </TabsContent>

        {/* Validate Tab */}
        <TabsContent value="validate" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-6 space-y-4">
              <h3 className="font-semibold">Assets generados</h3>
              {generatedAssetIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aún no hay assets. Crea algunos en la pestaña Generar.
                </p>
              ) : (
                <div className="space-y-2">
                  {generatedAssetIds.map((id) => (
                    <div key={id} className="rounded bg-card p-2 text-sm text-muted-foreground truncate">
                      {id.slice(0, 20)}...
                    </div>
                  ))}
                </div>
              )}
            </div>

            {generatedAssetIds.length > 0 && (
              <ValidationViewer assetId={generatedAssetIds[0]} orgId={orgId} accessToken={accessToken} />
            )}
          </div>
        </TabsContent>

        {/* Publish Tab */}
        <TabsContent value="publish" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-6 space-y-4">
              <h3 className="font-semibold">¿Listo para publicar?</h3>
              {generatedAssetIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Genera contenido, valídalo, y publícalo aquí.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {generatedAssetIds.length} asset(s) listos para publicar
                </p>
              )}
            </div>

            {generatedAssetIds.length > 0 && (
              <PublishingForm assetIds={generatedAssetIds} orgId={orgId} accessToken={accessToken} />
            )}
          </div>
        </TabsContent>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          <DashboardOverview orgId={orgId} accessToken={accessToken} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
