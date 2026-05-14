# Despliegue de apps/api + apps/worker en Hetzner + Coolify

Esta guía cubre el setup completo desde cero. Tiempo estimado: 1-2 horas la
primera vez, después cada deploy es `git push`.

## Arquitectura objetivo

```
Internet
   │
   ├─ Netlify ──────────────────► apps/web (Next.js) — www.kapisg.com
   │
   └─ api.kapisg.com ───────────► Hetzner VPS
                                    │
                                    ├─ Coolify (panel)
                                    ├─ apps/api    (puerto 3001, público)
                                    ├─ apps/ai     (puerto 3002, SIN domain público)
                                    │                └── apps/api lo proxea por red interna
                                    ├─ apps/worker (sin puerto, sin domain)
                                    └─ Redis       (Upstash o local)
```

## 1. Crear el VPS en Hetzner Cloud

1. Crear cuenta en https://console.hetzner.cloud
2. **New Project** → "KAPI Pulse"
3. **Add Server**:
   - Location: **Ashburn (us-east)** o **Falkenstein (eu-central)** — el más cercano a tus usuarios
   - Image: **Ubuntu 24.04**
   - Type: **CX22** (€4.59/mes — 2 vCPU, 4GB RAM, 40GB SSD) — suficiente para API + worker + Coolify + Redis
   - SSH Key: agrega tu clave pública (`cat ~/.ssh/id_ed25519.pub`)
   - Firewall: crea uno permitiendo TCP 22, 80, 443, 8000 (Coolify panel)
   - Name: `kapi-prod-1`
4. **Create & Buy now** → anota la IP pública (ej. `91.107.x.x`)

## 2. Comprar un dominio y apuntar DNS

Cualquier registrador funciona — Namecheap, Porkbun, Cloudflare Registrar (el
más barato), Hostinger. Sugiero `kapi-pulse.com` o el que prefieras.

En el panel DNS del registrador, crea estos registros:

| Tipo | Nombre | Valor | TTL |
|------|--------|-------|-----|
| A | `api` | IP del VPS | 300 |
| A | `coolify` | IP del VPS | 300 |
| CNAME | `www` | Dominio de Netlify de la web | 300 |

Espera ~5 min a que propague. Verifica con `dig +short api.kapisg.com`.

## 3. Instalar Coolify en el VPS

SSH al servidor y corre el instalador oficial:

```bash
ssh root@IP_DEL_VPS

curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

Tarda 5-10 min. Al final imprime las credenciales temporales del panel.

Accede a `http://IP_DEL_VPS:8000` (o `https://coolify.kapisg.com` si ya
apuntaste DNS) y crea tu cuenta de admin.

En **Settings → Instance**, configura:
- Public URL: `https://coolify.kapisg.com`
- Habilita **Auto-update** (parches automáticos)

Coolify pedirá apuntar el dominio `coolify.*` con TLS automático — déjalo
hacer lo suyo, usa Let's Encrypt.

## 4. Instalar Redis (managed o local)

**Opción A — Upstash (recomendado, gratis hasta 10k cmds/día):**
1. Crear cuenta en https://upstash.com
2. Create Database → Region más cercana al VPS
3. Copiar la `REDIS_URL` con TLS (formato `rediss://default:xxx@xxx.upstash.io:6379`)

**Opción B — Redis local en Coolify:**
1. Panel Coolify → New Resource → Database → Redis
2. Coolify levanta un container Redis con persistencia
3. La URL será `redis://kapi-redis:6379` (red interna de Docker)

Para empezar prefiere Upstash — menos cosas que se pueden romper en el VPS.

## 5. Conectar GitHub a Coolify

1. Panel Coolify → **Sources** → **+ Add** → GitHub App
2. Coolify te lleva a GitHub para instalar la app de Coolify en tu repo
3. Autoriza acceso a `KevinAndres10F/kapi-pulse`

## 6. Crear las apps en Coolify

### App 1: `kapi-api`

1. Coolify → **+ New Resource** → **Public Repository** → `https://github.com/KevinAndres10F/kapi-pulse` → Branch: `main`
2. Build Pack: **Dockerfile**
3. Configuración:
   - **Dockerfile Location**: `apps/api/Dockerfile`
   - **Build Context**: `.` (raíz)
   - **Port**: `3001`
   - **Domain**: `https://api.kapisg.com`
4. **Environment Variables** (pega todas estas, valores reales):
   ```
   NODE_ENV=production
   APP_URL=https://www.kapisg.com
   API_URL=https://api.kapisg.com
   PORT=3001
   SUPABASE_URL=https://zouznrwrirsisdqipcfb.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<copiar de Supabase Dashboard>
   REDIS_URL=<de Upstash o redis://kapi-redis:6379>
   TOKEN_ENCRYPTION_KEY=<openssl rand -hex 32 — guárdala segura>
   META_APP_ID=
   META_APP_SECRET=
   META_REDIRECT_URI=https://api.kapisg.com/api/callback/meta
   META_GRAPH_VERSION=v25.0
   LINKEDIN_CLIENT_ID=
   LINKEDIN_CLIENT_SECRET=
   LINKEDIN_REDIRECT_URI=https://api.kapisg.com/api/callback/linkedin
   ```
