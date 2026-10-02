// Copyright (c) StISLA2021
// Anonymous usage counts and star ratings. Photos, names, and emails are rejected.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const tools = new Set([
  'Adjust', 'Filters', 'Crop', 'Retouch', 'Smooth', 'Teeth', 'Background', 'Camera',
  'Stickers', 'Narrow', 'Enhance', 'Cutout', 'Text', 'Brushes',
]);
const browsers = new Set(['Chrome', 'Safari', 'Firefox', 'Edge', 'Samsung', 'Opera', 'Other']);
const kinds = new Set(['visit', 'install', 'tool', 'guide', 'vision', 'session', 'rating']);
const forbiddenKey = /image|photo|pixel|dataurl|canvas|landmark|face|file|email|name/i;

const empty = () => ({
  days: {},
  installs: [],
  tools: {},
  guide: 0,
  vision: 0,
  sessionCount: 0,
  sessionSeconds: 0,
  ratings: [],
});

const dayKey = (date) => date.toISOString().slice(0, 10);

const hashVisitor = (id) => createHash('sha256').update(id).digest('hex').slice(0, 24);

const cleanComment = (value) => String(value ?? '')
  .replace(/data:[^\s)"']+/gi, '')
  .replace(/blob:[^\s)"']+/gi, '')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 280);

const countryCode = (header) => {
  const code = String(header ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : 'unknown';
};

export const acceptUsage = (body, countryHeader) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, status: 400, error: 'json' };
  const keys = Object.keys(body);
  if (keys.some((key) => !['visitor', 'device', 'browser', 'events'].includes(key) || forbiddenKey.test(key))) {
    return { ok: false, status: 400, error: 'field' };
  }
  if (typeof body.visitor !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.visitor)) {
    return { ok: false, status: 400, error: 'visitor' };
  }
  if (body.device !== 'mobile' && body.device !== 'desktop') return { ok: false, status: 400, error: 'device' };
  if (!browsers.has(body.browser)) return { ok: false, status: 400, error: 'browser' };
  if (!Array.isArray(body.events) || body.events.length < 1 || body.events.length > 8) {
    return { ok: false, status: 400, error: 'events' };
  }
  const events = [];
  for (const event of body.events) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) return { ok: false, status: 400, error: 'field' };
    if (Object.keys(event).some((key) => forbiddenKey.test(key) || !['kind', 'tool', 'seconds', 'stars', 'comment'].includes(key))) {
      return { ok: false, status: 400, error: 'field' };
    }
    if (!kinds.has(event.kind)) return { ok: false, status: 400, error: 'kind' };
    const next = { kind: event.kind };
    if (event.kind === 'tool') {
      if (!tools.has(event.tool)) return { ok: false, status: 400, error: 'tool' };
      next.tool = event.tool;
    }
    if (event.kind === 'session') {
      const seconds = Number(event.seconds);
      if (!Number.isInteger(seconds) || seconds < 15 || seconds > 1800) return { ok: false, status: 400, error: 'seconds' };
      next.seconds = seconds;
    }
    if (event.kind === 'rating') {
      const stars = Number(event.stars);
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false, status: 400, error: 'stars' };
      next.stars = stars;
      next.comment = cleanComment(event.comment);
    }
    events.push(next);
  }
  return {
    ok: true,
    record: {
      visitor: hashVisitor(body.visitor.toLowerCase()),
      device: body.device,
      browser: body.browser,
      country: countryCode(countryHeader),
      events,
    },
  };
};

const bucketFor = (doc, day) => {
  if (!doc.days[day]) doc.days[day] = { visitors: [], devices: { mobile: 0, desktop: 0 }, browsers: {}, countries: {} };
  return doc.days[day];
};

