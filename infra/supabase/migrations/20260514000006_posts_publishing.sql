-- ============== Posts & Publishing (schema kapi_pulse) ==============

create type kapi_pulse.post_status as enum (
  'draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'
);

create table kapi_pulse.posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references kapi_pulse.organizations(id) on delete cascade,
  created_by uuid references kapi_pulse.profiles(id),
  title text,
  internal_notes text,
  status kapi_pulse.post_status not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table kapi_pulse.post_variants (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references kapi_pulse.posts(id) on delete cascade,
  social_account_id uuid references kapi_pulse.social_accounts(id) on delete cascade,
  content text,
  hashtags text[],
  link_url text,
  external_post_id text,
  status kapi_pulse.post_status not null default 'draft',
  error_message text,
  published_at timestamptz,
  created_at timestamptz default now()
);

create table kapi_pulse.post_media (
  id uuid primary key default gen_random_uuid(),
  post_variant_id uuid references kapi_pulse.post_variants(id) on delete cascade,
  position int not null default 0,
  media_type text not null, -- 'image', 'video', 'carousel'
  storage_path text not null,
  external_media_id text,
  width int,
  height int,
  duration_seconds int,
  alt_text text
);

-- Indices
create index idx_kp_posts_org on kapi_pulse.posts(organization_id);
create index idx_kp_posts_status on kapi_pulse.posts(status);
create index idx_kp_posts_scheduled on kapi_pulse.posts(scheduled_at) where scheduled_at is not null;
create index idx_kp_post_variants_post on kapi_pulse.post_variants(post_id);
create index idx_kp_post_variants_account on kapi_pulse.post_variants(social_account_id);
create index idx_kp_post_variants_status on kapi_pulse.post_variants(status);
create index idx_kp_post_media_variant on kapi_pulse.post_media(post_variant_id);

-- RLS
alter table kapi_pulse.posts enable row level security;
alter table kapi_pulse.post_variants enable row level security;
alter table kapi_pulse.post_media enable row level security;

-- Posts
create policy "miembros pueden ver posts de su org"
  on kapi_pulse.posts for select using (kapi_pulse.is_member_of(organization_id));

create policy "editores pueden crear posts"
  on kapi_pulse.posts for insert with check (kapi_pulse.has_write_access(organization_id));

create policy "editores pueden actualizar posts"
  on kapi_pulse.posts for update using (kapi_pulse.has_write_access(organization_id));

create policy "editores pueden eliminar posts"
  on kapi_pulse.posts for delete using (kapi_pulse.has_write_access(organization_id));

-- Post variants
create policy "miembros pueden ver variantes"
  on kapi_pulse.post_variants for select
  using (exists (
    select 1 from kapi_pulse.posts p where p.id = post_id and kapi_pulse.is_member_of(p.organization_id)
  ));

create policy "editores pueden crear variantes"
  on kapi_pulse.post_variants for insert
  with check (exists (
    select 1 from kapi_pulse.posts p where p.id = post_id and kapi_pulse.has_write_access(p.organization_id)
  ));

create policy "editores pueden actualizar variantes"
  on kapi_pulse.post_variants for update
  using (exists (
    select 1 from kapi_pulse.posts p where p.id = post_id and kapi_pulse.has_write_access(p.organization_id)
  ));

create policy "editores pueden eliminar variantes"
  on kapi_pulse.post_variants for delete
  using (exists (
    select 1 from kapi_pulse.posts p where p.id = post_id and kapi_pulse.has_write_access(p.organization_id)
  ));

-- Post media
create policy "miembros pueden ver media"
  on kapi_pulse.post_media for select
  using (exists (
    select 1 from kapi_pulse.post_variants pv
    join kapi_pulse.posts p on p.id = pv.post_id
    where pv.id = post_variant_id and kapi_pulse.is_member_of(p.organization_id)
  ));

create policy "editores pueden gestionar media"
  on kapi_pulse.post_media for all
  using (exists (
    select 1 from kapi_pulse.post_variants pv
    join kapi_pulse.posts p on p.id = pv.post_id
    where pv.id = post_variant_id and kapi_pulse.has_write_access(p.organization_id)
  ));
