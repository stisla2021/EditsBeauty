-- Optional. The Postgres path creates this table itself.
-- Run this once only if accounts are stored through Supabase REST.
-- This file stays outside api/ so it does not clash with api/account.js on Vercel.
-- password_hash is a salted scrypt hash. The password itself is not stored.

create table if not exists accounts (
  email text primary key,
  password_hash text not null,
  token_hash text not null,
  name text not null,
  photo text not null,
  looks jsonb not null
);
