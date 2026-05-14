/**
 * Job de refresh automático de tokens OAuth.
 * Se ejecuta cada hora, renueva tokens que expiran en las próximas 24h.
 * Si falla (invalid_grant), marca la cuenta como 'disconnected'.
 */

import { createClient } from '@supabase/supabase-js'

// Importaciones dinámicas para encryption y providers
// (en producción estos estarían en un package compartido)

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

function encryptToken(plaintext: string): string {
  const { createCipheriv, randomBytes } = require('node:crypto')
  const key = getEncryptionKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

export async function refreshExpiringTokens() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'kapi_pulse' },
    },
  )

  // Buscar cuentas que expiran en las próximas 24h
  const expiresBeforeDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: accounts, error } = await supabase
    .from('social_accounts')
    .select('id, provider, access_token_encrypted, refresh_token_encrypted, expires_at, organization_id')
    .eq('status', 'active')
    .not('expires_at', 'is', null)
    .lt('expires_at', expiresBeforeDate)

  if (error) {
    console.error('Error buscando tokens por expirar:', error)
    return
  }

  if (!accounts || accounts.length === 0) {
    console.log('No hay tokens por renovar')
    return
  }

  console.log(`Renovando ${accounts.length} tokens...`)

  for (const account of accounts) {
    try {
      const currentToken = decryptToken(account.access_token_encrypted)
      const refreshToken = account.refresh_token_encrypted
        ? decryptToken(account.refresh_token_encrypted)
        : null

      let newTokens: { accessToken: string; refreshToken?: string; expiresAt?: Date }

      // Seleccionar la estrategia de refresh según el proveedor
      if (account.provider === 'facebook' || account.provider === 'instagram') {
        // Meta: renovar long-lived token
        newTokens = await refreshMetaToken(currentToken)
      } else if (account.provider === 'linkedin') {
        if (!refreshToken) throw new Error('No hay refresh token para LinkedIn')
        newTokens = await refreshLinkedInToken(refreshToken)
      } else {
        console.log(`Refresh no implementado para ${account.provider}, saltando`)
        continue
      }

      // Guardar tokens renovados
      await supabase
        .from('social_accounts')
        .update({
          access_token_encrypted: encryptToken(newTokens.accessToken),
          refresh_token_encrypted: newTokens.refreshToken
            ? encryptToken(newTokens.refreshToken)
            : account.refresh_token_encrypted,
          expires_at: newTokens.expiresAt?.toISOString(),
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id)

      console.log(`Token renovado: ${account.provider} (${account.id})`)
    } catch (err) {
      console.error(`Error renovando token ${account.id} (${account.provider}):`, err)

      // Marcar como expirado
      await supabase
        .from('social_accounts')
        .update({
          status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id)

      // TODO: Enviar alerta por email + Telegram al owner de la org
      console.warn(`Cuenta ${account.id} marcada como expired — requiere reconexión`)
    }
  }
}

async function refreshMetaToken(currentToken: string) {
  const graphVersion = process.env.META_GRAPH_VERSION || 'v25.0'
  const url = `https://graph.facebook.com/${graphVersion}/oauth/access_token?${new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: currentToken,
  })}`

  const res = await fetch(url)
  if (!res.ok) throw new Error('Meta token refresh failed')
  const data = await res.json()

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
  }
}

async function refreshLinkedInToken(refreshToken: string) {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  })

  if (!res.ok) throw new Error('LinkedIn token refresh failed')
  const data = await res.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
  }
}
