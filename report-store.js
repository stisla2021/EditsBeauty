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
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (url && token) return saveRedis(url, token, record);
  if (process.env.VERCEL) {
    const error = new Error('unconfigured');
    error.status = 503;
    throw error;
  }
  return saveFile(record);
};
