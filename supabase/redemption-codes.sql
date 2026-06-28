-- Redemption codes: admin-issued codes that users can redeem for extra
-- analysis credits. Run this in the Supabase SQL editor after the auth
-- schema (next-phase-auth-cloud.sql) is in place.

create extension if not exists pgcrypto;

-- ============================================================
-- Tables
-- ============================================================

create table if not exists redemption_codes (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  credit_amount integer not null check (credit_amount > 0),
  max_uses      integer not null default 1 check (max_uses > 0),
  used_count    integer not null default 0 check (used_count >= 0),
  is_active     boolean not null default true,
  expires_at    timestamptz,
  note          text,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint chk_redemption_code_uses check (used_count <= max_uses)
);

create index if not exists redemption_codes_code_idx
  on redemption_codes (lower(code));

create index if not exists redemption_codes_created_at_idx
  on redemption_codes (created_at desc);

create table if not exists code_redemptions (
  id            uuid primary key default gen_random_uuid(),
  code_id       uuid not null references redemption_codes(id),
  code          text not null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  credit_amount integer not null,
  redeemed_at   timestamptz not null default now()
);

create index if not exists code_redemptions_user_idx
  on code_redemptions (user_id, redeemed_at desc);

create index if not exists code_redemptions_code_id_idx
  on code_redemptions (code_id);

-- ============================================================
-- RLS
-- ============================================================

alter table redemption_codes enable row level security;
alter table code_redemptions enable row level security;

-- Users can read own redemptions; admins bypass via service_role.
drop policy if exists code_redemptions_select_own on code_redemptions;
create policy code_redemptions_select_own on code_redemptions
  for select
  to authenticated
  using (user_id = auth.uid());

-- No anon/client write policies. All writes go through Next.js server
-- with SUPABASE_SERVICE_ROLE_KEY.

-- ============================================================
-- RPC: add credits to user_monthly_credits (no cap)
-- ============================================================

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
  if p_amount <= 0 then
    raise exception 'Credit add amount must be positive.';
  end if;

  -- Lazy-create the period row if it doesn't exist
  insert into user_monthly_credits (user_id, period_start, remaining, monthly_limit)
  values (p_user_id, p_period_start, p_monthly_limit, p_monthly_limit)
  on conflict (user_id, period_start) do nothing;

  -- Add credits, raising the limit so the bonus isn't capped
  return query
  update user_monthly_credits umc
  set
    remaining = umc.remaining + p_amount,
    monthly_limit = umc.monthly_limit + p_amount,
    updated_at = now()
  where umc.user_id = p_user_id
    and umc.period_start = p_period_start
  returning umc.user_id, umc.period_start, umc.remaining, umc.monthly_limit,
    umc.created_at, umc.updated_at;
end;
$$;

-- ============================================================
-- RPC: redeem a code (atomic)
-- ============================================================

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
  v_redemption_id uuid;
begin
  -- Normalise code input
  p_code := upper(trim(p_code));

  -- Look up the code with a row lock
  select * into v_code
  from redemption_codes
  where upper(code) = p_code
  for update;

  if not found then
    return query select false, null::uuid, 0, 0,
      '兑换码不存在或已失效'::text;
    return;
  end if;

  -- Validate
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

  -- Check user hasn't already redeemed this code
  perform 1 from code_redemptions
  where code_id = v_code.id and user_id = p_user_id
  limit 1;

  if found then
    return query select false, v_code.id, v_code.credit_amount, 0,
      '您已兑换过该兑换码'::text;
    return;
  end if;

  -- Increment used_count
  update redemption_codes
  set used_count = used_count + 1
  where id = v_code.id;

  -- Record the redemption
  insert into code_redemptions (code_id, code, user_id, credit_amount)
  values (v_code.id, v_code.code, p_user_id, v_code.credit_amount);

  -- Add credits to user's monthly pool (no cap)
  insert into user_monthly_credits (user_id, period_start, remaining, monthly_limit)
  values (p_user_id, p_period_start, p_monthly_limit, p_monthly_limit)
  on conflict (user_id, period_start) do nothing;

  update user_monthly_credits
  set
    remaining = remaining + v_code.credit_amount,
    monthly_limit = monthly_limit + v_code.credit_amount,
    updated_at = now()
  where user_id = p_user_id
    and period_start = p_period_start;

  -- Return success with new balance
  return query
  select
    true,
    v_code.id,
    v_code.credit_amount,
    umc.remaining,
    null::text
  from user_monthly_credits umc
  where umc.user_id = p_user_id
    and umc.period_start = p_period_start;
end;
$$;

-- ============================================================
-- Permissions: only service_role can execute
-- ============================================================

revoke execute on function add_user_monthly_credits(uuid, date, integer, integer)
  from anon, authenticated;
revoke execute on function redeem_code(text, uuid, date, integer)
  from anon, authenticated;

grant execute on function add_user_monthly_credits(uuid, date, integer, integer)
  to service_role;
grant execute on function redeem_code(text, uuid, date, integer)
  to service_role;
