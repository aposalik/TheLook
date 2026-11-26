begin;

create table if not exists public.look_analyses (
  id uuid primary key default gen_random_uuid(),
  look_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  engine_version text not null,
  deterministic jsonb not null check (jsonb_typeof(deterministic) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (look_id, user_id) references public.saved_looks(id, user_id) on delete cascade,
  unique (look_id, engine_version)
);

create index if not exists look_analyses_user_look_created_idx on public.look_analyses (user_id, look_id, created_at desc);
alter table public.look_analyses enable row level security;
create policy "look_analyses_select_own" on public.look_analyses for select to authenticated using ((select auth.uid()) = user_id);
create policy "look_analyses_insert_own" on public.look_analyses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "look_analyses_update_own" on public.look_analyses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "look_analyses_delete_own" on public.look_analyses for delete to authenticated using ((select auth.uid()) = user_id);

commit;
