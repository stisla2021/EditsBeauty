// Copyright (c) StISLA2021
const CACHE = 'editsbeauty-shell-v18';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './assets/index.js',
  './assets/menu.js',
  './sw.js',
  './images/logo.png',
  './images/logo-192.png',
  './images/logo-512.png',
  './images/EditsBeauty.jpeg',
];

const isImage = (url) => /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname);
const isCode = (url, request) => {
  if (request.mode === 'navigate') return true;
  return /\.(html|js|css|json)$/i.test(url.pathname) || url.pathname.endsWith('/');
};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(SHELL.map(async (url) => {
      try {
        await cache.add(url);
      } catch {
        // A host may not serve every shell file. The next visit stores the ones it has.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const putCache = async (request, response) => {
  if (!response || !response.ok) return;
  const cache = await caches.open(CACHE);
  await cache.put(request, response.clone());
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return;

  const image = isImage(url);
  if (!image && !isCode(url, request)) return;
  event.respondWith((async () => {
    if (image) {
      const cachedImage = await caches.match(request);
      if (cachedImage) return cachedImage;
    }
    try {
      const response = await fetch(request);
      await putCache(request, response);
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const home = await caches.match('./index.html') || await caches.match('./');
        if (home) return home;
      }
      return Response.error();
    }
  })());
});
