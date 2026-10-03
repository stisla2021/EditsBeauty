// Copyright (c) StISLA2021
// Email sign-in. The password is checked and stored only as a salted hash.
// Editing photos are rejected. A profile photo must be a small JPEG.

import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

const scryptHash = promisify(scrypt);
const allowedKeys = new Set(['action', 'email', 'password', 'name', 'photo', 'looks']);
const forbidden = /canvas|landmark|pixel|dataurl|file|edit/i;

const emailOf = (value) => {
  const email = String(value ?? '').trim().toLowerCase();
  if (!/^[^\s@]{1,64}@[^\s@]{1,80}$/.test(email) || email.length > 80) return '';
  return email;
};

const cleanName = (value) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);

const cleanPhoto = (value) => {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') return null;
  if (value.length > 30000) return null;
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
  return value;
};

const cleanLooks = (value) => {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 12) return null;
  const looks = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    if (Object.keys(item).some((key) => !['name', 'look', 'smooth'].includes(key))) return null;
    const look = String(item.look ?? '');
    const smooth = String(item.smooth ?? '0');
    if (!/^[\w-]{1,40}$/.test(look) || !/^\d{1,3}$/.test(smooth)) return null;
    looks.push({
      name: cleanName(item.name) || look,
      look,
      smooth,
    });
  }
  return looks;
};

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

const passwordHash = async (password, salt) => {
  const derived = await scryptHash(password, salt, 32);
  return `scrypt$${salt.toString('hex')}$${Buffer.from(derived).toString('hex')}`;
};

const passwordMatches = async (password, stored) => {
  const parts = String(stored ?? '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  if (salt.length < 8 || expected.length !== 32) return false;
  const derived = Buffer.from(await scryptHash(password, salt, 32));
  return timingSafeEqual(derived, expected);
};

const publicAccount = (record, token) => ({
  ok: true,
  email: record.email,
  name: record.name,
  photo: record.photo,
  looks: record.looks,
  token,
});

const emptyDoc = () => ({ accounts: {} });

export const acceptAccount = (body, tokenHeader) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, status: 400, error: 'json' };
  const keys = Object.keys(body);
  if (keys.some((key) => !allowedKeys.has(key) || forbidden.test(key))) return { ok: false, status: 400, error: 'field' };
  const action = body.action === 'update' ? 'update' : body.action === 'sign-in' ? 'sign-in' : '';
  if (!action) return { ok: false, status: 400, error: 'action' };
  const email = emailOf(body.email);
  if (action === 'sign-in') {
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || password.length < 6 || password.length > 80) return { ok: false, status: 400, error: 'password' };
    const name = cleanName(body.name);
    return { ok: true, action, email, password, name };
  }
  const token = String(tokenHeader ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) return { ok: false, status: 401, error: 'token' };
  const photo = body.photo === undefined ? undefined : cleanPhoto(body.photo);
  const looks = body.looks === undefined ? undefined : cleanLooks(body.looks);
  const name = body.name === undefined ? undefined : cleanName(body.name);
  if (photo === null || looks === null) return { ok: false, status: 400, error: 'field' };
  return { ok: true, action, token, name, photo, looks };
};

const filePath = () => resolve('data/accounts.json');

const readFileDoc = () => {
  const file = filePath();
  if (!existsSync(file)) return emptyDoc();
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : emptyDoc();
  } catch {
    return emptyDoc();
  }
};

const writeFileDoc = (doc) => {
  const file = filePath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(doc));
};

let tableReady = false;

const postgresSql = async (connectionString) => {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString);
  if (!tableReady) {
    await sql`
      create table if not exists accounts (
        email text primary key,
        password_hash text not null,
        token_hash text not null,
        name text not null,
        photo text not null,
        looks jsonb not null
      )`;
    tableReady = true;
  }
  return sql;
};

const rowToRecord = (row) => {
  if (!row) return null;
  let looks = row.looks;
  if (typeof looks === 'string') {
    try {
      looks = JSON.parse(looks);
    } catch {
      looks = [];
    }
  }
  return {
    email: row.email,
    passwordHash: row.password_hash,
    tokenHash: row.token_hash,
    name: row.name,
    photo: row.photo || '',
    looks: Array.isArray(looks) ? looks : [],
  };
};

const readPostgres = async (connectionString, email) => {
  const sql = await postgresSql(connectionString);
  const rows = await sql`select email, password_hash, token_hash, name, photo, looks from accounts where email = ${email}`;
  return rowToRecord(rows[0]);
};

const readPostgresByToken = async (connectionString, tokenHash) => {
  const sql = await postgresSql(connectionString);
  const rows = await sql`select email, password_hash, token_hash, name, photo, looks from accounts where token_hash = ${tokenHash}`;
  return rowToRecord(rows[0]);
};

const writePostgres = async (connectionString, record) => {
  const sql = await postgresSql(connectionString);
  const looks = JSON.stringify(record.looks);
  await sql`
    insert into accounts (email, password_hash, token_hash, name, photo, looks)
    values (${record.email}, ${record.passwordHash}, ${record.tokenHash}, ${record.name}, ${record.photo}, ${looks}::jsonb)
    on conflict (email) do update set
      password_hash = excluded.password_hash,
      token_hash = excluded.token_hash,
      name = excluded.name,
      photo = excluded.photo,
      looks = excluded.looks`;
};

const supabaseHeaders = (key) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
});

