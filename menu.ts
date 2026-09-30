// Copyright (c) StISLA2021
const themeKey = 'editsbeauty-theme';
type ThemePreference = 'system' | 'light' | 'dark';
const deviceTheme = window.matchMedia('(prefers-color-scheme: dark)');
let themePreference: ThemePreference = 'system';

const applyTheme = (preference: ThemePreference): void => {
  themePreference = preference;
  const isDark = preference === 'dark' || (preference === 'system' && deviceTheme.matches);
  document.body.classList.toggle('dark', isDark);
  document.body.dataset.theme = preference;
  document.querySelectorAll<HTMLButtonElement>('.theme-option').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.id === `${preference}Theme`));
  });
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#171519' : '#ffffff');
};

const readTheme = (): ThemePreference => {
  try {
    const savedTheme = localStorage.getItem(themeKey);
    return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'system';
  } catch {
    return 'system';
  }
};

const saveTheme = (theme: ThemePreference): void => {
  try {
    if (theme === 'system') localStorage.removeItem(themeKey);
    else localStorage.setItem(themeKey, theme);
  } catch {
    // Apply the selected theme for this page even when storage is unavailable.
  }
  applyTheme(theme);
};

applyTheme(readTheme());
deviceTheme.addEventListener('change', () => {
  if (themePreference === 'system') applyTheme('system');
});

const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

if (hamburger instanceof HTMLButtonElement && navLinks instanceof HTMLUListElement) {
  const closeMenu = (): void => {
    navLinks.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
  };

  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('active');
    hamburger.setAttribute('aria-expanded', String(isOpen));
  });

  navLinks.querySelectorAll<HTMLAnchorElement>('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('click', (event: MouseEvent) => {
    if (event.target instanceof Node && !navLinks.contains(event.target) && !hamburger.contains(event.target)) {
      closeMenu();
    }
  });
}

document.getElementById('lightTheme')?.addEventListener('click', () => saveTheme('light'));
document.getElementById('darkTheme')?.addEventListener('click', () => saveTheme('dark'));
document.getElementById('systemTheme')?.addEventListener('click', () => saveTheme('system'));

window.addEventListener('storage', (event: StorageEvent) => {
  if (event.key === themeKey) applyTheme(event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : 'system');
});

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let installPrompt: InstallPromptEvent | null = (window as Window & { __editsbeautyInstall?: InstallPromptEvent }).__editsbeautyInstall ?? null;
const installButton = document.createElement('button');
installButton.type = 'button';
installButton.className = 'install-app';
installButton.textContent = 'Install app';
installButton.hidden = true;
document.body.append(installButton);
if (installPrompt) {
  installButton.hidden = false;
  document.documentElement.dataset.installable = 'true';
}

window.addEventListener('beforeinstallprompt', (event: Event) => {
  event.preventDefault();
  installPrompt = event as InstallPromptEvent;
  installButton.hidden = false;
  document.documentElement.dataset.installable = 'true';
});

installButton.addEventListener('click', () => {
  if (!installPrompt) return;
  const prompt = installPrompt;
  installPrompt = null;
  installButton.hidden = true;
  void prompt.prompt().then(() => prompt.userChoice).then((choice) => {
    if (choice.outcome === 'accepted') installButton.remove();
    else installButton.hidden = false;
  }).catch(() => {
    installButton.hidden = false;
  });
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  installButton.hidden = true;
  document.documentElement.dataset.installed = 'true';
});

if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.register('./sw.js').then((registration) => {
    void registration.update();
  }).catch(() => undefined);
}

const settingKeys = [
  'editsbeauty-theme',
  'editsbeauty-save-album',
  'editsbeauty-sticker-optimize',
  'editsbeauty-heic',
  'editsbeauty-resolution',
  'editsbeauty-live-format',
  'editsbeauty-language',
  'editsbeauty-id',
];

