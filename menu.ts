// Copyright (c) StISLA2021
import { startReports } from './report';
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

const installedKey = 'editsbeauty-installed';

const rememberInstalled = (): void => {
  try {
    localStorage.setItem(installedKey, '1');
  } catch {
    // The button is still removed for this visit.
  }
};

const rememberedInstall = (): boolean => {
  try {
    return localStorage.getItem(installedKey) === '1';
  } catch {
    return false;
  }
};

const forgetInstalled = (): void => {
  try {
    localStorage.removeItem(installedKey);
  } catch {
    // A later install prompt can still show the button.
  }
};

const launchedInstalled = (): boolean => {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true
    || window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.matchMedia('(display-mode: minimal-ui)').matches
    || window.matchMedia('(display-mode: window-controls-overlay)').matches;
};

const alreadyInstalled = (): boolean => launchedInstalled() || rememberedInstall();

const appleDevice = (): boolean => {
  const ua = navigator.userAgent;
  const iPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iPad || /iPad|iPhone|iPod|Macintosh|Mac OS X/i.test(ua);
};

let installPrompt: InstallPromptEvent | null = (window as Window & { __editsbeautyInstall?: InstallPromptEvent }).__editsbeautyInstall ?? null;
if (installPrompt && !appleDevice() && !launchedInstalled()) forgetInstalled();
const installButton = document.createElement('button');
installButton.type = 'button';
installButton.className = 'install-app';
installButton.textContent = 'Install app';
installButton.hidden = appleDevice() || alreadyInstalled();
const installHelp = document.createElement('div');
installHelp.className = 'install-help';
installHelp.hidden = true;
installHelp.setAttribute('role', 'dialog');
installHelp.setAttribute('aria-label', 'Install EditsBeauty');
const installHelpText = document.createElement('p');
const installHelpClose = document.createElement('button');
installHelpClose.type = 'button';
installHelpClose.textContent = 'Close';
installHelp.append(installHelpText, installHelpClose);
document.body.append(installButton, installHelp);
if (installPrompt) document.documentElement.dataset.installable = 'true';

const installMenuItem = document.createElement('li');
const installMenuButton = document.createElement('button');
installMenuButton.type = 'button';
installMenuButton.className = 'nav-share';
installMenuButton.id = 'installApp';
installMenuButton.textContent = 'Install app';
installMenuItem.append(installMenuButton);
installMenuItem.hidden = appleDevice() || alreadyInstalled();
const placeInstallMenu = (): void => {
  if (!navLinks || installMenuItem.isConnected) return;
  const shareItem = document.getElementById('shareApp')?.closest('li');
  if (shareItem?.parentElement === navLinks) navLinks.insertBefore(installMenuItem, shareItem);
  else navLinks.prepend(installMenuItem);
};
if (!appleDevice() && !alreadyInstalled()) placeInstallMenu();
if (appleDevice() || alreadyInstalled()) {
  installButton.remove();
  installHelp.remove();
  installMenuItem.remove();
}

const hideInstall = (): void => {
  rememberInstalled();
  installPrompt = null;
  installButton.remove();
  installHelp.remove();
  installMenuItem.remove();
  document.documentElement.dataset.installed = 'true';
};

const showInstallHelp = (message: string): void => {
  installHelpText.textContent = message;
  installHelp.hidden = false;
};

window.addEventListener('beforeinstallprompt', (event: Event) => {
  event.preventDefault();
  if (appleDevice() || launchedInstalled()) return;
  forgetInstalled();
  installPrompt = event as InstallPromptEvent;
  document.documentElement.dataset.installable = 'true';
  if (!installButton.isConnected) document.body.append(installButton);
  installButton.hidden = false;
  placeInstallMenu();
  installMenuItem.hidden = false;
});

const runInstall = (): void => {
  if (appleDevice()) return;
  if (alreadyInstalled()) {
    hideInstall();
    return;
  }
  if (installPrompt) {
    const prompt = installPrompt;
    installPrompt = null;
    void prompt.prompt().then(() => prompt.userChoice).then((choice) => {
      if (choice.outcome === 'accepted') hideInstall();
    }).catch(() => {
      showInstallHelp('Open the browser menu and choose Install app.');
    });
    return;
  }
  showInstallHelp('Open the browser menu and choose Install app.');
};

installButton.addEventListener('click', runInstall);
installMenuButton.addEventListener('click', () => {
  navLinks?.classList.remove('active');
  if (hamburger instanceof HTMLButtonElement) hamburger.setAttribute('aria-expanded', 'false');
  runInstall();
});
installHelpClose.addEventListener('click', () => {
  installHelp.hidden = true;
});

window.addEventListener('appinstalled', hideInstall);
if (launchedInstalled()) hideInstall();
const relatedApps = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> };
if (!appleDevice() && relatedApps.getInstalledRelatedApps) {
  void relatedApps.getInstalledRelatedApps().then((apps) => {
    if (apps.length > 0) hideInstall();
  }).catch(() => undefined);
}

