/**
 * Endpoints de Meta Ads (modelo agencia central).
 *
 * Flujo:
 *   1. Cliente crea DRAFT → /api/ads/campaigns/draft
 *   2. Cliente envía a aprobación → /api/ads/campaigns/:id/submit (status → pending_approval)
 *   3. Admin (rol owner/admin de la org operadora) revisa:
 *      - Aprueba → /api/admin/ads/campaigns/:id/approve
 *        Esto CREA la campaña en Meta con status=PAUSED y persiste meta_campaign_id.
 *      - Lanza  → /api/admin/ads/campaigns/:id/launch
 *        Cambia status en Meta a ACTIVE.
 *      - Rechaza → /api/admin/ads/campaigns/:id/reject
 *
 * El check de "es admin" se hace contra ADMIN_ORG_ID (la org operadora,
 * KAPI Service Group). El X-User-Id header viene del JWT validado por
 * el middleware del frontend; en este punto del API ya lo damos por bueno
 * (mismo patrón que el resto de rutas).
 *
 * Si el caller pasa X-User-Id sin ser miembro de la org del recurso,
 * Supabase RLS le devuelve filas vacías — la API agrega además checks
 * explícitos para devolver 403 con mensaje claro.
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { supabaseAdmin } from '../lib/supabase'
import {
  createCampaign,
  createAdSet,
  createAdCreative,
  createAd,
  updateCampaignStatus,
  getInsights,
  getAdAccount,
  listBusinessAdAccounts,
  listBusinessPages,
  checkAdAccountFunding,
  deleteCampaign,
  MetaAdsError,
  type AdObjective,
} from '../providers/meta-ads'

const ads = new Hono()

// ============== Schemas ==============

const ObjectiveEnum = z.enum([
  'OUTCOME_TRAFFIC',
  'OUTCOME_AWARENESS',
  'OUTCOME_ENGAGEMENT',
  'OUTCOME_LEADS',
  'OUTCOME_SALES',
  'OUTCOME_APP_PROMOTION',
])

const DraftCampaignSchema = z.object({
  organizationId: z.string().uuid(),
  adAccountId: z.string().uuid(),
  createdBy: z.string().uuid(),
  name: z.string().min(3).max(200),
  objective: ObjectiveEnum,
  dailyBudgetCents: z.number().int().positive().optional(),
  lifetimeBudgetCents: z.number().int().positive().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  specialAdCategories: z.array(z.string()).optional(),
  adSet: z.object({
    name: z.string().min(3),
    optimizationGoal: z.string().optional(),
    billingEvent: z.string().optional(),
    targeting: z.record(z.string(), z.unknown()),
    dailyBudgetCents: z.number().int().positive().optional(),
    lifetimeBudgetCents: z.number().int().positive().optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
  }),
  creative: z.object({
    name: z.string().min(3),
    pageId: z.string().min(1),
    instagramActorId: z.string().optional(),
    message: z.string().max(2000).optional(),
    headline: z.string().max(255).optional(),
    linkUrl: z.string().url(),
    callToActionType: z.string().optional(),
    mediaAssetId: z.string().uuid().optional(),
    mediaUrl: z.string().url().optional(),
  }),
})

const RegisterAccountSchema = z.object({
  organizationId: z.string().uuid(),
  metaAdAccountId: z.string().regex(/^act_\d+$/, 'Debe tener formato act_XXXXX'),
})

// ============== Helpers ==============

function getCallerUserId(c: { req: { header: (k: string) => string | undefined } }): string | null {
  return c.req.header('x-user-id') || null
}

async function isAdminOperator(userId: string): Promise<boolean> {
  // ADMIN_ORG_ID = la org operadora (KAPI). Si el caller es owner/admin ahí,
  // puede aprobar/lanzar campañas de cualquier cliente.
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

async function isMemberOfOrg(userId: string, orgId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .maybeSingle()
  return !!data
}

function handleMetaError(e: unknown): { error: string; details?: unknown; status: 400 | 502 } {
  if (e instanceof MetaAdsError) {
    if (e.isPolicyRejection) {
      return {
        error: 'Meta rechazó el anuncio por políticas publicitarias',
        details: { code: e.code, userMessage: e.userMessage, fbtraceId: e.fbtraceId },
        status: 400,
      }
    }
    if (e.isFundingIssue) {
      return {
        error: 'Problema de método de pago / fondos en la Ad Account',
        details: { code: e.code, userMessage: e.userMessage, fbtraceId: e.fbtraceId },
        status: 400,
      }
    }
    return {
      error: e.message,
      details: { code: e.code, subcode: e.subcode, fbtraceId: e.fbtraceId },
      status: 502,
    }
  }
  return { error: e instanceof Error ? e.message : 'Error desconocido en Meta', status: 502 }
}

// ============== Ad Accounts ==============

/**
 * GET /api/ads/accounts?org_id=xxx — lista ad accounts conectadas a una org
 */
