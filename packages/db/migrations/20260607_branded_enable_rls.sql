-- Habilita RLS en las tablas de Branded Generation.
--
-- El schema kapi_pulse está EXPUESTO vía PostgREST, así que las tablas sin RLS
-- quedarían accesibles con la anon key. El backend (apps/api, apps/worker) accede
-- con la service_role key, que ignora RLS — por lo tanto habilitar RLS no rompe
-- el flujo de la app y cierra el acceso público no deseado.
--
-- Deny-all por defecto (sin policies): solo service_role puede leer/escribir.
-- Si en el futuro la web necesita leer estas tablas directo con la anon key,
-- agregar policies org-scoped (organization_id = get_user_org_id()).

ALTER TABLE kapi_pulse.character_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kapi_pulse.brand_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE kapi_pulse.generation_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE kapi_pulse.character_usage_log ENABLE ROW LEVEL SECURITY;
