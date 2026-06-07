# Complete Setup Guide - Branded Content Generation

Step-by-step guide to set up the branded content generation system with all features enabled.

## Prerequisites

- Node.js 18+
- Supabase CLI
- API keys for:
  - Eleven Labs (TTS)
  - Banana.dev (Image generation)
  - FAL.ai (Video generation, already configured)

## Quick Setup

### Option 1: Automatic Setup (Recommended)

```bash
chmod +x scripts/setup-branded-generation.sh
./scripts/setup-branded-generation.sh
```

This will:
1. Create `.env.local` with API key prompts
2. Apply all database migrations
3. Verify configuration

### Option 2: Manual Setup

#### Step 1: Environment Variables

```bash
cp .env.example.branded .env.local
```

Edit `.env.local` and add:

```bash
# Eleven Labs
ELEVEN_LABS_API_KEY=your_api_key_here

# Banana
BANANA_API_KEY=your_api_key_here
BANANA_ENDPOINT=https://api.banana.dev/start/v4/

# Character profiles
GEMA_VOICE_ID=hFyqYpDgcxGhrlIVAeYq

# KAPI Brand Colors
KAPI_PRIMARY=#001F4D
KAPI_SECONDARY=#BFCC00
KAPI_ACCENT=#00A9B5
```

#### Step 2: Database Migrations

Apply migrations in order:

```bash
# Main schema: character profiles and brand guidelines
npx supabase migration up 20260607_character_profiles_and_brand_guidelines.sql

# Initial data: Gema character and brand setup
npx supabase migration up 20260607_insert_gema_character.sql

# Credit pricing
npx supabase migration up 20260607_add_credit_pricing.sql

# Posts and publishing tables
npx supabase migration up 20260607_add_posts_table.sql
```

Verify in Supabase dashboard that tables are created:
- `character_profiles`
- `brand_guidelines`
- `generation_prompt_templates`
- `character_usage_log`
- `posts`
- `post_metrics`

#### Step 3: Register Job Queues

Edit `apps/worker/src/index.ts` and add:

```typescript
import { generateAudioJob } from './jobs/generation/generate-audio'
import { generateImageBrandedJob } from './jobs/generation/generate-image-branded'
import { generateVideoWithAudioJob } from './jobs/generation/generate-video-with-audio'

// Register queue processors
const queues = {
  'generate-image': generateImageJob,
  'generate-audio': generateAudioJob,
  'generate-image-branded': generateImageBrandedJob,
  'generate-video-with-audio': generateVideoWithAudioJob,
  'generate-video': generateVideoJob,
  'generate-avatar': generateAvatarJob,
  'generate-copy': generateCopyJob,
}
```

#### Step 4: Import Routes in Main API

Edit `apps/api/src/index.ts`:

```typescript
import generateBranded from './routes/studio/generate-branded'
import brandValidation from './routes/studio/brand-validation'
import publishing from './routes/studio/publishing'
import dashboard from './routes/studio/dashboard'

// Mount routes
app.route('/studio/branded', generateBranded)
app.route('/studio/brand-validation', brandValidation)
app.route('/studio/publishing', publishing)
app.route('/studio/dashboard', dashboard)
```

## Verification

### Test API is Running

```bash
curl http://localhost:3001/studio/branded/characters
```

Expected response:
```json
{
  "characters": [
    {
      "id": "...",
      "name": "Gema",
      "personality": "Professional, friendly, innovative",
      "eleven_labs_voice_id": "hFyqYpDgcxGhrlIVAeYq"
    }
  ]
}
```

### Test Character Exists

```bash
curl http://localhost:3001/studio/branded/characters \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Brand Guidelines

```bash
curl http://localhost:3001/studio/branded/brand \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected colors:
- Primary: `#001F4D` (Navy)
- Secondary: `#BFCC00` (Lime Green)
- Accent: `#00A9B5` (Cyan)

## Complete Feature List

