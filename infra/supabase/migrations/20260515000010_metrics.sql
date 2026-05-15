-- ============== Metrics & Insights (schema kapi_pulse) ==============
-- Snapshots de métricas por post y por cuenta. Las series temporales se
-- alimentan desde el worker (job metrics-sync) que llama a Graph API /
-- LinkedIn API cada 6h. period_start es el "bucket" del snapshot
-- (date_trunc) y lo decide el worker — eso permite idempotencia: dos
-- corridas en la misma hora upsertean la misma fila.

create table kapi_pulse.post_metrics (
  id uuid primary key default gen_random_uuid(),
  post_variant_id uuid not null references kapi_pulse.post_variants(id) on delete cascade,
  period_start timestamptz not null,
  collected_at timestamptz not null default now(),
  impressions int default 0,
  reach int default 0,
  likes int default 0,
  comments int default 0,
  shares int default 0,
  saves int default 0,
  clicks int default 0,
  video_views int default 0,
  engagement_rate numeric(6,4),
  raw jsonb default '{}'::jsonb,
  unique (post_variant_id, period_start)
);

create table kapi_pulse.account_metrics (
  id uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references kapi_pulse.social_accounts(id) on delete cascade,
  period_start timestamptz not null,
  collected_at timestamptz not null default now(),
  followers int default 0,
  following int default 0,
  posts_count int default 0,
  impressions int default 0,
  reach int default 0,
  profile_views int default 0,
  raw jsonb default '{}'::jsonb,
  unique (social_account_id, period_start)
);

-- Indices para queries por rango temporal
create index idx_kp_post_metrics_variant_period
  on kapi_pulse.post_metrics(post_variant_id, period_start desc);
create index idx_kp_post_metrics_period
  on kapi_pulse.post_metrics(period_start desc);
create index idx_kp_account_metrics_account_period
  on kapi_pulse.account_metrics(social_account_id, period_start desc);
create index idx_kp_account_metrics_period
  on kapi_pulse.account_metrics(period_start desc);

-- RLS: miembros pueden leer; solo service_role (worker/api) escribe
alter table kapi_pulse.post_metrics enable row level security;
alter table kapi_pulse.account_metrics enable row level security;

create policy "miembros pueden ver post_metrics"
  on kapi_pulse.post_metrics for select
  using (exists (
    select 1 from kapi_pulse.post_variants pv
    join kapi_pulse.posts p on p.id = pv.post_id
    where pv.id = post_variant_id and kapi_pulse.is_member_of(p.organization_id)
  ));

create policy "miembros pueden ver account_metrics"
  on kapi_pulse.account_metrics for select
  using (exists (
    select 1 from kapi_pulse.social_accounts sa
    where sa.id = social_account_id and kapi_pulse.is_member_of(sa.organization_id)
  ));

-- Vista materializada conveniente — último snapshot por variante (sin recalcular en cada query)
-- Nota: usamos vista común, no materialized. Si crece mucho, conviene materialized + REFRESH en el worker.
create or replace view kapi_pulse.post_metrics_latest as
select distinct on (post_variant_id)
  post_variant_id,
  period_start,
  collected_at,
  impressions,
  reach,
  likes,
  comments,
  shares,
  saves,
  clicks,
  video_views,
  engagement_rate
from kapi_pulse.post_metrics
order by post_variant_id, period_start desc;

create or replace view kapi_pulse.account_metrics_latest as
select distinct on (social_account_id)
  social_account_id,
  period_start,
  collected_at,
  followers,
  following,
  posts_count,
  impressions,
  reach,
  profile_views
from kapi_pulse.account_metrics
order by social_account_id, period_start desc;

grant select on kapi_pulse.post_metrics_latest to anon, authenticated, service_role;
grant select on kapi_pulse.account_metrics_latest to anon, authenticated, service_role;
