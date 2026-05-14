-- ============== GRANTs para exponer kapi_pulse via PostgREST ==============
-- supabase-js usa PostgREST con roles anon/authenticated; necesitan USAGE en el
-- schema y permisos por defecto (RLS se encarga del filtrado fino).

grant usage on schema kapi_pulse to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema kapi_pulse
  to anon, authenticated, service_role;

grant usage on all sequences in schema kapi_pulse to anon, authenticated, service_role;

grant execute on all functions in schema kapi_pulse to anon, authenticated, service_role;

-- Objetos futuros (cuando agreguemos tablas/funciones en migraciones siguientes)
alter default privileges in schema kapi_pulse
  grant select, insert, update, delete on tables to anon, authenticated, service_role;

alter default privileges in schema kapi_pulse
  grant usage on sequences to anon, authenticated, service_role;

alter default privileges in schema kapi_pulse
  grant execute on functions to anon, authenticated, service_role;
