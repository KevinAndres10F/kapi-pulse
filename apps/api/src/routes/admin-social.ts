/**
 * Endpoints admin para asignar redes sociales orgánicas a orgs en modelo
 * "agencia central" — paralelo a /api/admin/ads/*.
 *
 * Cuando el flow OAuth de Facebook Login no devuelve Pages porque el user
 * de Facebook no es admin clásico (típico cuando las Pages viven en Business
 * Manager), el admin operador de KAPI puede asignar Pages directamente
 * usando el System User token del Business.
 *
 * NO es un "fallback automático" del flow OAuth — es un endpoint explícito
 * que el admin invoca conscientemente, con audit (connected_by = admin uid).
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { supabaseAdmin } from '../lib/supabase'
import { encryptToken } from '../lib/encryption'
import {
  listBusinessOwnedPages,
  getPageWithSystemToken,
  metaProvider,
} from '../providers/meta'

const adminSocial = new Hono()

function getCallerUserId(c: { req: { header: (k: string) => string | undefined } }): string | null {
  return c.req.header('x-user-id') || null
}

async function isAdminOperator(userId: string): Promise<boolean> {
  const adminOrgId = process.env.ADMIN_ORG_ID
  if (!adminOrgId) return false
  const { data } = await supabaseAdmin
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', adminOrgId)
    .in('role', ['owner', 'admin'])
    .maybeSingle()
  return !!data
}

/**
 * GET /api/admin/social-accounts/pages-available
 * Lista Pages del Business Portfolio (owned + client) con sus tasks.
 * UI usa esto para poblar el dropdown del modal "Asignar Page".
 */
adminSocial.get('/pages-available', async (c) => {
  const userId = getCallerUserId(c)
  if (!userId) return c.json({ error: 'Falta X-User-Id' }, 401)
  if (!(await isAdminOperator(userId))) return c.json({ error: 'Solo admin operador' }, 403)

  try {
    const { data } = await listBusinessOwnedPages()
    // Enriquecer con flag "canPublish" basado en tasks
    const pages = data.map((p) => {
      const tasks = p.tasks || []
      const canPublish = tasks.includes('CREATE_CONTENT') || tasks.includes('MANAGE')
      return {
        id: p.id,
        name: p.name || null,
        kind: p.kind,
        canPublish,
        hasInstagram: Boolean(p.instagram_business_account?.id),
        tasks,
      }
    })
    return c.json({ pages })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Error en Meta' }, 502)
  }
})

const AssignPageSchema = z.object({
  organizationId: z.string().uuid(),
  pageId: z.string().min(1),
  includeLinkedInstagram: z.boolean().optional(),
})

/**
 * POST /api/admin/social-accounts/assign-page
 * Asigna una Page a una organización usando el System User token.
 * Persiste como social_accounts row con provider=facebook, y opcionalmente
 * también la IG Business vinculada como provider=instagram.
 */
adminSocial.post('/assign-page', async (c) => {
  const userId = getCallerUserId(c)
  if (!userId) return c.json({ error: 'Falta X-User-Id' }, 401)
  if (!(await isAdminOperator(userId))) return c.json({ error: 'Solo admin operador' }, 403)

  const body = await c.req.json()
  const parsed = AssignPageSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, 400)
  }
  const { organizationId, pageId, includeLinkedInstagram } = parsed.data

  let page
  try {
    page = await getPageWithSystemToken(pageId)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Error en Meta' }, 502)
  }

  if (!page.access_token) {
    return c.json(
      {
        error:
          'La Page no devolvió access_token. Verifica que el System User tenga la Page asignada con permiso "Create content" o "Manage" en Business Settings.',
        details: { pageId, tasks: page.tasks },
      },
      400,
    )
  }

  const warnings: string[] = []
  const tasks = page.tasks || []
  if (!tasks.includes('CREATE_CONTENT') && !tasks.includes('MANAGE')) {
    warnings.push('system_user_cannot_publish')
  }

  const pageTokenEncrypted = encryptToken(page.access_token)

  const { data: fbAccount, error: fbErr } = await supabaseAdmin
    .from('social_accounts')
    .upsert(
      {
        organization_id: organizationId,
        provider: 'facebook',
        external_id: page.id,
        display_name: page.name || page.id,
        avatar_url: page.picture?.data?.url,
        access_token_encrypted: pageTokenEncrypted,
        status: 'active',
        metadata: {
          type: 'page',
          page_id: page.id,
          assigned_via: 'admin_system_user',
          tasks,
        },
        connected_by: userId,
      },
      { onConflict: 'organization_id,provider,external_id' },
    )
    .select()
    .single()

  if (fbErr) return c.json({ error: `DB error: ${fbErr.message}` }, 500)

  let igAccount = null
  if (includeLinkedInstagram && page.instagram_business_account?.id) {
    try {
      const ig = await metaProvider.getInstagramAccount(
        page.access_token,
        page.instagram_business_account.id,
      )
      if (ig) {
        const { data, error: igErr } = await supabaseAdmin
          .from('social_accounts')
          .upsert(
            {
              organization_id: organizationId,
              provider: 'instagram',
              external_id: ig.id,
              display_name: ig.username || ig.name || ig.id,
              avatar_url: ig.profile_picture_url,
              access_token_encrypted: pageTokenEncrypted,
              status: 'active',
              metadata: {
                type: 'business',
                username: ig.username,
                followers: ig.followers_count,
                page_id: page.id,
                assigned_via: 'admin_system_user',
              },
              connected_by: userId,
            },
            { onConflict: 'organization_id,provider,external_id' },
          )
          .select()
          .single()
        if (igErr) {
          warnings.push(`instagram_db_error: ${igErr.message}`)
        } else {
          igAccount = data
        }
      } else {
        warnings.push('instagram_account_unreadable')
      }
    } catch (e) {
      warnings.push(`instagram_error: ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }

  return c.json({ facebook: fbAccount, instagram: igAccount, warnings }, 201)
})

export { adminSocial }
