-- Optional. The Postgres path creates this table itself.
-- Run this once only if usage counts are stored through Supabase REST.
-- This file stays outside api/ so it does not clash with api/usage.js on Vercel.

create table if not exists usage_snapshot (
  id text primary key,
  document jsonb not null
);
