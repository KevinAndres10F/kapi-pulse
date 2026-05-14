/**
 * Interface base para todos los proveedores de redes sociales.
 * Patrón Strategy: cada red social implementa esta interface.
 */

export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  scopes?: string[]
}

export interface SocialProfile {
  externalId: string
  displayName: string
  avatarUrl?: string
  metadata?: Record<string, unknown>
}

export interface PublishOptions {
  content: string
  mediaUrls?: string[]
  linkUrl?: string
  hashtags?: string[]
}

export interface PublishResult {
  externalPostId: string
  url?: string
}

export interface InsightsData {
  followers?: number
  reach?: number
  impressions?: number
  engagement?: number
  metrics: Record<string, unknown>
}

export interface SocialProvider {
  /** Nombre del proveedor */
  readonly name: string

  /** Genera la URL de autorización OAuth */
  getAuthUrl(state: string, redirectUri: string): string

  /** Intercambia el código de autorización por tokens */
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>

  /** Renueva el access token usando el refresh token */
  refreshTokens(refreshToken: string): Promise<OAuthTokens>

  /** Obtiene el perfil de la cuenta conectada */
  getProfile(accessToken: string): Promise<SocialProfile>

  /** Publica contenido (implementar en fases posteriores) */
  publish?(accessToken: string, options: PublishOptions): Promise<PublishResult>

  /** Obtiene métricas/insights (implementar en Fase 4) */
  getInsights?(accessToken: string, externalId: string): Promise<InsightsData>
}
