-- TheLook Phase A: Supabase foundation
-- Creates private, user-owned application data and Storage policies.

begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- User-owned application tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  occasion text not null default 'any' check (occasion in ('any', 'casual', 'work', 'evening')),
  styling_goal text not null default 'balanced' check (styling_goal in ('balanced', 'define-waist', 'vertical-line', 'shoulder-structure')),
  sound_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  created_at timestamptz not null default now(),
  unique (user_id, storage_path),
  unique (id, user_id),
  check (storage_path = user_id::text || '/' || id::text || '.jpg')
);

create table if not exists public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  title text not null check (char_length(title) between 1 and 120),
  category text not null check (category in ('upper', 'bottom', 'dress', 'shoe', 'accessory')),
  subcategory text,
  layer text check (layer is null or layer in ('base', 'mid', 'outer')),
  dominant_color text check (dominant_color is null or dominant_color ~ '^#[0-9A-Fa-f]{6}$'),
  palette text check (palette is null or palette in ('warm', 'cool', 'neutral')),
  color_role text check (color_role is null or color_role in ('neutral', 'accent', 'statement')),
  fit text check (fit is null or fit in ('slim', 'regular', 'relaxed', 'oversized')),
  formality smallint check (formality is null or formality between 1 and 5),
  styles text[] not null default '{}',
  seasons text[] not null default '{}',
  material text,
  description text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, storage_path),
  unique (id, user_id),
  check (storage_path = user_id::text || '/' || id::text || '.png')
);

create table if not exists public.saved_looks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  render_path text,
  stylist_title text,
  formula text not null check (char_length(formula) between 1 and 120),
  cohesion numeric(5,4) check (cohesion is null or cohesion between 0 and 1),
  reason text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check (render_path is null or render_path like user_id::text || '/%')
);

create table if not exists public.saved_look_items (
  id uuid primary key default gen_random_uuid(),
  look_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  wardrobe_item_id uuid,
  catalog_item_id text,
  role text not null,
  position smallint not null default 0 check (position >= 0),
  item_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (look_id, user_id) references public.saved_looks(id, user_id) on delete cascade,
  foreign key (wardrobe_item_id, user_id) references public.wardrobe_items(id, user_id) on delete cascade,
  check (num_nonnulls(wardrobe_item_id, catalog_item_id) = 1),
  unique (look_id, position)
);

-- ---------------------------------------------------------------------------
-- Render state and server-owned usage tables
-- ---------------------------------------------------------------------------

create table if not exists public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  avatar_id uuid not null,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'queued' check (
    status in ('queued', 'uploading', 'rendering_upper', 'rendering_lower', 'saving', 'completed', 'failed')
  ),
  selected_items jsonb not null,
  result_path text,
  youcam_units integer not null default 0 check (youcam_units >= 0),
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  foreign key (avatar_id, user_id) references public.avatars(id, user_id) on delete cascade,
  unique (user_id, fingerprint),
  check (result_path is null or result_path = user_id::text || '/' || id::text || '.jpg'),
  check ((status = 'completed' and result_path is not null and completed_at is not null) or status <> 'completed')
);

create table if not exists public.daily_ip_usage (
  day date not null,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  try_on_count integer not null default 0 check (try_on_count >= 0),
  youcam_units integer not null default 0 check (youcam_units >= 0),
  updated_at timestamptz not null default now(),
  primary key (day, ip_hash)
);

create table if not exists public.daily_user_usage (
  day date not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  try_on_count integer not null default 0 check (try_on_count >= 0),
  youcam_units integer not null default 0 check (youcam_units >= 0),
  updated_at timestamptz not null default now(),
  primary key (day, user_id)
);

