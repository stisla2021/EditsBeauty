// Copyright (c) StISLA2021
// Anonymous usage counts. Photos are rejected and are not stored.

import { acceptUsage, commentsAllowed, readUsage, saveUsage } from '../usage-store.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Usage-Key');
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Usage-Key');
    res.status(204).end();
    return;
  }
  try {
    if (req.method === 'GET') {
      send(res, origin, 200, await readUsage(commentsAllowed(req.headers['x-usage-key'])));
      return;
    }
    if (req.method !== 'POST') {
      send(res, origin, 405, { stored: false, error: 'method' });
      return;
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
    const accepted = acceptUsage(body, req.headers['x-vercel-ip-country']);
    if (!accepted.ok) {
      send(res, origin, accepted.status, { stored: false, error: accepted.error });
      return;
    }
    send(res, origin, 200, await saveUsage(accepted.record));
  } catch (error) {
    const status = error && typeof error.status === 'number' ? error.status : 502;
    send(res, origin, status, { stored: false, error: status === 503 ? 'unconfigured' : 'store' });
  }
}
