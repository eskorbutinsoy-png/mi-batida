create table if not exists public.push_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android' check (platform in ('android', 'ios', 'web')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_device_tokens_user_id on public.push_device_tokens(user_id);
create index if not exists idx_push_device_tokens_enabled on public.push_device_tokens(enabled);

create or replace function public.tg_set_push_device_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_push_device_tokens_updated_at on public.push_device_tokens;
create trigger trg_push_device_tokens_updated_at
before update on public.push_device_tokens
for each row
execute function public.tg_set_push_device_tokens_updated_at();

alter table public.push_device_tokens enable row level security;

drop policy if exists "push_tokens_select_own" on public.push_device_tokens;
create policy "push_tokens_select_own"
on public.push_device_tokens
for select
using (auth.uid() = user_id);

drop policy if exists "push_tokens_insert_own" on public.push_device_tokens;
create policy "push_tokens_insert_own"
on public.push_device_tokens
for insert
with check (auth.uid() = user_id);

drop policy if exists "push_tokens_update_own" on public.push_device_tokens;
create policy "push_tokens_update_own"
on public.push_device_tokens
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "push_tokens_delete_own" on public.push_device_tokens;
create policy "push_tokens_delete_own"
on public.push_device_tokens
for delete
using (auth.uid() = user_id);
