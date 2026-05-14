-- ============== Posts & Publishing ==============

create type post_status as enum ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');

create table posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  created_by uuid references profiles(id),
  title text,
  internal_notes text,
  status post_status not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table post_variants (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  social_account_id uuid references social_accounts(id) on delete cascade,
  content text,
  hashtags text[],
  link_url text,
  external_post_id text,
  status post_status not null default 'draft',
  error_message text,
  published_at timestamptz,
  created_at timestamptz default now()
);

create table post_media (
  id uuid primary key default gen_random_uuid(),
  post_variant_id uuid references post_variants(id) on delete cascade,
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
create index idx_posts_org on posts(organization_id);
create index idx_posts_status on posts(status);
create index idx_posts_scheduled on posts(scheduled_at) where scheduled_at is not null;
create index idx_post_variants_post on post_variants(post_id);
create index idx_post_variants_account on post_variants(social_account_id);
create index idx_post_variants_status on post_variants(status);
create index idx_post_media_variant on post_media(post_variant_id);

-- RLS
alter table posts enable row level security;
alter table post_variants enable row level security;
alter table post_media enable row level security;

-- Posts: miembros pueden ver, editores pueden escribir
create policy "miembros pueden ver posts de su org"
  on posts for select using (is_member_of(organization_id));

create policy "editores pueden crear posts"
  on posts for insert with check (has_write_access(organization_id));

create policy "editores pueden actualizar posts"
  on posts for update using (has_write_access(organization_id));

create policy "editores pueden eliminar posts"
  on posts for delete using (has_write_access(organization_id));

-- Post variants: heredan permisos del post padre
create policy "miembros pueden ver variantes"
  on post_variants for select
  using (exists (
    select 1 from posts p where p.id = post_id and is_member_of(p.organization_id)
  ));

create policy "editores pueden crear variantes"
  on post_variants for insert
  with check (exists (
    select 1 from posts p where p.id = post_id and has_write_access(p.organization_id)
  ));

create policy "editores pueden actualizar variantes"
  on post_variants for update
  using (exists (
    select 1 from posts p where p.id = post_id and has_write_access(p.organization_id)
  ));

create policy "editores pueden eliminar variantes"
  on post_variants for delete
  using (exists (
    select 1 from posts p where p.id = post_id and has_write_access(p.organization_id)
  ));

-- Post media: heredan permisos de la variante padre
create policy "miembros pueden ver media"
  on post_media for select
  using (exists (
    select 1 from post_variants pv
    join posts p on p.id = pv.post_id
    where pv.id = post_variant_id and is_member_of(p.organization_id)
  ));

create policy "editores pueden gestionar media"
  on post_media for all
  using (exists (
    select 1 from post_variants pv
    join posts p on p.id = pv.post_id
    where pv.id = post_variant_id and has_write_access(p.organization_id)
  ));
