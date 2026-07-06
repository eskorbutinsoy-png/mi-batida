-- Add latitude and longitude columns to batida_alertas
ALTER TABLE public.batida_alertas
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;