const iosDevice = (): boolean => {
  const iPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iPad || /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

const appliedVersionKey = 'editsbeauty-applied-version';
const dismissedUpdateKey = 'editsbeauty-update-dismissed';
const homeScreenSeenKey = 'editsbeauty-homescreen-seen';
const firstHomeSessionKey = 'editsbeauty-homescreen-first-session';
const seenHomeScreen = (): boolean => {
  try {
    return localStorage.getItem(homeScreenSeenKey) === '1';
  } catch {
    return false;
  }
};
const markHomeScreenSeen = (): void => {
  try {
    localStorage.setItem(homeScreenSeenKey, '1');
  } catch {
    // A new install still skips the banner for this visit.
  }
};
const seenBeforeThisVisit = launchedInstalled() && seenHomeScreen();
if (launchedInstalled()) {
  if (!seenBeforeThisVisit) {
    try {
      sessionStorage.setItem(firstHomeSessionKey, '1');
    } catch {
      // This visit still skips the banner.
    }
  }
  markHomeScreenSeen();
}
const firstHomeSession = ((): boolean => {
  try {
    return sessionStorage.getItem(firstHomeSessionKey) === '1';
  } catch {
    return false;
  }
})();
const returningHomeScreen = seenBeforeThisVisit && !firstHomeSession && !iosDevice();
const rememberAppliedVersion = (version: string): void => {
  try {
    localStorage.setItem(appliedVersionKey, version);
  } catch {
    // A successful reload still leaves the new version in control.
  }
};

if ('serviceWorker' in navigator) {
  const updateBanner = document.createElement('section');
  updateBanner.className = 'update-banner';
  updateBanner.setAttribute('role', 'region');
  updateBanner.setAttribute('aria-label', 'App update available');
  updateBanner.setAttribute('aria-live', 'polite');
  updateBanner.hidden = true;

  const updateCopy = document.createElement('div');
  updateCopy.className = 'update-copy';
  const updateTitle = document.createElement('strong');
  updateTitle.textContent = 'Update available';
  const updateVersion = document.createElement('p');
  updateVersion.className = 'update-version';
  const updateMessage = document.createElement('p');
  updateCopy.append(updateTitle, updateVersion, updateMessage);

  const updateActions = document.createElement('div');
  updateActions.className = 'update-actions';
  const updateButton = document.createElement('button');
  updateButton.className = 'update-button';
  updateButton.type = 'button';
  updateButton.textContent = 'Update';
  const updateClose = document.createElement('button');
  updateClose.className = 'update-close';
  updateClose.type = 'button';
  updateClose.setAttribute('aria-label', 'Dismiss update');
  updateClose.textContent = '×';
  updateActions.append(updateButton);
  updateBanner.append(updateCopy, updateActions, updateClose);
  document.body.prepend(updateBanner);

  let waitingWorker: ServiceWorker | null = null;
  let offeredVersion = '';
  let hasControlledPage = navigator.serviceWorker.controller !== null;
  let refreshing = false;

  const askVersion = (worker: ServiceWorker | null): Promise<string | null> => new Promise((resolve) => {
    if (!worker) {
      resolve(null);
      return;
    }
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => resolve(null), 1600);
    channel.port1.onmessage = (event: MessageEvent<{ version?: unknown }>) => {
      window.clearTimeout(timer);
      const version = event.data?.version;
      resolve(typeof version === 'string' && version ? version : null);
    };
    try {
      worker.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
    } catch {
      window.clearTimeout(timer);
      resolve(null);
    }
  });

  const dismissedVersion = (): string => {
    try {
      return sessionStorage.getItem(dismissedUpdateKey) ?? '';
    } catch {
      return '';
    }
  };

  const hideUpdate = (): void => {
    updateBanner.hidden = true;
    offeredVersion = '';
    waitingWorker = null;
  };

  const dismissUpdate = (): void => {
    if (offeredVersion) {
      try {
        sessionStorage.setItem(dismissedUpdateKey, offeredVersion);
      } catch {
        // Hiding the banner still works when storage is blocked.
      }
    }
    updateBanner.hidden = true;
  };

  const showUpdate = async (worker: ServiceWorker | null): Promise<void> => {
    if (!navigator.serviceWorker.controller || !worker) return;
    const [current, next] = await Promise.all([
      askVersion(navigator.serviceWorker.controller),
      askVersion(worker),
    ]);
    if (current) rememberAppliedVersion(current);
    if (!next || next === current) {
      if (next && next === current) hideUpdate();
      return;
    }
    updateBanner.hidden = true;
    if (!returningHomeScreen) {
      if (iosDevice() || launchedInstalled()) applyQuietly(worker, next);
      return;
    }
    waitingWorker = worker;
    offeredVersion = next;
    if (next === dismissedVersion()) {
      updateBanner.hidden = true;
      return;
    }
    updateVersion.textContent = `Version ${next}`;
    updateMessage.textContent = 'A new version of EditsBeauty is ready. Tap Update to load it now.';
    updateButton.disabled = false;
    updateButton.textContent = 'Update';
    updateBanner.hidden = false;
  };

  const finishUpdate = (): void => {
    if (refreshing) return;
    refreshing = true;
    const openLatest = (): void => {
      if (!iosDevice()) {
        window.location.reload();
        return;
      }
      const url = new URL(window.location.href);
      url.searchParams.set('refresh', String(Date.now()));
      window.location.replace(url.href);
    };
    if (!iosDevice() || !('caches' in window)) {
      openLatest();
      return;
    }
    void caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .finally(openLatest);
  };

  const applyQuietly = (worker: ServiceWorker, version: string): void => {
    updateBanner.hidden = true;
    try {
      if (sessionStorage.getItem('editsbeauty-quiet-update') === version) return;
      sessionStorage.setItem('editsbeauty-quiet-update', version);
    } catch {
      // One attempt still runs when storage is blocked.
    }
    waitingWorker = worker;
    offeredVersion = version;
    worker.postMessage({ type: 'SKIP_WAITING' });
    window.setTimeout(finishUpdate, 700);
  };

  updateClose.addEventListener('click', dismissUpdate);

  const beginUpdate = (): void => {
    if (refreshing || !waitingWorker) return;
    updateButton.disabled = true;
    updateButton.textContent = 'Updating…';
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    window.setTimeout(finishUpdate, 3000);
  };

  updateButton.addEventListener('click', beginUpdate);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hasControlledPage) {
      hasControlledPage = true;
      return;
    }
    if (offeredVersion) rememberAppliedVersion(offeredVersion);
    finishUpdate();
  });

  void navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((registration) => {
    void showUpdate(registration.waiting);

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;
      installingWorker.addEventListener('statechange', () => {
        if (installingWorker.state === 'installed') void showUpdate(registration.waiting ?? installingWorker);
      });
    });

    const checkForUpdate = (): void => {
      void registration.update().then(() => {
        void showUpdate(registration.waiting);
      }).catch((error: unknown) => {
        console.warn('EditsBeauty could not check for an app update.', error);
      });
    };
    checkForUpdate();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });
    window.addEventListener('pageshow', checkForUpdate);
    window.setInterval(checkForUpdate, 60 * 60 * 1000);
  }).catch((error: unknown) => {
    console.error('EditsBeauty could not register its service worker.', error);
  });
}

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

