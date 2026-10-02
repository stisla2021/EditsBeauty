// Copyright (c) StISLA2021
// Anonymous counts only. The photo, name, and email are never sent.

const visitorKey = 'editsbeauty-visitor';
const visitDayKey = 'editsbeauty-visit-day';
const installKey = 'editsbeauty-install-counted';
const firstSeenKey = 'editsbeauty-first-seen';
const editCountKey = 'editsbeauty-edit-count';
const ratedKey = 'editsbeauty-rated';
const dismissedKey = 'editsbeauty-rating-dismissed';
const sessionStartKey = 'editsbeauty-session-start';
const sessionMarkKey = 'editsbeauty-session-mark';

const tools = new Set([
  'Adjust', 'Filters', 'Crop', 'Retouch', 'Smooth', 'Teeth', 'Background', 'Camera',
  'Stickers', 'Narrow', 'Enhance', 'Cutout', 'Text', 'Brushes',
]);

type UsageEvent = {
  kind: 'visit' | 'install' | 'tool' | 'guide' | 'vision' | 'session' | 'rating';
  tool?: string;
  seconds?: number;
  stars?: number;
  comment?: string;
};

const queue: UsageEvent[] = [];
let flushTimer = 0;
let editTimer = 0;
const recentTools = new Map<string, number>();

const read = (key: string): string => {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};

const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Counts stay on this visit if storage is blocked.
  }
};

const visitorId = (): string => {
  const current = read(visitorKey);
  if (/^[0-9a-f-]{36}$/i.test(current)) return current;
  const next = crypto.randomUUID();
  write(visitorKey, next);
  return next;
};

const browserName = (): string => {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung';
  if (/Firefox\/|FxiOS/.test(ua)) return 'Firefox';
  if (/Chrome\/|CriOS/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
};

const deviceKind = (): 'mobile' | 'desktop' => (
  window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820 ? 'mobile' : 'desktop'
);

const usageEndpoint = (): string => {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === 'editsbeauty.vercel.app') return new URL('/api/usage', window.location.origin).href;
  return 'https://editsbeauty.vercel.app/api/usage';
};