ads.get('/accounts', async (c) => {
  const orgId = c.req.query('org_id')
  if (!orgId) return c.json({ error: 'Falta org_id' }, 400)

  const { data, error } = await supabaseAdmin
    .from('ad_accounts')
    .select('id, meta_ad_account_id, name, currency, timezone_name, status, created_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ accounts: data })
})

/**
 * POST /api/ads/accounts — registra una ad account a una org (admin-only)
 * Valida que el System User tenga acceso a esa cuenta antes de persistir.
 */
ads.post('/accounts', async (c) => {
  const userId = getCallerUserId(c)
  if (!userId) return c.json({ error: 'Falta X-User-Id' }, 401)
  if (!(await isAdminOperator(userId))) return c.json({ error: 'Solo admin operador' }, 403)

  const body = await c.req.json()
  const parsed = RegisterAccountSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, 400)
  }
  const { organizationId, metaAdAccountId } = parsed.data

  // Verifica acceso en Meta antes de persistir
  let meta
  let funding
  try {
    meta = await getAdAccount(metaAdAccountId)
    // Verifica funding en paralelo (no bloquea si falla)
    funding = await checkAdAccountFunding(metaAdAccountId).catch(() => null)
  } catch (e) {
    const h = handleMetaError(e)
    return c.json({ error: h.error, details: h.details }, h.status)
  }

  const { data, error } = await supabaseAdmin
    .from('ad_accounts')
    .insert({
      organization_id: organizationId,
      meta_ad_account_id: metaAdAccountId,
      name: meta.name,
      currency: meta.currency || 'USD',
      timezone_name: meta.timezone_name,
      status: 'active',
    })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)

  // Warnings no bloqueantes — el cliente puede registrar la cuenta pero
  // saber que tiene que arreglar antes de aprobar campañas.
  const warnings: string[] = []
  if (funding && !funding.hasFunding) {
    if (funding.accountStatus !== 1) {
      warnings.push(`account_status_${funding.accountStatus}`)
    }
    if (!funding.fundingSource) {
      warnings.push('no_payment_method')
    }
  }

  return c.json({ account: data, warnings }, 201)
})

/**
 * GET /api/ads/pages — lista Pages del Business (owned + client).
 * Admin-only — la UI lo usa para el dropdown al crear creatives.
 */
ads.get('/pages', async (c) => {
  const userId = getCallerUserId(c)
  if (!userId) return c.json({ error: 'Falta X-User-Id' }, 401)
  if (!(await isAdminOperator(userId))) return c.json({ error: 'Solo admin operador' }, 403)

  try {
    const { data } = await listBusinessPages()
    return c.json({ pages: data })
  } catch (e) {
    const h = handleMetaError(e)
    return c.json({ error: h.error, details: h.details }, h.status)
  }
})

/**
 * GET /api/ads/accounts/:id/funding — verifica funding status en vivo.
 * Útil para que el cliente sepa si puede enviar a aprobación.
 */
ads.get('/accounts/:id/funding', async (c) => {
  const id = c.req.param('id')
  const { data: account, error } = await supabaseAdmin
    .from('ad_accounts')
    .select('meta_ad_account_id')
    .eq('id', id)
    .maybeSingle()

  if (error) return c.json({ error: error.message }, 500)
  if (!account) return c.json({ error: 'Ad account no encontrada' }, 404)

  try {
    const status = await checkAdAccountFunding(account.meta_ad_account_id)
    return c.json(status)
  } catch (e) {
    const h = handleMetaError(e)
    return c.json({ error: h.error, details: h.details }, h.status)
  }
})

/**
 * GET /api/ads/accounts/business — lista ad accounts del Business Portfolio
 * (las que el System User puede ver). Útil para que el admin elija qué conectar.
 */
ads.get('/accounts/business', async (c) => {
  const userId = getCallerUserId(c)
  if (!userId) return c.json({ error: 'Falta X-User-Id' }, 401)
  if (!(await isAdminOperator(userId))) return c.json({ error: 'Solo admin operador' }, 403)

  try {
    const { data } = await listBusinessAdAccounts()
    return c.json({ accounts: data })
  } catch (e) {
    const h = handleMetaError(e)
    return c.json({ error: h.error, details: h.details }, h.status)
  }
})