const coreFiles = [
  './',
  './index.html',
  './about.html',
  './privacy.html',
  './terms.html',
  './licensing.html',
  './copyright.html',
  './fontlicense.html',
  './settings.html',
  './style.css',
  './manifest.json',
  './images/logo.png',
  './images/logo-192.png',
  './images/logo-512.png',
  './images/EditsBeauty.jpeg',
  './assets/index.js',
  './assets/menu.js',
  './sw.js',
];

const readSetting = (key: string, fallback: string): string => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

const writeSetting = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The control still updates on screen when storage is blocked.
  }
};

const showMenuToast = (message: string): void => {
  let toast = document.querySelector<HTMLDivElement>('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.append(toast);
  }
  toast.textContent = message;
  window.setTimeout(() => toast?.remove(), 2800);
};

const formatMegabytes = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
let cacheMeasure = 0;

const measureStorageBytes = async (): Promise<number> => {
  let bytes = 0;
  if ('caches' in window) {
    const names = await caches.keys();
    for (const name of names) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      for (const request of requests) {
        const response = await cache.match(request);
        if (!response) continue;
        const blob = await response.clone().blob();
        bytes += blob.size;
      }
    }
  }
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      bytes += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
  } catch {
    // Storage can be unavailable in a private window.
  }
  return bytes;
};

const modelFiles = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_packed_assets.data',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_wasm_bin.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_wasm_bin.wasm',
];

const keepCached = (url: URL): boolean => {
  if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/@mediapipe/')) return true;
  if (url.hostname === 'images.unsplash.com') return true;
  const relative = url.pathname === '/' ? './' : `.${url.pathname}`;
  return coreFiles.includes(relative);
};

const restoreCoreCache = async (): Promise<void> => {
  const saved: Array<{ request: Request; response: Response }> = [];
  if (!('caches' in window)) return;
  const names = await caches.keys();
  for (const name of names) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      if (!keepCached(new URL(request.url))) continue;
      const match = await cache.match(request);
      if (match) saved.push({ request, response: match.clone() });
    }
  }
  await Promise.all(names.map((name) => caches.delete(name)));
  const fresh = await caches.open('editsbeauty-shell-v7');
  for (const item of saved) await fresh.put(item.request, item.response);
  if (navigator.onLine) {
    void Promise.all([...coreFiles, ...modelFiles].map(async (path) => {
      try {
        const response = await fetch(path, { cache: 'reload' });
        if (response.ok) await fresh.put(path, response);
      } catch {
        // The copied file stays in place when the network is off.
      }
    }));
  }
};

const clearAppCache = async (): Promise<void> => {
  await restoreCoreCache();
  try {
    const kept = new Map<string, string>();
    settingKeys.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) kept.set(key, value);
    });
    localStorage.clear();
    kept.forEach((value, key) => localStorage.setItem(key, value));
    sessionStorage.clear();
  } catch {
    // Keep going when a storage area cannot be cleared.
  }
  cacheMeasure += 1;
  const cacheSize = document.getElementById('cacheSize');
  if (cacheSize) cacheSize.textContent = '0.00 MB';
  showMenuToast('Cache cleared successfully!');
};

