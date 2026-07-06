-- Tabla de eventos de batida para el informe cronológico
create table if not exists public.batida_eventos (
  id uuid primary key default gen_random_uuid(),
  batida_id uuid not null references public.batidas(id) on delete cascade,
  tipo text not null check (tipo in (
    'batida_creada',
    'batida_iniciada',
    'batida_finalizada',
    'miembro_unido',
    'miembro_reactivado',
    'miembro_abandono',
    'miembro_expulsado',
    'registro_creado'
  )),
  user_id uuid references auth.users(id) on delete set null,
  titulo text not null,
  detalle text,
  created_at timestamptz not null default now()
);

-- Si la tabla ya existia incompleta, aseguramos columnas requeridas.
alter table public.batida_eventos
  add column if not exists batida_id uuid,
  add column if not exists tipo text,
  add column if not exists user_id uuid,
  add column if not exists titulo text,
  add column if not exists detalle text,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'batida_eventos_batida_id_fkey'
      and conrelid = 'public.batida_eventos'::regclass
  ) then
    alter table public.batida_eventos
      add constraint batida_eventos_batida_id_fkey
      foreign key (batida_id) references public.batidas(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'batida_eventos_user_id_fkey'
      and conrelid = 'public.batida_eventos'::regclass
  ) then
    alter table public.batida_eventos
      add constraint batida_eventos_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'batida_eventos_tipo_check'
      and conrelid = 'public.batida_eventos'::regclass
  ) then
    alter table public.batida_eventos
      add constraint batida_eventos_tipo_check
      check (tipo in (
        'batida_creada',
        'batida_iniciada',
        'batida_finalizada',
        'miembro_unido',
        'miembro_reactivado',
        'miembro_abandono',
        'miembro_expulsado',
        'registro_creado'
      ));
  end if;
end
$$;

alter table public.batida_eventos
  alter column batida_id set not null,
  alter column tipo set not null,
  alter column titulo set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.batida_eventos enable row level security;

drop policy if exists "batida_eventos_select" on public.batida_eventos;
create policy "batida_eventos_select" on public.batida_eventos
  for select to authenticated
  using (
    exists (select 1 from public.batidas b where b.id = public.batida_eventos.batida_id and b.creador_id = auth.uid())
    or exists (select 1 from public.batida_admins ba where ba.batida_id = public.batida_eventos.batida_id and ba.user_id = auth.uid())
    or exists (select 1 from public.batida_miembros bm where bm.batida_id = public.batida_eventos.batida_id and bm.user_id = auth.uid())
  );

drop policy if exists "batida_eventos_insert" on public.batida_eventos;
create policy "batida_eventos_insert" on public.batida_eventos
  for insert to authenticated
  with check (
    exists (select 1 from public.batidas b where b.id = public.batida_eventos.batida_id and b.creador_id = auth.uid())
    or exists (select 1 from public.batida_admins ba where ba.batida_id = public.batida_eventos.batida_id and ba.user_id = auth.uid())
    or public.batida_eventos.user_id = auth.uid()
  );