// ============== Campaigns (lado cliente) ==============

/**
 * GET /api/ads/campaigns?org_id=xxx[&status=draft]
 */
ads.get('/campaigns', async (c) => {
  const orgId = c.req.query('org_id')
  if (!orgId) return c.json({ error: 'Falta org_id' }, 400)
  const status = c.req.query('status')

  let q = supabaseAdmin
    .from('ad_campaigns')
    .select(`
      *,
      ad_accounts (id, meta_ad_account_id, currency),
      ad_sets (id, name, status, meta_adset_id),
      ad_creatives (id, name, headline:title, body, link_url, meta_creative_id)
    `)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ campaigns: data })
})

/**
 * POST /api/ads/campaigns/draft — cliente crea DRAFT con adset + creative.
 * No toca Meta todavía; solo persiste local en estado 'draft'.
 */
ads.post('/campaigns/draft', async (c) => {
  const body = await c.req.json()
  const parsed = DraftCampaignSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, 400)
  }
  const d = parsed.data

  // Verifica que el ad_account pertenece a esa org
  const { data: account } = await supabaseAdmin
    .from('ad_accounts')
    .select('id, organization_id')
    .eq('id', d.adAccountId)
    .maybeSingle()
  if (!account || account.organization_id !== d.organizationId) {
    return c.json({ error: 'Ad account no pertenece a la organización' }, 400)
  }

  const { data: campaign, error: cErr } = await supabaseAdmin
    .from('ad_campaigns')
    .insert({
      organization_id: d.organizationId,
      ad_account_id: d.adAccountId,
      name: d.name,
      objective: d.objective,
      status: 'draft',
      daily_budget_cents: d.dailyBudgetCents,
      lifetime_budget_cents: d.lifetimeBudgetCents,
      start_time: d.startTime,
      end_time: d.endTime,
      special_ad_categories: d.specialAdCategories || [],
      proposed_by: d.createdBy,
    })
    .select()
    .single()

  if (cErr) return c.json({ error: cErr.message }, 500)

  const { data: adSet, error: sErr } = await supabaseAdmin
    .from('ad_sets')
    .insert({
      ad_campaign_id: campaign.id,
      name: d.adSet.name,
      daily_budget_cents: d.adSet.dailyBudgetCents,
      lifetime_budget_cents: d.adSet.lifetimeBudgetCents,
      billing_event: d.adSet.billingEvent || 'IMPRESSIONS',
      optimization_goal: d.adSet.optimizationGoal || 'LINK_CLICKS',
      targeting: d.adSet.targeting,
      start_time: d.adSet.startTime,
      end_time: d.adSet.endTime,
      status: 'PAUSED',
    })
    .select()
    .single()

  if (sErr) return c.json({ error: sErr.message }, 500)

  // Resuelve media_url si el cliente eligió un asset de Studio
  let mediaUrl = d.creative.mediaUrl
  if (d.creative.mediaAssetId && !mediaUrl) {
    const { data: asset } = await supabaseAdmin
      .from('generated_assets')
      .select('storage_bucket, storage_path')
      .eq('id', d.creative.mediaAssetId)
      .maybeSingle()
    if (asset) {
      const { data: signed } = await supabaseAdmin.storage
        .from(asset.storage_bucket)
        .createSignedUrl(asset.storage_path, 60 * 60 * 24 * 7) // 7d, suficiente para Meta lo descargue
      mediaUrl = signed?.signedUrl
    }
  }

  const { data: creative, error: crErr } = await supabaseAdmin
    .from('ad_creatives')
    .insert({
      ad_campaign_id: campaign.id,
      name: d.creative.name,
      body: d.creative.message,
      title: d.creative.headline,
      link_url: d.creative.linkUrl,
      call_to_action_type: d.creative.callToActionType,
      media_asset_id: d.creative.mediaAssetId,
      media_url: mediaUrl,
      page_id: d.creative.pageId,
      instagram_actor_id: d.creative.instagramActorId,
    })
    .select()
    .single()

  if (crErr) return c.json({ error: crErr.message }, 500)

  return c.json({ campaign, adSet, creative }, 201)
})

