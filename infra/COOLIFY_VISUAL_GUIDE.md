# Guía Visual Paso a Paso - Coolify

Instrucciones con diagramas ASCII para configurar en Coolify.

---

## 🎯 Resumen Rápido

```
1. Login en Coolify Dashboard
2. Seleccionar proyecto: kapi-pulse
3. Ir a: Settings → Environment Variables
4. Para CADA app (api, worker, web):
   - Agregar variables
   - Marcar "Secret" para API keys
5. Guardar y Redeploy (Full Rebuild)
6. Verificar en logs
7. Test en browser
```

---

## 📋 Variables por Aplicación

### API (apps/api) - 8 variables

```
┌──────────────────────────────────────────────┐
│ API Application Variables                     │
├──────────────────────────────────────────────┤
│                                              │
│ 1. ELEVEN_LABS_API_KEY      (Secret ☑)      │
│    Value: sk_xxxxxxxxxxxxxxxx               │
│                                              │
│ 2. BANANA_API_KEY           (Secret ☑)      │
│    Value: xxxxxxxxxxxxxxxxxxxxxxxx          │
│                                              │
│ 3. BANANA_ENDPOINT          (String)        │
│    Value: https://api.banana.dev/start/v4/  │
│                                              │
│ 4. FAL_API_KEY              (Secret ☑)      │
│    Value: xxxxxxxxxxxxxxxxxxxxxxxx          │
│                                              │
│ 5. GEMA_VOICE_ID            (String)        │
│    Value: hFyqYpDgcxGhrlIVAeYq              │
│                                              │
│ 6. KAPI_PRIMARY             (String)        │
│    Value: #001F4D                           │
│                                              │
│ 7. KAPI_SECONDARY           (String)        │
│    Value: #BFCC00                           │
│                                              │
│ 8. KAPI_ACCENT              (String)        │
│    Value: #00A9B5                           │
│                                              │
└──────────────────────────────────────────────┘
```

### Worker (apps/worker) - 8 variables

```
┌──────────────────────────────────────────────┐
│ Worker Application Variables                  │
├──────────────────────────────────────────────┤
│                                              │
│ Copiar TODAS las 8 variables de API:        │
│                                              │
│ ☑ ELEVEN_LABS_API_KEY      (Secret)        │
│ ☑ BANANA_API_KEY           (Secret)        │
│ ☑ BANANA_ENDPOINT          (String)        │
│ ☑ FAL_API_KEY              (Secret)        │
│ ☑ GEMA_VOICE_ID            (String)        │
│ ☑ KAPI_PRIMARY             (String)        │
│ ☑ KAPI_SECONDARY           (String)        │
│ ☑ KAPI_ACCENT              (String)        │
│                                              │
│ ⚠️  Worker necesita las MISMAS variables    │
│    para procesar los jobs de generación    │
│                                              │
└──────────────────────────────────────────────┘
```

### Web (apps/web) - 2 variables

```
┌──────────────────────────────────────────────┐
│ Web Application Variables                     │
├──────────────────────────────────────────────┤
│                                              │
│ 1. NEXT_PUBLIC_ORG_ID      (String)         │
│    Value: tu-org-uuid-aqui                  │
│                                              │
│ 2. NEXT_PUBLIC_API_URL     (String)         │
│    Value: https://api.tudominio.com         │
│                                              │
│ ℹ️  Solo 2 variables públicas para web      │
│    (NEXT_PUBLIC_ son visibles en cliente)   │
│                                              │
└──────────────────────────────────────────────┘
```

---

## ✅ Checklist Visual

```
┌────────────────────────────────────────────────────┐
│  SETUP CHECKLIST                                   │
├────────────────────────────────────────────────────┤
│                                                    │
│  OBTENER API KEYS:                                 │
│  □ elevenlabs.io → API Keys → copiar sk_...       │
│  □ banana.dev → Account → API Keys → copiar       │
│  □ fal.ai → Dashboard → copiar (o ya tienes)      │
│                                                    │
│  COOLIFY SETUP:                                    │
│  □ Login en Coolify                                │
│  □ Seleccionar kapi-pulse                          │
│  □ Settings → Environment Variables                │
│  □ Seleccionar apps/api                            │
│  □ Agregar 8 variables (ver lista arriba)          │
│  □ Seleccionar apps/worker                         │
│  □ Agregar las mismas 8 variables                  │
│  □ Seleccionar apps/web                            │
│  □ Agregar 2 variables NEXT_PUBLIC_*               │
│                                                    │
│  DEPLOY:                                           │
│  □ Guardar cambios (Save)                          │
│  □ Hacer Full Rebuild                              │
│  □ Esperar logs (5-10 min)                         │
│  □ Verificar sin errores                           │
│                                                    │
│  VERIFICAR:                                        │
│  □ curl https://api.tudominio.com/health           │
│  □ Acceder a /studio/branded en navegador          │
│  □ Ver Gema character cargado                      │
│  □ Ver colores KAPI presentes                      │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## 🎨 Valores a Copiar

### API Keys (Obtener de cada servicio)

```
Eleven Labs:
 Ir a: https://elevenlabs.io/app/settings/api-keys
 Copiar: sk_xxxxxxxxxxxxxxxxxxxxxxxx
 Pegar en: ELEVEN_LABS_API_KEY

Banana:
 Ir a: https://app.banana.dev/account/api-keys
 Copiar: xxxxxxxxxxxxxxxxxxxxxxxx
 Pegar en: BANANA_API_KEY

