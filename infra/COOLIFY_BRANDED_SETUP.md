# Configurar Branded Generation en Coolify

Guía corregida y verificada contra el código real (`apps/api`, `apps/worker`, `apps/ai`).

> **Modelo de deploy:** en Coolify viven 3 contenedores con Dockerfile propio:
> `kapi-api` (apps/api), `kapi-worker` (apps/worker) y `kapi-ai` (apps/ai).
> **`apps/web` NO está en Coolify** — se despliega en **Netlify** (ver `netlify.toml`),
> así que sus variables `NEXT_PUBLIC_*` van en Netlify → Site settings → Environment.

---

## ⚠️ Correcciones importantes vs. versiones anteriores de esta guía

1. **La variable de Fal se llama `FAL_KEY`, NO `FAL_API_KEY`.**
   El código lee `process.env.FAL_KEY` (`apps/api/src/services/providers/fal.ts`,
   `apps/worker/src/lib/providers/fal.ts`, `routes/studio/generate.ts`). Si la
   nombras `FAL_API_KEY`, la generación de **imágenes y videos** falla con
   `Error: FAL_KEY is not configured` y el endpoint `/capabilities` reporta
   `image:false, video:false`.

2. **Las imágenes salen de Fal (FLUX), no de Banana.**
   Banana.dev cerró su plataforma serverless y el provider `banana.ts` apunta a
   `api.banana.dev` (muerto). No es "Nano Banana" de Google — es otra cosa con
   API incompatible. **No configures Banana.** Usa `FAL_KEY` para imágenes y, como
   fallback, Replicate (`REPLICATE_API_TOKEN`).

3. **El voice ID de Gema NO se setea por env var.**
   La voz vive en el registro del personaje en Supabase (`eleven_labs_voice_id`).
   En Coolify solo va la API key (`ELEVEN_LABS_API_KEY`).

---

## 🎯 Variables NECESARIAS para Branded Generation

Estas van en **`kapi-api` Y `kapi-worker`** (ambos contenedores), salvo donde se indique.

### 🔴 Infraestructura base (sin esto las apps no arrancan)

```
SUPABASE_URL                = https://<proyecto>.supabase.co     (String)
SUPABASE_SERVICE_ROLE_KEY   = <service role key>                 (Secret)
SUPABASE_ANON_KEY           = <anon key>                         (Secret)  # api
REDIS_URL                   = redis://...                        (Secret)  # cola de jobs
TOKEN_ENCRYPTION_KEY        = <openssl rand -hex 32>             (Secret)  # api
APP_URL                     = https://app.tudominio.com          (String)
API_URL                     = https://api.tudominio.com          (String)
AI_URL                      = http://kapi-ai:3002                (String)  # red interna Coolify
```

> **REDIS_URL es obligatorio para el worker.** Sin Redis, el worker no toma
> ningún job → ninguna imagen/video/audio se genera nunca.

### 🔴 Generación visual / voz

```
FAL_KEY                     = <fal.ai key>                       (Secret)  ⭐ imágenes + video
FAL_API_URL                 = https://queue.fal.run              (String)  # opcional, tiene default
FAL_DEFAULT_IMAGE_MODEL     = fal-ai/flux/dev                    (String)  # opcional
FAL_DEFAULT_VIDEO_MODEL     = fal-ai/kling-video/v2              (String)  # opcional
ELEVEN_LABS_API_KEY         = sk_...                             (Secret)  # voz de Gema (TTS)
STUDIO_BUCKET               = generated-assets                   (String)  # bucket de assets
```

### 🔴 Solo en `kapi-ai` (genera el copy/guion)

```
ANTHROPIC_API_KEY           = sk-ant-...                         (Secret)
CLAUDE_MODEL                = claude-opus-4-7                     (String)
```

---

## 🟡 Variables OPCIONALES (features extra)

```
# Fallback de imagen si Fal da 429/503 (recomendado)
REPLICATE_API_TOKEN         = r8_...                             (Secret)
STUDIO_IMAGE_FALLBACK       = replicate                          (String)
REPLICATE_SDXL_VERSION      = 7762fd07cf82c948...                (String)

# Paso de avatar / UGC (elige uno)
HEYGEN_API_KEY              = ...                                (Secret)
HEDRA_API_KEY               = ...                                (Secret)
STUDIO_AVATAR_PROVIDER      = heygen                             (String)

# Colores de marca (referencia; el runtime no los lee por env, están en brand guidelines)
KAPI_PRIMARY                = #001F4D
KAPI_SECONDARY              = #BFCC00
KAPI_ACCENT                 = #00A9B5
```

> Publishing a redes sociales (`META_*`, `INSTAGRAM_*`, `LINKEDIN_*`, `TIKTOK_*`,
> etc.) es un módulo aparte — configúralo solo si vas a publicar. Ver `.env.example`.

---

## 🌐 Variables de `apps/web` (en NETLIFY, no Coolify)

```
NEXT_PUBLIC_SUPABASE_URL        = https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = <anon key>
NEXT_PUBLIC_API_URL             = https://api.tudominio.com
```

> Nunca pongas keys de Fal/ElevenLabs/Anthropic con prefijo `NEXT_PUBLIC_*`:
> quedarían expuestas en el browser y bypasearían la deducción de créditos.

---

## 🔧 Pasos en Coolify

1. Login → proyecto `kapi-pulse`.
2. Por cada contenedor (`kapi-api`, `kapi-worker`, `kapi-ai`):
   - Abrir la app → **Environment Variables**.
   - Agregar las variables de su sección (marcar **Secret** en las keys).
   - **Save**.
3. **Redeploy** de cada contenedor (los cambios de env requieren rebuild/restart).

---

## 🔍 Verificación

```bash
# 1. API viva
curl https://api.tudominio.com/health        # 200 OK

# 2. Capacidades de generación (debe mostrar image:true, video:true)
curl https://api.tudominio.com/api/studio/generate/capabilities \
  -H "Authorization: Bearer <TOKEN>"
# Esperado: {"image":true,"video":true,"avatar":...,"copy":true,...}
```

- Si `image:false` / `video:false` → falta `FAL_KEY` (revisa que NO la nombraste `FAL_API_KEY`).
- Worker: revisar logs en Coolify; debe conectar a Redis y quedar esperando jobs.
  Si loguea error de conexión a Redis → revisar `REDIS_URL`.

---

## 📋 Checklist

```
kapi-api:
□ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY
□ REDIS_URL
□ TOKEN_ENCRYPTION_KEY
□ APP_URL / API_URL / AI_URL
□ FAL_KEY            (¡no FAL_API_KEY!)
□ ELEVEN_LABS_API_KEY
□ STUDIO_BUCKET

kapi-worker:
□ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
□ REDIS_URL          (crítico — sin esto no procesa jobs)
□ FAL_KEY
□ ELEVEN_LABS_API_KEY
□ STUDIO_BUCKET

kapi-ai:
□ ANTHROPIC_API_KEY
□ CLAUDE_MODEL

Netlify (web):
□ NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
□ NEXT_PUBLIC_API_URL

Opcional:
□ REPLICATE_API_TOKEN + STUDIO_IMAGE_FALLBACK=replicate
□ HEYGEN_API_KEY / HEDRA_API_KEY

Verificación:
□ Redeploy de los 3 contenedores
□ curl /health → 200
□ curl /api/studio/generate/capabilities → image:true, video:true
□ Worker conectado a Redis (logs)
□ Personaje Gema con eleven_labs_voice_id correcto en Supabase
```
