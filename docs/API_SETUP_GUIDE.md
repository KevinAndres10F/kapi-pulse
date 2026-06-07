# API Setup Guide

Configurar las 3 APIs necesarias para branded generation.

## 1️⃣ Eleven Labs (Text-to-Speech)

### Crear Cuenta
1. Ir a https://elevenlabs.io
2. Sign up (gratuito)
3. Ir a Settings → API Keys
4. Copiar tu API key

### Obtener Voice ID
1. Ir a Voices → Manage
2. Copiar el voice_id (ejemplo: `hFyqYpDgcxGhrlIVAeYq` para Gema)
3. O crear una voz custom:
   - Ir a Voice Lab
   - Cargar audio de referencia
   - Esperar a que procese
   - Copiar el voice_id

### Configurar en .env
```bash
ELEVEN_LABS_API_KEY=sk_your_key_here
GEMA_VOICE_ID=hFyqYpDgcxGhrlIVAeYq
```

### Testear
```bash
curl -X POST https://api.elevenlabs.io/v1/text-to-speech/hFyqYpDgcxGhrlIVAeYq \
  -H "xi-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello, I am Gema","voice_settings":{"stability":0.5,"similarity_boost":0.75}}'
```

**Pricing**: ~$11 per 1M characters (muy barato)

---

## 2️⃣ Banana.dev (Image Generation)

### Crear Cuenta
1. Ir a https://app.banana.dev
2. Sign up (gratuito, con créditos iniciales)
3. Ir a Account → API Keys
4. Copiar API key

### Obtener Endpoint
1. Ir a Models
2. Buscar "FLUX" o "Stable Diffusion"
3. Usar el endpoint: `https://api.banana.dev/start/v4/`
4. Model keys están documentados (los tenemos en código)

### Configurar en .env
```bash
BANANA_API_KEY=your_api_key
BANANA_ENDPOINT=https://api.banana.dev/start/v4/
```

### Testear
```bash
curl -X POST https://api.banana.dev/start/v4/ \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model_key": "e261d61f-7bcc-4122-8fea-abdce3b10d68",
    "prompt": "woman in office",
    "width": 1024,
    "height": 1024
  }'
```

**Pricing**: $0.10-0.30 por imagen (según modelo)

---

## 3️⃣ FAL.ai (Video Generation)

### ✅ Ya Configurado
El proyecto ya tiene FAL.ai setup. Solo verifica:

```bash
# Check en .env
grep FAL_API_KEY .env.local
```

Si no está, ir a https://fal.ai y crear account.

---

## 🧪 Verificar Todo

### Test Eleven Labs
```bash
npm run api
# En otra terminal:
curl -X POST http://localhost:3001/studio/branded/audio \
  -H "Authorization: Bearer TEST_TOKEN" \
  -d '{
    "orgId": "YOUR_ORG_UUID",
    "text": "Hello, I am Gema",
    "voiceId": "hFyqYpDgcxGhrlIVAeYq"
  }'
```

### Test Banana
```bash
curl -X POST http://localhost:3001/studio/branded/image-branded \
  -H "Authorization: Bearer TEST_TOKEN" \
  -d '{
    "orgId": "YOUR_ORG_UUID",
    "prompt": "Woman in tech office",
    "characterId": "gema-uuid",
    "provider": "banana"
  }'
```

### Test FAL
```bash
curl -X POST http://localhost:3001/studio/branded/video-with-audio \
  -H "Authorization: Bearer TEST_TOKEN" \
  -d '{
    "orgId": "YOUR_ORG_UUID",
    "prompt": "Woman presenting",
    "sourceAssetId": "image-uuid",
    "characterId": "gema-uuid"
  }'
```

---

## 💳 Presupuesto Mensual

| API | Uso | Costo |
|-----|-----|-------|
| Eleven Labs | 100 posts × 30s | ~$15 |
| Banana | 100 imágenes | ~$15 |
| FAL | 50 videos | ~$25 |
| **Total** | | **~$55/mes** |

---

## 🔑 Checklist Setup

- [ ] Eleven Labs API key en .env
- [ ] Gema voice_id en .env
- [ ] Banana API key en .env
- [ ] FAL API key en .env (verificar)
- [ ] Testear cada API con curl
- [ ] Verificar créditos disponibles
- [ ] Cambiar from="test@example.com" en FAL

---

## ⚠️ Troubleshooting

**"API Key invalid"**
```bash
# Verify key format (no spaces)
echo $ELEVEN_LABS_API_KEY
```

**"Model not found"**
```bash
# Check model_key is correct
# flux-pro: e261d61f-7bcc-4122-8fea-abdce3b10d68
# flux-dev: c13ff1c3-38c7-4dd8-b4b5-e7342e09d63f
```

**"Request timeout"**
```bash
# Increase timeout or retry
# Max wait time ~2-3 minutes for images
```

**"Insufficient credits"**
```bash
# Add payment method in API dashboard
# Or use free tier (limited)
```

---

## 📝 Production Setup

### Environment Variables (Production)
```bash
# Add to your CI/CD secrets
ELEVEN_LABS_API_KEY=xxx
BANANA_API_KEY=xxx
FAL_API_KEY=xxx
GEMA_VOICE_ID=hFyqYpDgcxGhrlIVAeYq
```

### Rate Limiting
- Eleven Labs: 30 requests/min
- Banana: 10 requests/min (free tier)
- FAL: 5 requests/min (free tier)

### Monitoring
- Log all API calls in production
- Track cost per operation
- Set up alerts for API failures
- Monitor credit balance

---

## 🎯 Next Steps

1. ✅ Create API accounts (Eleven Labs, Banana, FAL)
2. ✅ Get API keys and voice IDs
3. ✅ Add to .env.local
4. ✅ Test endpoints
5. ✅ Verify everything works
6. 🔄 Deploy to production

**You're ready to generate content!** 🚀