5. **Deploy** → Coolify hace el build (5-10 min la primera vez) y arranca
6. Verifica: `curl https://api.kapisg.com/health` → `{"status":"healthy"}`

### App 2: `kapi-ai` (servicio Python con Claude)

> Importante: este servicio **NO debe tener domain público** — apps/api lo
> proxea por la red interna de Docker. Eso evita que se gasten créditos de
> Claude por requests externos sin auth.

1. Coolify → **+ New Resource** → mismo repo → mismo branch
2. Build Pack: **Dockerfile**
3. Configuración:
   - **Dockerfile Location**: `apps/ai/Dockerfile`
   - **Base Directory**: `/`
   - **Port**: `3002`
   - **Domain**: dejar **vacío** (no exponer públicamente)
   - **Resource name**: `kapi-ai` ← exacto, así apps/api lo encuentra como `http://kapi-ai:3002`
4. **Environment Variables**:
   ```env
   ANTHROPIC_API_KEY=sk-ant-... (de console.anthropic.com)
   CLAUDE_MODEL=claude-opus-4-7
   APP_URL=https://kapi-pulse.netlify.app
   API_URL=https://api.kapisg.com
   ```
5. **Save** → **Deploy** (3-5 min)
6. Verifica en logs: el container arranca con `Uvicorn running on http://0.0.0.0:3002`

7. Una vez deployado, actualiza la app `kapi-api`:
   - **Environment Variables** → agregar `AI_URL=http://kapi-ai:3002`
   - **Redeploy**

8. Smoke test (desde tu local):
   ```bash
   curl https://api.kapisg.com/api/ai/health
   # Esperado: {"status":"healthy","claude_configured":true,"model":"claude-opus-4-7"}
   ```

### App 3: `kapi-worker`

1. Coolify → **+ New Resource** → mismo repo → mismo branch
2. Build Pack: **Dockerfile**
3. Configuración:
   - **Dockerfile Location**: `apps/worker/Dockerfile`
   - **Build Context**: `.`
   - **Port**: (vacío — el worker no expone HTTP)
4. **Environment Variables**:
   ```
   NODE_ENV=production
   SUPABASE_URL=https://zouznrwrirsisdqipcfb.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<idem>
   REDIS_URL=<idem>
   TOKEN_ENCRYPTION_KEY=<la MISMA que en la API>
   META_APP_ID=
   META_APP_SECRET=
   META_GRAPH_VERSION=v25.0
   LINKEDIN_CLIENT_ID=
   LINKEDIN_CLIENT_SECRET=
   ```
5. **Deploy**
6. Verifica en los logs: `Worker de publicación iniciado (conectado a Redis)`

## 7. Configurar Netlify (apps/web) con la API real

En Netlify → Site settings → Environment variables, agrega/actualiza:

```
NEXT_PUBLIC_SUPABASE_URL=https://zouznrwrirsisdqipcfb.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
NEXT_PUBLIC_API_URL=https://api.kapisg.com
```

Trigger un nuevo deploy. Listo.

## 8. Auto-deploy con git push

En cada app de Coolify → **Configuration → Source → Auto Deploy: ON**.

Desde ahora cada `git push origin main` redeploya automáticamente. El branch
`claude/review-project-status-00ZYO` no autodeploya — mergea a `main` o
configura webhook para esa rama.

## Checklist de validación post-despliegue

- [ ] `curl https://api.kapisg.com/health` → 200 OK
- [ ] Logs de `kapi-worker` muestran "conectado a Redis"
- [ ] Signup en la web crea fila en `kapi_pulse.profiles` (verificar en Supabase SQL editor)
- [ ] Conectar LinkedIn redirige correctamente y guarda la cuenta
- [ ] Crear un post programado encola job en BullMQ (ver logs del worker)

## Troubleshooting

**Build falla con "pnpm: not found"**: el Dockerfile usa `corepack enable`,
asegúrate de estar usando Node 22+ (alpine ya viene con corepack).

**API arranca pero crashea con SUPABASE_URL undefined**: las env vars deben
estar marcadas como **Build-time + Runtime** en Coolify, no solo runtime.

**OAuth callback falla**: la `*_REDIRECT_URI` en env vars debe matchear EXACTAMENTE
la registrada en Meta/LinkedIn Developer Portal, incluyendo `https://` y trailing
slash.

**Worker no procesa jobs**: revisa que `REDIS_URL` sea idéntico en API y worker,
y que la URL incluya el password (formato `rediss://default:PASSWORD@host:6379`).