/**
 * DELETE /api/ads/campaigns/:id — elimina la campaña.
 * - Si tiene meta_campaign_id, intenta borrar en Meta primero.
 * - Luego elimina local (cascade a ad_sets, ad_creatives, ads vía FK).
 *
 * Reglas:
 * - Drafts: cualquier miembro de la org puede borrar.
 * - Cualquier otro estado: solo admin operador (porque ya existe en Meta).
 */
ads.delete('/campaigns/:id', async (c) => {
  const userId = getCallerUserId(c)
  if (!userId) return c.json({ error: 'Falta X-User-Id' }, 401)
  const id = c.req.param('id')

  const { data: campaign, error: gErr } = await supabaseAdmin
    .from('ad_campaigns')
    .select('id, organization_id, status, meta_campaign_id')
    .eq('id', id)
    .maybeSingle()

  if (gErr) return c.json({ error: gErr.message }, 500)
  if (!campaign) return c.json({ error: 'Campaña no encontrada' }, 404)

  if (campaign.status !== 'draft') {
    if (!(await isAdminOperator(userId))) {
      return c.json({ error: 'Solo admin operador puede borrar campañas no-draft' }, 403)
    }
  } else {
    if (!(await isMemberOfOrg(userId, campaign.organization_id))) {
      return c.json({ error: 'No autorizado' }, 403)
    }
  }

  // Si existe en Meta, borrar primero allá
  if (campaign.meta_campaign_id) {
    try {
      await deleteCampaign(campaign.meta_campaign_id)
    } catch (e) {
      // Loggeamos pero seguimos — la campaña puede haber sido borrada en Meta manualmente
      console.warn(`[ads] No se pudo borrar en Meta ${campaign.meta_campaign_id}:`, e)
    }
  }

  const { error: dErr } = await supabaseAdmin
    .from('ad_campaigns')
    .delete()
    .eq('id', id)

  if (dErr) return c.json({ error: dErr.message }, 500)
  return c.json({ success: true })
})

/**
 * POST /api/ads/campaigns/:id/submit — DRAFT → PENDING_APPROVAL
 */
ads.post('/campaigns/:id/submit', async (c) => {
  const id = c.req.param('id')

  const { data: campaign, error: gErr } = await supabaseAdmin
    .from('ad_campaigns')
    .select('id, status, name')
    .eq('id', id)
    .maybeSingle()
  if (gErr) return c.json({ error: gErr.message }, 500)
  if (!campaign) return c.json({ error: 'Campaña no encontrada' }, 404)
  if (campaign.status !== 'draft') {
    return c.json({ error: `Solo drafts pueden enviarse a aprobación (estado actual: ${campaign.status})` }, 400)
  }

  const { data, error } = await supabaseAdmin
    .from('ad_campaigns')
    .update({ status: 'pending_approval' })
    .eq('id', id)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ campaign: data })
})

// ============== Admin: aprobar / lanzar / rechazar ==============

const adsAdmin = new Hono()

/**
 * GET /api/admin/ads/pending — cola de aprobaciones
 */
adsAdmin.get('/pending', async (c) => {
  const userId = getCallerUserId(c)
  if (!userId) return c.json({ error: 'Falta X-User-Id' }, 401)
  if (!(await isAdminOperator(userId))) return c.json({ error: 'Solo admin operador' }, 403)

  const { data, error } = await supabaseAdmin
    .from('ad_campaigns_pending')
    .select('*')

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ pending: data })
})

/**
 * POST /api/admin/ads/campaigns/:id/approve
 * Crea la campaña en Meta (status=PAUSED), persiste meta_campaign_id +
 * meta_adset_id + meta_creative_id + meta_ad_id, pasa status local a 'approved'.
 */
