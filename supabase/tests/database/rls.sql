begin;

select plan(10);

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
