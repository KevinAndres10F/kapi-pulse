/**
 * Eleven Labs Text-to-Speech Provider
 * Generates natural voice audio for character profiles
 */

export interface ElevenLabsAudioResult {
  audioUrl: string
  duration: number // in seconds
  requestId: string
}

export interface ElevenLabsGenerateAudioInput {
  text: string
  voiceId: string
  modelId?: string
  stability?: number // 0-1
  similarityBoost?: number // 0-1
}

const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY
const ELEVEN_LABS_BASE_URL = 'https://api.elevenlabs.io/v1'

if (!ELEVEN_LABS_API_KEY) {
  throw new Error('ELEVEN_LABS_API_KEY environment variable is required')
}

export async function elevenLabsGenerateAudio(input: ElevenLabsGenerateAudioInput): Promise<ElevenLabsAudioResult> {
  const { text, voiceId, modelId = 'eleven_monolingual_v1', stability = 0.5, similarityBoost = 0.75 } = input

  const url = `${ELEVEN_LABS_BASE_URL}/text-to-speech/${voiceId}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_LABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability,
        similarity_boost: similarityBoost,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Eleven Labs API error (${response.status}): ${error}`)
  }

  const audioBuffer = await response.arrayBuffer()
  const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })

  // Calculate approximate duration from audio buffer
  // MP3 bitrate is typically 128kbps, but this is an approximation
  const durationSeconds = (audioBuffer.byteLength * 8) / (128 * 1000) // rough estimate

  // Create a temporary URL for the audio
  // In production, this should be uploaded to storage
  const audioUrl = URL.createObjectURL(audioBlob)

  return {
    audioUrl,
    duration: durationSeconds,
    requestId: response.headers.get('x-request-id') || `eleven-labs-${Date.now()}`,
  }
}

/**
 * Get available voices for an organization
 * Caches the list in memory
 */
let voicesCache: Array<{ id: string; name: string; description?: string }> | null = null
let voicesCacheTime = 0
const VOICES_CACHE_TTL = 3600000 // 1 hour

export async function elevenLabsGetVoices() {
  // Return cached if still valid
  if (voicesCache && Date.now() - voicesCacheTime < VOICES_CACHE_TTL) {
    return voicesCache
  }

  const url = `${ELEVEN_LABS_BASE_URL}/voices`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'xi-api-key': ELEVEN_LABS_API_KEY,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Eleven Labs voices API error (${response.status}): ${error}`)
  }

  const data = (await response.json()) as { voices: Array<{ voice_id: string; name: string; description?: string }> }
  voicesCache = data.voices.map((v) => ({ id: v.voice_id, name: v.name, description: v.description }))
  voicesCacheTime = Date.now()

  return voicesCache
}
