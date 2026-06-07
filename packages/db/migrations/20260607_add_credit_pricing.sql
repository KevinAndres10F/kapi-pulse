-- Add new credit pricing for branded generation operations
-- Insert pricing for Eleven Labs, Banana, and enhanced video generation

INSERT INTO credit_pricing (operation, provider, credits_per_unit, created_at)
VALUES
  -- Eleven Labs Audio
  ('generate_audio_eleven_labs', 'eleven_labs', 25, now()),

  -- Banana Image Generation
  ('generate_image_banana_flux_pro', 'banana', 50, now()),
  ('generate_image_banana_carousel', 'banana', 150, now()),

  -- Video with Audio Sync
  ('generate_video_with_audio_kling_5s', 'fal', 100, now()),
  ('generate_video_with_audio_kling_10s', 'fal', 150, now()),
  ('generate_video_with_audio_luma', 'fal', 120, now()),

  -- Branded Image (with brand injection)
  ('generate_image_branded_fal', 'fal', 60, now()),
  ('generate_image_branded_banana', 'banana', 50, now())

ON CONFLICT (operation, provider) DO UPDATE
SET credits_per_unit = EXCLUDED.credits_per_unit
WHERE credit_pricing.operation IN (
  'generate_audio_eleven_labs',
  'generate_image_banana_flux_pro',
  'generate_image_banana_carousel',
  'generate_video_with_audio_kling_5s',
  'generate_video_with_audio_kling_10s',
  'generate_video_with_audio_luma',
  'generate_image_branded_fal',
  'generate_image_branded_banana'
);
