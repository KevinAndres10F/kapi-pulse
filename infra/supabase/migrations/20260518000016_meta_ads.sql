-- ============== Meta Ads (Agency model) — schema kapi_pulse ==============
-- Modelo "agencia central": un solo Meta Business Portfolio operado por la
-- agencia (KAPI). N ad accounts dentro de ese Business, una por cliente
-- (organization). El System User token vive en server env (META_SYSTEM_USER_TOKEN)
-- y nunca toca esta tabla — solo persistimos el mapeo org_id ↔ meta_ad_account_id.
--
-- Flujo de aprobación (status):
--   draft               cliente está armando la campaña, no se ha enviado
--   pending_approval    cliente envió, espera al admin (equipo KAPI)
--   approved            admin aprobó; campaña creada en Meta con status PAUSED
--   active              admin la lanzó; campaña en Meta con status ACTIVE
--   paused              admin la pausó manualmente
--   rejected            admin rechazó (con rejection_reason)
--   archived            archivada (no se muestra en listings por default)
--
-- IMPORTANTE: la integración orgánica de Meta (Facebook Login + IG + Threads)
-- vive en social_accounts y no se toca. Este módulo es ortogonal.

create type kapi_pulse.ad_campaign_status as enum (
  'draft',
  'pending_approval',
  'approved',
  'active',
  'paused',
  'rejected',
  'archived'
);

create type kapi_pulse.ad_objective as enum (
  'OUTCOME_TRAFFIC',
  'OUTCOME_AWARENESS',
  'OUTCOME_ENGAGEMENT',
  'OUTCOME_LEADS',
  'OUTCOME_SALES',
  'OUTCOME_APP_PROMOTION'
);

-- ============== ad_accounts ==============
-- Mapea cada org de kapi_pulse a su Ad Account en Meta. Una org puede tener
-- varias (e.g. una para Ecuador, otra para Colombia) — por eso no es UNIQUE
-- en organization_id.
create table kapi_pulse.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references kapi_pulse.organizations(id) on delete cascade,
  meta_ad_account_id text not null, -- formato "act_1234567890"
  name text,
  currency text not null default 'USD',
  timezone_name text,
  status text not null default 'active', -- 'active' | 'disabled'
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (meta_ad_account_id)
);

create index idx_kp_ad_accounts_org on kapi_pulse.ad_accounts(organization_id) where status = 'active';

-- ============== ad_campaigns ==============
create table kapi_pulse.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references kapi_pulse.organizations(id) on delete cascade,
  ad_account_id uuid not null references kapi_pulse.ad_accounts(id) on delete cascade,
  meta_campaign_id text, -- null hasta que se aprueba y se crea en Meta
  name text not null,
  objective kapi_pulse.ad_objective not null,
  status kapi_pulse.ad_campaign_status not null default 'draft',
  daily_budget_cents int, -- presupuesto diario en centavos de la moneda de la cuenta
  lifetime_budget_cents int, -- alternativa a daily; uno de los dos
  start_time timestamptz,
  end_time timestamptz,
  special_ad_categories text[] default '{}', -- e.g. ['HOUSING'], ['EMPLOYMENT'], etc
  proposed_by uuid references kapi_pulse.profiles(id) on delete set null,
  approved_by uuid references kapi_pulse.profiles(id) on delete set null,
  approved_at timestamptz,
  rejection_reason text,
  launched_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (daily_budget_cents is not null or lifetime_budget_cents is not null)
);

create index idx_kp_ad_campaigns_org_status on kapi_pulse.ad_campaigns(organization_id, status);
create index idx_kp_ad_campaigns_account on kapi_pulse.ad_campaigns(ad_account_id);
create index idx_kp_ad_campaigns_pending on kapi_pulse.ad_campaigns(status, created_at) where status = 'pending_approval';
create index idx_kp_ad_campaigns_meta on kapi_pulse.ad_campaigns(meta_campaign_id) where meta_campaign_id is not null;

