-- Character Profiles Table (Fase 1)
CREATE TABLE character_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  personality text, -- e.g., "professional, friendly, innovative"

  -- Eleven Labs Voice Configuration
  eleven_labs_voice_id text, -- e.g., "hFyqYpDgcxGhrlIVAeYq"
  eleven_labs_model_id text DEFAULT 'eleven_monolingual_v1',

  -- Visual References
  reference_image_urls text[], -- URLs to Google Drive images
  visual_style text, -- e.g., "modern minimalist, tech-forward"

  -- Brand Integration
  is_default boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  CONSTRAINT name_unique_per_org UNIQUE(organization_id, name)
);

CREATE INDEX idx_character_profiles_org_id ON character_profiles(organization_id);

-- Brand Guidelines Table (Fase 5)
CREATE TABLE brand_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Color Palette (in both hex and OKLCH)
  primary_color text DEFAULT '#4F46E5', -- Indigo
  primary_color_oklch text DEFAULT 'oklch(0.45 0.18 270)',
  secondary_color text DEFAULT '#F5F5F5', -- Light gray
  secondary_color_oklch text DEFAULT 'oklch(0.96 0.005 264)',
  accent_color text DEFAULT '#F0F0FF', -- Light accent
  accent_color_oklch text DEFAULT 'oklch(0.95 0.015 270)',

  -- Additional colors for consistency
  text_primary text DEFAULT '#1A1A1A',
  text_secondary text DEFAULT '#666666',

  -- Typography
  font_primary text DEFAULT 'Geist Sans',
  font_secondary text DEFAULT 'Geist Mono',

  -- Visual Guidelines
  border_radius text DEFAULT '0.625rem',
  spacing_unit text DEFAULT '0.5rem',

  -- Logo and Assets
  logo_url text, -- Google Drive logo URL
  logo_dark_mode_url text,
  favicon_url text,

  -- Social Media Guidelines
  watermark_enabled boolean DEFAULT true,
  watermark_position text DEFAULT 'bottom-right', -- bottom-right, bottom-left, top-right, top-left
  watermark_opacity numeric DEFAULT 0.8,

  -- Content Guidelines
  max_image_width integer DEFAULT 1080,
  max_image_height integer DEFAULT 1350,
  recommended_aspect_ratios text[] DEFAULT ARRAY['1:1', '16:9', '9:16'],

  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  CONSTRAINT one_guideline_per_org UNIQUE(organization_id)
);

CREATE INDEX idx_brand_guidelines_org_id ON brand_guidelines(organization_id);

-- Generation Prompts Injections (para Fase 3 y 4)
CREATE TABLE generation_prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  character_profile_id uuid REFERENCES character_profiles(id) ON DELETE SET NULL,
  brand_guidelines_id uuid REFERENCES brand_guidelines(id) ON DELETE SET NULL,

  generation_kind text NOT NULL, -- 'image', 'video', 'carousel'

  -- Template with placeholders: {character}, {brand_colors}, {style}, etc.
  prompt_template text NOT NULL,
  negative_prompt_template text,

  -- Overrides for specific platforms
  platform_overrides jsonb, -- { "instagram": "...", "tiktok": "..." }

  is_active boolean DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX idx_generation_prompts_org ON generation_prompt_templates(organization_id);
CREATE INDEX idx_generation_prompts_character ON generation_prompt_templates(character_profile_id);

-- Track which character/brand was used in each generation
ALTER TABLE generation_jobs ADD COLUMN character_profile_id uuid REFERENCES character_profiles(id) ON DELETE SET NULL;
ALTER TABLE generation_jobs ADD COLUMN brand_guidelines_id uuid REFERENCES brand_guidelines(id) ON DELETE SET NULL;

CREATE INDEX idx_gen_jobs_character ON generation_jobs(character_profile_id);
