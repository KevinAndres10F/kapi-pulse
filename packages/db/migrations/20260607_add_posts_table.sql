-- Add posts table for publishing workflow with brand validation

CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,

  -- Content
  platform text NOT NULL, -- 'instagram', 'tiktok', 'linkedin', 'facebook', 'twitter'
  caption text,
  asset_ids uuid[] DEFAULT ARRAY[]::uuid[],

  -- Publishing
  status text DEFAULT 'draft', -- 'draft', 'scheduled', 'published', 'failed'
  published_at timestamp,
  scheduled_for timestamp,

  -- Brand Validation
  brand_validated boolean DEFAULT false,
  validation_score integer, -- 0-100
  validation_details jsonb, -- Store validation result

  -- Tracking
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),

  CONSTRAINT platform_valid CHECK (platform IN ('instagram', 'tiktok', 'linkedin', 'facebook', 'twitter')),
  CONSTRAINT status_valid CHECK (status IN ('draft', 'scheduled', 'published', 'failed'))
);

CREATE INDEX idx_posts_org_id ON posts(organization_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_platform ON posts(platform);
CREATE INDEX idx_posts_published_at ON posts(published_at DESC);

-- Track post metrics
CREATE TABLE post_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  platform text NOT NULL,

  -- Engagement metrics
  views integer DEFAULT 0,
  likes integer DEFAULT 0,
  comments integer DEFAULT 0,
  shares integer DEFAULT 0,
  clicks integer DEFAULT 0,

  -- Timestamps
  recorded_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX idx_post_metrics_post_id ON post_metrics(post_id);
CREATE INDEX idx_post_metrics_platform ON post_metrics(platform);

-- Auto-update posts.updated_at
CREATE OR REPLACE FUNCTION update_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_posts_timestamp
BEFORE UPDATE ON posts
FOR EACH ROW
EXECUTE FUNCTION update_posts_updated_at();
