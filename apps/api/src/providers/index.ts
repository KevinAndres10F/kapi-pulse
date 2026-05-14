/**
 * Registro central de proveedores.
 * Cada red social implementa la interface SocialProvider.
 */

import type { SocialProvider } from './types'
import { metaProvider } from './meta'
import { linkedInProvider } from './linkedin'

const providers: Record<string, SocialProvider> = {
  meta: metaProvider,
  facebook: metaProvider,   // alias — Meta maneja FB + IG
  instagram: metaProvider,  // alias
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
  // Retornar solo proveedores únicos (sin aliases)
  return ['meta', 'linkedin']
}

export { metaProvider } from './meta'
export { linkedInProvider } from './linkedin'
export type { SocialProvider } from './types'