const flush = (): void => {
  window.clearTimeout(flushTimer);
  flushTimer = 0;
  if (!queue.length) return;
  const events = queue.splice(0, 8);
  const body = JSON.stringify({
    visitor: visitorId(),
    device: deviceKind(),
    browser: browserName(),
    events,
  });
  if (body.length > 6000) return;
  void fetch(usageEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
};

const enqueue = (event: UsageEvent): void => {
  queue.push(event);
  if (queue.length >= 8) {
    flush();
    return;
  }
  if (!flushTimer) flushTimer = window.setTimeout(flush, 2500);
};

export const noteTool = (name: string): void => {
  if (!tools.has(name)) return;
  const now = Date.now();
  if (now - (recentTools.get(name) ?? 0) < 800) return;
  recentTools.set(name, now);
  enqueue({ kind: 'tool', tool: name });
};

export const noteGuide = (): void => {
  enqueue({ kind: 'guide' });
};

export const noteVision = (): void => {
  enqueue({ kind: 'vision' });
};

export const noteInstall = (): void => {
  if (read(installKey) === '1') return;
  write(installKey, '1');
  enqueue({ kind: 'install' });
  flush();
};

export const noteEdit = (): void => {
  window.clearTimeout(editTimer);
  editTimer = window.setTimeout(() => {
    const count = Number(read(editCountKey) || '0') + 1;
    write(editCountKey, String(Number.isFinite(count) ? count : 1));
    maybeAsk(true);
  }, 450);
};

let askScheduled = false;

const daysSince = (stamp: string): number => {
  const then = Date.parse(stamp);
  if (!Number.isFinite(then)) return 0;
  return Math.floor((Date.now() - then) / 86400000);
};

const maybeAsk = (fromEdit: boolean): void => {
  if (!/index\.html$|\/$/.test(window.location.pathname) && window.location.pathname !== '') return;
  if (read(ratedKey) === '1') return;
  if (document.getElementById('ratingDialog')) return;
  try {
    if (sessionStorage.getItem('editsbeauty-rating-shown') === '1') return;
  } catch {
    return;
  }
  const dismissed = Date.parse(read(dismissedKey));
  if (Number.isFinite(dismissed) && Date.now() - dismissed < 21 * 86400000) return;
  const edits = Number(read(editCountKey) || '0');
  const days = daysSince(read(firstSeenKey));
  const ready = edits >= 5 || (days >= 3 && edits >= 1);
  if (!ready || askScheduled) return;
  askScheduled = true;
  window.setTimeout(showRating, fromEdit ? 700 : 12000);
};

const showRating = (): void => {
  if (document.getElementById('ratingDialog') || read(ratedKey) === '1') return;
  try {
    sessionStorage.setItem('editsbeauty-rating-shown', '1');
  } catch {
    return;
  }
  const dialog = document.createElement('div');
  dialog.className = 'confirm-dialog';
  dialog.id = 'ratingDialog';
  dialog.innerHTML = `
    <div class="confirm-card rating-card" role="dialog" aria-labelledby="ratingTitle">
      <h2 id="ratingTitle">How is EditsBeauty?</h2>
      <p>A quick rating helps improve the editor. The photo is not included.</p>
      <div class="rating-stars" role="radiogroup" aria-label="Rating from 1 to 5">
        <button type="button" data-stars="1" aria-label="1 star">1</button>
        <button type="button" data-stars="2" aria-label="2 stars">2</button>
        <button type="button" data-stars="3" aria-label="3 stars">3</button>
        <button type="button" data-stars="4" aria-label="4 stars">4</button>
        <button type="button" data-stars="5" aria-label="5 stars">5</button>
      </div>
      <label class="rating-note">Optional note<textarea maxlength="280" placeholder="What should work better?"></textarea></label>
      <div class="confirm-actions">
        <button type="button" id="ratingDismiss">Not now</button>
        <button type="button" id="ratingSend">Send</button>
      </div>
    </div>`;
  document.body.append(dialog);
  let stars = 0;
  dialog.querySelectorAll<HTMLButtonElement>('[data-stars]').forEach((button) => {
    button.addEventListener('click', () => {
      stars = Number(button.dataset.stars);
      dialog.querySelectorAll('[data-stars]').forEach((item) => item.classList.toggle('is-on', Number((item as HTMLButtonElement).dataset.stars) <= stars));
    });
  });
  const close = (rememberDismiss: boolean): void => {
    if (rememberDismiss) write(dismissedKey, new Date().toISOString());
    dialog.remove();
  };
  dialog.querySelector('#ratingDismiss')?.addEventListener('click', () => close(true));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close(true);
  });
  dialog.querySelector('#ratingSend')?.addEventListener('click', () => {
    if (stars < 1) return;
    const comment = dialog.querySelector('textarea')?.value ?? '';
    enqueue({ kind: 'rating', stars, comment });
    flush();
    write(ratedKey, '1');
    close(false);
  });
};

const noteSession = (): void => {
  let start = Date.now();
  try {
    const stored = Number(sessionStorage.getItem(sessionStartKey) || '0');
    if (!stored) sessionStorage.setItem(sessionStartKey, String(start));
    else start = stored;
    const mark = Number(sessionStorage.getItem(sessionMarkKey) || String(start));
    const seconds = Math.min(1800, Math.round((Date.now() - mark) / 1000));
    sessionStorage.setItem(sessionMarkKey, String(Date.now()));
    if (seconds >= 15) enqueue({ kind: 'session', seconds: Math.max(30, Math.round(seconds / 30) * 30) });
  } catch {
    // A blocked session still leaves the rest of the editor alone.
  }
};

export const startUsage = (): void => {
  if (!read(firstSeenKey)) write(firstSeenKey, new Date().toISOString());
  const today = new Date().toISOString().slice(0, 10);
  if (read(visitDayKey) !== today) {
    write(visitDayKey, today);
    enqueue({ kind: 'visit' });
  }
  try {
    const started = sessionStorage.getItem(sessionStartKey) || String(Date.now());
    if (!sessionStorage.getItem(sessionStartKey)) sessionStorage.setItem(sessionStartKey, started);
    if (!sessionStorage.getItem(sessionMarkKey)) sessionStorage.setItem(sessionMarkKey, started);
  } catch {
    // Session length is skipped when storage is blocked.
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      noteSession();
      flush();
    }
  });
  window.addEventListener('pagehide', () => {
    noteSession();
    flush();
  });
  window.setTimeout(() => maybeAsk(false), 1500);
};
