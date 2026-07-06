-- Rollback: eliminar columnas de especies personalizadas/prohibidas
ALTER TABLE batidas
  DROP COLUMN IF EXISTS especies_prohibidas,
  DROP COLUMN IF EXISTS especies_personalizadas;
