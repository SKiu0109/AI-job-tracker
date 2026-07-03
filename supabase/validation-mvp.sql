-- Optional persistence for the Validation MVP layer.
-- Run this in the Supabase SQL editor, then set SUPABASE_URL and
-- SUPABASE_SERVICE_ROLE_KEY in Vercel or .env.local.

create extension if not exists pgcrypto;

create table if not exists product_events (
  id uuid primary key default gen_random_uuid(),
  guest_id text not null,
  event_name text not null,
  path text not null,
  language text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  properties jsonb not null default '{}'::jsonb
);

create index if not exists product_events_event_name_idx
  on product_events (event_name);

create index if not exists product_events_received_at_idx
  on product_events (received_at desc);

create index if not exists product_events_guest_id_idx
  on product_events (guest_id);

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  guest_id text not null,
  role text,
  goal text not null,
  feedback text not null,
  email text,
  rating integer check (rating between 1 and 5),
  language text not null,
  path text not null,
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx
  on feedback (created_at desc);

create index if not exists feedback_guest_id_idx
  on feedback (guest_id);

alter table product_events enable row level security;
alter table feedback enable row level security;

drop policy if exists product_events_no_client_access on product_events;
create policy product_events_no_client_access on product_events
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists feedback_no_client_access on feedback;
create policy feedback_no_client_access on feedback
  for all
  to anon, authenticated
  using (false)
  with check (false);

create table if not exists guest_credits (
  guest_id text primary key,
  remaining integer not null default 10 check (remaining >= 0 and remaining <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guest_credits_updated_at_idx
  on guest_credits (updated_at desc);

alter table guest_credits enable row level security;

drop policy if exists guest_credits_no_client_access on guest_credits;
create policy guest_credits_no_client_access on guest_credits
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function get_or_create_guest_credit_balance(
  p_guest_id text,
  p_limit integer default 10
)
returns table (
  guest_id text,
  remaining integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into guest_credits (guest_id, remaining)
  values (p_guest_id, p_limit)
  on conflict on constraint guest_credits_pkey do nothing;

  return query
  select gc.guest_id, gc.remaining, gc.created_at, gc.updated_at
  from guest_credits gc
  where gc.guest_id = p_guest_id;
end;
$$;

create or replace function try_spend_guest_credit(
  p_guest_id text,
  p_amount integer,
  p_limit integer default 10
)
returns table (
  guest_id text,
  remaining integer,
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

  insert into guest_credits (guest_id, remaining)
  values (p_guest_id, p_limit)
  on conflict on constraint guest_credits_pkey do nothing;

  return query
  update guest_credits gc
  set
    remaining = gc.remaining - p_amount,
    updated_at = now()
  where gc.guest_id = p_guest_id
    and gc.remaining >= p_amount
  returning gc.guest_id, gc.remaining, gc.created_at, gc.updated_at;
end;
$$;

create or replace function refund_guest_credit(
  p_guest_id text,
  p_amount integer,
  p_limit integer default 10
)
returns table (
  guest_id text,
  remaining integer,
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

  insert into guest_credits (guest_id, remaining)
  values (p_guest_id, p_limit)
  on conflict on constraint guest_credits_pkey do nothing;

  return query
  update guest_credits gc
  set
    remaining = least(p_limit, gc.remaining + p_amount),
    updated_at = now()
  where gc.guest_id = p_guest_id
  returning gc.guest_id, gc.remaining, gc.created_at, gc.updated_at;
end;
$$;

revoke execute on function get_or_create_guest_credit_balance(text, integer)
  from public, anon, authenticated;
revoke execute on function try_spend_guest_credit(text, integer, integer)
  from public, anon, authenticated;
revoke execute on function refund_guest_credit(text, integer, integer)
  from public, anon, authenticated;

grant execute on function get_or_create_guest_credit_balance(text, integer)
  to service_role;
grant execute on function try_spend_guest_credit(text, integer, integer)
  to service_role;
grant execute on function refund_guest_credit(text, integer, integer)
  to service_role;

-- Client policies explicitly deny direct access. The Next.js server writes with
-- SUPABASE_SERVICE_ROLE_KEY, which must stay server-only.
