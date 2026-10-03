// Copyright (c) StISLA2021
// Sign-in stores a salted password hash, a display name, a small profile photo, and saved Looks.
// Editing photos are rejected.

import { acceptAccount, signInAccount, updateAccount } from '../account-store.js';

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(status).json(body);
};

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (origin && !allowedOrigin(origin)) {
    send(res, origin, 403, { ok: false, error: 'origin' });
    return;
  }
  if (req.method === 'OPTIONS') {
    if (origin && allowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    send(res, origin, 405, { ok: false, error: 'method' });
    return;
  }
  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
  } catch {
    send(res, origin, 400, { ok: false, error: 'json' });
    return;
  }
  const accepted = acceptAccount(body, req.headers.authorization || '');
  if (!accepted.ok) {
    send(res, origin, accepted.status, { ok: false, error: accepted.error });
    return;
  }
  try {
    const result = accepted.action === 'sign-in'
      ? await signInAccount(accepted)
      : await updateAccount(accepted);
    send(res, origin, 200, result);
  } catch (error) {
    const status = error && typeof error.status === 'number' ? error.status : 502;
    const code = status === 503 ? 'unconfigured' : status === 401 ? (error.message === 'token' ? 'token' : 'password') : 'store';
    send(res, origin, status, { ok: false, error: code });
  }
}
