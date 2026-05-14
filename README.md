# KAPI Pulse

Plataforma SaaS de gestion integral de redes sociales por KAPI Service Group (Ecuador).

## Requisitos

- Node.js >= 20
- pnpm >= 9
- Python >= 3.11
- Redis (local o Upstash)
- Supabase (local o cloud)

## Setup local

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env
# Llenar las variables necesarias en .env

# 3. (Opcional) Instalar dependencias Python para el servicio AI
cd apps/ai && pip install -r requirements.txt && cd ../..

# 4. Ejecutar migraciones de base de datos
pnpm db:migrate

# 5. Cargar datos iniciales
pnpm db:seed

# 6. Levantar todos los servicios en desarrollo
pnpm dev
```

## Servicios

| Servicio | Puerto | Descripcion |
|----------|--------|-------------|
| `apps/web` | 3000 | Dashboard Next.js (frontend) |
| `apps/api` | 3001 | API gateway Hono (OAuth, webhooks) |
| `apps/ai` | 3002 | Servicio IA FastAPI (Claude, NLP) |
| `apps/bot` | 3003 | Bot Telegram grammY |
| `apps/worker` | — | Workers BullMQ (scheduler, publishing) |

## Estructura

```
kapi-pulse/
├── apps/          # Servicios desplegables
├── packages/      # Librerias compartidas
├── infra/         # Docker, Supabase, scripts
└── docs/          # Documentacion tecnica
```

## Scripts principales

- `pnpm dev` — Levanta todos los servicios
- `pnpm build` — Build de produccion
- `pnpm lint` — Ejecuta linters
- `pnpm format` — Formatea codigo con Prettier

## Stack

- **Frontend:** Next.js 14+ / React / TypeScript / Tailwind / shadcn/ui
- **API:** Hono / Node.js / TypeScript
- **IA:** FastAPI / Python / Claude API
- **DB:** Supabase (Postgres + Auth + Storage + Realtime)
- **Colas:** BullMQ + Redis
- **Bot:** grammY (Telegram)
- **Pagos:** MercadoPago + Stripe
