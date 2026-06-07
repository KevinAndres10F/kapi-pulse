# Branded Content Generation with Character Profiles

Complete guide to generating professional content with KAPI brand consistency and character profiles (featuring Gema).

## Overview

This system enables:

1. **Character Profiles** - Manage professional personas (like Gema) with voice, visual style, and references
2. **Brand Guidelines** - Centralized brand colors, fonts, and styling rules
3. **Branded Generation** - Images, videos, and audio that automatically incorporate brand elements
4. **Voice Synthesis** - Eleven Labs TTS integration for character narration
5. **Creative Assets** - Carousel generation, multiple style variations

## Architecture

### Database Schema

#### `character_profiles`
Stores character/persona information:
- Name, description, personality traits
- Eleven Labs voice ID (e.g., `hFyqYpDgcxGhrlIVAeYq` for Gema)
- Visual reference URLs from Google Drive
- Visual style guidelines

#### `brand_guidelines`
Organization-level brand rules:
- **Colors**: Primary (#001F4D Navy), Secondary (#BFCC00 Lime), Accent (#00A9B5 Cyan)
- **Typography**: Font families, sizes
- **Visual**: Border radius, spacing units
- **Watermark**: Position, opacity settings
- **Social Media**: Aspect ratios, image dimensions

#### `generation_prompt_templates`
Pre-built prompt templates for consistent output:
- Template with placeholders: `{character}`, `{setting}`, `{style}`
- Per-platform overrides (Instagram vs LinkedIn)
- Negative prompts for quality control

### Providers

#### Eleven Labs (TTS)
File: `apps/api/src/services/providers/eleven_labs.ts`

Generates natural speech audio:
```typescript
await elevenLabsGenerateAudio({
  text: "Hello, I'm Gema",
  voiceId: 'hFyqYpDgcxGhrlIVAeYq',
  stability: 0.5,
  similarityBoost: 0.75
})
```

#### Banana (Image Generation)
File: `apps/api/src/services/providers/banana.ts`

Generates images with Flux models:
```typescript
await bananaGenerateImage({
  prompt: "Professional woman in office...",
  model: 'flux-pro',
  num_outputs: 1
})
```

Carousel generation for multi-image posts:
```typescript
await bananaGenerateCarousel({
  prompt: "...",
  numImages: 3,
  baseSeed: 12345
})
```

### Brand Injection Service

File: `apps/api/src/services/brand-injection.ts`

Enriches prompts with:
- Character details (name, personality, visual style)
- Brand colors (Navy #001F4D, Lime #BFCC00, Cyan #00A9B5)
- Visual guidelines ("professional, modern, high-quality")
- Platform-specific overrides

```typescript
const injected = await injectBrandAndCharacter(
  "A woman in an office",
  {
    organizationId: org.id,
    characterProfileId: gema.id,
    brandGuidelinesId: brand.id
  }
)
// Result includes enriched prompt + metadata
```

## API Endpoints

### Character Management

**GET** `/studio/branded/characters`
List all character profiles for the organization.

**GET** `/studio/branded/characters/:id`
Get a specific character profile with all details.

**POST** `/studio/branded/characters`
Create a new character profile.
```json
{
  "name": "Gema",
  "description": "Professional woman, 28 years old, Latina heritage",
  "personality": "Professional, friendly, innovative",
  "elevenLabsVoiceId": "hFyqYpDgcxGhrlIVAeYq",
  "visualStyle": "Modern professional, executive style",
  "referenceImageUrls": [
    "https://drive.google.com/file/d/..."
  ],
  "isDefault": true
}
```

### Brand Management

**GET** `/studio/branded/brand`
Get organization's brand guidelines (colors, fonts, spacing).

### Image Generation

**POST** `/studio/branded/image-branded`
Generate images with brand consistency.

```json
{
  "orgId": "...",
  "prompt": "Woman presenting at a tech conference",
  "characterId": "gema-uuid",
  "provider": "fal",
  "numImages": 1,
  "isCarousel": false
}
```

**Carousel Example:**
```json
{
  "orgId": "...",
  "prompt": "Woman in different office environments",
  "characterId": "gema-uuid",
  "provider": "banana",
  "numImages": 3,
  "isCarousel": true,
  "model": "flux-pro"
}
```

### Audio Generation

**POST** `/studio/branded/audio`
Generate narration with character voice.

```json
{
  "orgId": "...",
  "text": "Hello, I'm Gema. Today we're discussing AI trends.",
  "voiceId": "hFyqYpDgcxGhrlIVAeYq"
}
```

### Video + Audio

**POST** `/studio/branded/video-with-audio`
Generate video with synchronized audio.

```json
{
  "orgId": "...",
  "prompt": "Woman speaking about business innovation",
  "sourceAssetId": "image-uuid",
  "audioAssetId": "audio-uuid",
  "characterId": "gema-uuid",
  "duration": 5,
  "aspectRatio": "9:16"
}
```

## Workflow Examples

### Example 1: Generate a Social Media Post with Gema

1. **Create Character** (one-time):
```bash
curl -X POST http://api/studio/branded/characters \
  -H "Authorization: Bearer token" \
  -d '{
    "name": "Gema",
    "elevenLabsVoiceId": "hFyqYpDgcxGhrlIVAeYq",
    "isDefault": true
  }'
```

2. **Generate Image** (with brand colors):
```bash
curl -X POST http://api/studio/branded/image-branded \
  -H "Authorization: Bearer token" \
  -d '{
    "prompt": "Professional woman in tech office environment",
    "characterId": "gema-uuid",
    "provider": "fal",
    "numImages": 1
  }'
```

3. **Generate Audio** (narration):
```bash
curl -X POST http://api/studio/branded/audio \
  -H "Authorization: Bearer token" \
  -d '{
    "text": "Welcome to our latest innovation update",
    "voiceId": "hFyqYpDgcxGhrlIVAeYq"
  }'
```

4. **Generate Video** (with both):
```bash
curl -X POST http://api/studio/branded/video-with-audio \
  -H "Authorization: Bearer token" \
  -d '{
    "prompt": "Woman presenting business insights",
    "sourceAssetId": "image-uuid",
    "audioAssetId": "audio-uuid",
    "characterId": "gema-uuid",
    "duration": 10
  }'
```

### Example 2: Instagram Carousel

```bash
curl -X POST http://api/studio/branded/image-branded \
  -d '{
    "prompt": "Woman in different KAPI office settings",
    "characterId": "gema-uuid",
    "provider": "banana",
    "numImages": 3,
    "isCarousel": true,
    "model": "flux-pro"
  }'
```

Result: 3 coordinated images following KAPI brand colors.

## Brand Color Injection

The system automatically injects brand colors into prompts:

**Input Prompt:**
```
"A woman in a modern office"
```

**Enhanced Prompt:**
```
"A woman in a modern office. FEATURING: Gema - professional and friendly. 
Visual style: Modern professional, executive style. 
BRAND COLORS: navy blue (#001F4D), lime green (#BFCC00), cyan (#00A9B5). 
Use these colors prominently in the design. 
STYLE: Professional, modern, high-quality. KAPI Service Group branding."
```

This ensures all generated content maintains visual consistency.

## Setup Instructions

### 1. Environment Variables

Copy `.env.example.branded` to your `.env.local`:

```bash
cp .env.example.branded .env.local
```

Add your API keys:
```
ELEVEN_LABS_API_KEY=your_key
BANANA_API_KEY=your_key
```

### 2. Database Migrations

Run the migrations:

```bash
# Main schema with character profiles and brand guidelines
supabase migration up 20260607_character_profiles_and_brand_guidelines.sql

# Insert Gema character and initial brand data
supabase migration up 20260607_insert_gema_character.sql
```

### 3. Credit Pricing Configuration

Add new operations to `credit_pricing` table:

| operation | provider | credits_per_unit |
|-----------|----------|------------------|
| generate_image_banana_flux_pro | banana | 50 |
| generate_image_banana_carousel | banana | 150 |
| generate_audio_eleven_labs | eleven_labs | 25 |
| generate_video_with_audio_kling_5s | fal | 100 |
| generate_video_with_audio_luma | fal | 120 |

### 4. Register Job Queues

Add to Bull MQ queue configuration:

```typescript
const queues = {
  'generate-image': generateImageJob,
  'generate-image-branded': generateImageBrandedJob,
  'generate-audio': generateAudioJob,
  'generate-video-with-audio': generateVideoWithAudioJob,
  // ... existing queues
}
```

## Customization

### Add New Character

1. Upload reference images to Google Drive
2. Create voice in Eleven Labs
3. POST to `/studio/branded/characters` with:
   - Name, description, personality
   - Voice ID
   - Reference image URLs
   - Visual style description

### Modify Brand Colors

Update `brand_guidelines` table:

```sql
UPDATE brand_guidelines
SET primary_color = '#NEW_HEX',
    primary_color_oklch = 'oklch(...)',
    updated_at = now()
WHERE organization_id = 'org-uuid';
```

Or use the API:
```bash
PATCH /studio/branded/brand \
  -d '{ "primaryColor": "#NEW_HEX" }'
```

### Create Platform-Specific Templates

Edit `generation_prompt_templates`:

```sql
INSERT INTO generation_prompt_templates (
  organization_id,
  character_profile_id,
  generation_kind,
  prompt_template,
  platform_overrides
) VALUES (
  'org-uuid',
  'gema-uuid',
  'image',
  'Base template...',
  '{
    "instagram": "Vertical, vibrant, use KAPI lime green prominently",
    "linkedin": "Professional, conservative colors, business focused"
  }'::jsonb
);
```

## Monitoring & Analytics

### Character Usage

Query `character_usage_log` to see which character was used in generations:

```sql
SELECT character_id, COUNT(*) as usage_count
FROM character_usage_log
WHERE organization_id = 'org-uuid'
GROUP BY character_id
ORDER BY usage_count DESC;
```

### Brand Consistency Check

View generated assets with metadata:

```sql
SELECT 
  ga.id,
  ga.kind,
  ga.metadata->>'brand_colors' as colors_used,
  ga.metadata->>'character' as character_used,
  ga.created_at
FROM generated_assets ga
WHERE ga.organization_id = 'org-uuid'
ORDER BY ga.created_at DESC;
```

## Troubleshooting

### Image Quality Issues

- Check if brand colors are being injected in the prompt
- Verify character personality traits match the generation context
- Try different models: `flux-pro` (best quality) vs `flux-dev` (faster)

### Audio Duration Mismatch

- Ensure video duration matches audio length
- Use platform for video composition (FFmpeg wrapper)
- Track duration_seconds in asset metadata

### Character Not Applied

- Verify character profile exists and belongs to organization
- Check `character_profile_id` is set in generation job
- Review `brand_injection.ts` logic for null/undefined handling

## Next Steps

1. ✅ Set up database schema
2. ✅ Configure API keys (Eleven Labs, Banana)
3. ✅ Create Gema character profile
4. ✅ Generate first branded image
5. 🔄 Build UI for character/brand management
6. 🔄 Create post publishing workflow with brand validation
7. 🔄 Add analytics dashboard for content performance

## References

- [Eleven Labs API Docs](https://elevenlabs.io/docs)
- [Banana.dev API Docs](https://docs.banana.dev)
- [FAL.ai Image Generation](https://fal.ai)
- [KAPI Service Group Brand](https://kapi.services)