const readSupabase = async (url, key, email) => {
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/accounts?email=eq.${encodeURIComponent(email)}&select=email,password_hash,token_hash,name,photo,looks`, {
    headers: supabaseHeaders(key),
  });
  if (!response.ok) {
    const error = new Error('store');
    error.status = 502;
    throw error;
  }
  const rows = await response.json();
  return rowToRecord(rows?.[0]);
};

const readSupabaseByToken = async (url, key, tokenHash) => {
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/accounts?token_hash=eq.${encodeURIComponent(tokenHash)}&select=email,password_hash,token_hash,name,photo,looks`, {
    headers: supabaseHeaders(key),
  });
  if (!response.ok) {
    const error = new Error('store');
    error.status = 502;
    throw error;
  }
  const rows = await response.json();
  return rowToRecord(rows?.[0]);
};

const writeSupabase = async (url, key, record) => {
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/accounts`, {
    method: 'POST',
    headers: { ...supabaseHeaders(key), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      email: record.email,
      password_hash: record.passwordHash,
      token_hash: record.tokenHash,
      name: record.name,
      photo: record.photo,
      looks: record.looks,
    }),
  });
  if (!response.ok) {
    const error = new Error('store');
    error.status = 502;
    throw error;
  }
};

const redisCommand = async (url, token, command) => {
  const response = await fetch(url.replace(/\/$/, ''), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!response.ok) {
    const error = new Error('store');
    error.status = 502;
    throw error;
  }
  return response.json();
};

const readRedisDoc = async (url, token) => {
  const payload = await redisCommand(url, token, ['GET', 'editsbeauty:accounts']);
  if (!payload?.result) return emptyDoc();
  try {
    const parsed = JSON.parse(payload.result);
    return parsed && typeof parsed === 'object' ? parsed : emptyDoc();
  } catch {
    return emptyDoc();
  }
};

const backend = () => {
  const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || '';
  if (postgresUrl) return { kind: 'postgres', postgresUrl };
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (supabaseUrl && supabaseKey) return { kind: 'supabase', supabaseUrl, supabaseKey };
  const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (redisUrl && redisToken) return { kind: 'redis', redisUrl, redisToken };
  if (!process.env.VERCEL) return { kind: 'file' };
  return null;
};

const readAccount = async (store, email) => {
  if (store.kind === 'postgres') return readPostgres(store.postgresUrl, email);
  if (store.kind === 'supabase') return readSupabase(store.supabaseUrl, store.supabaseKey, email);
  const doc = store.kind === 'redis' ? await readRedisDoc(store.redisUrl, store.redisToken) : readFileDoc();
  return doc.accounts?.[email] ?? null;
};

const readByToken = async (store, tokenHash) => {
  if (store.kind === 'postgres') return readPostgresByToken(store.postgresUrl, tokenHash);
  if (store.kind === 'supabase') return readSupabaseByToken(store.supabaseUrl, store.supabaseKey, tokenHash);
  const doc = store.kind === 'redis' ? await readRedisDoc(store.redisUrl, store.redisToken) : readFileDoc();
  return Object.values(doc.accounts || {}).find((item) => item && item.tokenHash === tokenHash) ?? null;
};

const writeAccount = async (store, record) => {
  if (store.kind === 'postgres') {
    await writePostgres(store.postgresUrl, record);
    return;
  }
  if (store.kind === 'supabase') {
    await writeSupabase(store.supabaseUrl, store.supabaseKey, record);
    return;
  }
  const doc = store.kind === 'redis' ? await readRedisDoc(store.redisUrl, store.redisToken) : readFileDoc();
  if (!doc.accounts) doc.accounts = {};
  doc.accounts[record.email] = record;
  const emails = Object.keys(doc.accounts);
  if (emails.length > 5000) delete doc.accounts[emails[0]];
  if (store.kind === 'redis') await redisCommand(store.redisUrl, store.redisToken, ['SET', 'editsbeauty:accounts', JSON.stringify(doc)]);
  else writeFileDoc(doc);
};

export const signInAccount = async ({ email, password, name }) => {
  const store = backend();
  if (!store) {
    const error = new Error('unconfigured');
    error.status = 503;
    throw error;
  }
  const normalized = emailOf(email);
  if (!normalized) {
    const error = new Error('password');
    error.status = 400;
    throw error;
  }
  const existing = await readAccount(store, normalized);
  const token = randomBytes(32).toString('hex');
  if (!existing) {
    const record = {
      email: normalized,
      passwordHash: await passwordHash(password, randomBytes(16)),
      tokenHash: hashToken(token),
      name: name || email,
      photo: '',
      looks: [],
    };
    await writeAccount(store, record);
    return publicAccount(record, token);
  }
  if (!(await passwordMatches(password, existing.passwordHash))) {
    const error = new Error('password');
    error.status = 401;
    throw error;
  }
  const record = {
    ...existing,
    tokenHash: hashToken(token),
    name: name || existing.name || normalized,
  };
  await writeAccount(store, record);
  return publicAccount(record, token);
};

export const updateAccount = async ({ token, name, photo, looks }) => {
  const store = backend();
  if (!store) {
    const error = new Error('unconfigured');
    error.status = 503;
    throw error;
  }
  const existing = await readByToken(store, hashToken(token));
  if (!existing) {
    const error = new Error('token');
    error.status = 401;
    throw error;
  }
  const record = {
    ...existing,
    name: name === undefined ? existing.name : (name || existing.name),
    photo: photo === undefined ? existing.photo : photo,
    looks: looks === undefined ? existing.looks : looks,
  };
  await writeAccount(store, record);
  return publicAccount(record, token);
};
