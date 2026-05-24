/**
 * Cliente API para endpoints admin de social accounts (asignación de Pages
 * via System User, paralelo a /api/ads/accounts).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function jsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error(`Non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }
  if (!res.ok) {
    const err = data as { error?: string; details?: unknown }
    const e = new Error(err.error || `HTTP ${res.status}`) as Error & { details?: unknown; status?: number }
    e.details = err.details
    e.status = res.status
    throw e
  }
  return data as T
}

function headers(userId: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-User-Id': userId }
}

export interface AvailablePage {
  id: string
  name: string | null
  kind: 'owned' | 'client'
  canPublish: boolean
  hasInstagram: boolean
  tasks: string[]
}

export async function listAvailablePages(userId: string): Promise<{ pages: AvailablePage[] }> {
  const res = await fetch(`${API_URL}/api/admin/social-accounts/pages-available`, {
    headers: headers(userId),
  })
  return jsonOrThrow(res)
}

export async function assignPage(
  body: { organizationId: string; pageId: string; includeLinkedInstagram?: boolean },
  userId: string,
): Promise<{
  facebook: { id: string; display_name: string | null } | null
  instagram: { id: string; display_name: string | null } | null
  warnings: string[]
}> {
  const res = await fetch(`${API_URL}/api/admin/social-accounts/assign-page`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify(body),
  })
  return jsonOrThrow(res)
}
