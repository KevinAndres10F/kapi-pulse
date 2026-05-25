'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Send,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { BriefForm, type Brief } from '@/components/studio/brief-form'
import { ImageGrid } from '@/components/studio/image-grid'
import { VideoPreview } from '@/components/studio/video-preview'
import { AvatarSelector } from '@/components/studio/avatar-selector'
import { CopyEditor, type CopyVariant } from '@/components/studio/copy-editor'
import { AccountPicker } from '@/components/studio/account-picker'
import { StepperProgress, type Step } from '@/components/studio/stepper-progress'
import { useGenerationJob } from '@/components/studio/use-generation-job'
import {
  createCampaign,
  dispatchAvatarGen,
  dispatchCopyGen,
  dispatchImageGen,
  dispatchVideoGen,
  fetchCapabilities,
  fetchJob,
  packageCampaign,
  patchCampaign,
  publishCampaign,
  type StudioCapabilities,
} from '@/lib/studio/api'

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Brief',
  2: 'Imágenes',
  3: 'Video',
  4: 'Avatar UGC',
  5: 'Copy',
  6: 'Publicar',
}

export function WizardClient({ orgId, orgSlug }: { orgId: string; orgSlug: string }) {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>(1)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [campaignName, setCampaignName] = useState('Nueva campaña')
  const [brief, setBrief] = useState<Brief | null>(null)
  const [capabilities, setCapabilities] = useState<StudioCapabilities | null>(null)

  useEffect(() => {
    fetchCapabilities(orgId)
      .then(setCapabilities)
      .catch((err) => console.warn('[wizard] capabilities fetch failed:', err))
  }, [orgId])

  const [imageJobId, setImageJobId] = useState<string | null>(null)
  const imageJob = useGenerationJob(imageJobId, orgId)
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set())

  const [videoJobs, setVideoJobs] = useState<Array<{ jobId: string; sourceAssetId: string }>>([])

  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [voiceId, setVoiceId] = useState<string | null>(null)
  const [script, setScript] = useState('')
  const [avatarJobId, setAvatarJobId] = useState<string | null>(null)
  const avatarJob = useGenerationJob(avatarJobId, orgId)

  const [copyJobId, setCopyJobId] = useState<string | null>(null)
  const [copyVariants, setCopyVariants] = useState<CopyVariant[]>([])
  const [copyPlatforms, setCopyPlatforms] = useState<string[]>(['instagram', 'facebook'])

  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set())
  const [publishing, setPublishing] = useState(false)
  const [packageUrl, setPackageUrl] = useState<string | null>(null)
  const [packaging, setPackaging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const steps: Step[] = ([1, 2, 3, 4, 5, 6] as WizardStep[]).map((n) => ({
    number: n,
    label: STEP_LABELS[n],
    state: n === step ? 'active' : n < step ? 'done' : 'pending',
  }))

  async function handleBriefSubmit(b: Brief) {
    setBrief(b)
    setError(null)
    try {
      const res = await createCampaign(orgId, campaignName || b.product.slice(0, 60), b)
      setCampaignId(res.campaign.id)
      setCampaignName(res.campaign.name)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleGenerateImages() {
    if (!brief || !campaignId) return
    setError(null)
    try {
      const prompt = `${brief.product}. ${brief.tone ? `Estilo ${brief.tone.toLowerCase()}.` : ''} Fotografía de producto, iluminación profesional.`
      const res = await dispatchImageGen(orgId, {
        prompt,
        numImages: 4,
        imageSize: 'square_hd',
        campaignId,
      })
      setImageJobId(res.jobId)
      setSelectedImageIds(new Set())
    } catch (err) {
      const e = err as Error & { code?: string; balance?: number; required?: number }
      if (e.code === 'INSUFFICIENT_CREDITS') {
        setError(`Créditos insuficientes. Balance: ${e.balance}, requeridos: ${e.required}`)
      } else {
        setError(e.message)
      }
    }
  }

  async function continueToVideoStep() {
    if (!campaignId) return
    try {
      await patchCampaign(orgId, campaignId, {
        step: {
          stepNumber: 2,
          update: { state: 'done', selectedAssetIds: Array.from(selectedImageIds) },
        },
      })
      setStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleAnimate(assetId: string) {
    if (!brief || !campaignId) return
    setError(null)
    try {
      const res = await dispatchVideoGen(orgId, {
        prompt: `${brief.product}. Movimiento sutil, cámara lenta.`,
        sourceAssetId: assetId,
        duration: 5,
        aspectRatio: brief.format === 'reel' || brief.format === 'story' ? '9:16' : '1:1',
        campaignId,
      })
      setVideoJobs((prev) => [...prev, { jobId: res.jobId, sourceAssetId: assetId }])
    } catch (err) {
      const e = err as Error & { code?: string }
      setError(e.message)
    }
  }

  async function continueToAvatarStep() {
    if (!campaignId) return
    try {
      const videoAssetIds: string[] = []
      for (const v of videoJobs) {
        const j = await fetchJob(v.jobId, orgId).catch(() => null)
        if (j?.job.status === 'succeeded') {
          videoAssetIds.push(...j.assets.map((a) => a.id))
        }
      }
      await patchCampaign(orgId, campaignId, {
        step: { stepNumber: 3, update: { state: 'done', selectedAssetIds: videoAssetIds } },
      })
      setStep(4)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function skipAvatar() {
    if (!campaignId) return
    patchCampaign(orgId, campaignId, {
      step: { stepNumber: 4, update: { state: 'skipped' } },
    }).then(() => setStep(5))
  }

  async function handleGenerateAvatar() {
    if (!avatarId || !voiceId || !script.trim() || !campaignId) {
      setError('Seleccioná avatar, voz y escribí un script.')
      return
    }
    setError(null)
    try {
      const res = await dispatchAvatarGen(orgId, {
        avatarId,
        voiceId,
        script,
        campaignId,
      })
      setAvatarJobId(res.jobId)
    } catch (err) {
      const e = err as Error & { code?: string }
      setError(e.message)
    }
  }

  async function continueAfterAvatar() {
    if (!campaignId) return
    const avatarAssetIds = avatarJob.assets.map((a) => a.id)
    await patchCampaign(orgId, campaignId, {
      step: { stepNumber: 4, update: { state: 'done', selectedAssetIds: avatarAssetIds } },
    })
    setStep(5)
  }

  async function handleGenerateCopy() {
    if (!brief || !campaignId) return
    setError(null)
    try {
      const res = await dispatchCopyGen(orgId, {
        brief: brief as unknown as Record<string, unknown>,
        platforms: copyPlatforms,
        nVariants: 1,
        campaignId,
      })
      setCopyJobId(res.jobId)
    } catch (err) {
      const e = err as Error & { code?: string }
      setError(e.message)
    }
  }

  const copyJob = useGenerationJob(copyJobId, orgId)

  useEffect(() => {
    if (copyJob.state !== 'succeeded' || copyJob.assets.length === 0) return
    if (copyVariants.length > 0) return
    const first = copyJob.assets[0]
    if (!first.signed_url) return
    fetch(first.signed_url)
      .then((r) => r.json())
      .then((data: { variants?: CopyVariant[] }) => setCopyVariants(data.variants || []))
      .catch((err) => console.warn('[copy] fetch failed:', err))
  }, [copyJob.state, copyJob.assets, copyVariants.length])

  async function continueToPublish() {
    if (!campaignId) return
    await patchCampaign(orgId, campaignId, {
      step: { stepNumber: 5, update: { state: 'done', result: { variants: copyVariants } } },
    })
    setStep(6)
  }

  async function handlePackage() {
    if (!campaignId) return
    setPackaging(true)
    setError(null)
    try {
      await packageCampaign(orgId, campaignId)
      setPackageUrl('queued')
      toast.success('Paquete encolado.', {
        description: 'Refrescá la página de la campaña en 1 minuto para descargar.',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPackaging(false)
    }
  }

  async function handlePublish(scheduledAt?: string) {
    if (!campaignId || selectedAccountIds.size === 0 || copyVariants.length === 0) {
      setError('Seleccioná cuentas y verificá el copy.')
      return
    }
    setPublishing(true)
    setError(null)

    const allAssetIds = [
      ...Array.from(selectedImageIds),
      ...avatarJob.assets.map((a) => a.id),
    ]
    if (allAssetIds.length === 0) {
      setError('No hay assets seleccionados para publicar.')
      setPublishing(false)
      return
    }

    try {
      const targets = Array.from(selectedAccountIds).map((accountId) => {
        const cv = copyVariants[0]
        return {
          socialAccountId: accountId,
          content: cv.content,
          hashtags: cv.hashtags,
          assetIds: allAssetIds,
        }
      })

      const res = await publishCampaign(orgId, campaignId, { targets, scheduledAt })
      router.push(`/${orgSlug}/calendar/new?postId=${res.postId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <Input
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            className="h-auto border-0 border-b border-input bg-transparent px-0 py-1 text-2xl font-semibold tracking-tight shadow-none focus-visible:ring-0 focus-visible:border-ring rounded-none"
          />
        </div>
        <StepperProgress steps={steps} onStepClick={(n) => setStep(n as WizardStep)} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1 · Brief del producto</CardTitle>
            <CardDescription>Contanos qué vas a promocionar y a quién.</CardDescription>
          </CardHeader>
          <CardContent>
            <BriefForm
              orgId={orgId}
              initialBrief={brief || undefined}
              onSubmit={handleBriefSubmit}
              submitLabel="Crear campaña"
            />
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2 · Imágenes de producto</CardTitle>
            <CardDescription>Generamos 4 variantes con Flux. Seleccioná las que más te gustan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="gradient"
              onClick={handleGenerateImages}
              loading={imageJob.state === 'queued' || imageJob.state === 'running'}
              disabled={imageJob.state === 'queued' || imageJob.state === 'running'}
            >
              {!(imageJob.state === 'queued' || imageJob.state === 'running') && (
                <Sparkles className="size-4" />
              )}
              {imageJob.state === 'idle' || imageJob.state === 'failed'
                ? 'Generar imágenes (32 créditos)'
                : 'Generando…'}
            </Button>

            {imageJobId && (
              <ImageGrid
                assets={imageJob.assets}
                selectedIds={selectedImageIds}
                onToggle={(id) =>
                  setSelectedImageIds((s) => {
                    const next = new Set(s)
                    if (next.has(id)) next.delete(id)
                    else next.add(id)
                    return next
                  })
                }
                loading={imageJob.state === 'queued' || imageJob.state === 'running'}
                expectedCount={4}
              />
            )}

            <NavButtons
              onBack={() => setStep(1)}
              onNext={continueToVideoStep}
              nextDisabled={selectedImageIds.size === 0}
              nextLabel="Continuar a video"
            />
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3 · Animar imágenes</CardTitle>
            <CardDescription>
              Convertimos imágenes seleccionadas en videos de 5s con Kling AI (80 créditos por video).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from(selectedImageIds).map((assetId) => {
                const jobInfo = videoJobs.find((v) => v.sourceAssetId === assetId)
                return (
                  <div
                    key={assetId}
                    className="rounded-xl border border-border bg-muted/30 p-3"
                  >
                    {!jobInfo ? (
                      <Button variant="gradient" size="sm" onClick={() => handleAnimate(assetId)}>
                        Animar este (80 créditos)
                      </Button>
                    ) : (
                      <VideoJobPreview jobId={jobInfo.jobId} orgId={orgId} />
                    )}
                  </div>
                )
              })}
            </div>

            <NavButtons onBack={() => setStep(2)} onNext={continueToAvatarStep} />
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4 · UGC con avatar IA (opcional)</CardTitle>
            <CardDescription>
              Video vertical de una persona hablando del producto. Requiere HeyGen o Hedra (120 créditos).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {capabilities && !capabilities.avatar ? (
              <Alert variant="warning">
                <AlertCircle className="size-4" />
                <AlertTitle>Avatar UGC no habilitado</AlertTitle>
                <AlertDescription>
                  Tu instalación no tiene{' '}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">HEYGEN_API_KEY</code> ni{' '}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">HEDRA_API_KEY</code>.
                  Podés saltar este paso y seguir con el copy.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <AvatarSelector
                  orgId={orgId}
                  selectedAvatarId={avatarId}
                  selectedVoiceId={voiceId}
                  onAvatarSelect={setAvatarId}
                  onVoiceSelect={setVoiceId}
                />

                <div className="space-y-1.5">
                  <Label htmlFor="script">Script (lo que dice el avatar)</Label>
                  <Textarea
                    id="script"
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    rows={4}
                    placeholder={
                      brief
                        ? `Hablale a ${brief.audience || 'tu audiencia'} sobre ${brief.product}`
                        : ''
                    }
                  />
                </div>

                <Button
                  variant="gradient"
                  onClick={handleGenerateAvatar}
                  loading={avatarJob.state === 'queued' || avatarJob.state === 'running'}
                  disabled={avatarJob.state === 'queued' || avatarJob.state === 'running'}
                >
                  {!(avatarJob.state === 'queued' || avatarJob.state === 'running') && (
                    <Sparkles className="size-4" />
                  )}
                  Generar avatar (120 créditos)
                </Button>

                {avatarJobId && (
                  <VideoPreview
                    asset={avatarJob.assets[0]}
                    state={avatarJob.state}
                    error={avatarJob.error}
                    label={avatarJob.state === 'succeeded' ? 'Avatar listo' : `Estado: ${avatarJob.state}`}
                  />
                )}
              </>
            )}

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep(3)}>
                <ChevronLeft className="size-4" />
                Volver
              </Button>
              <div className="flex gap-2">
                {capabilities?.avatar === false ? (
                  <Button variant="gradient" onClick={skipAvatar}>
                    Saltar y continuar
                    <ChevronRight className="size-4" />
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={skipAvatar}>
                      Saltar
                    </Button>
                    <Button variant="gradient" onClick={continueAfterAvatar}>
                      Continuar
                      <ChevronRight className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">5 · Copy y hashtags</CardTitle>
            <CardDescription>Claude genera copy adaptado a cada red (2 créditos por bundle).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Plataformas</Label>
              <div className="flex flex-wrap gap-2">
                {['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'threads'].map((p) => {
                  const active = copyPlatforms.includes(p)
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() =>
                        setCopyPlatforms((prev) =>
                          prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
                        )
                      }
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium capitalize transition-all',
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card text-foreground hover:border-primary/40',
                      )}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>

            <Button
              variant="gradient"
              onClick={handleGenerateCopy}
              loading={copyJob.state === 'queued' || copyJob.state === 'running'}
              disabled={
                copyJob.state === 'queued' || copyJob.state === 'running' || copyPlatforms.length === 0
              }
            >
              {!(copyJob.state === 'queued' || copyJob.state === 'running') && (
                <Sparkles className="size-4" />
              )}
              Generar copy
            </Button>

            {copyVariants.length > 0 && <CopyEditor variants={copyVariants} onChange={setCopyVariants} />}

            <NavButtons
              onBack={() => setStep(4)}
              onNext={continueToPublish}
              nextDisabled={copyVariants.length === 0}
            />
          </CardContent>
        </Card>
      )}

      {step === 6 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">6 · Publicar o descargar</CardTitle>
            <CardDescription>Elegí cuentas y publicá ahora, o descargá un paquete listo para subir manualmente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Cuentas destino (Instagram / Facebook)</Label>
              <AccountPicker
                orgId={orgId}
                selectedIds={selectedAccountIds}
                onChange={setSelectedAccountIds}
                filterProviders={['instagram', 'facebook']}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="gradient"
                onClick={() => handlePublish()}
                loading={publishing}
                disabled={publishing || selectedAccountIds.size === 0}
              >
                {!publishing && <Send className="size-4" />}
                Publicar ahora
              </Button>
              <Button variant="outline" onClick={handlePackage} loading={packaging} disabled={packaging}>
                {!packaging && <Download className="size-4" />}
                Descargar paquete
              </Button>
            </div>

            {packageUrl === 'queued' && (
              <Alert variant="success">
                <AlertDescription>
                  Paquete en proceso. Refrescá la página de la campaña en 1 minuto para descargar.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setStep(5)}>
                <ChevronLeft className="size-4" />
                Volver
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function VideoJobPreview({ jobId, orgId }: { jobId: string; orgId: string }) {
  const job = useGenerationJob(jobId, orgId)
  return (
    <VideoPreview
      asset={job.assets[0]}
      state={job.state}
      error={job.error}
      label={job.state === 'succeeded' ? 'Video listo' : `Estado: ${job.state}`}
    />
  )
}

function NavButtons({
  onBack,
  onNext,
  nextDisabled,
  nextLabel = 'Continuar',
}: {
  onBack: () => void
  onNext: () => void
  nextDisabled?: boolean
  nextLabel?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ChevronLeft className="size-4" />
        Volver
      </Button>
      <Button variant="gradient" onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}

const _typeCheck: typeof Loader2 = Loader2
void _typeCheck
