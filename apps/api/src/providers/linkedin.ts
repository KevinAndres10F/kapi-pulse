/**
 * Adaptador OAuth para LinkedIn
 *
 * Docs: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow
 * Posts API: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
 *
 * Scopes requeridos:
 *   - openid, profile, email (Sign In with LinkedIn)
 *   - w_member_social (publicar posts — requiere Marketing Developer Platform para org pages)
 *
 * Rate limits:
 *   - 100 llamadas/día por miembro (API estándar)
 *   - Header obligatorio: LinkedIn-Version: 202602
 *
 * Gotchas:
 *   - Marketing Developer Platform es caro ($699+/mes) para publicar en Company Pages
 *   - Empezar con Sign-In + publicar como persona (gratis)
 *   - Posts API (no UGC legacy) requiere header de versión
 *   - Refresh token dura 365 días, access token 60 días
 */

import type {
  SocialProvider,
  OAuthTokens,
  SocialProfile,
  PostInsightsData,
} from './types'

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization'
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
const LINKEDIN_API = 'https://api.linkedin.com/v2'
const LINKEDIN_VERSION = '202602'

const SCOPES = 'openid profile email w_member_social'

export class LinkedInProvider implements SocialProvider {
  readonly name = 'linkedin'

  private clientId = process.env.LINKEDIN_CLIENT_ID!
  private clientSecret = process.env.LINKEDIN_CLIENT_SECRET!

  getAuthUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      scope: SCOPES,
    })
    return `${LINKEDIN_AUTH_URL}?${params}`
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    const res = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(`LinkedIn token exchange failed: ${err.error_description || res.statusText}`)
    }

    const data = await res.json()
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
      scopes: data.scope?.split(' '),
    }
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const res = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    })

    if (!res.ok) {
      throw new Error('LinkedIn token refresh failed — puede requerir reconexión')
    }

    const data = await res.json()
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
      scopes: data.scope?.split(' '),
    }
  }

  async getProfile(accessToken: string): Promise<SocialProfile> {
    const res = await fetch(`${LINKEDIN_API}/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': LINKEDIN_VERSION,
      },
    })

    if (!res.ok) throw new Error('No se pudo obtener el perfil de LinkedIn')

    const data = await res.json()
    return {
      externalId: data.sub,
      displayName: data.name || `${data.given_name} ${data.family_name}`,
      avatarUrl: data.picture,
      metadata: { email: data.email },
    }
  }

  /**
   * Insights de un post (UGC/Share) de LinkedIn — limitado al scope w_member_social.
   * Sin Marketing Developer Platform no podemos pedir impressions/reach; solo likes
   * y comments via socialActions. Devolvemos undefined en lo no disponible y dejamos
   * que el frontend muestre "—" en esas métricas.
   *
   * Docs: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/social-actions
   * externalPostId esperado: el URN crudo (ej. "urn:li:share:7012345678901234567"
   * o "urn:li:ugcPost:7012345678901234567"). Si viene como activity URN, lo aceptamos.
   */
  async getPostInsights(
    accessToken: string,
    externalPostId: string,
  ): Promise<PostInsightsData> {
    const encodedUrn = encodeURIComponent(externalPostId)
    const url = `${LINKEDIN_API}/socialActions/${encodedUrn}`
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': LINKEDIN_VERSION,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string }
      throw new Error(
        `LinkedIn socialActions failed: ${err.message || res.statusText} ` +
          `(las métricas full de LinkedIn requieren Marketing Developer Platform)`,
      )
    }
    const data = (await res.json()) as LinkedInSocialActions
    return {
      likes: data.likesSummary?.totalLikes ?? data.likesSummary?.aggregatedTotalLikes,
      comments:
        data.commentsSummary?.totalFirstLevelComments ??
        data.commentsSummary?.aggregatedTotalComments,
      raw: data as unknown as Record<string, unknown>,
    }
  }
}

type LinkedInSocialActions = {
  likesSummary?: { totalLikes?: number; aggregatedTotalLikes?: number }
  commentsSummary?: { totalFirstLevelComments?: number; aggregatedTotalComments?: number }
}

export const linkedInProvider = new LinkedInProvider()