adsAdmin.post('/campaigns/:id/approve', async (c) => {
  const userId = getCallerUserId(c)
  if (!userId) return c.json({ error: 'Falta X-User-Id' }, 401)
  if (!(await isAdminOperator(userId))) return c.json({ error: 'Solo admin operador' }, 403)

  const id = c.req.param('id')

  const { data: full, error: fErr } = await supabaseAdmin
    .from('ad_campaigns')
    .select(`
      *,
      ad_accounts (meta_ad_account_id),
      ad_sets (*),
      ad_creatives (*)
    `)
    .eq('id', id)
    .maybeSingle()

  if (fErr) return c.json({ error: fErr.message }, 500)
  if (!full) return c.json({ error: 'Campaña no encontrada' }, 404)
  if (full.status !== 'pending_approval') {
    return c.json({ error: `Solo se aprueba en pending_approval (estado: ${full.status})` }, 400)
  }
  const adAccount = full.ad_accounts.meta_ad_account_id as string
  const set = full.ad_sets?.[0]
  const cr = full.ad_creatives?.[0]
  if (!set || !cr) return c.json({ error: 'Campaña sin adset o creative' }, 400)

  try {
    // 1. Campaign
    const metaCampaign = await createCampaign({
      adAccountId: adAccount,
      name: full.name,
      objective: full.objective as AdObjective,
      status: 'PAUSED',
      dailyBudgetCents: full.daily_budget_cents || undefined,
      lifetimeBudgetCents: full.lifetime_budget_cents || undefined,
      startTime: full.start_time || undefined,
      endTime: full.end_time || undefined,
      specialAdCategories: full.special_ad_categories || [],
    })

    // 2. AdSet
    const metaAdSet = await createAdSet({
      adAccountId: adAccount,
      campaignId: metaCampaign.id,
      name: set.name,
      dailyBudgetCents: set.daily_budget_cents || undefined,
      lifetimeBudgetCents: set.lifetime_budget_cents || undefined,
      billingEvent: set.billing_event || 'IMPRESSIONS',
      optimizationGoal: set.optimization_goal || 'LINK_CLICKS',
      targeting: set.targeting || {},
      startTime: set.start_time || undefined,
      endTime: set.end_time || undefined,
      status: 'PAUSED',
    })

    // 3. Creative
    const metaCreative = await createAdCreative({
      adAccountId: adAccount,
      name: cr.name,
      pageId: cr.page_id,
      instagramActorId: cr.instagram_actor_id || undefined,
      message: cr.body || undefined,
      headline: cr.title || undefined,
      linkUrl: cr.link_url,
      callToActionType: cr.call_to_action_type || undefined,
      imageUrl: cr.media_url || undefined,
    })

    // 4. Ad
    const metaAd = await createAd({
      adAccountId: adAccount,
      adSetId: metaAdSet.id,
      creativeId: metaCreative.id,
      name: `${full.name} — Ad`,
      status: 'PAUSED',
    })

    // Persistencia local de los IDs de Meta
    await supabaseAdmin
      .from('ad_campaigns')
      .update({
        status: 'approved',
        meta_campaign_id: metaCampaign.id,
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)

    await supabaseAdmin.from('ad_sets').update({ meta_adset_id: metaAdSet.id }).eq('id', set.id)
    await supabaseAdmin
      .from('ad_creatives')
      .update({ meta_creative_id: metaCreative.id })
      .eq('id', cr.id)
    await supabaseAdmin.from('ads').insert({
      ad_set_id: set.id,
      ad_creative_id: cr.id,
      meta_ad_id: metaAd.id,
      name: `${full.name} — Ad`,
      status: 'PAUSED',
    })

    return c.json({
      success: true,
      meta: {
        campaignId: metaCampaign.id,
        adSetId: metaAdSet.id,
        creativeId: metaCreative.id,
        adId: metaAd.id,
      },
    })
  } catch (e) {
    const h = handleMetaError(e)
    // Persistir rechazo si fue por políticas para que el cliente lo vea
    if (e instanceof MetaAdsError && e.isPolicyRejection) {
      await supabaseAdmin
        .from('ad_campaigns')
        .update({
          status: 'rejected',
          rejection_reason: e.userMessage || e.message,
        })
        .eq('id', id)
    }
    return c.json({ error: h.error, details: h.details }, h.status)
  }
})

/**
 * POST /api/admin/ads/campaigns/:id/launch
 * approved → active. Pone status=ACTIVE en campaign + adset + ads.
 */
adsAdmin.post('/campaigns/:id/launch', async (c) => {
  const userId = getCallerUserId(c)
  if (!userId) return c.json({ error: 'Falta X-User-Id' }, 401)
  if (!(await isAdminOperator(userId))) return c.json({ error: 'Solo admin operador' }, 403)

  const id = c.req.param('id')
  const { data: campaign } = await supabaseAdmin
    .from('ad_campaigns')
    .select('id, status, meta_campaign_id, ad_sets (id, meta_adset_id)')
    .eq('id', id)
    .maybeSingle()

  if (!campaign) return c.json({ error: 'Campaña no encontrada' }, 404)
  if (campaign.status !== 'approved' && campaign.status !== 'paused') {
    return c.json({ error: `Solo approved/paused puede lanzarse (estado: ${campaign.status})` }, 400)
  }
  if (!campaign.meta_campaign_id) {
    return c.json({ error: 'Campaña sin meta_campaign_id — no fue aprobada en Meta' }, 400)
  }

  try {
    await updateCampaignStatus(campaign.meta_campaign_id, 'ACTIVE')
    // Activar también adsets. Si fallan no rollbackeamos la campaign
    // — el operador puede activarlos manualmente desde el panel.
    const adSets = (campaign.ad_sets || []) as Array<{ meta_adset_id: string | null }>
    for (const s of adSets) {
      if (s.meta_adset_id) {
        try {
          await updateCampaignStatus(s.meta_adset_id, 'ACTIVE')
        } catch (e) {
          console.warn(`[ads] No se pudo activar adset ${s.meta_adset_id}:`, e)
        }
      }
    }
    await supabaseAdmin
      .from('ad_campaigns')
      .update({ status: 'active', launched_at: new Date().toISOString() })
      .eq('id', id)

    return c.json({ success: true })
  } catch (e) {
    const h = handleMetaError(e)
    return c.json({ error: h.error, details: h.details }, h.status)
  }
})

/**
 * POST /api/admin/ads/campaigns/:id/pause — active → paused
 */
adsAdmin.post('/campaigns/:id/pause', async (c) => {
  const userId = getCallerUserId(c)
  if (!userId) return c.json({ error: 'Falta X-User-Id' }, 401)
  if (!(await isAdminOperator(userId))) return c.json({ error: 'Solo admin operador' }, 403)

  const id = c.req.param('id')
  const { data: campaign } = await supabaseAdmin
    .from('ad_campaigns')
    .select('meta_campaign_id, status')
    .eq('id', id)
    .maybeSingle()

  if (!campaign?.meta_campaign_id) {
    return c.json({ error: 'Campaña no encontrada o sin ID de Meta' }, 404)
  }

  try {
    await updateCampaignStatus(campaign.meta_campaign_id, 'PAUSED')
    await supabaseAdmin.from('ad_campaigns').update({ status: 'paused' }).eq('id', id)
    return c.json({ success: true })
  } catch (e) {
    const h = handleMetaError(e)
    return c.json({ error: h.error, details: h.details }, h.status)
  }
})

/**
 * POST /api/admin/ads/campaigns/:id/reject
 * Body: { reason: string }
 */
adsAdmin.post('/campaigns/:id/reject', async (c) => {
  const userId = getCallerUserId(c)
  if (!userId) return c.json({ error: 'Falta X-User-Id' }, 401)
  if (!(await isAdminOperator(userId))) return c.json({ error: 'Solo admin operador' }, 403)

  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const reason = typeof body.reason === 'string' ? body.reason : 'Sin razón especificada'

  const { data, error } = await supabaseAdmin
    .from('ad_campaigns')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', id)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ campaign: data })
})

// ============== Insights (lectura) ==============

/**
 * GET /api/ads/insights?org_id=xxx&scope=campaign&date_preset=last_7d
 *
 * Lee de la tabla local ad_insights (poblada por el worker). Útil para
 * dashboards. Para datos "live" (sin esperar al worker), pasar &live=1.
 */
ads.get('/insights', async (c) => {
  const orgId = c.req.query('org_id')
  if (!orgId) return c.json({ error: 'Falta org_id' }, 400)
  const scope = (c.req.query('scope') || 'campaign') as 'campaign' | 'adset' | 'ad' | 'account'
  const datePreset = c.req.query('date_preset') || 'last_7d'
  const isLive = c.req.query('live') === '1'

  if (isLive) {
    const scopeId = c.req.query('scope_id')
    if (!scopeId) return c.json({ error: 'Para live=1 falta scope_id' }, 400)

    // Solo permitir live si el caller es miembro de la org dueña
    const userId = getCallerUserId(c)
    if (!userId || !(await isMemberOfOrg(userId, orgId))) {
      return c.json({ error: 'No autorizado' }, 403)
    }
    try {
      const data = await getInsights(scopeId, { level: scope, datePreset: datePreset as never })
      return c.json({ insights: data.data, source: 'live' })
    } catch (e) {
      const h = handleMetaError(e)
      return c.json({ error: h.error, details: h.details }, h.status)
    }
  }

  const { data, error } = await supabaseAdmin
    .from('ad_insights')
    .select('*')
    .eq('organization_id', orgId)
    .eq('scope_type', scope)
    .order('period_start', { ascending: false })
    .limit(500)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ insights: data, source: 'cached' })
})

export { ads, adsAdmin }
