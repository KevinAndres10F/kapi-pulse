const HEDRA_API_URL = process.env.HEDRA_API_URL || 'https://mercury.dev.dream-ai.com/api/v1'
const HEDRA_API_KEY = process.env.HEDRA_API_KEY

function authHeaders() {
  if (!HEDRA_API_KEY) throw new Error('HEDRA_API_KEY is not configured')
  return { 'X-API-Key': HEDRA_API_KEY, 'Content-Type': 'application/json' }
}

export async function hedraRun(req: {
  characterImageUrl: string
  audioUrl?: string
  script?: string
  voiceId?: string
  aspectRatio?: '1:1' | '9:16' | '16:9'
}): Promise<{ generationId: string; videoUrl: string }> {
  const submit = await fetch(`${HEDRA_API_URL}/characters`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      text: req.script,
      voiceId: req.voiceId,
      voiceUrl: req.audioUrl,
      avatarImage: req.characterImageUrl,
      aspectRatio: req.aspectRatio || '9:16',
    }),
  })
  if (!submit.ok) {
    const text = await submit.text().catch(() => '')
    throw new Error(`Hedra submit failed (${submit.status}): ${text}`)
  }
  const submitData = (await submit.json()) as { jobId?: string; generationId?: string }
  const generationId = submitData.generationId || submitData.jobId
  if (!generationId) throw new Error('Hedra missing generation id')

  const started = Date.now()
  while (true) {
    if (Date.now() - started > 10 * 60_000) throw new Error('Hedra timed out')
    await new Promise((r) => setTimeout(r, 5000))
    const poll = await fetch(`${HEDRA_API_URL}/projects/${generationId}`, { headers: authHeaders() })
    if (!poll.ok) throw new Error(`Hedra poll failed: ${poll.status}`)
    const data = (await poll.json()) as { status: string; videoUrl?: string; errorMessage?: string }
    const status = String(data.status).toLowerCase()
    if (status.includes('complet') && data.videoUrl) {
      return { generationId, videoUrl: data.videoUrl }
    }
    if (status.includes('error') || status.includes('fail')) {
      throw new Error(`Hedra failed: ${data.errorMessage || 'unknown'}`)
    }
  }
}
