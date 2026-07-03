-- Production hardening for Pathwise credits, rate limits, and server cache.
-- Run after validation-mvp.sql, next-phase-auth-cloud.sql, and
-- redemption-codes.sql.

create extension if not exists pgcrypto;

-- ============================================================
-- Persistent API rate limits
-- ============================================================

create table if not exists api_rate_limits (
  scope text not null,
  identity_hash text not null,
  window_start timestamptz not null,
  hit_count integer not null default 0 check (hit_count >= 0),
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (scope, identity_hash, window_start)
);

create index if not exists api_rate_limits_updated_at_idx
  on api_rate_limits (updated_at desc);

alter table api_rate_limits enable row level security;

drop policy if exists api_rate_limits_no_client_access on api_rate_limits;
create policy api_rate_limits_no_client_access on api_rate_limits
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function check_api_rate_limit(
  p_scope text,
  p_identity_hash text,
  p_window_seconds integer,
  p_limit integer
)
returns table (
  allowed boolean,
  hit_count integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_hit_count integer;
begin
  if p_window_seconds <= 0 or p_limit <= 0 then
    raise exception 'Rate limit window and limit must be positive.';
  end if;

  v_window_start :=
    to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);

  insert into api_rate_limits (scope, identity_hash, window_start, hit_count)
  values (p_scope, p_identity_hash, v_window_start, 1)
  on conflict (scope, identity_hash, window_start)
  do update set
    hit_count = api_rate_limits.hit_count + 1,
    updated_at = now()
  returning api_rate_limits.hit_count into v_hit_count;

  delete from api_rate_limits
  where updated_at < v_now - interval '2 days';

  return query select
    v_hit_count <= p_limit,
    v_hit_count,
    greatest(
      1,
      ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - v_now)))::integer
    );
end;
$$;

revoke execute on function check_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function check_api_rate_limit(text, text, integer, integer)
  to service_role;

-- ============================================================
-- Permanent bonus credit wallet and guest credit migration
-- ============================================================

