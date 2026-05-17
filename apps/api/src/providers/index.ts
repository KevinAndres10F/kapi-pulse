/**
 * Registro central de proveedores.
 * Cada red social implementa la interface SocialProvider.
 *
 * IMPORTANTE: `meta` y `facebook` apuntan al MetaProvider (Facebook Login
 * tradicional, descubre Pages + IG Business vinculadas). `instagram` ahora
 * apunta al InstagramProvider (Login directo con Instagram, sin necesidad
 * de Facebook Page). Las cuentas guardadas con `metadata.auth_method` =
 * 'instagram_login' usan el flow nuevo; el resto siguen el flow Meta.
 */

import type { SocialProvider } from './types'
import { metaProvider } from './meta'
import { instagramProvider } from './instagram'
import { linkedInProvider } from './linkedin'

const providers: Record<string, SocialProvider> = {
  meta: metaProvider,
  facebook: metaProvider,
  instagram: instagramProvider,
  linkedin: linkedInProvider,
  // TODO: provider tiktok en Fase 2b
  // TODO: provider x en Fase 2b
  // TODO: provider youtube en Fase 2b
  // TODO: provider pinterest en Fase 2b
  // TODO: provider threads en Fase 2b (API separada graph.threads.net)
}

export function getProvider(name: string): SocialProvider | undefined {
  return providers[name.toLowerCase()]
}

export function getSupportedProviders(): string[] {
  return ['meta', 'instagram', 'linkedin']
}

export { metaProvider } from './meta'
export { instagramProvider } from './instagram'
export { linkedInProvider } from './linkedin'
export type { SocialProvider } from './types'
