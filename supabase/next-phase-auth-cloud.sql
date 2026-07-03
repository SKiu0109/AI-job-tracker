-- Next phase schema for Supabase Auth, account tiers, monthly credits,
-- and cloud sync of jobs/profile/analysis cache.
-- Run after enabling Supabase Auth providers in the Supabase Dashboard.

create table if not exists user_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  account_type text not null default 'free'
    check (account_type in ('free', 'paid')),
  monthly_credit_limit integer not null default 20 check (monthly_credit_limit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_accounts_email_idx
  on user_accounts (lower(email));

create table if not exists user_monthly_credits (
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  remaining integer not null check (remaining >= 0),
  monthly_limit integer not null check (monthly_limit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start)
);

create index if not exists user_monthly_credits_user_period_idx
  on user_monthly_credits (user_id, period_start desc);

create table if not exists cloud_jobs (
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index if not exists cloud_jobs_user_updated_at_idx
  on cloud_jobs (user_id, updated_at desc);

create table if not exists cloud_candidate_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists cloud_analysis_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, cache_key)
);

create index if not exists cloud_analysis_cache_user_created_at_idx
  on cloud_analysis_cache (user_id, created_at desc);

alter table user_accounts enable row level security;
alter table user_monthly_credits enable row level security;
alter table cloud_jobs enable row level security;
alter table cloud_candidate_profiles enable row level security;
alter table cloud_analysis_cache enable row level security;

drop policy if exists user_accounts_select_own on user_accounts;
create policy user_accounts_select_own on user_accounts
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists user_monthly_credits_select_own on user_monthly_credits;
create policy user_monthly_credits_select_own on user_monthly_credits
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists cloud_jobs_crud_own on cloud_jobs;
create policy cloud_jobs_crud_own on cloud_jobs
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists cloud_candidate_profiles_crud_own on cloud_candidate_profiles;
create policy cloud_candidate_profiles_crud_own on cloud_candidate_profiles
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists cloud_analysis_cache_crud_own on cloud_analysis_cache;
create policy cloud_analysis_cache_crud_own on cloud_analysis_cache
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop function if exists get_or_create_user_monthly_credit_balance(uuid, date, integer);
drop function if exists try_spend_user_monthly_credit(uuid, date, integer, integer);
drop function if exists refund_user_monthly_credit(uuid, date, integer, integer);

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
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_monthly_credits (user_id, period_start, remaining, monthly_limit)
  values (p_user_id, p_period_start, p_monthly_limit, p_monthly_limit)
  on conflict on constraint user_monthly_credits_pkey do nothing;

  return query
  select umc.user_id, umc.period_start, umc.remaining, umc.monthly_limit,
    umc.created_at, umc.updated_at
  from user_monthly_credits umc
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
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_amount <= 0 then
    raise exception 'Credit spend amount must be positive.';
  end if;

  insert into user_monthly_credits (user_id, period_start, remaining, monthly_limit)
  values (p_user_id, p_period_start, p_monthly_limit, p_monthly_limit)
  on conflict on constraint user_monthly_credits_pkey do nothing;

  return query
  update user_monthly_credits umc
  set
    remaining = umc.remaining - p_amount,
    updated_at = now()
  where umc.user_id = p_user_id
    and umc.period_start = p_period_start
    and umc.remaining >= p_amount
  returning umc.user_id, umc.period_start, umc.remaining, umc.monthly_limit,
    umc.created_at, umc.updated_at;
end;
$$;

create or replace function refund_user_monthly_credit(
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
    raise exception 'Credit refund amount must be positive.';
  end if;

  insert into user_monthly_credits (user_id, period_start, remaining, monthly_limit)
  values (p_user_id, p_period_start, p_monthly_limit, p_monthly_limit)
  on conflict on constraint user_monthly_credits_pkey do nothing;

  return query
  update user_monthly_credits umc
  set
    remaining = least(umc.monthly_limit, umc.remaining + p_amount),
    updated_at = now()
  where umc.user_id = p_user_id
    and umc.period_start = p_period_start
  returning umc.user_id, umc.period_start, umc.remaining, umc.monthly_limit,
    umc.created_at, umc.updated_at;
end;
$$;

revoke execute on function get_or_create_user_monthly_credit_balance(uuid, date, integer)
  from public, anon, authenticated;
revoke execute on function try_spend_user_monthly_credit(uuid, date, integer, integer)
  from public, anon, authenticated;
revoke execute on function refund_user_monthly_credit(uuid, date, integer, integer)
  from public, anon, authenticated;

grant execute on function get_or_create_user_monthly_credit_balance(uuid, date, integer)
  to service_role;
grant execute on function try_spend_user_monthly_credit(uuid, date, integer, integer)
  to service_role;
grant execute on function refund_user_monthly_credit(uuid, date, integer, integer)
  to service_role;
