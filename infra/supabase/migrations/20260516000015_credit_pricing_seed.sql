-- ============== Credit Pricing Catalog (versioned) ==============

create table kapi_pulse.credit_pricing (
  id uuid primary key default gen_random_uuid(),
  operation text unique not null,
  provider kapi_pulse.asset_source not null,
  model text not null,
  unit text not null default 'call',
  credits_per_unit int not null,
  upstream_usd_cost numeric(8,4) not null,
  is_active boolean default true,
  notes text,
  updated_at timestamptz default now()
);

-- 1 USD ≈ 100 créditos (margen ~50% vs costo upstream)
insert into kapi_pulse.credit_pricing
  (operation, provider, model, unit, credits_per_unit, upstream_usd_cost, notes) values
  ('generate_image_flux_schnell',   'fal',       'fal-ai/flux/schnell',         'call', 3,   0.003, 'Imagen rápida 1MP'),
  ('generate_image_flux_dev',       'fal',       'fal-ai/flux/dev',             'call', 8,   0.025, 'Imagen calidad media'),
  ('generate_image_flux_pro',       'fal',       'fal-ai/flux-pro/v1.1',        'call', 10,  0.040, 'Imagen pro'),
  ('generate_image_replicate_sdxl', 'replicate', 'stability-ai/sdxl',           'call', 8,   0.025, 'Fallback'),
  ('generate_video_kling_5s',       'fal',       'fal-ai/kling-video/v2',       'call', 80,  0.40,  'Video 5s 720p'),
  ('generate_video_kling_10s',      'fal',       'fal-ai/kling-video/v2',       'call', 150, 0.80,  'Video 10s'),
  ('generate_video_luma',           'fal',       'fal-ai/luma-dream-machine',   'call', 80,  0.35,  'Video Luma Dream Machine'),
  ('generate_avatar_heygen_15s',    'heygen',    'heygen-avatar-iv',            'call', 120, 0.50,  'Avatar UGC 15s vertical'),
  ('generate_avatar_hedra',         'hedra',     'hedra-character-2',           'call', 90,  0.40,  'Avatar Hedra'),
  ('generate_copy_claude',          'claude',    'claude-opus-4-7',             'call', 2,   0.008, 'Bundle copy + hashtags');

alter table kapi_pulse.credit_pricing enable row level security;

create policy "todos los autenticados ven pricing" on kapi_pulse.credit_pricing
  for select using (auth.uid() is not null);