### ✅ Phase 1: Character Profiles
- [x] Store multiple characters (personas)
- [x] Eleven Labs voice IDs
- [x] Visual style references
- [x] Google Drive image references

### ✅ Phase 2: Eleven Labs Integration
- [x] TTS audio generation
- [x] Voice stability/similarity controls
- [x] Character voice assignment

### ✅ Phase 3: Banana API Integration
- [x] Flux image generation
- [x] Carousel generation (multiple images)
- [x] Fallback to FAL

### ✅ Phase 4: Video + Audio
- [x] Synchronized video+audio jobs
- [x] Audio asset linking
- [x] Duration tracking

### ✅ Phase 5: Brand Consistency
- [x] KAPI color injection (Navy, Lime, Cyan)
- [x] Prompt enrichment with brand details
- [x] Platform-specific templates
- [x] Watermark configuration

### ✅ Bonus: Validation & Publishing
- [x] Brand compliance scoring (0-100)
- [x] Asset validation before publishing
- [x] Campaign validation
- [x] Publishing workflow
- [x] Post scheduling
- [x] Compliance reporting
- [x] Dashboard with analytics

## API Endpoint Reference

### Character Management
```
GET    /studio/branded/characters
GET    /studio/branded/characters/:id
POST   /studio/branded/characters
```

### Brand Management
```
GET    /studio/branded/brand
```

### Content Generation
```
POST   /studio/branded/image-branded
POST   /studio/branded/audio
POST   /studio/branded/video-with-audio
```

### Validation
```
GET    /studio/brand-validation/assets/:assetId/validate
POST   /studio/brand-validation/assets/validate-batch
GET    /studio/brand-validation/campaigns/:campaignId/validate
GET    /studio/brand-validation/compliance-report
```

### Publishing
```
POST   /studio/publishing/posts
POST   /studio/publishing/posts/bulk
GET    /studio/publishing/history
GET    /studio/publishing/performance
```

### Analytics Dashboard
```
GET    /studio/dashboard/brand-overview
GET    /studio/dashboard/generation-analytics
GET    /studio/dashboard/posting-stats
GET    /studio/dashboard/quick-stats
```

## Example Workflows

### Workflow 1: Generate and Publish a Social Post

```bash
# 1. Get available characters
curl http://localhost:3001/studio/branded/characters \
  -H "Authorization: Bearer $TOKEN"

# 2. Generate branded image with Gema
curl -X POST http://localhost:3001/studio/branded/image-branded \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "org-uuid",
    "prompt": "Woman in tech office presenting",
    "characterId": "gema-uuid",
    "provider": "fal",
    "numImages": 1
  }'

# 3. Wait for job completion (check job status)
curl http://localhost:3001/studio/generate/jobs/:jobId \
  -H "Authorization: Bearer $TOKEN"

# 4. Validate the image
curl http://localhost:3001/studio/brand-validation/assets/:assetId/validate \
  -H "Authorization: Bearer $TOKEN"

# 5. Publish to Instagram
curl -X POST http://localhost:3001/studio/publishing/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assetIds": ["asset-uuid"],
    "platform": "instagram",
    "caption": "Check out our latest insights!",
    "validateBranding": true
  }'
```

### Workflow 2: Generate Carousel with Audio + Video

```bash
# 1. Generate carousel (3 images with theme consistency)
curl -X POST http://localhost:3001/studio/branded/image-branded \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "orgId": "org-uuid",
    "prompt": "Woman in different KAPI office scenes",
    "characterId": "gema-uuid",
    "provider": "banana",
    "numImages": 3,
    "isCarousel": true,
    "model": "flux-pro"
  }'

# 2. Generate narration audio
curl -X POST http://localhost:3001/studio/branded/audio \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "orgId": "org-uuid",
    "text": "Welcome to our latest update",
    "voiceId": "hFyqYpDgcxGhrlIVAeYq"
  }'

# 3. Generate video with audio sync
curl -X POST http://localhost:3001/studio/branded/video-with-audio \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "orgId": "org-uuid",
    "prompt": "Woman presenting business insights",
    "sourceAssetId": "first-carousel-image-uuid",
    "audioAssetId": "audio-uuid",
    "characterId": "gema-uuid",
    "duration": 10,
    "aspectRatio": "9:16"
  }'

# 4. Schedule for later
curl -X POST http://localhost:3001/studio/publishing/posts \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "assetIds": ["video-asset-uuid"],
    "platform": "tiktok",
    "caption": "New insights with Gema!",
    "scheduledFor": "2026-06-15T14:00:00Z",
    "validateBranding": true
  }'
```

