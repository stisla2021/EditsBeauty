// Copyright (c) StISLA2021
const CACHE = 'editsbeauty-shell-v11';

const isMediaPipe = (url) =>
  url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/@mediapipe/');
const isSceneImage = (url) => url.hostname === 'images.unsplash.com';
const isImage = (url) => /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname);
const isCode = (url, request) => {
  if (request.mode === 'navigate') return true;
  return /\.(html|js|css|json)$/i.test(url.pathname) || url.pathname.endsWith('/');
};

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const mediaPipe = isMediaPipe(url);
  const image = isSceneImage(url) || (sameOrigin && isImage(url));
  if (!sameOrigin && !mediaPipe && !isSceneImage(url)) return;

  if (mediaPipe || image) {
    event.respondWith(fetch(request));
    return;
  }

  if (!isCode(url, request)) return;
  event.respondWith((async () => {
    try {
      return await fetch(request);
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      return Response.error();
    }
  })());
});
