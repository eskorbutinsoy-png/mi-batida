-- Add cupos_custom column to batidas for user-defined species quotas
ALTER TABLE batidas ADD COLUMN IF NOT EXISTS cupos_custom jsonb DEFAULT '{}'::jsonb;
