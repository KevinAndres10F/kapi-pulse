# Configurar Branded Generation en Coolify

Guía paso a paso para configurar todas las variables de entorno en Coolify.

---

## 🎯 Variables Necesarias

```
ELEVEN_LABS_API_KEY              (Text-to-speech)
BANANA_API_KEY                   (Image generation)
BANANA_ENDPOINT                  (Image API endpoint)
FAL_API_KEY                       (Video generation - probablemente ya existe)
GEMA_VOICE_ID                     (Eleven Labs voice ID)
KAPI_PRIMARY                      (Brand color)
KAPI_SECONDARY                    (Brand color)
KAPI_ACCENT                       (Brand color)
```

---

## 📝 Paso 1: Obtener las API Keys

### 1.1 Eleven Labs API Key
1. Ir a https://elevenlabs.io/app/settings/api-keys
2. Crear cuenta si no tienes una
3. Copiar tu API Key (empieza con `sk_`)
4. Guardar en un lugar seguro

### 1.2 Banana API Key
1. Ir a https://app.banana.dev/account/api-keys
2. Crear cuenta si no tienes una
3. Generar una nueva API Key
4. Copiar el API Key completo
5. Guardar en un lugar seguro

### 1.3 FAL API Key (Verificar)
1. Ir a https://fal.ai/dashboard/credentials
2. Copiar el API Key (probablemente ya lo tienes)
3. Si no, crear uno nuevo

---

## 🔧 Paso 2: Acceder a Coolify

### 2.1 Login en Coolify
```
1. Ir a https://tu-coolify-domain.com
2. Login con tus credenciales
3. Seleccionar tu proyecto
```

### 2.2 Ir a Configuración de Variables
```
Proyecto → Settings → Environment Variables
   O
Proyecto → Deploy → Edit Variables
```

---

## 📌 Paso 3: Agregar Variables (por aplicación)

### Para API (`apps/api`)

#### Variable 1: Eleven Labs API Key
```
Name:    ELEVEN_LABS_API_KEY
Value:   sk_xxxxxxxxxxxxxxxxxxxxxxxx
Type:    Secret (marcar "Secret" si existe la opción)
```

#### Variable 2: Banana API Key
```
Name:    BANANA_API_KEY
Value:   xxxxxxxxxxxxxxxxxxxxxxxx
Type:    Secret
```

#### Variable 3: Banana Endpoint
```
Name:    BANANA_ENDPOINT
Value:   https://api.banana.dev/start/v4/
Type:    String
```

#### Variable 4: Gema Voice ID
```
Name:    GEMA_VOICE_ID
Value:   hFyqYpDgcxGhrlIVAeYq
Type:    String
```

#### Variable 5: FAL API Key (Verificar/Agregar)
```
Name:    FAL_API_KEY
Value:   xxxxxxxxxxxxxxxxxxxxxxxx
Type:    Secret
```

#### Variables 6-8: Brand Colors
```
Name:    KAPI_PRIMARY
Value:   #001F4D
Type:    String

Name:    KAPI_SECONDARY
Value:   #BFCC00
Type:    String

Name:    KAPI_ACCENT
Value:   #00A9B5
Type:    String
```

---

### Para Worker (`apps/worker`)

Las mismas variables que para API:

```
✓ ELEVEN_LABS_API_KEY
✓ BANANA_API_KEY
✓ BANANA_ENDPOINT
✓ FAL_API_KEY
✓ GEMA_VOICE_ID
✓ KAPI_PRIMARY
✓ KAPI_SECONDARY
✓ KAPI_ACCENT
```

⚠️ **Importante**: El worker necesita las mismas variables para procesar los jobs.

---

### Para Web (`apps/web`)

Solo variables públicas:

```
Name:    NEXT_PUBLIC_ORG_ID
Value:   your-organization-uuid
Type:    String

Name:    NEXT_PUBLIC_API_URL
Value:   https://api.tudominio.com
Type:    String
```

---

