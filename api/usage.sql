-- Optional. The Postgres path creates this table itself.
-- Run this once only if usage counts are stored through Supabase REST.

create table if not exists usage_snapshot (
  id text primary key,
  document jsonb not null
);
