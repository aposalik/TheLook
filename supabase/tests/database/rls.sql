begin;

select plan(18);

-- Create two local test identities. The test runs as postgres, then switches to
-- the authenticated role and supplies each identity's JWT subject.
insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_anonymous
)
values
  ('00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rls-a@example.test', '', now(), now(), now(), '{}', '{}', false),
  ('00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rls-b@example.test', '', now(), now(), now(), '{}', '{}', false)
on conflict (id) do nothing;

insert into public.wardrobe_items (
  id, user_id, storage_path, title, category
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001/10000000-0000-0000-0000-000000000001.png',
    'User A shirt', 'upper'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002/10000000-0000-0000-0000-000000000002.png',
    'User B shirt', 'upper'
  )
on conflict (id) do nothing;

insert into public.outfit_documents (
  id, user_id, title, schema_version, aspect_ratio, background, revision, status
)
values (
  '20000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000002',
  'User B private outfit', 1, '4:5', '{"type":"solid","value":"#ffffff"}'::jsonb, 1, 'draft'
)
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$select title from public.wardrobe_items order by title$$,
  $$values ('User A shirt'::text)$$,
  'User A can see only User A wardrobe rows'
);
select is_empty(
  $$select 1 from public.wardrobe_items where user_id = '00000000-0000-0000-0000-000000000002'$$,
  'User A cannot read User B wardrobe rows'
);
select throws_ok(
  $$insert into public.wardrobe_items (user_id, storage_path, title, category)
    values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002/new.png', 'forbidden', 'upper')$$,
  '42501', null,
  'User A cannot insert a row owned by User B'
);

select is(
  public.save_outfit_document(
    '20000000-0000-0000-0000-000000000001',
    'User A studio outfit', 1, '4:5', '{"type":"solid","value":"#f4f0e8"}'::jsonb,
    0, 'draft',
    '[{"id":"30000000-0000-0000-0000-000000000001","itemId":"catalog-shirt","itemSource":"catalog","itemSnapshot":{"id":"catalog-shirt","slot":"top","title":"Catalog shirt","color":"#557799","palette":"cool"},"x":0.3,"y":0.1,"width":0.4,"height":0.36,"rotation":0,"zIndex":0,"opacity":1,"flipX":false,"locked":false,"wearingRole":"base"}]'::jsonb
  ),
  1,
  'User A can create a revisioned studio document through the bounded RPC'
);
select results_eq(
  $$select title from public.outfit_documents order by title$$,
  $$values ('User A studio outfit'::text)$$,
  'User A can see only User A outfit documents'
);
select is_empty(
  $$select 1 from public.outfit_documents where user_id = '00000000-0000-0000-0000-000000000002'$$,
  'User A cannot read User B outfit documents'
);
select throws_ok(
  $$insert into public.outfit_documents (id, user_id, title)
    values ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'forbidden')$$,
  '42501', null,
  'User A cannot insert an outfit document owned by User B'
);
select throws_ok(
  $$select public.save_outfit_document(
    '20000000-0000-0000-0000-000000000001', 'stale', 1, '4:5', '{"type":"solid","value":"#fff"}'::jsonb,
    0, 'draft', '[]'::jsonb
  )$$,
  'P0001', 'revision_conflict',
  'A stale expected revision is rejected'
);
select throws_ok(
  $$select public.save_outfit_document(
    '20000000-0000-0000-0000-000000000001', 'forbidden wardrobe', 1, '4:5', '{"type":"solid","value":"#fff"}'::jsonb,
    1, 'draft',
    '[{"id":"30000000-0000-0000-0000-000000000002","itemId":"10000000-0000-0000-0000-000000000002","itemSource":"user","itemSnapshot":{"id":"10000000-0000-0000-0000-000000000002","slot":"top","title":"Other shirt","color":"#000000","palette":"neutral"},"x":0.3,"y":0.1,"width":0.4,"height":0.36,"rotation":0,"zIndex":0,"opacity":1,"flipX":false,"locked":false,"wearingRole":"base"}]'::jsonb
  )$$,
  'P0001', 'wardrobe_item_not_owned',
  'The save RPC rejects another user wardrobe item'
);
select is(
  public.save_manual_look(
    '40000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'User A saved studio look', 1, '4:5', '{"type":"solid","value":"#f4f0e8"}'::jsonb,
    1,
    '[{"id":"30000000-0000-0000-0000-000000000001","itemId":"catalog-shirt","itemSource":"catalog","itemSnapshot":{"id":"catalog-shirt","slot":"top","title":"Catalog shirt","color":"#557799","palette":"cool"},"x":0.3,"y":0.1,"width":0.4,"height":0.36,"rotation":0,"zIndex":0,"opacity":1,"flipX":false,"locked":false,"wearingRole":"base"}]'::jsonb,
    null
  ),
  2,
  'Saving a manual Look advances the document revision atomically'
);
select results_eq(
  $$select origin, outfit_document_id from public.saved_looks where id = '40000000-0000-0000-0000-000000000001'$$,
  $$values ('manual'::text, '20000000-0000-0000-0000-000000000001'::uuid)$$,
  'Manual Looks remain linked to their editable document'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select results_eq(
  $$select title from public.wardrobe_items order by title$$,
  $$values ('User B shirt'::text)$$,
  'User B can see only User B wardrobe rows'
);
select is_empty(
  $$select 1 from public.wardrobe_items where user_id = '00000000-0000-0000-0000-000000000001'$$,
  'User B cannot read User A wardrobe rows'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
delete from public.wardrobe_items where user_id = '00000000-0000-0000-0000-000000000002';
set local role postgres;
select is(
  (select count(*)::integer from public.wardrobe_items where user_id = '00000000-0000-0000-0000-000000000002'),
  1,
  'User A cannot delete User B wardrobe rows'
);
set local role authenticated;

-- Server-owned usage and settings tables must remain inaccessible to the browser.
select is_empty(
  $$select 1 from public.daily_ip_usage$$,
  'Authenticated clients cannot read IP usage counters'
);
select is_empty(
  $$select 1 from public.daily_user_usage$$,
  'Authenticated clients cannot read user usage counters'
);
select is_empty(
  $$select 1 from public.global_usage$$,
  'Authenticated clients cannot read global usage counters'
);
select is_empty(
  $$select 1 from public.render_settings$$,
  'Authenticated clients cannot read render settings'
);

select finish();
rollback;
