-- TheLook Phase E: atomic quota reservation
-- Adds the reserve_render_quota() function called by the Vercel tryon-look route.
-- Uses the service-role key (bypasses RLS) — the route verifies ownership first.

begin;

-- ---------------------------------------------------------------------------
-- reserve_render_quota(p_user_id, p_fingerprint, p_ip_hash)
--
-- Atomically:
--   1. Reads render_settings (kill switch + limits).
--   2. Checks global daily + total unit budgets.
--   3. Checks per-user daily limit.
--   4. Checks for an existing completed render with this fingerprint (cache).
--   5. Checks for an in-flight render with this fingerprint (dedup lock).
--   6. Inserts a queued render_job row (acts as the in-flight lock).
--   7. Increments daily_user_usage, daily_ip_usage, global_usage.
--
-- Returns a JSON object:
--   { "ok": true,  "job_id": "<uuid>", "remaining": <int> }   -- reserved
--   { "ok": false, "reason": "<code>", "cached_path": "<text>" | null }  -- rejected
--
-- Reason codes: disabled | global_budget | user_limit | in_flight | cached
-- ---------------------------------------------------------------------------

create or replace function public.reserve_render_quota(
  p_user_id   uuid,
  p_fingerprint text,   -- sha256 hex of photo+items
  p_ip_hash   text,     -- hmac-sha256 hex of trusted x-forwarded-for
  p_avatar_id uuid,
  p_items     jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings        public.render_settings%rowtype;
  v_today           date := current_date;
  v_global_today    integer;
  v_global_total    integer;
  v_user_today      integer;
  v_existing_path   text;
  v_in_flight       boolean;
  v_job_id          uuid := gen_random_uuid();
  v_remaining       integer;
begin
  -- 1. Read settings (single row, id = true)
  select * into v_settings from public.render_settings where id = true;

  -- Kill switch
  if not v_settings.real_tryon_enabled then
    return jsonb_build_object('ok', false, 'reason', 'disabled');
  end if;

  -- 2. Global daily limit
  select coalesce(try_on_count, 0) into v_global_today
    from public.global_usage where day = v_today;
  if v_global_today >= v_settings.global_daily_tryon_limit then
    return jsonb_build_object('ok', false, 'reason', 'global_budget');
  end if;

  -- Global total unit budget (sum all time)
  select coalesce(sum(youcam_units), 0) into v_global_total from public.global_usage;
  if v_global_total >= v_settings.global_total_unit_limit then
    return jsonb_build_object('ok', false, 'reason', 'global_budget');
  end if;

  -- 3. Per-user daily limit
  select coalesce(try_on_count, 0) into v_user_today
    from public.daily_user_usage where day = v_today and user_id = p_user_id;
  if v_user_today >= v_settings.user_daily_tryon_limit then
    return jsonb_build_object('ok', false, 'reason', 'user_limit',
      'remaining', 0,
      'reset_utc', (v_today + interval '1 day')::text);
  end if;

  -- 4. Cache hit — completed render with same fingerprint
  select result_path into v_existing_path
    from public.render_jobs
    where user_id = p_user_id
      and fingerprint = p_fingerprint
      and status = 'completed'
    limit 1;
  if v_existing_path is not null then
    return jsonb_build_object('ok', false, 'reason', 'cached', 'cached_path', v_existing_path);
  end if;

  -- 5. In-flight dedup — queued/uploading/rendering job with same fingerprint
  select exists(
    select 1 from public.render_jobs
    where user_id = p_user_id
      and fingerprint = p_fingerprint
      and status in ('queued', 'uploading', 'rendering_upper', 'rendering_lower', 'saving')
  ) into v_in_flight;
  if v_in_flight then
    return jsonb_build_object('ok', false, 'reason', 'in_flight');
  end if;

  -- 6. Insert queued render_job (in-flight lock)
  insert into public.render_jobs (id, user_id, avatar_id, fingerprint, status, selected_items)
  values (v_job_id, p_user_id, p_avatar_id, p_fingerprint, 'queued', p_items);

  -- 7. Increment counters (upsert)
  insert into public.daily_user_usage (day, user_id, try_on_count, youcam_units)
  values (v_today, p_user_id, 1, 0)
  on conflict (day, user_id) do update
    set try_on_count = public.daily_user_usage.try_on_count + 1,
        updated_at   = now();

  insert into public.daily_ip_usage (day, ip_hash, try_on_count, youcam_units)
  values (v_today, p_ip_hash, 1, 0)
  on conflict (day, ip_hash) do update
    set try_on_count = public.daily_ip_usage.try_on_count + 1,
        updated_at   = now();

  insert into public.global_usage (day, try_on_count, youcam_units)
  values (v_today, 1, 0)
  on conflict (day) do update
    set try_on_count = public.global_usage.try_on_count + 1,
        updated_at   = now();

  v_remaining := v_settings.user_daily_tryon_limit - v_user_today - 1;

  return jsonb_build_object(
    'ok',        true,
    'job_id',    v_job_id,
    'remaining', v_remaining
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- complete_render_job(p_job_id, p_result_path, p_units)
-- Mark a job completed and record actual YouCam units consumed.
-- ---------------------------------------------------------------------------

create or replace function public.complete_render_job(
  p_job_id     uuid,
  p_result_path text,
  p_units      integer default 1
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := current_date;
  v_user_id uuid;
  v_fingerprint text;
begin
  select user_id, fingerprint into v_user_id, v_fingerprint
    from public.render_jobs where id = p_job_id;

  update public.render_jobs
    set status       = 'completed',
        result_path  = p_result_path,
        youcam_units = p_units,
        completed_at = now()
    where id = p_job_id;

  -- Record actual units
  update public.daily_user_usage
    set youcam_units = youcam_units + p_units, updated_at = now()
    where day = v_today and user_id = v_user_id;

  update public.global_usage
    set youcam_units = youcam_units + p_units, updated_at = now()
    where day = v_today;
end;
$$;

-- ---------------------------------------------------------------------------
-- fail_render_job(p_job_id, p_error_code, p_error_message)
-- Mark a job failed and refund the quota reservation.
-- ---------------------------------------------------------------------------

create or replace function public.fail_render_job(
  p_job_id        uuid,
  p_error_code    text default 'unknown',
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today   date := current_date;
  v_user_id uuid;
  v_ip_hash text;
begin
  select user_id into v_user_id from public.render_jobs where id = p_job_id;

  update public.render_jobs
    set status        = 'failed',
        error_code    = p_error_code,
        error_message = p_error_message
    where id = p_job_id;

  -- Refund the reservation so the user keeps their allowance
  update public.daily_user_usage
    set try_on_count = greatest(0, try_on_count - 1), updated_at = now()
    where day = v_today and user_id = v_user_id;

  update public.global_usage
    set try_on_count = greatest(0, try_on_count - 1), updated_at = now()
    where day = v_today;
end;
$$;

commit;
