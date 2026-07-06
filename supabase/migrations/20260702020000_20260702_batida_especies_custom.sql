-- Añadir columnas para especies prohibidas y personalizadas en batidas
ALTER TABLE batidas
  ADD COLUMN IF NOT EXISTS especies_prohibidas TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS especies_personalizadas JSONB DEFAULT '[]';
