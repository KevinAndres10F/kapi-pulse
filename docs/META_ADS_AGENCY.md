# Meta Ads — modelo agencia central

Guía técnica para configurar la integración de Meta Ads en KAPI Pulse bajo el
modelo "agencia central" (un solo Business Portfolio operado por KAPI, N
ad accounts de clientes asignadas adentro).

## Por qué este modelo

- **Sin App Review.** El System User es admin de tu Business Portfolio; Meta
  no exige review para que el admin actúe sobre sus propias cuentas.
- **Un solo token server-side.** Sin OAuth dance por cliente, sin refresh,
  sin gestión de tokens por usuario.
- **Multi-cliente.** Cada cliente queda mapeado en `kapi_pulse.ad_accounts`
  a su `meta_ad_account_id`. Las llamadas a Marketing API se hacen pasando
  ese ID por path.

Si más adelante necesitas que cada cliente conecte SU propia cuenta sin
asignarla a tu Business, hay que cambiar a OAuth user-scoped + scope
`ads_management` + App Review. Ese camino no está implementado.

## Setup en Meta (una sola vez)

1. **Business Portfolio.** Si no tienes, créalo en
   <https://business.facebook.com/>. El que ya uses para administrar Pages
   sirve.

2. **Asignar Ad Accounts.** En *Business Settings → Accounts → Ad Accounts*:
   - **Opción A (recomendada):** "Request Access" a la Ad Account del
     cliente. El cliente acepta desde su Business Manager.
   - **Opción B:** "Add → Create New Ad Account". La cuenta queda dentro
     del tuyo (tú asumes la facturación si no asignas el método de pago
     del cliente).

3. **System User.**
   - *Business Settings → Users → System Users → Add*.
   - Rol: **Admin**.
   - Nombre sugerido: `kapi-pulse-ads`.

4. **Asignar Ad Accounts al System User.**
   - Click en el System User → *Add Assets → Ad Accounts*.
   - Selecciona todas las que vayas a operar.
   - Permiso: **Manage ad account** (full control).

5. **Asignar Pages.**
   - Mismo flow, *Add Assets → Pages*.
   - Permiso: **Create ads + Manage Page**.
   - Sin esto, las llamadas a `createAdCreative` fallan con error de page.

6. **Generar token.**
   - System User → *Generate New Token*.
   - App: tu Meta App (la que ya tienes en `META_APP_ID`).
   - Scopes:
     - `ads_management`
     - `ads_read`
     - `business_management`
     - `pages_read_engagement` (para validar Page)
     - `pages_manage_ads` (publicar ads desde Page)
   - Token expiration: **Never**.
   - Copia el token a `META_SYSTEM_USER_TOKEN`.

7. **Business ID.**
   - *Business Settings → Business Info → Business Manager ID*.
   - Copia a `META_BUSINESS_ID`.

## Setup en kapi-pulse

1. **Env vars** en `.env`:
   ```bash
   META_SYSTEM_USER_TOKEN=EAA...   # el token del paso 6
   META_BUSINESS_ID=1234567890     # el ID del paso 7
   ADMIN_ORG_ID=<uuid>             # tu org en kapi_pulse.organizations
   ```

2. **Migraciones**:
   ```bash
   pnpm db:migrate
   ```
   Aplica `20260518000016_meta_ads.sql` que crea las tablas.

3. **Validar acceso del token**:
   Levanta el API y llama (con un X-User-Id que sea owner/admin de
   `ADMIN_ORG_ID`):
   ```bash
   curl http://localhost:3001/api/ads/accounts/business \
     -H "X-User-Id: <tu-uuid>"
   ```
   Debes ver la lista de Ad Accounts de tu Business. Si devuelve 502,
   el token no tiene los scopes o el Business ID está mal.

4. **Registrar una Ad Account a una org cliente**:
   ```bash
   curl -X POST http://localhost:3001/api/ads/accounts \
     -H "X-User-Id: <tu-uuid>" \
     -H "Content-Type: application/json" \
     -d '{
       "organizationId": "<uuid-org-cliente>",
       "metaAdAccountId": "act_1234567890"
     }'
   ```
   La API valida que el System User tenga acceso antes de persistir.

## Flujo end-to-end (HTTP)

### Cliente arma campaña

`POST /api/ads/campaigns/draft`

