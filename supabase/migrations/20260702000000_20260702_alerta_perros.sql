-- Create a table for batida dog alerts
create table if not exists public.batida_alertas (
  id uuid primary key default gen_random_uuid(),
  batida_id uuid not null references public.batidas(id) on delete cascade,
  user_id uuid not null references public.perfiles(id),
  tipo_alerta text not null check (tipo_alerta in ('perro_cogido', 'perro_visto', 'perro_por_la_zona')),
  color text,
  propietario text,
  direccion text,
  mensaje text,
  imagen_url text,
  created_at timestamptz not null default now()
);
