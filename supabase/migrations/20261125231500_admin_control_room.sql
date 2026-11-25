-- TheLook admin control room: immutable privileged-action audit trail.
-- No client policies are created; only the service-role-backed admin API may read/write it.

begin;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null,
  actor_email text,
  action text not null check (char_length(action) between 1 and 100),
  target_type text not null check (char_length(target_type) between 1 and 80),
  target_id text,
  reason text not null check (char_length(reason) between 3 and 500),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_idx
  on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_actor_idx
  on public.admin_audit_logs (actor_user_id, created_at desc);
create index if not exists admin_audit_logs_target_idx
  on public.admin_audit_logs (target_type, target_id, created_at desc);

alter table public.admin_audit_logs enable row level security;
revoke all on public.admin_audit_logs from anon, authenticated;

comment on table public.admin_audit_logs is
  'Append-only audit trail for privileged TheLook control-room actions. Access is service-role only.';

commit;