```json
{
  "organizationId": "<uuid-cliente>",
  "adAccountId": "<uuid-ad-account-kapi>",
  "createdBy": "<uuid-user>",
  "name": "Promo Lanzamiento Marzo",
  "objective": "OUTCOME_TRAFFIC",
  "dailyBudgetCents": 5000,
  "adSet": {
    "name": "AdSet 1",
    "optimizationGoal": "LINK_CLICKS",
    "billingEvent": "IMPRESSIONS",
    "targeting": {
      "geo_locations": { "countries": ["EC"] },
      "age_min": 18,
      "age_max": 45,
      "publisher_platforms": ["facebook", "instagram"]
    }
  },
  "creative": {
    "name": "Creative 1",
    "pageId": "1234567890",
    "instagramActorId": "17841...",
    "message": "Aprovecha el descuento de marzo",
    "headline": "¡Hasta 50% OFF!",
    "linkUrl": "https://kapi.ec/promo",
    "callToActionType": "SHOP_NOW",
    "mediaAssetId": "<uuid-asset-studio-opcional>"
  }
}
```

Si pasas `mediaAssetId` (un asset generado en Studio), la API genera una
signed URL de 7 días y se la pasa a Meta como `picture`. Si pasas `mediaUrl`
externo, se usa ese.

### Cliente envía a aprobación

`POST /api/ads/campaigns/:id/submit` — pasa de `draft` a `pending_approval`.
No toca Meta todavía.

### Admin aprueba (crea en Meta como PAUSED)

`POST /api/admin/ads/campaigns/:id/approve` (X-User-Id de un admin de
`ADMIN_ORG_ID`). Crea Campaign → AdSet → Creative → Ad en Meta, todo en
`PAUSED`. Persiste los IDs en local.

Si Meta rechaza por políticas, la campaña pasa a `rejected` con
`rejection_reason`.

### Admin lanza

`POST /api/admin/ads/campaigns/:id/launch` — pone Campaign + AdSets en
`ACTIVE` en Meta. Estado local pasa a `active`.

### Admin pausa o rechaza

- `POST /api/admin/ads/campaigns/:id/pause`
- `POST /api/admin/ads/campaigns/:id/reject` con body `{ "reason": "..." }`

### Insights

- **Cached (rápido)**: `GET /api/ads/insights?org_id=xxx&scope=campaign`
  Lee de `kapi_pulse.ad_insights`, poblada por el worker cada 6h.
- **Live (lento, llama a Meta)**: `?live=1&scope_id=<meta_campaign_id>`

## Worker

El job `ads-insights-sync` corre cada 6h. Para todas las campañas con
`meta_campaign_id` y status en (`active`, `paused`, `approved`):

1. Pide insights diarios de últimos 7 días.
2. Upsertea en `ad_insights` por (scope_type, scope_id, period_start).
3. Calcula `spend_cents`, `cpc_cents`, `cpm_cents`, `purchase_value_cents`,
   `roas`, `actions[]`, etc.

Idempotente. Re-correrlo en el mismo día reescribe la fila del día actual
sin duplicar.

## Coexistencia con la integración orgánica

- `apps/api/src/providers/meta.ts` — OAuth de **Facebook Login** + posts
  orgánicos en Pages e IG. Sin cambios. Tokens viven en `social_accounts`
  cifrados.
- `apps/api/src/providers/meta-ads.ts` — Marketing API con System User.
  Token en server env. Sin tabla de tokens.

Ambos coexisten. El cliente puede tener una `social_account` de Instagram
(para posts orgánicos) y simultáneamente que su `ad_account` esté asignada
a tu Business para correr Ads. El `instagram_actor_id` del creative debe
coincidir con el IG account vinculado a la Page configurada.

## Errores comunes

| Síntoma | Causa | Fix |
|---|---|---|
| `403 - Solo admin operador` | El X-User-Id no es owner/admin de `ADMIN_ORG_ID` | Verificar membership en `organization_members` |
| `502 ... Permission` | System User no tiene la Ad Account asignada | Re-asignar en Business Settings |
| `400 ... funding` | Ad Account sin método de pago activo | Configurar tarjeta en la Ad Account |
| Policy rejection code 1815108 | Copy/creative viola políticas de Meta | Ajustar copy y volver a `approve` |
| Insights vacíos | Campaña sin gasto en últimos 7d | Esperar a tener spend |

## Skill local de Santiago (opcional, para operador)

El skill `https://github.com/santmun/meta-ads-skills` se instala en tu
máquina (`~/.claude/skills/`) y te permite, desde Claude Code, ejecutar
el CLI oficial `meta` directamente. Útil para:

- Debug ad-hoc de creatividades antes de meterlas al draft.
- Validar segmentaciones experimentales.
- Pruebas en una Ad Account de sandbox.

No se integra al backend de kapi-pulse — corre solo en tu workstation con
las creds en `~/.env-meta-ads`. El backend usa Marketing API REST directa
para no depender de spawn de procesos Python en producción.
