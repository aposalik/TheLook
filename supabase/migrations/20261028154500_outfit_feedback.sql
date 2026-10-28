create table if not exists public.outfit_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  signal text not null check (signal in ('like', 'dislike')),
  item_ids text[] not null check (cardinality(item_ids) between 1 and 12),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index if not exists outfit_feedback_user_created_idx
  on public.outfit_feedback (user_id, created_at desc);

alter table public.outfit_feedback enable row level security;

drop policy if exists "outfit_feedback_select_own" on public.outfit_feedback;
create policy "outfit_feedback_select_own"
on public.outfit_feedback for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "outfit_feedback_insert_own" on public.outfit_feedback;
create policy "outfit_feedback_insert_own"
on public.outfit_feedback for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "outfit_feedback_delete_own" on public.outfit_feedback;
create policy "outfit_feedback_delete_own"
on public.outfit_feedback for delete to authenticated
using ((select auth.uid()) = user_id);
