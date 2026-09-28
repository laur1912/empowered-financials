-- Run once in the Supabase SQL Editor.
create table if not exists public.planner_state (
  id text primary key,
  data jsonb not null,
  rev integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Row Level Security on with no policies: the public/anon key can't read or write this table.
-- The app reads and writes it from the server with the secret key, which bypasses RLS.
alter table public.planner_state enable row level security;
