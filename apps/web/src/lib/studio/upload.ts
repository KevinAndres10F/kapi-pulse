import { requestUploadUrl } from './api'

/**
 * Sube un File directo a Supabase Storage usando signed upload URL emitida
 * por el backend. Devuelve el assetId persistido en `generated_assets`.
 */
export async function uploadFileAsset(
  orgId: string,
  file: File,
  kind: 'reference' | 'image' | 'video' = 'reference',
  accessToken?: string,
): Promise<{ assetId: string; storagePath: string }> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const upload = await requestUploadUrl(orgId, ext, kind, accessToken)

  const putRes = await fetch(upload.uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: file,
  })

  if (!putRes.ok) {
    throw new Error(`Upload failed: ${putRes.status} ${putRes.statusText}`)
  }

  return { assetId: upload.assetId, storagePath: upload.storagePath }
}
