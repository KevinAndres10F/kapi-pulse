-- ============== Link post_media → generated_assets ==============

alter table kapi_pulse.post_media
  add column if not exists generated_asset_id uuid references kapi_pulse.generated_assets(id) on delete set null,
  add column if not exists storage_bucket text default 'generated-assets',
  add column if not exists mime_type text;

create index if not exists idx_kp_post_media_asset
  on kapi_pulse.post_media(generated_asset_id)
  where generated_asset_id is not null;
