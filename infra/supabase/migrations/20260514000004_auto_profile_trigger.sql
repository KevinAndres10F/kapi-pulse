-- Trigger: crear perfil en kapi_pulse.profiles cuando se registra un usuario.
--
-- Importante: este proyecto Supabase ya tiene un trigger on_auth_user_created
-- del otro producto que inserta en public.profiles. Para no colisionar, usamos
-- una función y nombre de trigger únicos al schema kapi_pulse.
create or replace function kapi_pulse.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = kapi_pulse, public
as $$
begin
  insert into kapi_pulse.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_kapi_pulse on auth.users;
create trigger on_auth_user_created_kapi_pulse
  after insert on auth.users
  for each row execute function kapi_pulse.handle_new_user();