FAL:
 Ir a: https://fal.ai/dashboard/credentials
 Copiar: xxxxxxxxxxxxxxxxxxxxxxxx
 Pegar en: FAL_API_KEY
```

### Valores Fijos (Copiar exactamente)

```
BANANA_ENDPOINT:
 https://api.banana.dev/start/v4/

GEMA_VOICE_ID:
 hFyqYpDgcxGhrlIVAeYq

KAPI_PRIMARY:
 #001F4D

KAPI_SECONDARY:
 #BFCC00

KAPI_ACCENT:
 #00A9B5
```

---

## 🔐 Secret vs String

```
┌──────────────────────────┬──────────┐
│ Variable                 │ Tipo     │
├──────────────────────────┼──────────┤
│ ELEVEN_LABS_API_KEY      │ Secret ☑ │
│ BANANA_API_KEY           │ Secret ☑ │
│ FAL_API_KEY              │ Secret ☑ │
│ BANANA_ENDPOINT          │ String   │
│ GEMA_VOICE_ID            │ String   │
│ KAPI_PRIMARY             │ String   │
│ KAPI_SECONDARY           │ String   │
│ KAPI_ACCENT              │ String   │
│ NEXT_PUBLIC_ORG_ID       │ String   │
│ NEXT_PUBLIC_API_URL      │ String   │
└──────────────────────────┴──────────┘

Secret = Ocultar valor (para API keys)
String = Mostrar valor (para configuración)
```

---

## 🚀 Deploy Flow

```
PASO 1: Guardar Variables
   └─ Click "Save Changes"
   └─ Esperar confirmación

PASO 2: Triggerar Deploy
   └─ Ir a Deployments
   └─ Click "Full Rebuild"

PASO 3: Monitorear
   └─ Ver logs en tiempo real
   └─ Buscar líneas de éxito:
      ✓ "Starting API..."
      ✓ "Starting Worker..."
      ✓ "Starting Web..."
      ✓ "All services ready"

PASO 4: Verificar
   └─ curl endpoint para verificar
   └─ Acceder a /studio/branded
   └─ Revisar que Gema cargó
```

---

## 💡 Tips

```
Si falla el deploy:
1. Revisar spelling exacto de variables
2. Verificar que API keys sean válidos
3. Ver logs en Coolify para errores específicos
4. Hacer otro Full Rebuild

Si no ves cambios:
1. Limpiar caché del navegador (Ctrl+Shift+Del)
2. Esperar 30 segundos después de deploy
3. Verificar en logs que variables se cargaron

Si Worker no procesa jobs:
1. Verificar que TODAS las variables están en worker
2. Ver logs del worker
3. Hacer rebuild específico del worker
```

---

## 📊 Ejemplo Completo

```
CASO: Configurar Branded Generation en Coolify

1. Obtener API Keys:
   - elevenlabs.io → copiar sk_abc123...
   - banana.dev → copiar xyz789...
   - fal.ai → copiar (ya tienes)

2. Entrar a Coolify:
   - Login
   - Seleccionar kapi-pulse
   - Settings → Environment Variables

3. Configurar apps/api:
   ✓ ELEVEN_LABS_API_KEY = sk_abc123...
   ✓ BANANA_API_KEY = xyz789...
   ✓ BANANA_ENDPOINT = https://api.banana.dev/start/v4/
   ✓ FAL_API_KEY = tu-key
   ✓ GEMA_VOICE_ID = hFyqYpDgcxGhrlIVAeYq
   ✓ KAPI_PRIMARY = #001F4D
   ✓ KAPI_SECONDARY = #BFCC00
   ✓ KAPI_ACCENT = #00A9B5

4. Configurar apps/worker:
   (Copiar las 8 variables de API)

5. Configurar apps/web:
   ✓ NEXT_PUBLIC_ORG_ID = tu-uuid
   ✓ NEXT_PUBLIC_API_URL = https://api.tudominio.com

6. Deploy:
   - Guardar cambios
   - Full Rebuild
   - Esperar 5-10 minutos

7. Verificar:
   - Ver logs (sin errores)
   - curl https://api.tudominio.com/health
   - Abrir https://tudominio.com/studio/branded
   - Ver Gema character y colores KAPI
```

---

## ✨ ¡Listo!

Después de completar estos pasos:

```
✅ Sistema en producción
✅ Gema con voz TTS funcional
✅ Colores KAPI inyectados
✅ Generación de imágenes/videos lista
✅ Publishing multi-plataforma activo
✅ Dashboard de analytics en vivo

🚀 ¡Puedes empezar a generar contenido!
```

---

## 📚 Referencias Rápidas

```
Documentación:
- /infra/COOLIFY_BRANDED_SETUP.md → Guía detallada
- /docs/API_SETUP_GUIDE.md → Detalles de cada API
- /docs/QUICK_START.md → Start 5 minutos

URLs de Servicios:
- Eleven Labs: https://elevenlabs.io/app/settings/api-keys
- Banana: https://app.banana.dev/account/api-keys
- FAL.ai: https://fal.ai/dashboard/credentials
- Coolify: https://tu-coolify-domain.com

Endpoints para Test:
- Health: https://api.tudominio.com/health
- Studio: https://tudominio.com/studio/branded
- Characters: https://api.tudominio.com/studio/branded/characters
```
