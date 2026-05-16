-- ============== Studio: Assets, Jobs & Campaigns (schema kapi_pulse) ==============

create type kapi_pulse.asset_kind as enum (
  'image', 'video', 'avatar_video', 'audio', 'copy_bundle'
);

create type kapi_pulse.asset_source as enum (
  'fal', 'replicate', 'heygen', 'hedra', 'claude', 'upload'
);

create type kapi_pulse.job_status as enum (
  'pending', 'reserved', 'running', 'succeeded', 'failed', 'cancelled', 'refunded'
);

create type kapi_pulse.campaign_status as enum (
  'draft', 'generating', 'review', 'approved', 'published', 'archived', 'failed'
);

-- ============== Campaigns ==============
create table kapi_pulse.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references kapi_pulse.organizations(id) on delete cascade,
  created_by uuid references kapi_pulse.profiles(id) on delete set null,
  name text not null,
  brief jsonb not null default '{}'::jsonb,
  status kapi_pulse.campaign_status not null default 'draft',
  total_credits_spent int default 0,
  cover_asset_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_kp_campaigns_org_status on kapi_pulse.campaigns(organization_id, status);
create index idx_kp_campaigns_org_created on kapi_pulse.campaigns(organization_id, created_at desc);

-- ============== Generation Jobs ==============
create table kapi_pulse.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references kapi_pulse.organizations(id) on delete cascade,
  created_by uuid references kapi_pulse.profiles(id) on delete set null,
  campaign_id uuid references kapi_pulse.campaigns(id) on delete cascade,
  step_id uuid,
  kind kapi_pulse.asset_kind not null,
  provider kapi_pulse.asset_source not null,
  model text not null,
  operation text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb default '{}'::jsonb,
  external_id text,
  credits_cost int not null default 0,
  credit_tx_id uuid references kapi_pulse.credit_transactions(id) on delete set null,
  status kapi_pulse.job_status not null default 'pending',
  error text,
  bullmq_job_id text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_kp_gen_jobs_org_status on kapi_pulse.generation_jobs(organization_id, status);
create index idx_kp_gen_jobs_campaign on kapi_pulse.generation_jobs(campaign_id) where campaign_id is not null;
create index idx_kp_gen_jobs_external on kapi_pulse.generation_jobs(external_id) where external_id is not null;
create index idx_kp_gen_jobs_created on kapi_pulse.generation_jobs(organization_id, created_at desc);

-- ============== Generated Assets ==============
create table kapi_pulse.generated_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references kapi_pulse.organizations(id) on delete cascade,
  job_id uuid references kapi_pulse.generation_jobs(id) on delete set null,
  kind kapi_pulse.asset_kind not null,
  source kapi_pulse.asset_source not null,
  storage_bucket text not null default 'generated-assets',
  storage_path text not null,
  mime_type text,
  width int,
  height int,
  duration_seconds numeric(8,2),
  size_bytes bigint,
  prompt text,
  seed bigint,
  parent_asset_id uuid references kapi_pulse.generated_assets(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  is_deleted boolean default false,
  created_by uuid references kapi_pulse.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index idx_kp_assets_org_kind on kapi_pulse.generated_assets(organization_id, kind, created_at desc) where is_deleted = false;
create index idx_kp_assets_job on kapi_pulse.generated_assets(job_id) where job_id is not null;
create index idx_kp_assets_parent on kapi_pulse.generated_assets(parent_asset_id) where parent_asset_id is not null;

-- Cover asset FK (after generated_assets exists)
alter table kapi_pulse.campaigns
  add constraint campaigns_cover_asset_fk
  foreign key (cover_asset_id) references kapi_pulse.generated_assets(id) on delete set null;

-- ============== Campaign Steps ==============
create table kapi_pulse.campaign_steps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references kapi_pulse.campaigns(id) on delete cascade,
  step_number int not null check (step_number between 1 and 6),
  step_type text not null,
  state text not null default 'pending',
  selected_asset_ids uuid[] default '{}'::uuid[],
  config jsonb default '{}'::jsonb,
  result jsonb default '{}'::jsonb,
  updated_at timestamptz default now(),
  unique (campaign_id, step_number)
);

create index idx_kp_campaign_steps_campaign on kapi_pulse.campaign_steps(campaign_id, step_number);

alter table kapi_pulse.generation_jobs
  add constraint generation_jobs_step_fk
  foreign key (step_id) references kapi_pulse.campaign_steps(id) on delete set null;

-- ============== RLS ==============
alter table kapi_pulse.campaigns enable row level security;
alter table kapi_pulse.generation_jobs enable row level security;
alter table kapi_pulse.generated_assets enable row level security;
alter table kapi_pulse.campaign_steps enable row level security;

create policy "miembros ven campañas de su org" on kapi_pulse.campaigns
  for select using (kapi_pulse.is_member_of(organization_id));
create policy "editores crean campañas" on kapi_pulse.campaigns
  for insert with check (kapi_pulse.has_write_access(organization_id));
create policy "editores actualizan campañas" on kapi_pulse.campaigns
  for update using (kapi_pulse.has_write_access(organization_id));
create policy "editores borran campañas" on kapi_pulse.campaigns
  for delete using (kapi_pulse.has_write_access(organization_id));

create policy "miembros ven jobs de su org" on kapi_pulse.generation_jobs
  for select using (kapi_pulse.is_member_of(organization_id));
create policy "editores crean jobs" on kapi_pulse.generation_jobs
  for insert with check (kapi_pulse.has_write_access(organization_id));
create policy "editores actualizan jobs" on kapi_pulse.generation_jobs
  for update using (kapi_pulse.has_write_access(organization_id));

create policy "miembros ven assets de su org" on kapi_pulse.generated_assets
  for select using (kapi_pulse.is_member_of(organization_id) and is_deleted = false);
create policy "editores crean assets" on kapi_pulse.generated_assets
  for insert with check (kapi_pulse.has_write_access(organization_id));
create policy "editores actualizan assets" on kapi_pulse.generated_assets
  for update using (kapi_pulse.has_write_access(organization_id));
create policy "editores borran assets" on kapi_pulse.generated_assets
  for delete using (kapi_pulse.has_write_access(organization_id));

create policy "ver campaign_steps si miembro" on kapi_pulse.campaign_steps
  for select using (exists (
    select 1 from kapi_pulse.campaigns c
    where c.id = campaign_id and kapi_pulse.is_member_of(c.organization_id)
  ));
create policy "editar campaign_steps si editor" on kapi_pulse.campaign_steps
  for all using (exists (
    select 1 from kapi_pulse.campaigns c
    where c.id = campaign_id and kapi_pulse.has_write_access(c.organization_id)
  ));
