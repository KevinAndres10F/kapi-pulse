-- ============== RPC: crear organización + owner atómicamente ==============
-- El flow original hacía 2 inserts secuenciales:
--   1) insert org with .select().single() para obtener el id
--   2) insert organization_members (owner)
--
-- El (1) fallaba con 403 porque la policy de SELECT requiere is_member_of(id)
-- y el user todavía no es miembro (eso pasa en el paso 2). Esta RPC hace
-- ambos inserts en una transacción como SECURITY DEFINER, devolviendo la
-- fila de la org.

create or replace function kapi_pulse.create_organization_with_owner(
  p_name text,
  p_slug text,
  p_timezone text default 'America/Guayaquil',
  p_locale text default 'es-EC'
)
returns kapi_pulse.organizations
language plpgsql
security definer
set search_path = kapi_pulse, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org kapi_pulse.organizations;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  insert into kapi_pulse.organizations (name, slug, timezone, locale)
  values (p_name, p_slug, p_timezone, p_locale)
  returning * into v_org;

  insert into kapi_pulse.organization_members (organization_id, user_id, role)
  values (v_org.id, v_user_id, 'owner');

  return v_org;
end;
$$;

grant execute on function
  kapi_pulse.create_organization_with_owner(text, text, text, text)
  to authenticated;
