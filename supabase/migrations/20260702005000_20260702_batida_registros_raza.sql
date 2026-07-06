-- Add raza column to batida_registros
ALTER TABLE public.batida_registros
  ADD COLUMN IF NOT EXISTS raza text;
