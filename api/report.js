// Copyright (c) StISLA2021
// Stores a diagnostic report after the app has already asked the person to confirm.
// Photos are rejected. On Vercel, connect Postgres (POSTGRES_URL or DATABASE_URL)
// or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Optional RESEND_API_KEY
// emails a copy to stisla2021@gmail.com. Until a database is set, this replies unconfigured.

import { acceptReport, saveReport } from '../report-store.js';

const allowedOrigin = (origin) => {
  if (!origin) return true;
  if (origin === 'https://editsbeauty.vercel.app') return true;
  if (origin === 'https://stisla2021.github.io') return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
};

const send = (res, origin, status, body) => {
  if (origin && allowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.status(status).json(body);
};

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (origin && !allowedOrigin(origin)) {
    send(res, origin, 403, { error: 'origin' });
    return;
  }
  if (req.method === 'OPTIONS') {
    if (origin && allowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    send(res, origin, 405, { error: 'method' });
    return;
  }
  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
  } catch {
    send(res, origin, 400, { error: 'json' });
    return;
  }
  const accepted = acceptReport(body);
  if (!accepted.ok) {
    send(res, origin, accepted.status, { stored: false, error: accepted.error });
    return;
  }
  try {
    const saved = await saveReport(accepted.record);
    send(res, origin, 200, saved);
  } catch (error) {
    const status = error && typeof error.status === 'number' ? error.status : 502;
    send(res, origin, status, { stored: false, error: status === 503 ? 'unconfigured' : 'store' });
  }
};