### Workflow 3: Check Brand Compliance

```bash
# Check individual asset
curl http://localhost:3001/studio/brand-validation/assets/:assetId/validate \
  -H "Authorization: Bearer $TOKEN"

# Check campaign compliance
curl http://localhost:3001/studio/brand-validation/campaigns/:campaignId/validate \
  -H "Authorization: Bearer $TOKEN"

# Get full compliance report
curl http://localhost:3001/studio/brand-validation/compliance-report \
  -H "Authorization: Bearer $TOKEN"

# View dashboard overview
curl http://localhost:3001/studio/dashboard/brand-overview \
  -H "Authorization: Bearer $TOKEN"
```

## Troubleshooting

### Issue: "ELEVEN_LABS_API_KEY not configured"

**Solution**: Make sure `.env.local` has the key:
```bash
grep ELEVEN_LABS_API_KEY .env.local
```

### Issue: Migration errors

**Solution**: Check if table exists:
```bash
npx supabase db list tables
```

### Issue: Job not running

**Solution**: Verify Bull MQ queue is registered:
```bash
# In worker logs, you should see:
# ✓ Queue registered: generate-audio
# ✓ Queue registered: generate-image-branded
```

### Issue: Voice sounds robotic

**Solution**: Adjust stability and similarity in request:
```json
{
  "text": "...",
  "voiceId": "hFyqYpDgcxGhrlIVAeYq",
  "modelId": "eleven_monolingual_v1",
  "stability": 0.7,
  "similarityBoost": 0.85
}
```

## Performance Tuning

### Image Generation Speed
- Use `flux-schnell` for faster generation (lower quality)
- Use `flux-dev` for balanced speed/quality
- Use `flux-pro` for best quality (slowest)

### Audio Generation
- Max text length: 5000 characters
- Typical processing: 10-30 seconds per request
- Cache voice ID for repeated uses

### Video Generation
- Min duration: 5 seconds
- Max duration: 10 seconds
- Aspect ratios: 16:9, 9:16, 1:1

## Cost Estimation (Monthly)

Assuming 100 posts per month:

| Operation | Credits | Cost |
|-----------|---------|------|
| 100 images (FAL Flux Dev) | 6,000 | $30 |
| 50 images (Banana) | 2,500 | ~$15 |
| 100 audio (30s avg) | 2,500 | ~$10 |
| 50 videos (5s) | 5,000 | $25 |
| **Total** | **16,000** | **~$80** |

## Next Steps

1. ✅ Run setup script
2. ✅ Configure environment
3. ✅ Apply migrations
4. ✅ Test endpoints
5. 🔄 Build UI for character/brand management
6. 🔄 Integrate with existing post publishing
7. 🔄 Set up webhook for social media updates
8. 🔄 Create cron job for analytics collection

## Support

For issues:
1. Check logs: `npm run dev --workspace=apps/api`
2. Review docs: `docs/BRANDED_GENERATION.md`
3. Test endpoints: Use curl commands above
4. Check database: `npx supabase db list tables`

## Resources

- [Eleven Labs API](https://elevenlabs.io/docs)
- [Banana.dev API](https://docs.banana.dev)
- [FAL.ai Models](https://fal.ai)
- [KAPI Service Group](https://kapi.services)