const prune = (doc, today) => {
  const cutoff = new Date(`${today}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 40);
  const limit = cutoff.toISOString().slice(0, 10);
  Object.keys(doc.days).forEach((day) => {
    if (day < limit) delete doc.days[day];
  });
  doc.ratings = doc.ratings.slice(0, 100);
  if (doc.installs.length > 20000) doc.installs = doc.installs.slice(-20000);
};

export const applyUsage = (doc, record, today = dayKey(new Date())) => {
  const next = doc && typeof doc === 'object' ? doc : empty();
  if (!next.days) next.days = {};
  if (!Array.isArray(next.installs)) next.installs = [];
  if (!next.tools) next.tools = {};
  if (!Array.isArray(next.ratings)) next.ratings = [];
  const bucket = bucketFor(next, today);
  if (!bucket.visitors.includes(record.visitor)) {
    if (bucket.visitors.length < 5000) bucket.visitors.push(record.visitor);
    bucket.devices[record.device] = (bucket.devices[record.device] || 0) + 1;
    bucket.browsers[record.browser] = (bucket.browsers[record.browser] || 0) + 1;
    bucket.countries[record.country] = (bucket.countries[record.country] || 0) + 1;
  }
  record.events.forEach((event) => {
    if (event.kind === 'tool') next.tools[event.tool] = (next.tools[event.tool] || 0) + 1;
    if (event.kind === 'guide') next.guide = (next.guide || 0) + 1;
    if (event.kind === 'vision') next.vision = (next.vision || 0) + 1;
    if (event.kind === 'install' && !next.installs.includes(record.visitor)) next.installs.push(record.visitor);
    if (event.kind === 'session') {
      next.sessionCount = (next.sessionCount || 0) + 1;
      next.sessionSeconds = (next.sessionSeconds || 0) + event.seconds;
    }
    if (event.kind === 'rating') {
      next.ratings = next.ratings.filter((item) => item.visitor !== record.visitor);
      next.ratings.unshift({ visitor: record.visitor, stars: event.stars, comment: event.comment, at: new Date().toISOString() });
    }
  });
  prune(next, today);
  return next;
};

const uniqueSince = (doc, today, days) => {
  const start = new Date(`${today}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const limit = start.toISOString().slice(0, 10);
  const seen = new Set();
  Object.entries(doc.days || {}).forEach(([day, bucket]) => {
    if (day < limit || day > today) return;
    (bucket.visitors || []).forEach((visitor) => seen.add(visitor));
  });
  return seen.size;
};

const sumMaps = (doc, today, field) => {
  const start = new Date(`${today}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  const limit = start.toISOString().slice(0, 10);
  const totals = {};
  Object.entries(doc.days || {}).forEach(([day, bucket]) => {
    if (day < limit || day > today) return;
    Object.entries(bucket[field] || {}).forEach(([key, value]) => {
      totals[key] = (totals[key] || 0) + Number(value || 0);
    });
  });
  return totals;
};

export const summarizeUsage = (doc, today = dayKey(new Date()), includeComments = false) => {
  const source = doc && typeof doc === 'object' ? doc : empty();
  const ratings = Array.isArray(source.ratings) ? source.ratings : [];
  const stars = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  ratings.forEach((item) => {
    if (stars[item.stars] != null) {
      stars[item.stars] += 1;
      sum += item.stars;
    }
  });
  const sessions = Number(source.sessionCount || 0);
  return {
    daily: uniqueSince(source, today, 1),
    weekly: uniqueSince(source, today, 7),
    monthly: uniqueSince(source, today, 30),
    installs: Array.isArray(source.installs) ? source.installs.length : 0,
    tools: source.tools || {},
    guide: Number(source.guide || 0),
    vision: Number(source.vision || 0),
    devices: sumMaps(source, today, 'devices'),
    browsers: sumMaps(source, today, 'browsers'),
    countries: sumMaps(source, today, 'countries'),
    sessionCount: sessions,
    averageSessionSeconds: sessions ? Math.round(Number(source.sessionSeconds || 0) / sessions) : 0,
    ratings: {
      count: ratings.length,
      average: ratings.length ? Math.round((sum / ratings.length) * 10) / 10 : 0,
      stars,
      comments: includeComments
        ? ratings.filter((item) => item.comment).slice(0, 30).map((item) => ({ stars: item.stars, comment: item.comment, at: item.at }))
        : [],
    },
  };
};

const filePath = () => resolve('data/usage.json');

const readFileDoc = () => {
  const file = filePath();
  if (!existsSync(file)) return empty();
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : empty();
  } catch {
    return empty();
  }
};

const writeFileDoc = (doc) => {
  const file = filePath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(doc));
};

let snapshotReady = false;

const postgresSql = async (connectionString) => {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString);
  if (!snapshotReady) {
    await sql`
      create table if not exists usage_snapshot (
        id text primary key,
        document jsonb not null
      )`;
    snapshotReady = true;
  }
  return sql;
};

const readPostgres = async (connectionString) => {
  const sql = await postgresSql(connectionString);
  const rows = await sql`select document from usage_snapshot where id = 'current'`;
  const document = rows[0]?.document;
  if (typeof document === 'string') {
    try {
      const parsed = JSON.parse(document);
      return parsed && typeof parsed === 'object' ? parsed : empty();
    } catch {
      return empty();
    }
  }
  return document && typeof document === 'object' ? document : empty();
};

const writePostgres = async (connectionString, doc) => {
  const sql = await postgresSql(connectionString);
  const payload = JSON.stringify(doc);
  await sql`
    insert into usage_snapshot (id, document)
    values ('current', ${payload}::jsonb)
    on conflict (id) do update set document = excluded.document`;
};

const supabaseHeaders = (key) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
});

const readSupabase = async (url, key) => {
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/usage_snapshot?id=eq.current&select=document`, {
    headers: supabaseHeaders(key),
  });
  if (!response.ok) {
    const error = new Error('store');
    error.status = 502;
    throw error;
  }
  const rows = await response.json();
  const document = rows?.[0]?.document;
  return document && typeof document === 'object' ? document : empty();
};

const writeSupabase = async (url, key, doc) => {
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/usage_snapshot`;
  const headers = { ...supabaseHeaders(key), Prefer: 'resolution=merge-duplicates,return=minimal' };
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: 'current', document: doc }),
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

const readRedis = async (url, token) => {
  const payload = await redisCommand(url, token, ['GET', 'editsbeauty:usage']);
  if (!payload?.result) return empty();
  try {
    const parsed = JSON.parse(payload.result);
    return parsed && typeof parsed === 'object' ? parsed : empty();
  } catch {
    return empty();
  }
};

const writeRedis = async (url, token, doc) => {
  await redisCommand(url, token, ['SET', 'editsbeauty:usage', JSON.stringify(doc)]);
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

const readDoc = async (store) => {
  if (store.kind === 'postgres') return readPostgres(store.postgresUrl);
  if (store.kind === 'supabase') return readSupabase(store.supabaseUrl, store.supabaseKey);
  if (store.kind === 'redis') return readRedis(store.redisUrl, store.redisToken);
  return readFileDoc();
};

const writeDoc = async (store, doc) => {
  if (store.kind === 'postgres') return writePostgres(store.postgresUrl, doc);
  if (store.kind === 'supabase') return writeSupabase(store.supabaseUrl, store.supabaseKey, doc);
  if (store.kind === 'redis') return writeRedis(store.redisUrl, store.redisToken, doc);
  writeFileDoc(doc);
};

export const saveUsage = async (record) => {
  const store = backend();
  if (!store) {
    const error = new Error('unconfigured');
    error.status = 503;
    throw error;
  }
  const next = applyUsage(await readDoc(store), record);
  await writeDoc(store, next);
  return { stored: true };
};

export const readUsage = async (includeComments) => {
  const store = backend();
  if (!store) {
    const error = new Error('unconfigured');
    error.status = 503;
    throw error;
  }
  return summarizeUsage(await readDoc(store), dayKey(new Date()), includeComments);
};

export const commentsAllowed = (header) => {
  const key = process.env.USAGE_VIEW_KEY || '';
  if (!key) return !process.env.VERCEL;
  return header === key;
};