const formatMegabytes = (bytes: number): string => {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
let cacheMeasure = 0;

const responseBytes = async (response: Response): Promise<number> => {
  const header = Number(response.headers.get('content-length'));
  if (Number.isFinite(header) && header > 0) return header;
  try {
    return (await response.clone().blob()).size;
  } catch {
    return 0;
  }
};

const measureStorageBytes = async (): Promise<number> => {
  let counted = 0;
  if (!('caches' in window)) return 0;
  const names = await caches.keys();
  for (const name of names) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      if (response) counted += await responseBytes(response);
    }
  }
  return counted;
};

const showCacheSize = async (): Promise<void> => {
  const cacheSize = document.getElementById('cacheSize');
  if (!cacheSize) return;
  const measure = cacheMeasure;
  try {
    const bytes = await measureStorageBytes();
    if (measure !== cacheMeasure) return;
    cacheSize.textContent = formatMegabytes(bytes);
  } catch {
    if (measure === cacheMeasure) cacheSize.textContent = '0 B';
  }
};

const clearAppCache = async (): Promise<void> => {
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
  }
  try {
    sessionStorage.clear();
  } catch {
    // Keep going when storage cannot be cleared.
  }
  cacheMeasure += 1;
  const cacheSize = document.getElementById('cacheSize');
  if (cacheSize) cacheSize.textContent = '0 B';
  showMenuToast('Cache cleared. It is 0 B again.');
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
  const faceMeshOverlay = document.getElementById('faceMeshOverlay');
  if (faceMeshOverlay instanceof HTMLButtonElement) setSwitch(faceMeshOverlay, readSetting('editsbeauty-face-mesh', 'off') === 'on');
  const diagnosticReports = document.getElementById('diagnosticReports');
  if (diagnosticReports instanceof HTMLButtonElement) setSwitch(diagnosticReports, readSetting('editsbeauty-diagnostics', 'off') === 'on');
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
  faceMeshOverlay?.addEventListener('click', () => {
    if (!(faceMeshOverlay instanceof HTMLButtonElement)) return;
    const next = faceMeshOverlay.getAttribute('aria-checked') !== 'true';
    setSwitch(faceMeshOverlay, next);
    writeSetting('editsbeauty-face-mesh', next ? 'on' : 'off');
  });
  diagnosticReports?.addEventListener('click', () => {
    if (!(diagnosticReports instanceof HTMLButtonElement)) return;
    const next = diagnosticReports.getAttribute('aria-checked') !== 'true';
    setSwitch(diagnosticReports, next);
    writeSetting('editsbeauty-diagnostics', next ? 'on' : 'off');
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
    cacheSize.textContent = '0 B';
    void showCacheSize();
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
startReports();