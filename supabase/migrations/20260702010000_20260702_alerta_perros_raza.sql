-- Add raza column to batida_alertas
ALTER TABLE public.batida_alertas
  ADD COLUMN IF NOT EXISTS raza text;
