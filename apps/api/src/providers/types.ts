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
  following?: number
  postsCount?: number
  reach?: number
  impressions?: number
  profileViews?: number
  engagement?: number
  raw: Record<string, unknown>
}

export interface PostInsightsData {
  impressions?: number
  reach?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  clicks?: number
  videoViews?: number
  raw: Record<string, unknown>
}

export interface SocialProvider {
  readonly name: string
  getAuthUrl(state: string, redirectUri: string): string
  exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens>
  refreshTokens(refreshToken: string): Promise<OAuthTokens>
  getProfile(accessToken: string): Promise<SocialProfile>
  publish?(accessToken: string, options: PublishOptions): Promise<PublishResult>
  /** Métricas a nivel cuenta (followers, impressions de la página, etc) */
  getInsights?(accessToken: string, externalId: string): Promise<InsightsData>
  /** Métricas de un post específico (impressions, likes, comments, etc) */
  getPostInsights?(accessToken: string, externalPostId: string): Promise<PostInsightsData>
}
