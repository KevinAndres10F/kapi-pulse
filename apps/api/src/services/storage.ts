import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const STORAGE_DEFAULT_BUCKET = process.env.STUDIO_BUCKET || 'generated-assets'
const SIGNED_URL_TTL = Number(process.env.STUDIO_SIGNED_URL_TTL_SECONDS) || 3600

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  json: 'application/json',
  zip: 'application/zip',
}

// Storage client must NOT use the kapi_pulse schema (storage uses its own schema)
function storageClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function ensureOrgPrefix(storagePath: string, orgId: string) {
  if (!storagePath.startsWith(`${orgId}/`)) {
    throw new Error(`Storage path must be prefixed with org id: ${storagePath}`)
  }
}

export function buildStoragePath(orgId: string, ext: string, prefix?: string): string {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const id = randomUUID()
  const slug = prefix ? `${prefix}/` : ''
  return `${orgId}/${yyyy}/${mm}/${slug}${id}.${ext.replace(/^\./, '')}`
}

export async function uploadFromUrl(opts: {
  orgId: string
  sourceUrl: string
  ext: string
  bucket?: string
  jobId?: string
  contentType?: string
}): Promise<{ storagePath: string; sizeBytes: number; mimeType: string; bucket: string }> {
  const bucket = opts.bucket || STORAGE_DEFAULT_BUCKET
  const ext = opts.ext.replace(/^\./, '').toLowerCase()
  const mimeType = opts.contentType || MIME_BY_EXT[ext] || 'application/octet-stream'

  const res = await fetch(opts.sourceUrl)
  if (!res.ok) {
    throw new Error(`Failed to download asset from upstream: ${res.status} ${res.statusText}`)
  }

  const arrayBuffer = await res.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const storagePath = buildStoragePath(opts.orgId, ext, opts.jobId)
  ensureOrgPrefix(storagePath, opts.orgId)

  const client = storageClient()
  const { error } = await client.storage.from(bucket).upload(storagePath, buffer, {
    contentType: mimeType,
    cacheControl: '3600',
    upsert: false,
  })

  if (error) throw error

  return { storagePath, sizeBytes: buffer.byteLength, mimeType, bucket }
}

export async function uploadJson(opts: {
  orgId: string
  data: unknown
  bucket?: string
  jobId?: string
}): Promise<{ storagePath: string; sizeBytes: number; mimeType: string; bucket: string }> {
  const bucket = opts.bucket || STORAGE_DEFAULT_BUCKET
  const buffer = Buffer.from(JSON.stringify(opts.data, null, 2), 'utf-8')
  const storagePath = buildStoragePath(opts.orgId, 'json', opts.jobId)
  ensureOrgPrefix(storagePath, opts.orgId)

  const client = storageClient()
  const { error } = await client.storage.from(bucket).upload(storagePath, buffer, {
    contentType: 'application/json',
    cacheControl: '60',
    upsert: false,
  })

  if (error) throw error
  return { storagePath, sizeBytes: buffer.byteLength, mimeType: 'application/json', bucket }
}

export async function uploadBuffer(opts: {
  orgId: string
  buffer: Buffer
  ext: string
  bucket?: string
  jobId?: string
  contentType?: string
}): Promise<{ storagePath: string; sizeBytes: number; mimeType: string; bucket: string }> {
  const bucket = opts.bucket || STORAGE_DEFAULT_BUCKET
  const ext = opts.ext.replace(/^\./, '').toLowerCase()
  const mimeType = opts.contentType || MIME_BY_EXT[ext] || 'application/octet-stream'
  const storagePath = buildStoragePath(opts.orgId, ext, opts.jobId)
  ensureOrgPrefix(storagePath, opts.orgId)

  const client = storageClient()
  const { error } = await client.storage.from(bucket).upload(storagePath, opts.buffer, {
    contentType: mimeType,
    cacheControl: '3600',
    upsert: false,
  })

  if (error) throw error
  return { storagePath, sizeBytes: opts.buffer.byteLength, mimeType, bucket }
}

export async function createSignedUploadUrl(opts: {
  orgId: string
  ext: string
  bucket?: string
}): Promise<{ uploadUrl: string; storagePath: string; token: string; bucket: string }> {
  const bucket = opts.bucket || 'campaign-uploads'
  const storagePath = buildStoragePath(opts.orgId, opts.ext)
  ensureOrgPrefix(storagePath, opts.orgId)

  const client = storageClient()
  const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(storagePath)
  if (error || !data) throw error || new Error('Failed to create signed upload URL')

  return {
    uploadUrl: data.signedUrl,
    storagePath,
    token: data.token,
    bucket,
  }
}

export async function getSignedDownloadUrl(
  storagePath: string,
  opts: { expiresIn?: number; bucket?: string } = {},
): Promise<string> {
  const bucket = opts.bucket || STORAGE_DEFAULT_BUCKET
  const expiresIn = opts.expiresIn ?? SIGNED_URL_TTL

  const client = storageClient()
  const { data, error } = await client.storage.from(bucket).createSignedUrl(storagePath, expiresIn)
  if (error || !data) throw error || new Error('Failed to create signed URL')
  return data.signedUrl
}

export async function deleteAsset(storagePath: string, bucket?: string): Promise<void> {
  const client = storageClient()
  const { error } = await client.storage.from(bucket || STORAGE_DEFAULT_BUCKET).remove([storagePath])
  if (error) throw error
}