const bindSettings = (): void => {
  const saveAlbum = document.getElementById('saveAlbum');
  const stickerOptimize = document.getElementById('stickerOptimize');
  const heicFormat = document.getElementById('heicFormat');
  const resolutionValue = document.getElementById('resolutionValue');
  const liveValue = document.getElementById('liveValue');
  const languageValue = document.getElementById('languageValue');
  const cacheSize = document.getElementById('cacheSize');
  const dialog = document.getElementById('clearDialog');
  if (!(saveAlbum instanceof HTMLButtonElement)) return;

  const setSwitch = (button: HTMLButtonElement, on: boolean): void => {
    button.setAttribute('aria-checked', String(on));
  };
  setSwitch(saveAlbum, readSetting('editsbeauty-save-album', 'on') !== 'off');
  if (stickerOptimize instanceof HTMLButtonElement) setSwitch(stickerOptimize, readSetting('editsbeauty-sticker-optimize', 'off') === 'on');
  if (heicFormat instanceof HTMLButtonElement) setSwitch(heicFormat, readSetting('editsbeauty-heic', 'on') !== 'off');
  if (resolutionValue) resolutionValue.textContent = readSetting('editsbeauty-resolution', 'High');
  if (liveValue) liveValue.textContent = readSetting('editsbeauty-live-format', 'Ask every time');
  if (languageValue) languageValue.textContent = readSetting('editsbeauty-language', 'English');

  saveAlbum.addEventListener('click', () => {
    const next = saveAlbum.getAttribute('aria-checked') !== 'true';
    setSwitch(saveAlbum, next);
    writeSetting('editsbeauty-save-album', next ? 'on' : 'off');
  });
  stickerOptimize?.addEventListener('click', () => {
    if (!(stickerOptimize instanceof HTMLButtonElement)) return;
    const next = stickerOptimize.getAttribute('aria-checked') !== 'true';
    setSwitch(stickerOptimize, next);
    writeSetting('editsbeauty-sticker-optimize', next ? 'on' : 'off');
  });
  heicFormat?.addEventListener('click', () => {
    if (!(heicFormat instanceof HTMLButtonElement)) return;
    const next = heicFormat.getAttribute('aria-checked') !== 'true';
    setSwitch(heicFormat, next);
    writeSetting('editsbeauty-heic', next ? 'on' : 'off');
  });

  const resolutions = ['High', 'Standard', 'Original'];
  const liveFormats = ['Ask every time', 'Live', 'Still'];
  const languages = ['English', 'Français'];
  document.getElementById('resolutionRow')?.addEventListener('click', () => {
    const current = resolutionValue?.textContent ?? 'High';
    const next = resolutions[(resolutions.indexOf(current) + 1) % resolutions.length];
    if (resolutionValue) resolutionValue.textContent = next;
    writeSetting('editsbeauty-resolution', next);
  });
  document.getElementById('liveRow')?.addEventListener('click', () => {
    const current = liveValue?.textContent ?? 'Ask every time';
    const next = liveFormats[(liveFormats.indexOf(current) + 1) % liveFormats.length];
    if (liveValue) liveValue.textContent = next;
    writeSetting('editsbeauty-live-format', next);
  });
  document.getElementById('languageRow')?.addEventListener('click', () => {
    const current = languageValue?.textContent ?? 'English';
    const next = languages[(languages.indexOf(current) + 1) % languages.length];
    if (languageValue) languageValue.textContent = next;
    writeSetting('editsbeauty-language', next);
  });

  document.getElementById('clearCache')?.addEventListener('click', () => {
    if (dialog) dialog.hidden = false;
  });
  document.getElementById('clearCancel')?.addEventListener('click', () => {
    if (dialog) dialog.hidden = true;
  });
  document.getElementById('clearConfirm')?.addEventListener('click', () => {
    if (dialog) dialog.hidden = true;
    void clearAppCache();
  });

  if (cacheSize) {
    const measure = cacheMeasure;
    void measureStorageBytes().then((bytes) => {
      if (measure !== cacheMeasure) return;
      cacheSize.textContent = formatMegabytes(bytes);
    }).catch(() => {
      if (measure === cacheMeasure) cacheSize.textContent = '0.00 MB';
    });
  }
};

const bindAboutId = (): void => {
  const button = document.getElementById('editsBeautyId');
  if (!button) return;
  button.addEventListener('click', () => {
    let id = readSetting('editsbeauty-id', '');
    if (!id) {
      id = `EB-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;
      writeSetting('editsbeauty-id', id);
    }
    showMenuToast(`EditsBeauty ID: ${id}`);
  });
};

bindSettings();
bindAboutId();