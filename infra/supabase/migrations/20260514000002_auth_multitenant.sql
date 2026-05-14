-- ============== Multi-tenancy core ==============

-- Organizaciones (tenants)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  logo_url text,
  timezone text not null default 'America/Guayaquil',
  locale text not null default 'es-EC',
  plan_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Perfiles de usuario (extiende auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  preferred_locale text default 'es',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Roles de miembros
create type member_role as enum ('owner', 'admin', 'editor', 'viewer');

-- Membresías org <-> usuario
create table organization_members (
  organization_id uuid references organizations(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role member_role not null default 'editor',
  joined_at timestamptz default now(),
  primary key (organization_id, user_id)
);

-- Invitaciones pendientes
create table invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  email text not null,
  role member_role not null default 'editor',
  token text unique not null default encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  invited_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Índices para búsquedas frecuentes
create index idx_org_members_user on organization_members(user_id);
create index idx_org_members_org on organization_members(organization_id);
create index idx_invitations_email on invitations(email);
create index idx_invitations_token on invitations(token);
create index idx_organizations_slug on organizations(slug);