-- ============== ad_sets ==============
create table kapi_pulse.ad_sets (
  id uuid primary key default gen_random_uuid(),
  ad_campaign_id uuid not null references kapi_pulse.ad_campaigns(id) on delete cascade,
  meta_adset_id text,
  name text not null,
  daily_budget_cents int,
  lifetime_budget_cents int,
  billing_event text default 'IMPRESSIONS',
  optimization_goal text default 'LINK_CLICKS',
  targeting jsonb not null default '{}'::jsonb,
  start_time timestamptz,
  end_time timestamptz,
  status text not null default 'PAUSED', -- ACTIVE | PAUSED | DELETED
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_kp_ad_sets_campaign on kapi_pulse.ad_sets(ad_campaign_id);

-- ============== ad_creatives ==============
-- Vincula a assets generados en studio (generated_assets) si aplica.
create table kapi_pulse.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  ad_campaign_id uuid not null references kapi_pulse.ad_campaigns(id) on delete cascade,
  meta_creative_id text,
  name text not null,
  body text, -- copy del anuncio
  title text, -- headline
  link_url text,
  call_to_action_type text, -- LEARN_MORE | SHOP_NOW | SIGN_UP | etc
  media_asset_id uuid references kapi_pulse.generated_assets(id) on delete set null,
  media_url text, -- fallback si no es asset de studio (URL externa)
  page_id text, -- Facebook Page que publica el anuncio
  instagram_actor_id text, -- IG account vinculada
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index idx_kp_ad_creatives_campaign on kapi_pulse.ad_creatives(ad_campaign_id);

-- ============== ads ==============
create table kapi_pulse.ads (
  id uuid primary key default gen_random_uuid(),
  ad_set_id uuid not null references kapi_pulse.ad_sets(id) on delete cascade,
  ad_creative_id uuid not null references kapi_pulse.ad_creatives(id) on delete cascade,
  meta_ad_id text,
  name text not null,
  status text not null default 'PAUSED',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_kp_ads_set on kapi_pulse.ads(ad_set_id);

-- ============== ad_insights ==============
-- Snapshots diarios (period_start = date_trunc('day', ...)). Idempotente por
-- (scope_type, scope_id, period_start). El worker corre cada 6h y upsertea
-- la fila del día — si re-corres no se duplica.
create table kapi_pulse.ad_insights (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references kapi_pulse.organizations(id) on delete cascade,
  scope_type text not null check (scope_type in ('campaign', 'adset', 'ad', 'account')),
  scope_id uuid not null, -- FK lógica: depende de scope_type
  meta_object_id text not null, -- el ID en Meta correspondiente
  period_start timestamptz not null,
  collected_at timestamptz not null default now(),
  spend_cents int default 0,
  impressions int default 0,
  reach int default 0,
  clicks int default 0,
  ctr numeric(6,4), -- click-through rate
  cpc_cents int, -- cost per click
  cpm_cents int, -- cost per mille (1000 impressions)
  frequency numeric(6,2),
  actions jsonb default '[]'::jsonb, -- conversions por tipo
  purchase_value_cents int, -- valor de compra (si tracking activo)
  roas numeric(8,2), -- return on ad spend
  raw jsonb default '{}'::jsonb,
  unique (scope_type, scope_id, period_start)
);

create index idx_kp_ad_insights_org_period on kapi_pulse.ad_insights(organization_id, period_start desc);
create index idx_kp_ad_insights_scope on kapi_pulse.ad_insights(scope_type, scope_id, period_start desc);

-- ============== updated_at triggers ==============
create or replace function kapi_pulse.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tg_ad_accounts_updated_at
  before update on kapi_pulse.ad_accounts
  for each row execute function kapi_pulse.tg_set_updated_at();

create trigger tg_ad_campaigns_updated_at
  before update on kapi_pulse.ad_campaigns
  for each row execute function kapi_pulse.tg_set_updated_at();

create trigger tg_ad_sets_updated_at
  before update on kapi_pulse.ad_sets
  for each row execute function kapi_pulse.tg_set_updated_at();

create trigger tg_ads_updated_at
  before update on kapi_pulse.ads
  for each row execute function kapi_pulse.tg_set_updated_at();

-- ============== RLS ==============
alter table kapi_pulse.ad_accounts enable row level security;
alter table kapi_pulse.ad_campaigns enable row level security;
alter table kapi_pulse.ad_sets enable row level security;
alter table kapi_pulse.ad_creatives enable row level security;
alter table kapi_pulse.ads enable row level security;
alter table kapi_pulse.ad_insights enable row level security;

-- Read: miembros de la org ven lo de su org.
-- Write: solo service_role (la API valida roles antes de escribir).
create policy "miembros ven ad_accounts" on kapi_pulse.ad_accounts
  for select using (kapi_pulse.is_member_of(organization_id));

create policy "miembros ven ad_campaigns" on kapi_pulse.ad_campaigns
  for select using (kapi_pulse.is_member_of(organization_id));

create policy "miembros ven ad_sets" on kapi_pulse.ad_sets
  for select using (exists (
    select 1 from kapi_pulse.ad_campaigns c
    where c.id = ad_campaign_id and kapi_pulse.is_member_of(c.organization_id)
  ));

create policy "miembros ven ad_creatives" on kapi_pulse.ad_creatives
  for select using (exists (
    select 1 from kapi_pulse.ad_campaigns c
    where c.id = ad_campaign_id and kapi_pulse.is_member_of(c.organization_id)
  ));

create policy "miembros ven ads" on kapi_pulse.ads
  for select using (exists (
    select 1 from kapi_pulse.ad_sets s
    join kapi_pulse.ad_campaigns c on c.id = s.ad_campaign_id
    where s.id = ad_set_id and kapi_pulse.is_member_of(c.organization_id)
  ));

create policy "miembros ven ad_insights" on kapi_pulse.ad_insights
  for select using (kapi_pulse.is_member_of(organization_id));

-- ============== Vistas convenientes ==============

-- Último snapshot por campaña (para dashboards sin recalcular).
create or replace view kapi_pulse.ad_campaign_insights_latest as
select distinct on (scope_id)
  scope_id as ad_campaign_id,
  organization_id,
  period_start,
  collected_at,
  spend_cents,
  impressions,
  reach,
  clicks,
  ctr,
  cpc_cents,
  cpm_cents,
  roas
from kapi_pulse.ad_insights
where scope_type = 'campaign'
order by scope_id, period_start desc;

alter view kapi_pulse.ad_campaign_insights_latest set (security_invoker = true);
grant select on kapi_pulse.ad_campaign_insights_latest to anon, authenticated, service_role;

-- Cola de aprobaciones (admin dashboard). El check de admin va en la app —
-- la vista solo filtra por status.
create or replace view kapi_pulse.ad_campaigns_pending as
select
  c.id,
  c.organization_id,
  c.name,
  c.objective,
  c.daily_budget_cents,
  c.lifetime_budget_cents,
  c.start_time,
  c.end_time,
  c.proposed_by,
  c.created_at,
  a.meta_ad_account_id,
  a.currency
from kapi_pulse.ad_campaigns c
join kapi_pulse.ad_accounts a on a.id = c.ad_account_id
where c.status = 'pending_approval'
order by c.created_at asc;

alter view kapi_pulse.ad_campaigns_pending set (security_invoker = true);
grant select on kapi_pulse.ad_campaigns_pending to authenticated, service_role;

-- ============== Grants ==============
grant usage on schema kapi_pulse to anon, authenticated, service_role;
grant select on kapi_pulse.ad_accounts to anon, authenticated, service_role;
grant select on kapi_pulse.ad_campaigns to anon, authenticated, service_role;
grant select on kapi_pulse.ad_sets to anon, authenticated, service_role;
grant select on kapi_pulse.ad_creatives to anon, authenticated, service_role;
grant select on kapi_pulse.ads to anon, authenticated, service_role;
grant select on kapi_pulse.ad_insights to anon, authenticated, service_role;
grant insert, update, delete on kapi_pulse.ad_accounts to service_role;
grant insert, update, delete on kapi_pulse.ad_campaigns to service_role;
grant insert, update, delete on kapi_pulse.ad_sets to service_role;
grant insert, update, delete on kapi_pulse.ad_creatives to service_role;
grant insert, update, delete on kapi_pulse.ads to service_role;
grant insert, update, delete on kapi_pulse.ad_insights to service_role;
