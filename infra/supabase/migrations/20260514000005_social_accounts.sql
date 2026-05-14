-- ============== Social Accounts ==============

create type social_provider as enum (
  'facebook', 'instagram', 'threads', 'whatsapp',
  'tiktok', 'linkedin', 'x', 'youtube', 'pinterest'
);

create type account_status as enum ('active', 'expired', 'disconnected', 'error');

create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  provider social_provider not null,
  external_id text not null,
  display_name text,
  avatar_url text,
  -- Tokens encriptados con pgcrypto (symmetric encrypt con TOKEN_ENCRYPTION_KEY)
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  expires_at timestamptz,
  scopes text[],
  status account_status not null default 'active',
  metadata jsonb default '{}'::jsonb,
  connected_by uuid references profiles(id),
  connected_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, provider, external_id)
);

-- Indices
create index idx_social_accounts_org on social_accounts(organization_id);
create index idx_social_accounts_provider on social_accounts(provider);
create index idx_social_accounts_status on social_accounts(status);
create index idx_social_accounts_expires on social_accounts(expires_at) where expires_at is not null;

-- RLS
alter table social_accounts enable row level security;

create policy "miembros pueden ver cuentas de su org"
  on social_accounts for select
  using (is_member_of(organization_id));

create policy "editores pueden conectar cuentas"
  on social_accounts for insert
  with check (has_write_access(organization_id));

create policy "editores pueden actualizar cuentas"
  on social_accounts for update
  using (has_write_access(organization_id));

create policy "admins pueden desconectar cuentas"
  on social_accounts for delete
  using (is_admin_of(organization_id));
