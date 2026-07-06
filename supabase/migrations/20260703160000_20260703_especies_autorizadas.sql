-- Add especies_autorizadas column to batidas
ALTER TABLE batidas ADD COLUMN IF NOT EXISTS especies_autorizadas jsonb DEFAULT '[]'::jsonb;
