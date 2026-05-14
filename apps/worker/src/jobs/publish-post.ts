/**
 * Job de publicación de posts en redes sociales.
 * Retry exponencial: 3 intentos con backoff 2^attempt * 30s.
 * Si falla definitivamente, marca el post y variantes como 'failed'.
 */

import { createClient } from '@supabase/supabase-js'

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key || key.length !== 64) throw new Error('TOKEN_ENCRYPTION_KEY inválido')
  return Buffer.from(key, 'hex')
}

function decryptToken(encryptedStr: string): string {
  const { createDecipheriv } = require('node:crypto')
  const key = getEncryptionKey()
  const [ivHex, authTagHex, encrypted] = encryptedStr.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'kapi_pulse' },
    },
  )
}

interface PublishJobData {
  postId: string
}

/**
 * Publica un post en todas sus variantes (redes sociales).
 * Cada variante se publica de forma independiente.
 */
export async function publishPost(data: PublishJobData) {
  const supabase = getSupabase()
  const { postId } = data

  console.log(`[publish] Iniciando publicación del post ${postId}`)

  // Obtener el post con variantes y cuentas sociales
  const { data: post, error: postError } = await supabase
    .from('posts')
    .select(`
      *,
      post_variants (
        id, social_account_id, content, hashtags, link_url, status,
        social_accounts (
          id, provider, access_token_encrypted, external_id, status, metadata
        )
      )
    `)
    .eq('id', postId)
    .single()

  if (postError || !post) {
    throw new Error(`Post ${postId} no encontrado: ${postError?.message}`)
  }

  if (post.status === 'cancelled') {
    console.log(`[publish] Post ${postId} fue cancelado, saltando`)
    return { skipped: true }
  }

  // Marcar como "publishing"
  await supabase
    .from('posts')
    .update({ status: 'publishing', updated_at: new Date().toISOString() })
    .eq('id', postId)

  const results: Array<{ variantId: string; success: boolean; externalPostId?: string; error?: string }> = []

  for (const variant of post.post_variants) {
    const account = variant.social_accounts

    if (!account || account.status !== 'active') {
      const errMsg = `Cuenta social ${variant.social_account_id} no activa o no encontrada`
      console.warn(`[publish] ${errMsg}`)
      await markVariantFailed(supabase, variant.id, errMsg)
      results.push({ variantId: variant.id, success: false, error: errMsg })
      continue
    }

    try {
      // Desencriptar access token
      const accessToken = decryptToken(account.access_token_encrypted)

      // Publicar según el proveedor
      const result = await publishToProvider(account.provider, accessToken, {
        content: variant.content || '',
        hashtags: variant.hashtags || [],
        linkUrl: variant.link_url || undefined,
        externalId: account.external_id,
        metadata: account.metadata,
      })

      // Marcar variante como publicada
      await supabase
        .from('post_variants')
        .update({
          status: 'published',
          external_post_id: result.externalPostId,
          published_at: new Date().toISOString(),
        })
        .eq('id', variant.id)

      console.log(`[publish] Variante ${variant.id} publicada en ${account.provider}: ${result.externalPostId}`)
      results.push({ variantId: variant.id, success: true, externalPostId: result.externalPostId })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[publish] Error publicando variante ${variant.id} en ${account.provider}:`, errMsg)
      await markVariantFailed(supabase, variant.id, errMsg)
      results.push({ variantId: variant.id, success: false, error: errMsg })
    }
  }

  // Determinar estado final del post
  const allSuccess = results.every((r) => r.success)
  const anySuccess = results.some((r) => r.success)
  const finalStatus = allSuccess ? 'published' : anySuccess ? 'published' : 'failed'

  await supabase
    .from('posts')
    .update({
      status: finalStatus,
      published_at: anySuccess ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)

  console.log(`[publish] Post ${postId} finalizado con estado: ${finalStatus}`)

  // Si hubo fallos, lanzar error para que BullMQ haga retry (si quedan intentos)
  if (!allSuccess) {
    const failedCount = results.filter((r) => !r.success).length
    throw new Error(`${failedCount} variante(s) fallaron al publicar`)
  }

  return { postId, results }
}

async function markVariantFailed(supabase: ReturnType<typeof createClient>, variantId: string, errorMessage: string) {
  await supabase
    .from('post_variants')
    .update({ status: 'failed', error_message: errorMessage })
    .eq('id', variantId)
}

// ============== Publicadores por proveedor ==============

interface PublishParams {
  content: string
  hashtags: string[]
  linkUrl?: string
  externalId: string
  metadata?: Record<string, unknown>
}

interface PublishProviderResult {
  externalPostId: string
  url?: string
}

async function publishToProvider(
  provider: string,
  accessToken: string,
  params: PublishParams,
): Promise<PublishProviderResult> {
  switch (provider) {
    case 'facebook':
      return publishToFacebook(accessToken, params)
    case 'instagram':
      return publishToInstagram(accessToken, params)
    case 'linkedin':
      return publishToLinkedIn(accessToken, params)
    case 'x':
      return publishToX(accessToken, params)
    default:
      throw new Error(`Proveedor ${provider} no soportado para publicación`)
  }
}

// ---------- Facebook ----------
async function publishToFacebook(accessToken: string, params: PublishParams): Promise<PublishProviderResult> {
  const graphVersion = process.env.META_GRAPH_VERSION || 'v25.0'
  const pageId = params.externalId

  const message = buildMessage(params)

  const url = `https://graph.facebook.com/${graphVersion}/${pageId}/feed`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      link: params.linkUrl || undefined,
      access_token: accessToken,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Facebook API error: ${err.error?.message || res.statusText}`)
  }

  const data = await res.json()
  return { externalPostId: data.id, url: `https://facebook.com/${data.id}` }
}

// ---------- Instagram ----------
async function publishToInstagram(accessToken: string, params: PublishParams): Promise<PublishProviderResult> {
  const graphVersion = process.env.META_GRAPH_VERSION || 'v25.0'
  const igUserId = params.externalId
  const caption = buildMessage(params)

  // Instagram requiere media; para texto solo, usamos un "carousel" con imagen placeholder
  // Por ahora, solo soportamos publicación con caption (requiere imagen en post_media)
  // TODO: Implementar subida de media desde post_media

  // Crear container de media (text post no existe en IG, se necesita imagen)
  // Por ahora lanzamos error informativo
  throw new Error('Instagram requiere al menos una imagen para publicar. Sube media al post.')
}

// ---------- LinkedIn ----------
async function publishToLinkedIn(accessToken: string, params: PublishParams): Promise<PublishProviderResult> {
  const personUrn = `urn:li:person:${params.externalId}`
  const message = buildMessage(params)

  const body: Record<string, unknown> = {
    author: personUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: message },
        shareMediaCategory: params.linkUrl ? 'ARTICLE' : 'NONE',
        ...(params.linkUrl
          ? {
              media: [
                {
                  status: 'READY',
                  originalUrl: params.linkUrl,
                },
              ],
            }
          : {}),
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  }

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`LinkedIn API error: ${err}`)
  }

  const postId = res.headers.get('x-restli-id') || ''
  return { externalPostId: postId, url: `https://linkedin.com/feed/update/${postId}` }
}

// ---------- X (Twitter) ----------
async function publishToX(accessToken: string, params: PublishParams): Promise<PublishProviderResult> {
  const message = buildMessage(params, 280)

  const res = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: message }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`X API error: ${err.detail || err.title || res.statusText}`)
  }

  const data = await res.json()
  return { externalPostId: data.data.id, url: `https://x.com/i/status/${data.data.id}` }
}

// ---------- Helpers ----------
function buildMessage(params: PublishParams, maxLength?: number): string {
  let message = params.content

  if (params.hashtags && params.hashtags.length > 0) {
    const hashtagStr = params.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')
    message += `\n\n${hashtagStr}`
  }

  if (maxLength && message.length > maxLength) {
    message = message.slice(0, maxLength - 3) + '...'
  }

  return message
}
