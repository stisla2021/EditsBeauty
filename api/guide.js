// Copyright (c) StISLA2021
// Groq reads the typed request and returns editor controls.
// A preview is accepted only as a short-lived JPEG and is not stored.

import { planEdit } from '../guide-plan.js';

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
  const allowed = ['message', 'state', 'history', 'preview'];
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !allowed.includes(key))) {
    send(res, origin, 400, { error: 'photo' });
    return;
  }
  try {
    const plan = await planEdit({
      message: body.message,
      state: body.state,
      history: body.history,
      preview: body.preview,
    });
    send(res, origin, 200, plan);
  } catch (error) {
    const status = error && typeof error.status === 'number' ? error.status : 502;
    const code = status === 503 ? 'unconfigured' : status === 400 && error?.message === 'photo' ? 'photo' : 'guide';
    send(res, origin, status, { error: code });
  }
}