create table if not exists user_credit_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bonus_remaining integer not null default 0 check (bonus_remaining >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guest_credit_migrations (
  guest_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  migrated_amount integer not null default 0 check (migrated_amount >= 0),
  created_at timestamptz not null default now()
);

create index if not exists guest_credit_migrations_user_idx
  on guest_credit_migrations (user_id, created_at desc);

alter table user_credit_wallets enable row level security;
alter table guest_credit_migrations enable row level security;

drop policy if exists user_credit_wallets_select_own on user_credit_wallets;
create policy user_credit_wallets_select_own on user_credit_wallets
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists guest_credit_migrations_no_client_access on guest_credit_migrations;
create policy guest_credit_migrations_no_client_access on guest_credit_migrations
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop function if exists get_or_create_user_monthly_credit_balance(uuid, date, integer);
drop function if exists try_spend_user_monthly_credit(uuid, date, integer, integer);
drop function if exists refund_user_monthly_credit(uuid, date, integer, integer);
drop function if exists refund_user_monthly_credit(uuid, date, integer, integer, integer, integer);
drop function if exists add_user_bonus_credits(uuid, date, integer, integer);
drop function if exists migrate_guest_credits_to_user(text, uuid, date, integer);

create or replace function get_or_create_user_monthly_credit_balance(
  p_user_id uuid,
  p_period_start date,
  p_monthly_limit integer default 20
)
returns table (
  user_id uuid,
  period_start date,
  remaining integer,
  monthly_limit integer,
  created_at timestamptz,
  updated_at timestamptz,
  monthly_remaining integer,
  bonus_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_monthly_credits (user_id, period_start, remaining, monthly_limit)
  values (p_user_id, p_period_start, p_monthly_limit, p_monthly_limit)
  on conflict on constraint user_monthly_credits_pkey do nothing;

  insert into user_credit_wallets (user_id, bonus_remaining)
  values (p_user_id, 0)
  on conflict on constraint user_credit_wallets_pkey do nothing;

  return query
  select
    umc.user_id,
    umc.period_start,
    umc.remaining + ucw.bonus_remaining,
    umc.monthly_limit,
    umc.created_at,
    greatest(umc.updated_at, ucw.updated_at),
    umc.remaining,
    ucw.bonus_remaining
  from user_monthly_credits umc
  join user_credit_wallets ucw on ucw.user_id = umc.user_id
  where umc.user_id = p_user_id
    and umc.period_start = p_period_start;
end;
$$;

create or replace function try_spend_user_monthly_credit(
  p_user_id uuid,
  p_period_start date,
  p_amount integer,
  p_monthly_limit integer default 20
)
returns table (
  user_id uuid,
  period_start date,
  remaining integer,
  monthly_limit integer,
  created_at timestamptz,
  updated_at timestamptz,
  monthly_remaining integer,
  bonus_remaining integer,
  spent_monthly integer,
  spent_bonus integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_monthly_remaining integer;
  v_bonus_remaining integer;
  v_spent_monthly integer;
  v_spent_bonus integer;
begin
  if p_amount <= 0 then
    raise exception 'Credit spend amount must be positive.';
  end if;

  insert into user_monthly_credits (user_id, period_start, remaining, monthly_limit)
  values (p_user_id, p_period_start, p_monthly_limit, p_monthly_limit)
  on conflict on constraint user_monthly_credits_pkey do nothing;

  insert into user_credit_wallets (user_id, bonus_remaining)
  values (p_user_id, 0)
  on conflict on constraint user_credit_wallets_pkey do nothing;

  select umc.remaining, ucw.bonus_remaining
  into v_monthly_remaining, v_bonus_remaining
  from user_monthly_credits umc
  join user_credit_wallets ucw on ucw.user_id = umc.user_id
  where umc.user_id = p_user_id
    and umc.period_start = p_period_start
  for update of umc, ucw;

  if v_monthly_remaining + v_bonus_remaining < p_amount then
    return;
  end if;

  v_spent_monthly := least(v_monthly_remaining, p_amount);
  v_spent_bonus := p_amount - v_spent_monthly;

  update user_monthly_credits
  set
    remaining = user_monthly_credits.remaining - v_spent_monthly,
    updated_at = now()
  where user_monthly_credits.user_id = p_user_id
    and user_monthly_credits.period_start = p_period_start;

  update user_credit_wallets
  set
    bonus_remaining = user_credit_wallets.bonus_remaining - v_spent_bonus,
    updated_at = now()
  where user_credit_wallets.user_id = p_user_id;

  return query
  select
    umc.user_id,
    umc.period_start,
    umc.remaining + ucw.bonus_remaining,
    umc.monthly_limit,
    umc.created_at,
    greatest(umc.updated_at, ucw.updated_at),
    umc.remaining,
    ucw.bonus_remaining,
    v_spent_monthly,
    v_spent_bonus
  from user_monthly_credits umc
  join user_credit_wallets ucw on ucw.user_id = umc.user_id
  where umc.user_id = p_user_id
    and umc.period_start = p_period_start;
end;
$$;

create or replace function refund_user_monthly_credit(
  p_user_id uuid,
  p_period_start date,
  p_amount integer,
  p_monthly_limit integer default 20,
  p_monthly_amount integer default null,
  p_bonus_amount integer default null
)
returns table (
  user_id uuid,
  period_start date,
  remaining integer,
  monthly_limit integer,
  created_at timestamptz,
  updated_at timestamptz,
  monthly_remaining integer,
  bonus_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund_monthly integer := coalesce(p_monthly_amount, p_amount);
  v_refund_bonus integer := coalesce(p_bonus_amount, 0);
begin
  if p_amount <= 0 then
    raise exception 'Credit refund amount must be positive.';
  end if;

  insert into user_monthly_credits (user_id, period_start, remaining, monthly_limit)
  values (p_user_id, p_period_start, p_monthly_limit, p_monthly_limit)
  on conflict on constraint user_monthly_credits_pkey do nothing;

  insert into user_credit_wallets (user_id, bonus_remaining)
  values (p_user_id, 0)
  on conflict on constraint user_credit_wallets_pkey do nothing;

  update user_monthly_credits
  set
    remaining = least(
      user_monthly_credits.monthly_limit,
      user_monthly_credits.remaining + greatest(0, v_refund_monthly)
    ),
    updated_at = now()
  where user_monthly_credits.user_id = p_user_id
    and user_monthly_credits.period_start = p_period_start;

  update user_credit_wallets
  set
    bonus_remaining = user_credit_wallets.bonus_remaining + greatest(0, v_refund_bonus),
    updated_at = now()
  where user_credit_wallets.user_id = p_user_id;

  return query
  select
    umc.user_id,
    umc.period_start,
    umc.remaining + ucw.bonus_remaining,
    umc.monthly_limit,
    umc.created_at,
    greatest(umc.updated_at, ucw.updated_at),
    umc.remaining,
    ucw.bonus_remaining
  from user_monthly_credits umc
  join user_credit_wallets ucw on ucw.user_id = umc.user_id
  where umc.user_id = p_user_id
    and umc.period_start = p_period_start;
end;
$$;

create or replace function add_user_bonus_credits(
  p_user_id uuid,
  p_period_start date,
  p_amount integer,
  p_monthly_limit integer default 20
)
returns table (
  user_id uuid,
  period_start date,
  remaining integer,
  monthly_limit integer,
  created_at timestamptz,
  updated_at timestamptz,
  monthly_remaining integer,
  bonus_remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then
    raise exception 'Credit add amount must be positive.';
  end if;

  insert into user_monthly_credits (user_id, period_start, remaining, monthly_limit)
  values (p_user_id, p_period_start, p_monthly_limit, p_monthly_limit)
  on conflict on constraint user_monthly_credits_pkey do nothing;

  insert into user_credit_wallets (user_id, bonus_remaining)
  values (p_user_id, p_amount)
  on conflict on constraint user_credit_wallets_pkey
  do update set
    bonus_remaining = user_credit_wallets.bonus_remaining + excluded.bonus_remaining,
    updated_at = now();

  return query
  select
    umc.user_id,
    umc.period_start,
    umc.remaining + ucw.bonus_remaining,
    umc.monthly_limit,
    umc.created_at,
    greatest(umc.updated_at, ucw.updated_at),
    umc.remaining,
    ucw.bonus_remaining
  from user_monthly_credits umc
  join user_credit_wallets ucw on ucw.user_id = umc.user_id
  where umc.user_id = p_user_id
    and umc.period_start = p_period_start;
end;
$$;

create or replace function migrate_guest_credits_to_user(
  p_guest_id text,
  p_user_id uuid,
  p_period_start date,
  p_monthly_limit integer default 20
)
returns table (
  migrated boolean,
  migrated_amount integer,
  remaining integer,
  monthly_limit integer,
  monthly_remaining integer,
  bonus_remaining integer,
  period_start date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest_remaining integer := 0;
  v_inserted boolean := false;
  v_inserted_count integer := 0;
begin
  if p_guest_id is null or length(trim(p_guest_id)) = 0 then
    raise exception 'Guest id is required.';
  end if;

  insert into user_monthly_credits (user_id, period_start, remaining, monthly_limit)
  values (p_user_id, p_period_start, p_monthly_limit, p_monthly_limit)
  on conflict on constraint user_monthly_credits_pkey do nothing;

  insert into user_credit_wallets (user_id, bonus_remaining)
  values (p_user_id, 0)
  on conflict on constraint user_credit_wallets_pkey do nothing;

  select gc.remaining
  into v_guest_remaining
  from guest_credits gc
  where gc.guest_id = p_guest_id
  for update;

  v_guest_remaining := greatest(0, coalesce(v_guest_remaining, 0));

  insert into guest_credit_migrations (guest_id, user_id, migrated_amount)
  values (p_guest_id, p_user_id, v_guest_remaining)
  on conflict on constraint guest_credit_migrations_pkey do nothing;

  get diagnostics v_inserted_count = row_count;
  v_inserted := v_inserted_count > 0;

  if v_inserted and v_guest_remaining > 0 then
    update user_credit_wallets
    set
      bonus_remaining = user_credit_wallets.bonus_remaining + v_guest_remaining,
      updated_at = now()
    where user_credit_wallets.user_id = p_user_id;

    update guest_credits
    set
      remaining = 0,
      updated_at = now()
    where guest_credits.guest_id = p_guest_id;
  end if;

  if not v_inserted then
    select gcm.migrated_amount
    into v_guest_remaining
    from guest_credit_migrations gcm
    where gcm.guest_id = p_guest_id;
  end if;

  return query
  select
    v_inserted and v_guest_remaining > 0,
    v_guest_remaining,
    umc.remaining + ucw.bonus_remaining,
    umc.monthly_limit,
    umc.remaining,
    ucw.bonus_remaining,
    umc.period_start
  from user_monthly_credits umc
  join user_credit_wallets ucw on ucw.user_id = umc.user_id
  where umc.user_id = p_user_id
    and umc.period_start = p_period_start;
end;
$$;

-- Keep the older admin helper name, but make it add permanent bonus credits.
create or replace function add_user_monthly_credits(
  p_user_id uuid,
  p_period_start date,
  p_amount integer,
  p_monthly_limit integer default 20
)
returns table (
  user_id uuid,
  period_start date,
  remaining integer,
  monthly_limit integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    bonus.user_id,
    bonus.period_start,
    bonus.remaining,
    bonus.monthly_limit,
    bonus.created_at,
    bonus.updated_at
  from add_user_bonus_credits(
    p_user_id,
    p_period_start,
    p_amount,
    p_monthly_limit
  ) bonus;
end;
$$;

-- Replace redeem_code so code rewards are permanent bonus wallet credits.
create or replace function redeem_code(
  p_code text,
  p_user_id uuid,
  p_period_start date,
  p_monthly_limit integer default 20
)
returns table (
  success boolean,
  code_id uuid,
  credit_amount integer,
  new_remaining integer,
  error_message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code redemption_codes%rowtype;
begin
  p_code := upper(trim(p_code));

  select rc.* into v_code
  from redemption_codes rc
  where upper(rc.code) = p_code
  for update;

  if not found then
    return query select false, null::uuid, 0, 0,
      '兑换码不存在或已失效'::text;
    return;
  end if;

  if not v_code.is_active then
    return query select false, v_code.id, v_code.credit_amount, 0,
      '该兑换码已被停用'::text;
    return;
  end if;

  if v_code.expires_at is not null and v_code.expires_at < now() then
    return query select false, v_code.id, v_code.credit_amount, 0,
      '该兑换码已过期'::text;
    return;
  end if;

  if v_code.used_count >= v_code.max_uses then
    return query select false, v_code.id, v_code.credit_amount, 0,
      '该兑换码使用次数已达上限'::text;
    return;
  end if;

  perform 1 from code_redemptions cr
  where cr.code_id = v_code.id and cr.user_id = p_user_id
  limit 1;

  if found then
    return query select false, v_code.id, v_code.credit_amount, 0,
      '您已兑换过该兑换码'::text;
    return;
  end if;

  update redemption_codes rc
  set used_count = rc.used_count + 1
  where rc.id = v_code.id;

  insert into code_redemptions (code_id, code, user_id, credit_amount)
  values (v_code.id, v_code.code, p_user_id, v_code.credit_amount);

  perform 1 from add_user_bonus_credits(
    p_user_id,
    p_period_start,
    v_code.credit_amount,
    p_monthly_limit
  );

  return query
  select
    true,
    v_code.id,
    v_code.credit_amount,
    balance.remaining,
    null::text
  from get_or_create_user_monthly_credit_balance(
    p_user_id,
    p_period_start,
    p_monthly_limit
  ) balance;
end;
$$;

revoke execute on function get_or_create_user_monthly_credit_balance(uuid, date, integer)
  from public, anon, authenticated;
revoke execute on function try_spend_user_monthly_credit(uuid, date, integer, integer)
  from public, anon, authenticated;
revoke execute on function refund_user_monthly_credit(uuid, date, integer, integer, integer, integer)
  from public, anon, authenticated;
revoke execute on function add_user_bonus_credits(uuid, date, integer, integer)
  from public, anon, authenticated;
revoke execute on function migrate_guest_credits_to_user(text, uuid, date, integer)
  from public, anon, authenticated;
revoke execute on function add_user_monthly_credits(uuid, date, integer, integer)
  from public, anon, authenticated;
revoke execute on function redeem_code(text, uuid, date, integer)
  from public, anon, authenticated;

grant execute on function get_or_create_user_monthly_credit_balance(uuid, date, integer)
  to service_role;
grant execute on function try_spend_user_monthly_credit(uuid, date, integer, integer)
  to service_role;
grant execute on function refund_user_monthly_credit(uuid, date, integer, integer, integer, integer)
  to service_role;
grant execute on function add_user_bonus_credits(uuid, date, integer, integer)
  to service_role;
grant execute on function migrate_guest_credits_to_user(text, uuid, date, integer)
  to service_role;
grant execute on function add_user_monthly_credits(uuid, date, integer, integer)
  to service_role;
grant execute on function redeem_code(text, uuid, date, integer)
  to service_role;

-- ============================================================
-- Server-side public analysis cache
-- ============================================================

create table if not exists server_analysis_cache (
  cache_key text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists server_analysis_cache_expires_at_idx
  on server_analysis_cache (expires_at);

alter table server_analysis_cache enable row level security;

drop policy if exists server_analysis_cache_no_client_access on server_analysis_cache;
create policy server_analysis_cache_no_client_access on server_analysis_cache
  for all
  to anon, authenticated
  using (false)
  with check (false);
