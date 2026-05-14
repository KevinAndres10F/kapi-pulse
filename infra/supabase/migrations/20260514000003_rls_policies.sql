-- ============== RLS Policies ==============

-- Habilitar RLS en todas las tablas
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table organization_members enable row level security;
alter table invitations enable row level security;

-- Función helper: ¿el usuario actual pertenece a la org?
create or replace function is_member_of(org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id
      and user_id = auth.uid()
  );
$$;

-- Función helper: ¿el usuario tiene rol de escritura en la org?
create or replace function has_write_access(org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'editor')
  );
$$;

-- Función helper: ¿el usuario es owner o admin de la org?
create or replace function is_admin_of(org_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- ===== PROFILES =====
create policy "usuarios pueden ver su propio perfil"
  on profiles for select
  using (id = auth.uid());

create policy "usuarios pueden actualizar su propio perfil"
  on profiles for update
  using (id = auth.uid());

create policy "usuarios pueden insertar su propio perfil"
  on profiles for insert
  with check (id = auth.uid());

-- ===== ORGANIZATIONS =====
create policy "miembros pueden ver sus organizaciones"
  on organizations for select
  using (is_member_of(id));

create policy "cualquier usuario autenticado puede crear una org"
  on organizations for insert
  with check (auth.uid() is not null);

create policy "admins pueden actualizar su org"
  on organizations for update
  using (is_admin_of(id));

-- ===== ORGANIZATION_MEMBERS =====
create policy "miembros pueden ver miembros de su org"
  on organization_members for select
  using (is_member_of(organization_id));

create policy "admins pueden agregar miembros"
  on organization_members for insert
  with check (is_admin_of(organization_id));

create policy "admins pueden actualizar roles"
  on organization_members for update
  using (is_admin_of(organization_id));

create policy "admins pueden eliminar miembros"
  on organization_members for delete
  using (is_admin_of(organization_id));

-- Caso especial: el creador de la org puede insertarse como owner
create policy "creador puede insertarse como owner"
  on organization_members for insert
  with check (user_id = auth.uid() and role = 'owner');

-- ===== INVITATIONS =====
create policy "miembros pueden ver invitaciones de su org"
  on invitations for select
  using (is_member_of(organization_id));

create policy "admins pueden crear invitaciones"
  on invitations for insert
  with check (is_admin_of(organization_id));

create policy "admins pueden eliminar invitaciones"
  on invitations for delete
  using (is_admin_of(organization_id));

-- Invitaciones públicas por token (para aceptar)
create policy "cualquiera puede ver invitación por token"
  on invitations for select
  using (true);