create table if not exists public.global_usage (
  day date primary key,
  try_on_count integer not null default 0 check (try_on_count >= 0),
  youcam_units integer not null default 0 check (youcam_units >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.render_settings (
  id boolean primary key default true check (id),
  real_tryon_enabled boolean not null default true,
  ip_daily_tryon_limit integer not null default 2 check (ip_daily_tryon_limit >= 0),
  user_daily_tryon_limit integer not null default 2 check (user_daily_tryon_limit >= 0),
  global_daily_tryon_limit integer not null default 20 check (global_daily_tryon_limit >= 0),
  global_total_unit_limit integer not null default 700 check (global_total_unit_limit >= 0),
  updated_at timestamptz not null default now()
);

insert into public.render_settings (id)
values (true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists avatars_user_created_idx
  on public.avatars (user_id, created_at desc);
create index if not exists wardrobe_items_user_created_idx
  on public.wardrobe_items (user_id, created_at desc);
create index if not exists wardrobe_items_user_category_idx
  on public.wardrobe_items (user_id, category);
create index if not exists saved_looks_user_created_idx
  on public.saved_looks (user_id, created_at desc);
create index if not exists saved_look_items_user_look_idx
  on public.saved_look_items (user_id, look_id, position);
create index if not exists render_jobs_user_created_idx
  on public.render_jobs (user_id, created_at desc);
create index if not exists render_jobs_status_created_idx
  on public.render_jobs (status, created_at);

-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists user_preferences_set_updated_at on public.user_preferences;
create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

drop trigger if exists wardrobe_items_set_updated_at on public.wardrobe_items;
create trigger wardrobe_items_set_updated_at
before update on public.wardrobe_items
for each row execute function public.set_updated_at();

drop trigger if exists render_jobs_set_updated_at on public.render_jobs;
create trigger render_jobs_set_updated_at
before update on public.render_jobs
for each row execute function public.set_updated_at();

drop trigger if exists daily_ip_usage_set_updated_at on public.daily_ip_usage;
create trigger daily_ip_usage_set_updated_at
before update on public.daily_ip_usage
for each row execute function public.set_updated_at();

drop trigger if exists daily_user_usage_set_updated_at on public.daily_user_usage;
create trigger daily_user_usage_set_updated_at
before update on public.daily_user_usage
for each row execute function public.set_updated_at();

drop trigger if exists global_usage_set_updated_at on public.global_usage;
create trigger global_usage_set_updated_at
before update on public.global_usage
for each row execute function public.set_updated_at();

drop trigger if exists render_settings_set_updated_at on public.render_settings;
create trigger render_settings_set_updated_at
before update on public.render_settings
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Provision profile/preferences for both anonymous and permanent auth users
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- Backfill if the migration is applied after users already exist.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

insert into public.user_preferences (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Database Row-Level Security
-- Anonymous Supabase users use the authenticated Postgres role, so these
-- policies protect guest and permanent accounts in exactly the same way.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.avatars enable row level security;
alter table public.wardrobe_items enable row level security;
alter table public.saved_looks enable row level security;
alter table public.saved_look_items enable row level security;
alter table public.render_jobs enable row level security;
alter table public.daily_ip_usage enable row level security;
alter table public.daily_user_usage enable row level security;
alter table public.global_usage enable row level security;
alter table public.render_settings enable row level security;

create policy "profiles_select_own"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "preferences_select_own"
on public.user_preferences for select to authenticated
using ((select auth.uid()) = user_id);

create policy "preferences_insert_own"
on public.user_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "preferences_update_own"
on public.user_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "avatars_select_own"
on public.avatars for select to authenticated
using ((select auth.uid()) = user_id);

create policy "avatars_insert_own"
on public.avatars for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "avatars_update_own"
on public.avatars for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "avatars_delete_own"
on public.avatars for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "wardrobe_select_own"
on public.wardrobe_items for select to authenticated
using ((select auth.uid()) = user_id);

create policy "wardrobe_insert_own"
on public.wardrobe_items for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "wardrobe_update_own"
on public.wardrobe_items for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "wardrobe_delete_own"
on public.wardrobe_items for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "looks_select_own"
on public.saved_looks for select to authenticated
using ((select auth.uid()) = user_id);

create policy "looks_insert_own"
on public.saved_looks for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "looks_update_own"
on public.saved_looks for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "looks_delete_own"
on public.saved_looks for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "look_items_select_own"
on public.saved_look_items for select to authenticated
using ((select auth.uid()) = user_id);

create policy "look_items_insert_own"
on public.saved_look_items for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "look_items_update_own"
on public.saved_look_items for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "look_items_delete_own"
on public.saved_look_items for delete to authenticated
using ((select auth.uid()) = user_id);

-- Render jobs are written by trusted Vercel server code. Users can only inspect
-- their own job status/result metadata.
create policy "render_jobs_select_own"
on public.render_jobs for select to authenticated
using ((select auth.uid()) = user_id);

-- No client policies are intentionally defined for daily usage, global usage,
-- or render settings. RLS therefore denies all browser access; trusted server
-- code uses the service-role key.

-- ---------------------------------------------------------------------------
-- Private Storage buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 10000000, array['image/jpeg', 'image/png', 'image/webp']),
  ('wardrobe', 'wardrobe', false, 10000000, array['image/png', 'image/webp']),
  ('renders', 'renders', false, 10000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The first folder of every object path must be the authenticated user UUID.

create policy "avatars_storage_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "avatars_storage_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "avatars_storage_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "avatars_storage_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "wardrobe_storage_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'wardrobe'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "wardrobe_storage_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'wardrobe'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "wardrobe_storage_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'wardrobe'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'wardrobe'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "wardrobe_storage_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'wardrobe'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "renders_storage_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'renders'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Browser clients do not upload renders. Trusted Vercel server code writes them
-- with the service-role key. Users may only read/delete their own render files.
create policy "renders_storage_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'renders'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;
