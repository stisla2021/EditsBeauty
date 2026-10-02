// Copyright (c) StISLA2021
// Groq reads the typed request and returns editor controls. The photo is not accepted.

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
  if (body.image || body.photo || body.pixels || body.dataUrl || body.file) {
    send(res, origin, 400, { error: 'photo' });
    return;
  }
  try {
    const plan = await planEdit({
      message: body.message,
      state: body.state,
      history: body.history,
    });
    send(res, origin, 200, plan);
  } catch (error) {
    const status = error && typeof error.status === 'number' ? error.status : 502;
    send(res, origin, status, { error: status === 503 ? 'unconfigured' : 'guide' });
  }
}
