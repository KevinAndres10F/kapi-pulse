-- ============== Studio Storage Buckets ==============

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('generated-assets', 'generated-assets', false, 524288000,
    array['image/png','image/jpeg','image/webp','video/mp4','video/quicktime','audio/mpeg','audio/mp4','application/json','application/zip']),
  ('campaign-uploads', 'campaign-uploads', false, 104857600,
    array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Helper: extract org_id from first segment of storage object name ('{org_id}/...')
create or replace function kapi_pulse.storage_org_id(name text) returns uuid
language sql
immutable
set search_path = ''
as $$
  select nullif(split_part(name, '/', 1), '')::uuid
$$;

-- Policies on storage.objects scoped to our buckets + org membership
drop policy if exists "kapi: miembros ven sus assets" on storage.objects;
drop policy if exists "kapi: editores suben assets" on storage.objects;
drop policy if exists "kapi: editores borran assets" on storage.objects;
drop policy if exists "kapi: editores actualizan assets" on storage.objects;

create policy "kapi: miembros ven sus assets"
  on storage.objects for select
  using (
    bucket_id in ('generated-assets','campaign-uploads')
    and kapi_pulse.is_member_of(kapi_pulse.storage_org_id(name))
  );

create policy "kapi: editores suben assets"
  on storage.objects for insert
  with check (
    bucket_id in ('generated-assets','campaign-uploads')
    and kapi_pulse.has_write_access(kapi_pulse.storage_org_id(name))
  );

create policy "kapi: editores actualizan assets"
  on storage.objects for update
  using (
    bucket_id in ('generated-assets','campaign-uploads')
    and kapi_pulse.has_write_access(kapi_pulse.storage_org_id(name))
  );

create policy "kapi: editores borran assets"
  on storage.objects for delete
  using (
    bucket_id in ('generated-assets','campaign-uploads')
    and kapi_pulse.has_write_access(kapi_pulse.storage_org_id(name))
  );