## ✅ Paso 4: Verificar Configuración en Coolify

### 4.1 Revisar Variables Agregadas
```
1. Ir a Project → Settings → Environment Variables
2. Verificar que todas aparezcan:
   ✓ ELEVEN_LABS_API_KEY (oculto)
   ✓ BANANA_API_KEY (oculto)
   ✓ BANANA_ENDPOINT (visible)
   ✓ FAL_API_KEY (oculto)
   ✓ GEMA_VOICE_ID (visible)
   ✓ KAPI_* (visible)
```

### 4.2 Guardar Cambios
```
1. Click "Save" o "Apply"
2. Esperar confirmación
3. Coolify debería mostrar: "Variables saved successfully"
```

---

## 🚀 Paso 5: Deploy con Nuevas Variables

### 5.1 Triggerar Nuevo Build
```
Proyecto → Actions → Redeploy
   O
Proyecto → Deploy → Rebuild
```

### 5.2 Opciones de Deploy
```
- Full Rebuild (recomendado después de cambiar variables)
- Docker Rebuild
- Production Deploy
```

### 5.3 Monitorear Deploy
```
1. Ir a Deployments
2. Ver logs en tiempo real
3. Esperar a que todas las apps inicien:
   ✓ API (puerto 3001)
   ✓ Worker (background job processor)
   ✓ Web (puerto 3000)
```

---

## 🔍 Paso 6: Verificar que Funciona

### 6.1 Verificar API
```bash
curl https://tu-api-domain.com/health
```

Debería retornar `200 OK`

### 6.2 Verificar Variables en Logs
```
Proyecto → Logs → Apps
```

Buscar líneas como:
```
✓ ELEVEN_LABS_API_KEY configured
✓ BANANA_API_KEY configured
✓ FAL_API_KEY configured
```

### 6.3 Test Endpoint de Branded
```bash
curl https://tu-api-domain.com/studio/branded/characters \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Debería retornar lista de personajes (Gema).

### 6.4 Ver UI en Producción
```
https://tu-web-domain.com/studio/branded
```

Debería cargar sin errores y mostrar:
- ✓ Gema character seleccionable
- ✓ Brand guidelines (colores KAPI)
- ✓ Formulario de generación

---

## 📋 Checklist de Configuración

```
Setup en Coolify:
□ Login en Coolify
□ Seleccionar proyecto kapi-pulse
□ Ir a Environment Variables

API (apps/api):
□ ELEVEN_LABS_API_KEY (Secret)
□ BANANA_API_KEY (Secret)
□ BANANA_ENDPOINT (String)
□ FAL_API_KEY (Secret)
□ GEMA_VOICE_ID (String)
□ KAPI_PRIMARY (String)
□ KAPI_SECONDARY (String)
□ KAPI_ACCENT (String)

Worker (apps/worker):
□ ELEVEN_LABS_API_KEY (Secret)
□ BANANA_API_KEY (Secret)
□ BANANA_ENDPOINT (String)
□ FAL_API_KEY (Secret)
□ GEMA_VOICE_ID (String)
□ KAPI_PRIMARY (String)
□ KAPI_SECONDARY (String)
□ KAPI_ACCENT (String)

Web (apps/web):
□ NEXT_PUBLIC_ORG_ID (String)
□ NEXT_PUBLIC_API_URL (String)

Verificación:
□ Guardar cambios
□ Full rebuild
□ Revisar logs
□ Test endpoint /studio/branded
□ Acceder a /studio/branded en web
□ Verificar Gema character cargado
```

---

## 🎯 ¡Listo!

Una vez configuradas todas las variables en Coolify:

✅ Sistema de branded content generation activado  
✅ Gema con voz TTS lista  
✅ Colores KAPI inyectados automáticamente  
✅ Generación de imágenes/videos funcional  
✅ Publishing a múltiples plataformas disponible  
✅ Dashboard de analytics en vivo  

**¡Tu sistema está en producción!** 🚀
