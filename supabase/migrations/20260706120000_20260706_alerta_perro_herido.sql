-- Add perro_herido type and gravedad column to batida_alertas

-- Drop old check constraint and replace with one that includes perro_herido
ALTER TABLE public.batida_alertas
  DROP CONSTRAINT IF EXISTS batida_alertas_tipo_alerta_check;

ALTER TABLE public.batida_alertas
  ADD CONSTRAINT batida_alertas_tipo_alerta_check
  CHECK (tipo_alerta IN ('perro_cogido', 'perro_visto', 'perro_por_la_zona', 'perro_herido'));

-- Add gravedad column (leve, moderado, grave)
ALTER TABLE public.batida_alertas
  ADD COLUMN IF NOT EXISTS gravedad text
  CHECK (gravedad IS NULL OR gravedad IN ('leve', 'moderado', 'grave'));
