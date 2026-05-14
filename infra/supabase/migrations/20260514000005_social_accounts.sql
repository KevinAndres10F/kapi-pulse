-- ============== Social Accounts (schema kapi_pulse) ==============

create type kapi_pulse.social_provider as enum (
  'facebook', 'instagram', 'threads', 'whatsapp',
  'tiktok', 'linkedin', 'x', 'youtube', 'pinterest'
);

create type kapi_pulse.account_status as enum ('active', 'expired', 'disconnected', 'error');

create table kapi_pulse.social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references kapi_pulse.organizations(id) on delete cascade,
  provider kapi_pulse.social_provider not null,
  external_id text not null,
  display_name text,
  avatar_url text,
  -- Tokens encriptados en la app con TOKEN_ENCRYPTION_KEY (aes-256-gcm)
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  expires_at timestamptz,
  scopes text[],
  status kapi_pulse.account_status not null default 'active',
  metadata jsonb default '{}'::jsonb,
  connected_by uuid references kapi_pulse.profiles(id),
  connected_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (organization_id, provider, external_id)
);

-- Indices
create index idx_kp_social_accounts_org on kapi_pulse.social_accounts(organization_id);
create index idx_kp_social_accounts_provider on kapi_pulse.social_accounts(provider);
create index idx_kp_social_accounts_status on kapi_pulse.social_accounts(status);
create index idx_kp_social_accounts_expires on kapi_pulse.social_accounts(expires_at) where expires_at is not null;

-- RLS
alter table kapi_pulse.social_accounts enable row level security;

create policy "miembros pueden ver cuentas de su org"
  on kapi_pulse.social_accounts for select
  using (kapi_pulse.is_member_of(organization_id));

create policy "editores pueden conectar cuentas"
  on kapi_pulse.social_accounts for insert
  with check (kapi_pulse.has_write_access(organization_id));

create policy "editores pueden actualizar cuentas"
  on kapi_pulse.social_accounts for update
  using (kapi_pulse.has_write_access(organization_id));

create policy "admins pueden desconectar cuentas"
  on kapi_pulse.social_accounts for delete
  using (kapi_pulse.is_admin_of(organization_id));
