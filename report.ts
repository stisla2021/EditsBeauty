// Copyright (c) StISLA2021
// Diagnostic reports are off until Settings is turned on, and nothing is sent until the person confirms.
// The report never includes a photo, the canvas, or face landmarks.

const reportVersion = '1.1.3';
const diagnosticsKey = 'editsbeauty-diagnostics';
const seenErrors = new Set<string>();
let pendingError = { error: '', stack: '' };
let sending = false;

const diagnosticsOn = (): boolean => {
  try {
    return localStorage.getItem(diagnosticsKey) === 'on';
  } catch {
    return false;
  }
};

const clean = (value: string, max: number): string => value
  .replace(/data:[^\s)"']+/gi, '[removed]')
  .replace(/blob:[^\s)"']+/gi, '[removed]')
  .replace(/iVBORw0KGgo[A-Za-z0-9+/=]*/g, '[removed]')
  .replace(/\/9j\/[A-Za-z0-9+/=]+/g, '[removed]')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const browserInfo = (): { name: string; version: string } => {
  const ua = navigator.userAgent;
  const version = (pattern: RegExp): string => ua.match(pattern)?.[1] ?? '';
  if (/Edg\//.test(ua)) return { name: 'Edge', version: version(/Edg\/(\d+)/) };
  if (/Chrome\//.test(ua)) return { name: 'Chrome', version: version(/Chrome\/(\d+)/) };
  if (/Firefox\//.test(ua)) return { name: 'Firefox', version: version(/Firefox\/(\d+)/) };
  if (/Safari\//.test(ua)) return { name: 'Safari', version: version(/Version\/(\d+)/) };
  return { name: 'Browser', version: '' };
};

const deviceKind = (): 'mobile' | 'desktop' => {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return coarse || window.innerWidth < 820 ? 'mobile' : 'desktop';
};

const screenSize = (): string => {
  const bucket = (value: number): number => Math.max(40, Math.round(value / 40) * 40);
  return `${bucket(window.innerWidth)}×${bucket(window.innerHeight)}`;
};

const currentTool = (): string => {
  const studio = document.querySelector('.studio');
  if (studio && !studio.hasAttribute('hidden')) {
    const tab = document.querySelector('.studio-rail button[aria-pressed="true"] span')?.textContent?.trim();
    return tab ? `Editor · ${tab}` : 'Editor';
  }
  const file = (window.location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
  if (!file || file === 'index') return 'Home';
  return file.charAt(0).toUpperCase() + file.slice(1);
};

const reportEndpoint = (): string => {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === 'editsbeauty.vercel.app') {
    return new URL('/api/report', window.location.origin).href;
  }
  return 'https://editsbeauty.vercel.app/api/report';
};

type ReportBody = {
  version: string;
  browser: { name: string; version: string };
  device: 'mobile' | 'desktop';
  screenSize: string;
  tool: string;
  error: string;
  stack: string;
  description: string;
};

const buildReport = (description: string): ReportBody => ({
  version: reportVersion,
  browser: browserInfo(),
  device: deviceKind(),
  screenSize: screenSize(),
  tool: clean(currentTool(), 80),
  error: clean(pendingError.error, 500),
  stack: clean(pendingError.stack, 1500),
  description: clean(description, 400),
});

const reportText = (report: ReportBody): string => [
  'EditsBeauty diagnostic report',
  `App version: ${report.version}`,
  `Browser: ${report.browser.name} ${report.browser.version}`.trim(),
  `Device: ${report.device}`,
  `Approximate screen size: ${report.screenSize}`,
  `Tool or screen: ${report.tool || 'Unknown'}`,
  `Error: ${report.error || 'None'}`,
  `Stack: ${report.stack || 'None'}`,
  `Note: ${report.description || 'None'}`,
  'The photo, canvas, and face landmarks are not included.',
].join('\n');

export const startReports = (): void => {
  const dialog = document.createElement('section');
  dialog.className = 'report-dialog';
  dialog.hidden = true;
  dialog.innerHTML = `
    <div class="report-card" role="dialog" aria-labelledby="reportTitle" aria-modal="true">
      <h2 id="reportTitle">Report a problem</h2>
      <div class="report-body"></div>
      <p class="report-status" aria-live="polite"></p>
    </div>
  `;
  document.body.append(dialog);
  const card = dialog.querySelector('.report-card');
  const body = dialog.querySelector('.report-body');
  const status = dialog.querySelector('.report-status');
  if (!(card instanceof HTMLElement) || !(body instanceof HTMLElement) || !(status instanceof HTMLElement)) return;

  const close = (): void => {
    dialog.hidden = true;
    pendingError = { error: '', stack: '' };
    sending = false;
    status.textContent = '';
  };

  const paintOff = (): void => {
    body.replaceChildren();
    const copy = document.createElement('p');
    copy.textContent = 'Diagnostic reporting is off. Nothing has been collected or stored. Your photo stays on this device. Turn reporting on in Settings if you want the choice to send a short report later. You can still write to stisla2021@gmail.com yourself.';
    const actions = document.createElement('div');
    actions.className = 'report-actions';
    const settings = document.createElement('a');
    settings.href = 'settings.html';
    settings.textContent = 'Open Settings';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Close';
    cancel.addEventListener('click', close);
    actions.append(settings, cancel);
    body.append(copy, actions);
  };

  const paintOn = (): void => {
    const sample = buildReport('');
    body.replaceChildren();
    const intro = document.createElement('p');
    intro.textContent = 'Nothing is sent until you confirm. If you agree, only this list is stored or emailed. Your photo, the canvas, face landmarks, your name, and your email are not included.';
    const list = document.createElement('ul');
    const rows = [
      `App version: ${sample.version}`,
      `Browser: ${sample.browser.name} ${sample.browser.version}`.trim(),
      `Device: ${sample.device}`,
      `Approximate screen size: ${sample.screenSize}`,
      `Tool or screen: ${sample.tool || 'Unknown'}`,
      `Error: ${sample.error || 'None'}`,
      'Your note: the text you type below, if any',
      'Timestamp: the time you confirm',
    ];
    rows.forEach((row) => {
      const item = document.createElement('li');
      item.textContent = row;
      list.append(item);
    });
    const label = document.createElement('label');
    label.className = 'report-note';
    label.textContent = 'Optional note';
    const note = document.createElement('textarea');
    note.maxLength = 400;
    note.placeholder = 'What went wrong, in a few words';
    label.append(note);
    const consentLabel = document.createElement('label');
    consentLabel.className = 'report-consent';
    const consent = document.createElement('input');
    consent.type = 'checkbox';
    const consentText = document.createElement('span');
    consentText.textContent = 'I agree to send only the items listed above.';
    consentLabel.append(consent, consentText);
    const actions = document.createElement('div');
    actions.className = 'report-actions';
    const store = document.createElement('button');
    store.type = 'button';
    store.className = 'report-store';
    store.textContent = 'Store this report';
    const email = document.createElement('button');
    email.type = 'button';
    email.className = 'report-email';
    email.textContent = 'Email this report';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'report-cancel';
    cancel.textContent = 'Cancel';
    const agreed = (): boolean => {
      if (consent.checked) return true;
      status.textContent = 'Check the box to confirm. Nothing has been sent.';
      return false;
    };
    store.addEventListener('click', () => {
      if (!agreed() || sending || !diagnosticsOn()) return;
      sending = true;
      store.disabled = true;
      const report = buildReport(note.value);
      status.textContent = 'Sending the report…';
      void fetch(reportEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      }).then(async (response) => {
        const payload = await response.json().catch(() => ({})) as { stored?: boolean; error?: string };
        if (response.ok && payload.stored) {
          status.textContent = 'Stored. The photo was not included.';
          window.setTimeout(close, 1200);
          return;
        }
        sending = false;
        store.disabled = false;
        status.textContent = payload.error === 'unconfigured'
          ? 'The server is not keeping reports yet. Nothing was stored. You can email this report instead.'
          : 'The report was not stored. Nothing else was sent. You can email it instead.';
      }).catch(() => {
        sending = false;
        store.disabled = false;
        status.textContent = 'The report was not stored. You can email it instead.';
      });
    });
    email.addEventListener('click', () => {
      if (!agreed() || !diagnosticsOn()) return;
      const report = buildReport(note.value);
      window.location.href = `mailto:stisla2021@gmail.com?subject=${encodeURIComponent('EditsBeauty diagnostic report')}&body=${encodeURIComponent(reportText(report))}`;
      status.textContent = 'Opening your email app with this report. The photo is not included.';
    });
    cancel.addEventListener('click', close);
    actions.append(store, email, cancel);
    body.append(intro, list, label, consentLabel, actions);
  };

  const open = (error = '', stack = ''): void => {
    pendingError = { error: clean(error, 500), stack: clean(stack, 1500) };
    status.textContent = '';
    if (diagnosticsOn()) paintOn();
    else paintOff();
    dialog.hidden = false;
  };

  document.getElementById('reportProblem')?.addEventListener('click', () => open());
  document.getElementById('settingsReport')?.addEventListener('click', () => open());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  window.addEventListener('error', (event) => {
    if (!diagnosticsOn() || !dialog.hidden) return;
    const message = clean(event.message || '', 500);
    if (!message || seenErrors.has(message)) return;
    if (event.filename && !event.filename.startsWith(window.location.origin) && !event.filename.startsWith('http://127.0.0.1') && !event.filename.startsWith('http://localhost')) return;
    seenErrors.add(message);
    open(message, event.error instanceof Error ? event.error.stack || '' : '');
  });
  window.addEventListener('unhandledrejection', (event) => {
    if (!diagnosticsOn() || !dialog.hidden) return;
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? '');
    const message = clean(reason, 500);
    if (!message || seenErrors.has(message)) return;
    seenErrors.add(message);
    const stack = event.reason instanceof Error ? event.reason.stack || '' : '';
    open(message, stack);
  });
};
