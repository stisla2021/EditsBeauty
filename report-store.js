// Copyright (c) StISLA2021
// Accepts a diagnostic report and nothing else. Photos, canvas data, and face landmarks are rejected.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const allowedKeys = new Set(['version', 'browser', 'device', 'screenSize', 'tool', 'error', 'stack', 'description']);
const forbiddenKey = /image|photo|pixel|dataurl|canvas|landmark|face|file|email|name/i;

const clean = (value, max) => String(value ?? '')
  .replace(/data:[^\s)"']+/gi, '[removed]')
  .replace(/blob:[^\s)"']+/gi, '[removed]')
  .replace(/iVBORw0KGgo[A-Za-z0-9+/=]*/g, '[removed]')
  .replace(/\/9j\/[A-Za-z0-9+/=]+/g, '[removed]')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const textField = (value, max) => {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') return null;
  return clean(value, max);
};

export const acceptReport = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, status: 400, error: 'json' };
  const keys = Object.keys(body);
  if (keys.some((key) => !allowedKeys.has(key) || forbiddenKey.test(key))) return { ok: false, status: 400, error: 'field' };
  const version = textField(body.version, 16);
  const tool = textField(body.tool, 80);
  const error = textField(body.error, 500);
  const stack = textField(body.stack, 1500);
  const description = textField(body.description, 400);
  const screenSize = textField(body.screenSize, 24);
  if ([version, tool, error, stack, description, screenSize].some((item) => item == null)) {
    return { ok: false, status: 400, error: 'field' };
  }
  if (!/^\d+\.\d+\.\d+$/.test(version)) return { ok: false, status: 400, error: 'version' };
  if (body.device !== 'mobile' && body.device !== 'desktop') return { ok: false, status: 400, error: 'device' };
  if (!/^\d{2,5}×\d{2,5}$/.test(screenSize)) return { ok: false, status: 400, error: 'screen' };
  const browser = body.browser;
  if (!browser || typeof browser !== 'object' || Array.isArray(browser)) return { ok: false, status: 400, error: 'browser' };
  if (Object.keys(browser).some((key) => key !== 'name' && key !== 'version')) return { ok: false, status: 400, error: 'browser' };
  const name = textField(browser.name, 40);
  const browserVersion = textField(browser.version, 20);
  if (name == null || browserVersion == null || !name) return { ok: false, status: 400, error: 'browser' };
  return {
    ok: true,
    record: {
      id: crypto.randomUUID(),
      version,
      browser: { name, version: browserVersion },
      device: body.device,
      screenSize,
      tool,
      error,
      stack,
      description,
      timestamp: new Date().toISOString(),
    },
  };
};

const reportMessage = (record) => [
  'EditsBeauty diagnostic report',
  `App version: ${record.version}`,
  `Browser: ${record.browser.name} ${record.browser.version}`.trim(),
  `Device: ${record.device}`,
  `Screen size: ${record.screenSize}`,
  `Tool or screen: ${record.tool || 'Unknown'}`,
  `Error: ${record.error || 'None'}`,
  `Stack: ${record.stack || 'None'}`,
  `Note: ${record.description || 'None'}`,
  `Timestamp: ${record.timestamp}`,
  'The photo, canvas, and face landmarks are not included.',
].join('\n');

let reportsTableReady = false;

const savePostgres = async (connectionString, record) => {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(connectionString);
  if (!reportsTableReady) {
    await sql`
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
      )`;
    reportsTableReady = true;
  }
  await sql`
    insert into diagnostic_reports (
      id, created_at, version, browser_name, browser_version, device, screen_size, tool, error, stack, description
    ) values (
      ${record.id},
      ${record.timestamp},
      ${record.version},
      ${record.browser.name},
      ${record.browser.version},
      ${record.device},
      ${record.screenSize},
      ${record.tool},
      ${record.error},
      ${record.stack},
      ${record.description}
    )`;
  return { stored: true, id: record.id };
};

const saveSupabase = async (url, key, record) => {
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/diagnostic_reports`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      id: record.id,
      created_at: record.timestamp,
      version: record.version,
      browser_name: record.browser.name,
      browser_version: record.browser.version,
      device: record.device,
      screen_size: record.screenSize,
      tool: record.tool,
      error: record.error,
      stack: record.stack,
      description: record.description,
    }),
  });
  if (!response.ok) {
    const error = new Error('store');
    error.status = 502;
    throw error;
  }
  return { stored: true, id: record.id };
};

const emailReport = async (record) => {
  const key = process.env.RESEND_API_KEY || '';
  if (!key) return false;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.REPORT_EMAIL_FROM || 'EditsBeauty <onboarding@resend.dev>',
        to: ['stisla2021@gmail.com'],
        subject: 'EditsBeauty diagnostic report',
        text: reportMessage(record),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
};

const saveRedis = async (url, token, record) => {
  const endpoint = url.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const pushed = await fetch(`${endpoint}/lpush/editsbeauty:reports`, {
    method: 'POST',
    headers,
    body: JSON.stringify([JSON.stringify(record)]),
  });
  if (!pushed.ok) {
    const error = new Error('store');
    error.status = 502;
    throw error;
  }
  await fetch(`${endpoint}/ltrim/editsbeauty:reports/0/199`, { method: 'POST', headers });
  return { stored: true, id: record.id };
};

const saveFile = (record) => {
  const file = resolve('data/reports.json');
  mkdirSync(dirname(file), { recursive: true });
  const current = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  const reports = Array.isArray(current) ? current : [];
  reports.unshift(record);
  writeFileSync(file, JSON.stringify(reports.slice(0, 200), null, 2));
  return { stored: true, id: record.id };
};

export const saveReport = async (record) => {
  const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || '';
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  let saved;
  if (postgresUrl) saved = await savePostgres(postgresUrl, record);
  else if (supabaseUrl && supabaseKey) saved = await saveSupabase(supabaseUrl, supabaseKey, record);
  else if (redisUrl && redisToken) saved = await saveRedis(redisUrl, redisToken, record);
  else if (!process.env.VERCEL) saved = saveFile(record);
  else {
    const error = new Error('unconfigured');
    error.status = 503;
    throw error;
  }
  const emailed = await emailReport(record);
  return { ...saved, emailed };
};
