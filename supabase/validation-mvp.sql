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

-- No anon/client policies are created intentionally. The Next.js server writes
-- with SUPABASE_SERVICE_ROLE_KEY, which must stay server-only.
