-- TheLook Outfit Studio persistence
-- Adds versioned canvas documents, optimistic revisions, manual Looks linkage,
-- and a private preview bucket. All ownership is derived from auth.uid().

begin;

create table if not exists public.outfit_documents (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  schema_version integer not null default 1 check (schema_version = 1),
  aspect_ratio text not null default '4:5' check (aspect_ratio in ('4:5', '3:4', '1:1', '9:16')),
  background jsonb not null default '{"type":"solid","value":"#f4f0e8"}'::jsonb check (jsonb_typeof(background) = 'object'),
  revision integer not null default 0 check (revision >= 0),
  status text not null default 'draft' check (status in ('draft', 'saved', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.outfit_document_nodes (
  id uuid primary key,
  document_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  wardrobe_item_id uuid,
  catalog_item_id text,
  wearing_role text not null check (wearing_role in ('base', 'mid', 'outer', 'bottom', 'shoe', 'accessory')),
  transform jsonb not null check (jsonb_typeof(transform) = 'object'),
  z_index smallint not null check (z_index between 0 and 11),
  item_snapshot jsonb not null check (jsonb_typeof(item_snapshot) = 'object' and not item_snapshot ? 'image'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (document_id, user_id) references public.outfit_documents(id, user_id) on delete cascade,
  foreign key (wardrobe_item_id, user_id) references public.wardrobe_items(id, user_id) on delete restrict,
  check (num_nonnulls(wardrobe_item_id, catalog_item_id) = 1),
  unique (document_id, z_index),
  unique (document_id, id)
);

create index if not exists outfit_documents_user_updated_idx
  on public.outfit_documents (user_id, updated_at desc);
create index if not exists outfit_document_nodes_document_idx
  on public.outfit_document_nodes (document_id, z_index);
create index if not exists outfit_document_nodes_user_idx
  on public.outfit_document_nodes (user_id, document_id);

drop trigger if exists outfit_documents_set_updated_at on public.outfit_documents;
create trigger outfit_documents_set_updated_at
before update on public.outfit_documents
for each row execute function public.set_updated_at();

drop trigger if exists outfit_document_nodes_set_updated_at on public.outfit_document_nodes;
create trigger outfit_document_nodes_set_updated_at
before update on public.outfit_document_nodes
for each row execute function public.set_updated_at();

alter table public.outfit_documents enable row level security;
alter table public.outfit_document_nodes enable row level security;

create policy "outfit_documents_select_own"
on public.outfit_documents for select to authenticated
using ((select auth.uid()) = user_id);

create policy "outfit_documents_insert_own"
on public.outfit_documents for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "outfit_documents_update_own"
on public.outfit_documents for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "outfit_documents_delete_own"
on public.outfit_documents for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "outfit_document_nodes_select_own"
on public.outfit_document_nodes for select to authenticated
using ((select auth.uid()) = user_id);

create policy "outfit_document_nodes_insert_own"
on public.outfit_document_nodes for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "outfit_document_nodes_update_own"
on public.outfit_document_nodes for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "outfit_document_nodes_delete_own"
on public.outfit_document_nodes for delete to authenticated
using ((select auth.uid()) = user_id);

alter table public.saved_looks
  add column if not exists origin text not null default 'generated',
  add column if not exists preview_path text,
  add column if not exists outfit_document_id uuid,
  add column if not exists analysis_status text not null default 'pending',
  add column if not exists analysis_version text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'saved_looks_origin_check') then
    alter table public.saved_looks add constraint saved_looks_origin_check
      check (origin in ('generated', 'manual', 'assistant'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'saved_looks_analysis_status_check') then
    alter table public.saved_looks add constraint saved_looks_analysis_status_check
      check (analysis_status in ('pending', 'complete', 'failed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'saved_looks_preview_path_check') then
    alter table public.saved_looks add constraint saved_looks_preview_path_check
      check (preview_path is null or preview_path like user_id::text || '/%');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'saved_looks_outfit_document_fk') then
    alter table public.saved_looks add constraint saved_looks_outfit_document_fk
      foreign key (outfit_document_id, user_id)
      references public.outfit_documents(id, user_id)
      on delete cascade;
  end if;
end;
$$;

create index if not exists saved_looks_document_idx
  on public.saved_looks (user_id, outfit_document_id)
  where outfit_document_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('look-previews', 'look-previews', false, 10000000, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "look_previews_storage_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'look-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "look_previews_storage_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'look-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function public.save_outfit_document(
  p_document_id uuid,
  p_title text,
  p_schema_version integer,
  p_aspect_ratio text,
  p_background jsonb,
  p_expected_revision integer,
  p_status text,
  p_nodes jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current_revision integer;
  v_next_revision integer;
  v_node jsonb;
  v_item_source text;
  v_item_id text;
  v_transform jsonb;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_title is null or char_length(trim(p_title)) not between 1 and 120 then raise exception 'invalid_title'; end if;
  if p_schema_version <> 1 then raise exception 'invalid_schema_version'; end if;
  if p_aspect_ratio not in ('4:5', '3:4', '1:1', '9:16') then raise exception 'invalid_aspect_ratio'; end if;
  if p_status not in ('draft', 'saved', 'archived') then raise exception 'invalid_status'; end if;
  if jsonb_typeof(p_background) <> 'object' then raise exception 'invalid_background'; end if;
  if jsonb_typeof(p_nodes) <> 'array' then raise exception 'invalid_nodes'; end if;
  if jsonb_array_length(p_nodes) > 12 then raise exception 'node_limit_exceeded'; end if;
  if p_expected_revision < 0 then raise exception 'invalid_revision'; end if;

  select revision into v_current_revision
  from public.outfit_documents
  where id = p_document_id and user_id = v_user_id
  for update;

  if not found then
    if p_expected_revision <> 0 then raise exception 'revision_conflict'; end if;
    v_next_revision := 1;
    insert into public.outfit_documents (
      id, user_id, title, schema_version, aspect_ratio, background, revision, status
    ) values (
      p_document_id, v_user_id, trim(p_title), p_schema_version, p_aspect_ratio, p_background, v_next_revision, p_status
    );
  else
    if v_current_revision <> p_expected_revision then raise exception 'revision_conflict'; end if;
    v_next_revision := v_current_revision + 1;
    update public.outfit_documents
    set title = trim(p_title),
        schema_version = p_schema_version,
        aspect_ratio = p_aspect_ratio,
        background = p_background,
        revision = v_next_revision,
        status = p_status
    where id = p_document_id and user_id = v_user_id;
  end if;

  delete from public.outfit_document_nodes
  where document_id = p_document_id and user_id = v_user_id;

  for v_node in select value from jsonb_array_elements(p_nodes)
  loop
    if jsonb_typeof(v_node) <> 'object' then raise exception 'invalid_node'; end if;
    if jsonb_typeof(v_node->'itemSnapshot') <> 'object' or (v_node->'itemSnapshot') ? 'image' then raise exception 'invalid_item_snapshot'; end if;
    if (v_node->>'wearingRole') not in ('base', 'mid', 'outer', 'bottom', 'shoe', 'accessory') then raise exception 'invalid_wearing_role'; end if;
    if jsonb_typeof(v_node->'x') <> 'number'
      or jsonb_typeof(v_node->'y') <> 'number'
      or jsonb_typeof(v_node->'width') <> 'number'
      or jsonb_typeof(v_node->'height') <> 'number'
      or jsonb_typeof(v_node->'rotation') <> 'number'
      or jsonb_typeof(v_node->'opacity') <> 'number'
      or jsonb_typeof(v_node->'zIndex') <> 'number'
      or jsonb_typeof(v_node->'flipX') <> 'boolean'
      or jsonb_typeof(v_node->'locked') <> 'boolean'
    then raise exception 'invalid_transform'; end if;
    if (v_node->>'x')::numeric not between -0.8 and 0.95
      or (v_node->>'y')::numeric not between -0.8 and 0.95
      or (v_node->>'width')::numeric not between 0.05 and 1.5
      or (v_node->>'height')::numeric not between 0.05 and 1.5
      or (v_node->>'rotation')::numeric not between -180 and 180
      or (v_node->>'opacity')::numeric not between 0 and 1
      or (v_node->>'zIndex')::integer not between 0 and 11
    then raise exception 'transform_out_of_bounds'; end if;

    v_item_source := v_node->>'itemSource';
    v_item_id := v_node->>'itemId';
    if v_item_source = 'user' then
      if not exists (
        select 1 from public.wardrobe_items
        where id = v_item_id::uuid and user_id = v_user_id
      ) then raise exception 'wardrobe_item_not_owned'; end if;
    elsif v_item_source = 'catalog' then
      if v_item_id is null or char_length(v_item_id) not between 1 and 160 then raise exception 'invalid_catalog_item'; end if;
    else
      raise exception 'invalid_item_source';
    end if;

    v_transform := jsonb_build_object(
      'x', (v_node->>'x')::numeric,
      'y', (v_node->>'y')::numeric,
      'width', (v_node->>'width')::numeric,
      'height', (v_node->>'height')::numeric,
      'rotation', (v_node->>'rotation')::numeric,
      'opacity', (v_node->>'opacity')::numeric,
      'flipX', (v_node->>'flipX')::boolean,
      'locked', (v_node->>'locked')::boolean
    );

    insert into public.outfit_document_nodes (
      id, document_id, user_id, wardrobe_item_id, catalog_item_id,
      wearing_role, transform, z_index, item_snapshot
    ) values (
      (v_node->>'id')::uuid,
      p_document_id,
      v_user_id,
      case when v_item_source = 'user' then v_item_id::uuid else null end,
      case when v_item_source = 'catalog' then v_item_id else null end,
      v_node->>'wearingRole',
      v_transform,
      (v_node->>'zIndex')::smallint,
      v_node->'itemSnapshot'
    );
  end loop;

  return v_next_revision;
end;
$$;

create or replace function public.save_manual_look(
  p_look_id uuid,
  p_document_id uuid,
  p_title text,
  p_schema_version integer,
  p_aspect_ratio text,
  p_background jsonb,
  p_expected_revision integer,
  p_nodes jsonb,
  p_preview_path text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_revision integer;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_preview_path is not null and p_preview_path not like v_user_id::text || '/%' then raise exception 'invalid_preview_path'; end if;

  select public.save_outfit_document(
    p_document_id, p_title, p_schema_version, p_aspect_ratio, p_background,
    p_expected_revision, 'saved', p_nodes
  ) into v_revision;

  insert into public.saved_looks (
    id, user_id, render_path, stylist_title, formula, cohesion, reason,
    origin, preview_path, outfit_document_id, analysis_status
  ) values (
    p_look_id, v_user_id, null, p_title, 'manual', null, null,
    'manual', p_preview_path, p_document_id, 'pending'
  )
  on conflict (id) do update
  set stylist_title = excluded.stylist_title,
      origin = 'manual',
      preview_path = excluded.preview_path,
      outfit_document_id = excluded.outfit_document_id;

  delete from public.saved_look_items
  where look_id = p_look_id and user_id = v_user_id;

  insert into public.saved_look_items (
    look_id, user_id, wardrobe_item_id, catalog_item_id,
    role, position, item_snapshot
  )
  select
    p_look_id,
    v_user_id,
    node.wardrobe_item_id,
    node.catalog_item_id,
    node.wearing_role,
    node.z_index,
    node.item_snapshot
  from public.outfit_document_nodes node
  where node.document_id = p_document_id and node.user_id = v_user_id
  order by node.z_index;

  return v_revision;
end;
$$;

revoke all on function public.save_outfit_document(uuid, text, integer, text, jsonb, integer, text, jsonb) from public;
grant execute on function public.save_outfit_document(uuid, text, integer, text, jsonb, integer, text, jsonb) to authenticated;
revoke all on function public.save_manual_look(uuid, uuid, text, integer, text, jsonb, integer, jsonb, text) from public;
grant execute on function public.save_manual_look(uuid, uuid, text, integer, text, jsonb, integer, jsonb, text) to authenticated;

commit;
