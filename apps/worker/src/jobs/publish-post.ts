/**
 * Job de publicación de posts en redes sociales.
 * Retry exponencial: 3 intentos con backoff 2^attempt * 30s.
 * Si falla definitivamente, marca el post y variantes como 'failed'.
 */

import { createDecipheriv } from 'node:crypto'
import { getSupabase as getSb } from '../lib/supabase.js'
import { getSignedDownloadUrl } from '../lib/storage.js'

const ENCRYPTION_ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key || key.length !== 64) throw new Error('TOKEN_ENCRYPTION_KEY inválido')
  return Buffer.from(key, 'hex')
}

function decryptToken(encryptedStr: string): string {
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

interface PublishJobData {
  postId: string
}

interface GraphError {
  error?: { message?: string }
}

interface GraphResponse {
  id?: string
  post_id?: string
  status_code?: string
  status?: string
}

async function asJson<T>(res: Response, fallback: T): Promise<T> {
  try {
    return (await res.json()) as T
  } catch {
    return fallback
  }
}

interface MediaRow {
  id: string
  post_variant_id: string
  position: number
  media_type: 'image' | 'video' | 'carousel'
  storage_path: string
  storage_bucket: string | null
  mime_type: string | null
}

interface VariantRow {
  id: string
  social_account_id: string
  content: string | null
  hashtags: string[] | null
  link_url: string | null
  social_accounts: {
    id: string
    provider: string
    access_token_encrypted: string
    external_id: string
    status: string
    metadata: Record<string, unknown> | null
  }
}

/**
 * Publica un post en todas sus variantes (redes sociales).
 */
export async function publishPost(data: PublishJobData) {
  const supabase = getSb()
  const { postId } = data

  console.log(`[publish] Iniciando publicación del post ${postId}`)

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

  await supabase
    .from('posts')
    .update({ status: 'publishing', updated_at: new Date().toISOString() })
    .eq('id', postId)

  const variants = (post.post_variants || []) as unknown as VariantRow[]
  const variantIds = variants.map((v) => v.id)

  // Cargar media de todas las variantes en una sola query
  const { data: mediaRows } = await supabase
    .from('post_media')
    .select('id, post_variant_id, position, media_type, storage_path, storage_bucket, mime_type')
    .in('post_variant_id', variantIds.length ? variantIds : ['00000000-0000-0000-0000-000000000000'])
    .order('position', { ascending: true })

  const mediaByVariant: Record<string, MediaRow[]> = {}
  for (const m of (mediaRows || []) as MediaRow[]) {
    if (!mediaByVariant[m.post_variant_id]) mediaByVariant[m.post_variant_id] = []
    mediaByVariant[m.post_variant_id].push(m)
  }

  const results: Array<{ variantId: string; success: boolean; externalPostId?: string; error?: string }> = []

  for (const variant of variants) {
    const account = variant.social_accounts
    if (!account || account.status !== 'active') {
      const errMsg = `Cuenta social ${variant.social_account_id} no activa o no encontrada`
      await markVariantFailed(variant.id, errMsg)
      results.push({ variantId: variant.id, success: false, error: errMsg })
      continue
    }

    try {
      const accessToken = decryptToken(account.access_token_encrypted)
      const media = mediaByVariant[variant.id] || []

      const result = await publishToProvider(account.provider, accessToken, {
        content: variant.content || '',
        hashtags: variant.hashtags || [],
        linkUrl: variant.link_url || undefined,
        externalId: account.external_id,
        metadata: account.metadata || undefined,
      }, media)

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
      await markVariantFailed(variant.id, errMsg)
      results.push({ variantId: variant.id, success: false, error: errMsg })
    }
  }

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

  if (!allSuccess) {
    const failedCount = results.filter((r) => !r.success).length
    throw new Error(`${failedCount} variante(s) fallaron al publicar`)
  }

  return { postId, results }
}

async function markVariantFailed(variantId: string, errorMessage: string) {
  await getSb()
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

async function resolveMediaUrls(media: MediaRow[]): Promise<string[]> {
  return Promise.all(
    media.map((m) =>
      getSignedDownloadUrl(m.storage_path, {
        bucket: m.storage_bucket || 'generated-assets',
        expiresIn: 3600,
      }),
    ),
  )
}

async function publishToProvider(
  provider: string,
  accessToken: string,
  params: PublishParams,
  media: MediaRow[],
): Promise<PublishProviderResult> {
  switch (provider) {
    case 'facebook':
      return publishToFacebook(accessToken, params, media)
    case 'instagram':
      return publishToInstagram(accessToken, params, media)
    case 'linkedin':
      return publishToLinkedIn(accessToken, params)
    case 'x':
      return publishToX(accessToken, params)
    default:
      throw new Error(`Proveedor ${provider} no soportado para publicación`)
  }
}

// ---------- Facebook ----------
async function publishToFacebook(accessToken: string, params: PublishParams, media: MediaRow[]): Promise<PublishProviderResult> {
  const graphVersion = process.env.META_GRAPH_VERSION || 'v25.0'
  const pageId = params.externalId
  const message = buildMessage(params)

  if (media.length === 0) {
    const res = await fetch(`https://graph.facebook.com/${graphVersion}/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        link: params.linkUrl || undefined,
        access_token: accessToken,
      }),
    })
    if (!res.ok) {
      const err = await asJson<GraphError>(res, {})
      throw new Error(`Facebook API error: ${err.error?.message || res.statusText}`)
    }
    const data = await asJson<GraphResponse>(res, {})
    return { externalPostId: data.id || '', url: `https://facebook.com/${data.id || ''}` }
  }

  const urls = await resolveMediaUrls(media)

  // Single video
  if (media.length === 1 && media[0].media_type === 'video') {
    const res = await fetch(`https://graph.facebook.com/${graphVersion}/${pageId}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_url: urls[0],
        description: message,
        access_token: accessToken,
      }),
    })
    if (!res.ok) {
      const err = await asJson<GraphError>(res, {})
      throw new Error(`Facebook video error: ${err.error?.message || res.statusText}`)
    }
    const data = await asJson<GraphResponse>(res, {})
    const id = data.id || data.post_id || ''
    return { externalPostId: id, url: `https://facebook.com/${id}` }
  }

  // Single image
  if (media.length === 1 && media[0].media_type === 'image') {
    const res = await fetch(`https://graph.facebook.com/${graphVersion}/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: urls[0],
        caption: message,
        access_token: accessToken,
      }),
    })
    if (!res.ok) {
      const err = await asJson<GraphError>(res, {})
      throw new Error(`Facebook photo error: ${err.error?.message || res.statusText}`)
    }
    const data = await asJson<GraphResponse>(res, {})
    const id = data.post_id || data.id || ''
    return { externalPostId: id, url: `https://facebook.com/${id}` }
  }

  // Multiple images → attached_media carousel
  const mediaFbIds: string[] = []
  for (let i = 0; i < media.length; i++) {
    const res = await fetch(`https://graph.facebook.com/${graphVersion}/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: urls[i],
        published: false,
        access_token: accessToken,
      }),
    })
    if (!res.ok) {
      const err = await asJson<GraphError>(res, {})
      throw new Error(`Facebook unpublished photo error: ${err.error?.message || res.statusText}`)
    }
    const data = await asJson<GraphResponse>(res, {})
    if (data.id) mediaFbIds.push(data.id)
  }

  const feedRes = await fetch(`https://graph.facebook.com/${graphVersion}/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      attached_media: mediaFbIds.map((id) => ({ media_fbid: id })),
      access_token: accessToken,
    }),
  })
  if (!feedRes.ok) {
    const err = await asJson<GraphError>(feedRes, {})
    throw new Error(`Facebook carousel error: ${err.error?.message || feedRes.statusText}`)
  }
  const feed = await asJson<GraphResponse>(feedRes, {})
  return { externalPostId: feed.id || '', url: `https://facebook.com/${feed.id || ''}` }
}

// ---------- Instagram ----------
async function publishToInstagram(accessToken: string, params: PublishParams, media: MediaRow[]): Promise<PublishProviderResult> {
  const graphVersion = process.env.META_GRAPH_VERSION || 'v25.0'
  const igUserId = params.externalId
  const caption = buildMessage(params)

  if (media.length === 0) {
    throw new Error('Instagram requiere al menos una imagen o video')
  }

  const urls = await resolveMediaUrls(media)

  if (media.length === 1) {
    const isVideo = media[0].media_type === 'video'
    const containerId = await createIgContainer(graphVersion, igUserId, accessToken, {
      ...(isVideo ? { video_url: urls[0], media_type: 'REELS' } : { image_url: urls[0] }),
      caption,
    })
    await waitForIgContainer(graphVersion, containerId, accessToken)
    return publishIgContainer(graphVersion, igUserId, accessToken, containerId)
  }

  // Carousel (max 10 items)
  const children: string[] = []
  for (let i = 0; i < Math.min(media.length, 10); i++) {
    const isVideo = media[i].media_type === 'video'
    const childId = await createIgContainer(graphVersion, igUserId, accessToken, {
      ...(isVideo ? { video_url: urls[i], media_type: 'VIDEO' } : { image_url: urls[i] }),
      is_carousel_item: true,
    })
    await waitForIgContainer(graphVersion, childId, accessToken)
    children.push(childId)
  }

  const carouselId = await createIgContainer(graphVersion, igUserId, accessToken, {
    media_type: 'CAROUSEL',
    children: children.join(','),
    caption,
  })
  await waitForIgContainer(graphVersion, carouselId, accessToken)
  return publishIgContainer(graphVersion, igUserId, accessToken, carouselId)
}

async function createIgContainer(
  graphVersion: string,
  igUserId: string,
  accessToken: string,
  fields: Record<string, unknown>,
): Promise<string> {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) params.set(k, String(v))
  }
  params.set('access_token', accessToken)

  const res = await fetch(`https://graph.facebook.com/${graphVersion}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!res.ok) {
    const err = await asJson<GraphError>(res, {})
    throw new Error(`Instagram container error: ${err.error?.message || res.statusText}`)
  }

  const data = await asJson<GraphResponse>(res, {})
  if (!data.id) throw new Error('Instagram container did not return id')
  return data.id
}

async function waitForIgContainer(
  graphVersion: string,
  containerId: string,
  accessToken: string,
  opts: { maxAttempts?: number; intervalMs?: number } = {},
) {
  const maxAttempts = opts.maxAttempts ?? 20
  const intervalMs = opts.intervalMs ?? 3000

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(
      `https://graph.facebook.com/${graphVersion}/${containerId}?fields=status_code,status&access_token=${accessToken}`,
    )
    if (!res.ok) {
      throw new Error(`Instagram status check failed: ${res.status}`)
    }
    const data = await asJson<GraphResponse>(res, {})
    if (data.status_code === 'FINISHED') return
    if (data.status_code === 'ERROR' || data.status_code === 'EXPIRED') {
      throw new Error(`Instagram container status: ${data.status_code} (${data.status || 'unknown'})`)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  throw new Error('Instagram container did not finish in time')
}

async function publishIgContainer(
  graphVersion: string,
  igUserId: string,
  accessToken: string,
  containerId: string,
): Promise<PublishProviderResult> {
  const res = await fetch(`https://graph.facebook.com/${graphVersion}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: containerId, access_token: accessToken }).toString(),
  })

  if (!res.ok) {
    const err = await asJson<GraphError>(res, {})
    throw new Error(`Instagram publish error: ${err.error?.message || res.statusText}`)
  }

  const data = await asJson<GraphResponse>(res, {})
  return { externalPostId: data.id || '', url: `https://instagram.com/p/${data.id || ''}` }
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
    const err = await asJson<{ detail?: string; title?: string }>(res, {})
    throw new Error(`X API error: ${err.detail || err.title || res.statusText}`)
  }

  const data = await asJson<{ data?: { id: string } }>(res, {})
  const id = data.data?.id || ''
  return { externalPostId: id, url: `https://x.com/i/status/${id}` }
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
