'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Loader2, ChevronRight, ChevronLeft, Download, Send, AlertCircle } from 'lucide-react'
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
  patchCampaign,
  dispatchImageGen,
  dispatchVideoGen,
  dispatchAvatarGen,
  dispatchCopyGen,
  packageCampaign,
  publishCampaign,
  fetchJob,
  fetchCapabilities,
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

  // Step 2 — imágenes
  const [imageJobId, setImageJobId] = useState<string | null>(null)
  const imageJob = useGenerationJob(imageJobId, orgId)
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set())

  // Step 3 — videos
  const [videoJobs, setVideoJobs] = useState<Array<{ jobId: string; sourceAssetId: string }>>([])

  // Step 4 — avatar UGC
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const [voiceId, setVoiceId] = useState<string | null>(null)
  const [script, setScript] = useState('')
  const [avatarJobId, setAvatarJobId] = useState<string | null>(null)
  const avatarJob = useGenerationJob(avatarJobId, orgId)

  // Step 5 — copy
  const [copyJobId, setCopyJobId] = useState<string | null>(null)
  const [copyVariants, setCopyVariants] = useState<CopyVariant[]>([])
  const [copyPlatforms, setCopyPlatforms] = useState<string[]>(['instagram', 'facebook'])

  // Step 6 — publicar
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

  // --- Step 1 ---
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

  // --- Step 2: generar imágenes ---
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

  // --- Step 3: animar imagen seleccionada ---
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
      // collect succeeded video assets
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

  // --- Step 4: avatar ---
  async function handleGenerateAvatar() {
    if (!avatarId || !voiceId || !script.trim() || !campaignId) {
      setError('Selecciona avatar, voz y escribe un script')
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

  // --- Step 5: copy ---
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

  // --- Step 6: publicar / paquete ---
  async function handlePackage() {
    if (!campaignId) return
    setPackaging(true)
    setError(null)
    try {
      await packageCampaign(orgId, campaignId)
      // package job runs in background; user re-visits campaign detail to download
      setPackageUrl('queued')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPackaging(false)
    }
  }

  async function handlePublish(scheduledAt?: string) {
    if (!campaignId || selectedAccountIds.size === 0 || copyVariants.length === 0) {
      setError('Selecciona cuentas y verifica el copy')
      return
    }
    setPublishing(true)
    setError(null)

    // map content per platform → social account
    const allAssetIds = [
      ...Array.from(selectedImageIds),
      ...avatarJob.assets.map((a) => a.id),
    ]
    if (allAssetIds.length === 0) {
      setError('No hay assets seleccionados para publicar')
      setPublishing(false)
      return
    }

    try {
      // Get social_account → provider mapping via DOM data set is not available
      // Just use first matching copy variant for each account
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
      <div>
        <input
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          className="w-full max-w-xl border-b-2 border-transparent bg-transparent text-2xl font-bold text-gray-900 outline-none focus:border-blue-600"
        />
        <div className="mt-4">
          <StepperProgress steps={steps} onStepClick={(n) => setStep(n as WizardStep)} />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* Step 1 — Brief */}
      {step === 1 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">1. Brief del producto</h2>
          <BriefForm orgId={orgId} initialBrief={brief || undefined} onSubmit={handleBriefSubmit} submitLabel="Crear campaña" />
        </section>
      )}

      {/* Step 2 — Imágenes */}
      {step === 2 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-2 text-lg font-semibold">2. Imágenes de producto</h2>
          <p className="mb-4 text-sm text-gray-500">
            Generamos 4 variantes con Flux. Seleccioná las que más te gustan.
          </p>

          <button
            onClick={handleGenerateImages}
            disabled={imageJob.state === 'queued' || imageJob.state === 'running'}
            className="mb-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {(imageJob.state === 'queued' || imageJob.state === 'running') && <Loader2 className="h-4 w-4 animate-spin" />}
            {imageJob.state === 'idle' || imageJob.state === 'failed' ? 'Generar imágenes (32 créditos)' : 'Generando...'}
          </button>

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

          <div className="mt-6 flex items-center justify-between">
            <button onClick={() => setStep(1)} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
              <ChevronLeft className="h-4 w-4" /> Volver
            </button>
            <button
              onClick={continueToVideoStep}
              disabled={selectedImageIds.size === 0}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Continuar a video <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* Step 3 — Video */}
      {step === 3 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-2 text-lg font-semibold">3. Animar imágenes</h2>
          <p className="mb-4 text-sm text-gray-500">
            Convertimos imágenes seleccionadas en videos de 5s con Kling AI (80 créditos por video).
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from(selectedImageIds).map((assetId) => {
              const jobInfo = videoJobs.find((v) => v.sourceAssetId === assetId)
              return (
                <div key={assetId} className="rounded-xl border border-gray-200 p-3">
                  {!jobInfo ? (
                    <button
                      onClick={() => handleAnimate(assetId)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      Animar este (80 créditos)
                    </button>
                  ) : (
                    <VideoJobPreview jobId={jobInfo.jobId} orgId={orgId} />
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button onClick={() => setStep(2)} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
              <ChevronLeft className="h-4 w-4" /> Volver
            </button>
            <button
              onClick={continueToAvatarStep}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Continuar <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* Step 4 — Avatar UGC */}
      {step === 4 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-2 text-lg font-semibold">4. UGC con avatar IA (opcional)</h2>
          <p className="mb-4 text-sm text-gray-500">
            Genera un video vertical de una persona hablando del producto. Requiere configurar HeyGen
            o Hedra en el backend (120 créditos).
          </p>

          {capabilities && !capabilities.avatar ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Avatar UGC no está habilitado en este entorno</p>
                  <p className="mt-1 text-xs text-amber-700">
                    Tu instalación no tiene <code className="rounded bg-amber-100 px-1">HEYGEN_API_KEY</code> ni{' '}
                    <code className="rounded bg-amber-100 px-1">HEDRA_API_KEY</code> configurada. Podés
                    saltar este paso y seguir con el copy + publicación. Configurá una de esas claves cuando
                    quieras incorporar avatares al flujo.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <AvatarSelector
                orgId={orgId}
                selectedAvatarId={avatarId}
                selectedVoiceId={voiceId}
                onAvatarSelect={setAvatarId}
                onVoiceSelect={setVoiceId}
              />

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Script (lo que dice el avatar)</label>
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  rows={4}
                  placeholder={brief ? `Hablale a ${brief.audience || 'tu audiencia'} sobre ${brief.product}` : ''}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <button
                onClick={handleGenerateAvatar}
                disabled={avatarJob.state === 'queued' || avatarJob.state === 'running'}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {(avatarJob.state === 'queued' || avatarJob.state === 'running') && <Loader2 className="h-4 w-4 animate-spin" />}
                Generar avatar (120 créditos)
              </button>

              {avatarJobId && (
                <VideoPreview
                  asset={avatarJob.assets[0]}
                  state={avatarJob.state}
                  error={avatarJob.error}
                  label={avatarJob.state === 'succeeded' ? 'Avatar listo' : `Estado: ${avatarJob.state}`}
                />
              )}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button onClick={() => setStep(3)} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
              <ChevronLeft className="h-4 w-4" /> Volver
            </button>
            <div className="flex gap-2">
              {capabilities?.avatar === false ? (
                <button
                  onClick={skipAvatar}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Saltar y continuar <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <>
                  <button onClick={skipAvatar} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
                    Saltar
                  </button>
                  <button
                    onClick={continueAfterAvatar}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Continuar <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Step 5 — Copy */}
      {step === 5 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-2 text-lg font-semibold">5. Copy y hashtags</h2>
          <p className="mb-4 text-sm text-gray-500">Claude genera copy adaptado a cada red (2 créditos por bundle).</p>

          <div className="mb-4">
            <label className="mb-1 block text-xs font-semibold text-gray-700">Plataformas</label>
            <div className="flex flex-wrap gap-2">
              {['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'threads'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    setCopyPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
                  }
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    copyPlatforms.includes(p) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerateCopy}
            disabled={copyJob.state === 'queued' || copyJob.state === 'running' || copyPlatforms.length === 0}
            className="mb-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {(copyJob.state === 'queued' || copyJob.state === 'running') && <Loader2 className="h-4 w-4 animate-spin" />}
            Generar copy
          </button>

          {copyVariants.length > 0 && <CopyEditor variants={copyVariants} onChange={setCopyVariants} />}

          <div className="mt-6 flex items-center justify-between">
            <button onClick={() => setStep(4)} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
              <ChevronLeft className="h-4 w-4" /> Volver
            </button>
            <button
              onClick={continueToPublish}
              disabled={copyVariants.length === 0}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Continuar <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* Step 6 — Publicar */}
      {step === 6 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">6. Publicar o descargar</h2>

          <div className="space-y-6">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Cuentas destino (Instagram / Facebook)</h3>
              <AccountPicker
                orgId={orgId}
                selectedIds={selectedAccountIds}
                onChange={setSelectedAccountIds}
                filterProviders={['instagram', 'facebook']}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handlePublish()}
                disabled={publishing || selectedAccountIds.size === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Publicar ahora
              </button>

              <button
                onClick={handlePackage}
                disabled={packaging}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {packaging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Descargar paquete
              </button>
            </div>

            {packageUrl === 'queued' && (
              <p className="text-sm text-emerald-700">
                Paquete en proceso. Refrescá la página de la campaña en 1 minuto para descargar.
              </p>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button onClick={() => setStep(5)} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
              <ChevronLeft className="h-4 w-4" /> Volver
            </button>
          </div>
        </section>
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
