-- ============== RLS Policies (schema kapi_pulse) ==============

alter table kapi_pulse.organizations enable row level security;
alter table kapi_pulse.profiles enable row level security;
alter table kapi_pulse.organization_members enable row level security;
alter table kapi_pulse.invitations enable row level security;

-- Helpers: ¿el usuario actual pertenece / escribe / administra la org?
create or replace function kapi_pulse.is_member_of(org_id uuid)
returns boolean
language sql
security definer
set search_path = kapi_pulse, public
stable
as $$
  select exists (
    select 1 from kapi_pulse.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
  );
$$;

create or replace function kapi_pulse.has_write_access(org_id uuid)
returns boolean
language sql
security definer
set search_path = kapi_pulse, public
stable
as $$
  select exists (
    select 1 from kapi_pulse.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'editor')
  );
$$;

create or replace function kapi_pulse.is_admin_of(org_id uuid)
returns boolean
language sql
security definer
set search_path = kapi_pulse, public
stable
as $$
  select exists (
    select 1 from kapi_pulse.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- ===== PROFILES =====
create policy "usuarios pueden ver su propio perfil"
  on kapi_pulse.profiles for select
  using (id = auth.uid());

create policy "usuarios pueden actualizar su propio perfil"
  on kapi_pulse.profiles for update
  using (id = auth.uid());

create policy "usuarios pueden insertar su propio perfil"
  on kapi_pulse.profiles for insert
  with check (id = auth.uid());

-- ===== ORGANIZATIONS =====
create policy "miembros pueden ver sus organizaciones"
  on kapi_pulse.organizations for select
  using (kapi_pulse.is_member_of(id));

create policy "cualquier usuario autenticado puede crear una org"
  on kapi_pulse.organizations for insert
  with check (auth.uid() is not null);

create policy "admins pueden actualizar su org"
  on kapi_pulse.organizations for update
  using (kapi_pulse.is_admin_of(id));

-- ===== ORGANIZATION_MEMBERS =====
create policy "miembros pueden ver miembros de su org"
  on kapi_pulse.organization_members for select
  using (kapi_pulse.is_member_of(organization_id));

create policy "admins pueden agregar miembros"
  on kapi_pulse.organization_members for insert
  with check (kapi_pulse.is_admin_of(organization_id));

create policy "admins pueden actualizar roles"
  on kapi_pulse.organization_members for update
  using (kapi_pulse.is_admin_of(organization_id));

create policy "admins pueden eliminar miembros"
  on kapi_pulse.organization_members for delete
  using (kapi_pulse.is_admin_of(organization_id));

-- Caso especial: el creador de la org puede insertarse como owner
create policy "creador puede insertarse como owner"
  on kapi_pulse.organization_members for insert
  with check (user_id = auth.uid() and role = 'owner');

-- ===== INVITATIONS =====
create policy "miembros pueden ver invitaciones de su org"
  on kapi_pulse.invitations for select
  using (kapi_pulse.is_member_of(organization_id));

create policy "admins pueden crear invitaciones"
  on kapi_pulse.invitations for insert
  with check (kapi_pulse.is_admin_of(organization_id));

create policy "admins pueden eliminar invitaciones"
  on kapi_pulse.invitations for delete
  using (kapi_pulse.is_admin_of(organization_id));

create policy "cualquiera puede ver invitacion por token"
  on kapi_pulse.invitations for select
  using (true);
