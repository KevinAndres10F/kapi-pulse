-- Insert default KAPI brand guidelines for organizations
-- This migration populates the initial brand guidelines and character profile for Gema

-- Note: Run this after the main schema migration
-- This assumes organizations exist

-- Las apps usan el schema dedicado kapi_pulse — fijamos search_path para que
-- los INSERT caigan en las tablas correctas.
SET search_path TO kapi_pulse, public;

-- Get the first organization (adjust as needed for multi-org setup)
INSERT INTO brand_guidelines (organization_id, primary_color, primary_color_oklch, secondary_color, secondary_color_oklch, accent_color, accent_color_oklch, text_primary, text_secondary, font_primary, font_secondary, watermark_enabled, watermark_position, watermark_opacity)
SELECT id, '#001F4D', 'oklch(0.18 0.08 250)', '#BFCC00', 'oklch(0.75 0.24 100)', '#00A9B5', 'oklch(0.60 0.18 200)', '#001F4D', '#666666', 'Geist Sans', 'Geist Mono', true, 'bottom-right', 0.8
FROM organizations
LIMIT 1
ON CONFLICT (organization_id) DO NOTHING;

-- Insert Gema character profile with reference images from Google Drive
INSERT INTO character_profiles (
  organization_id,
  name,
  description,
  personality,
  eleven_labs_voice_id,
  visual_style,
  reference_image_urls,
  is_default
)
SELECT
  organizations.id,
  'Gema',
  'Professional woman, 28 years old, Latina heritage. Modern, approachable, and expert communicator in tech and business.',
  'Professional, friendly, innovative, knowledgeable, warm',
  'hFyqYpDgcxGhrlIVAeYq',
  'Modern professional, executive style, office environments, tech-forward aesthetic, warm lighting',
  ARRAY[
    'https://drive.google.com/file/d/18z24vIuCZjIg8urOgFxJgssl9MbBHSyI/view?usp=drivesdk',
    'https://drive.google.com/file/d/1f-ccDlh4FYdiquhNm0z0HwbvpTBiyX8Q/view?usp=drivesdk',
    'https://drive.google.com/file/d/1vAGwMNws6GTZxglzOYuIP6Fz_rTxr-WQ/view?usp=drivesdk',
    'https://drive.google.com/file/d/12bcUWDecoEPNt65DgbicrKdBuitAMlLH/view?usp=drivesdk',
    'https://drive.google.com/file/d/1JljojYXJhKYdBqU5Pu3evLFSSQDJazCH/view?usp=drivesdk'
  ],
  true
FROM organizations
LIMIT 1
ON CONFLICT (organization_id, name) DO NOTHING;

-- Create a default prompt template for image generation with Gema
INSERT INTO generation_prompt_templates (
  organization_id,
  character_profile_id,
  brand_guidelines_id,
  generation_kind,
  prompt_template,
  negative_prompt_template,
  is_active
)
SELECT
  o.id,
  cp.id,
  bg.id,
  'image',
  'Professional woman (Gema, 28 years old, Latina heritage) in {setting}. She has long dark brown wavy hair, warm genuine smile. Wearing business attire - navy blue (#001F4D) or teal blazer. Office environment with natural light, modern aesthetic. KAPI Service Group branding colors: navy (#001F4D), lime green (#BFCC00), cyan (#00A9B5). High resolution, professional photography.',
  'low quality, blurry, distorted, unprofessional, artificial lighting',
  true
FROM organizations o
JOIN character_profiles cp ON cp.organization_id = o.id AND cp.name = 'Gema'
JOIN brand_guidelines bg ON bg.organization_id = o.id
LIMIT 1
ON CONFLICT DO NOTHING;

-- Create another template for video generation
INSERT INTO generation_prompt_templates (
  organization_id,
  character_profile_id,
  brand_guidelines_id,
  generation_kind,
  prompt_template,
  negative_prompt_template,
  platform_overrides,
  is_active
)
SELECT
  o.id,
  cp.id,
  bg.id,
  'video',
  'Dynamic video of professional woman (Gema) {action}. Modern office or tech event setting. Professional, energetic, positive energy. KAPI Service Group branding: navy, lime green, cyan colors. High production quality, 4K resolution.',
  'low quality, shaky camera, unprofessional, artificial',
  '{"instagram": "Vertical video (9:16) format. Engaging, snappy edits. KAPI colors prominent.", "linkedin": "Professional, informative tone. Classic 16:9 aspect ratio. Business focused."}'::jsonb,
  true
FROM organizations o
JOIN character_profiles cp ON cp.organization_id = o.id AND cp.name = 'Gema'
JOIN brand_guidelines bg ON bg.organization_id = o.id
LIMIT 1
ON CONFLICT DO NOTHING;
