/**
 * Brand & Character Injection Service
 * Enriches generation prompts with brand colors, character details, and styling
 */

import { supabaseAdmin } from '../lib/supabase'

export interface BrandInjectionContext {
  organizationId: string
  characterProfileId?: string
  brandGuidelinesId?: string
}

export interface InjectedPrompt {
  prompt: string
  negativePrompt?: string
  metadata: {
    characterName?: string
    brandColors?: string[]
    visualStyle?: string
  }
}

/**
 * Build an enriched prompt with brand colors and character details
 */
export async function injectBrandAndCharacter(
  basePrompt: string,
  context: BrandInjectionContext,
  options?: { negativePrompt?: string; platform?: string }
): Promise<InjectedPrompt> {
  const { organizationId, characterProfileId } = context
  let negativePrompt = options?.negativePrompt || ''

  const metadata: InjectedPrompt['metadata'] = {}

  // Fetch character profile if provided
  let character: any = null
  if (characterProfileId) {
    const { data } = await supabaseAdmin
      .from('character_profiles')
      .select('*')
      .eq('id', characterProfileId)
      .single()

    if (data) {
      character = data
      metadata.characterName = character.name
      metadata.visualStyle = character.visual_style
    }
  }

  // Fetch brand guidelines
  const { data: brandGuidelines } = await supabaseAdmin
    .from('brand_guidelines')
    .select('*')
    .eq('organization_id', organizationId)
    .single()

  // Build color injection string
  let colorInjection = ''
  if (brandGuidelines) {
    const colors = [
      brandGuidelines.primary_color,
      brandGuidelines.secondary_color,
      brandGuidelines.accent_color,
    ]
    metadata.brandColors = colors
    colorInjection = `BRAND COLORS: navy blue (#001F4D), lime green (#BFCC00), cyan (#00A9B5). Use these colors prominently in the design.`
  }

  // Build character description if available
  let characterDescription = ''
  if (character) {
    characterDescription = `FEATURING: ${character.name || 'Character'} - ${character.personality || 'professional and friendly'}. `
    if (character.visual_style) {
      characterDescription += `Visual style: ${character.visual_style}. `
    }
  }

  // Build enhanced prompt
  const enhancedPrompt = [
    basePrompt,
    characterDescription,
    colorInjection,
    `STYLE: Professional, modern, high-quality. KAPI Service Group branding.`,
  ]
    .filter(Boolean)
    .join(' ')

  // Add negative prompt directives
  if (!negativePrompt.includes('low quality')) {
    negativePrompt += ', low quality, blurry, distorted'
  }

  return {
    prompt: enhancedPrompt,
    negativePrompt: negativePrompt.trim(),
    metadata,
  }
}

/**
 * Get brand colors for an organization
 */
export async function getBrandColors(organizationId: string) {
  const { data } = await supabaseAdmin
    .from('brand_guidelines')
    .select('primary_color, secondary_color, accent_color, primary_color_oklch, secondary_color_oklch, accent_color_oklch')
    .eq('organization_id', organizationId)
    .single()

  if (!data) {
    // Return KAPI defaults
    return {
      primary: '#001F4D',
      secondary: '#BFCC00',
      accent: '#00A9B5',
    }
  }

  return {
    primary: data.primary_color,
    secondary: data.secondary_color,
    accent: data.accent_color,
    primaryOklch: data.primary_color_oklch,
    secondaryOklch: data.secondary_color_oklch,
    accentOklch: data.accent_color_oklch,
  }
}

/**
 * Get character profile for an organization
 */
export async function getCharacterProfile(organizationId: string, characterId?: string) {
  let query = supabaseAdmin
    .from('character_profiles')
    .select('*')
    .eq('organization_id', organizationId)

  if (characterId) {
    query = query.eq('id', characterId)
  } else {
    // Get default character
    query = query.eq('is_default', true)
  }

  const { data } = await query.single()
  return data
}

/**
 * Add watermark configuration to image generation
 */
export function addWatermarkMetadata(
  organizationId: string,
  brandGuidelines: any
): {
  enabled: boolean
  position: string
  opacity: number
  text?: string
} {
  return {
    enabled: brandGuidelines?.watermark_enabled ?? true,
    position: brandGuidelines?.watermark_position ?? 'bottom-right',
    opacity: brandGuidelines?.watermark_opacity ?? 0.8,
    text: 'KAPI', // Default watermark text
  }
}
