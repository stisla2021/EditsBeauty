-- Run once in Vercel Postgres or the Supabase SQL editor.
-- The app creates this table itself when POSTGRES_URL or DATABASE_URL is set.
-- Supabase REST storage needs the table first.

create table if not exists diagnostic_reports (
  id text primary key,
  created_at timestamptz not null,
  version text not null,
  browser_name text not null,
  browser_version text not null,
  device text not null,
  screen_size text not null,
  tool text not null,
  error text not null,
  stack text not null,
  description text not null
);
