# Quick Start - Branded Content Generation

Get started in 5 minutes.

## 1️⃣ Setup (2 minutes)

```bash
# Copy environment template
cp .env.example.branded .env.local

# Add your API keys (edit the file)
nano .env.local

# Add these lines:
ELEVEN_LABS_API_KEY=your_key
BANANA_API_KEY=your_key
```

## 2️⃣ Run Migrations (1 minute)

```bash
npx supabase migration up 20260607_character_profiles_and_brand_guidelines.sql
npx supabase migration up 20260607_insert_gema_character.sql
npx supabase migration up 20260607_add_credit_pricing.sql
npx supabase migration up 20260607_add_posts_table.sql
```

## 3️⃣ Start Services (1 minute)

Terminal 1 - API:
```bash
npm run dev --workspace=apps/api
```

Terminal 2 - Worker:
```bash
npm run dev --workspace=apps/worker
```

## 4️⃣ Generate Your First Image

```bash
# Get character ID (Gema)
curl http://localhost:3001/studio/branded/characters \
  -H "Authorization: Bearer YOUR_TOKEN"

# Generate image with brand colors
curl -X POST http://localhost:3001/studio/branded/image-branded \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "YOUR_ORG_UUID",
    "characterId": "GEMA_UUID",
    "prompt": "Woman in tech office"
  }'
```

## 5️⃣ Publish to Instagram

```bash
# Get your image from previous step (asset_ids from job response)
curl -X POST http://localhost:3001/studio/publishing/posts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assetIds": ["ASSET_UUID"],
    "platform": "instagram",
    "caption": "Check out our latest updates with Gema!"
  }'
```

## ✨ What You Get

✅ **Gema** - Professional female character  
✅ **Voice** - Eleven Labs TTS (`hFyqYpDgcxGhrlIVAeYq`)  
✅ **Colors** - Navy #001F4D, Lime #BFCC00, Cyan #00A9B5  
✅ **Images** - With FAL & Banana  
✅ **Video** - With audio sync  
✅ **Publishing** - Scheduled & validated  

## Key Features

| Feature | Endpoint | What it does |
|---------|----------|--------------|
| **Image** | `POST /image-branded` | Generate with Gema + KAPI colors |
| **Audio** | `POST /audio` | Narration with Gema's voice |
| **Video** | `POST /video-with-audio` | Video + audio synchronized |
| **Publish** | `POST /publishing/posts` | Post to Instagram, TikTok, etc |
| **Validate** | `GET /brand-validation/assets/:id/validate` | Check brand compliance |
| **Dashboard** | `GET /dashboard/brand-overview` | See analytics |

## Example: Full Workflow

```bash
# 1. Generate 3 carousel images
curl -X POST http://localhost:3001/studio/branded/image-branded \
  -d '{
    "prompt": "Woman in different office scenes",
    "characterId": "gema",
    "provider": "banana",
    "numImages": 3,
    "isCarousel": true
  }'

# 2. Generate narration
curl -X POST http://localhost:3001/studio/branded/audio \
  -d '{
    "text": "Welcome to our team!",
    "voiceId": "hFyqYpDgcxGhrlIVAeYq"
  }'

# 3. Check brand compliance
curl http://localhost:3001/studio/brand-validation/assets/ASSET_ID/validate

# 4. Publish
curl -X POST http://localhost:3001/studio/publishing/posts \
  -d '{
    "assetIds": ["image1", "image2", "image3"],
    "platform": "instagram",
    "caption": "New insights with our team!"
  }'
```

## Environment Variables Reference

```bash
# APIs
ELEVEN_LABS_API_KEY=...          # Text-to-speech
BANANA_API_KEY=...               # Image generation

# Character
GEMA_VOICE_ID=hFyqYpDgcxGhrlIVAeYq

# Brand Colors (auto-loaded)
KAPI_PRIMARY=#001F4D             # Navy
KAPI_SECONDARY=#BFCC00           # Lime
KAPI_ACCENT=#00A9B5              # Cyan
```

## Troubleshooting

**Q: API returns 401**  
A: Make sure you're passing a valid auth token

**Q: Image generation hangs**  
A: Check if Worker process is running in Terminal 2

**Q: "Insufficient credits"**  
A: Add credits to your org in Supabase `user_credits` table

**Q: Voice sounds wrong**  
A: Check `GEMA_VOICE_ID` is `hFyqYpDgcxGhrlIVAeYq`

## Next Steps

1. ✅ Get it running with this quick start
2. 📖 Read full guide: `docs/BRANDED_GENERATION_SETUP.md`
3. 🎨 Customize Gema or add new characters
4. 📊 Check dashboard: `/studio/dashboard/brand-overview`
5. 🚀 Integrate with your publishing pipeline

## Support

- **Docs**: `docs/BRANDED_GENERATION.md`
- **Setup**: `docs/BRANDED_GENERATION_SETUP.md`
- **Code**: `apps/api/src/services/`, `apps/worker/src/jobs/`

---

**That's it!** You now have:
- ✅ Professional character (Gema)
- ✅ KAPI brand colors injected automatically
- ✅ Audio narration with Gema's voice
- ✅ Image & video generation
- ✅ Brand-validated publishing
- ✅ Analytics dashboard

**Happy generating! 🎉**
