ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS role_interest text,
  ADD COLUMN IF NOT EXISTS estimated_volume text,
  ADD COLUMN IF NOT EXISTS message text;

CREATE INDEX IF NOT EXISTS idx_leads_source_created_at ON leads (source, created_at DESC);
