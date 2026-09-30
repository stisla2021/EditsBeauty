// Copyright (c) StISLA2021
const CACHE = 'editsbeauty-shell-v9';
const SHELL = [
  './',
  './index.html',
  './about.html',
  './faq.html',
  './privacy.html',
  './privacy-policy.html',
  './contact.html',
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
const MEDIAPIPE = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_packed_assets.data',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_packed_assets_loader.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_simd_wasm_bin.wasm',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_wasm_bin.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh_solution_wasm_bin.wasm',
  'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1471341971476-ae15ff5dd4ea?auto=format&fit=crop&w=1600&q=80',
];

const isMediaPipe = (url) =>
  url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/@mediapipe/');
const isSceneImage = (url) => url.hostname === 'images.unsplash.com';
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
        // Skip a shell file that this host does not serve.
      }
    }));
    await Promise.all(MEDIAPIPE.map(async (url) => {
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (response.ok) await cache.put(url, response);
      } catch {
        // A later visit stores the model when face detection loads online.
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
  if (!response || !(response.ok || response.type === 'opaque')) return;
  const cache = await caches.open(CACHE);
  await cache.put(request, response.clone());
};

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const mediaPipe = isMediaPipe(url);
  const image = isSceneImage(url) || (sameOrigin && isImage(url));
  if (!sameOrigin && !mediaPipe && !isSceneImage(url)) return;

  if (mediaPipe || image) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      await putCache(request, response);
      return response;
    })());
    return;
  }

  if (!isCode(url, request)) return;
  event.respondWith((async () => {
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
