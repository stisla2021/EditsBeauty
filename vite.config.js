import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { planEdit } from './guide-plan.js';
import { acceptReport, saveReport } from './report-store.js';

const groqKey = () => {
  if (process.env.GROQ_API_KEY) return process.env.GROQ_API_KEY;
  const file = resolve('.env');
  if (!existsSync(file)) return '';
  const line = readFileSync(file, 'utf8').split(/\r?\n/).find((item) => item.startsWith('GROQ_API_KEY='));
  if (!line) return '';
  return line.slice('GROQ_API_KEY='.length).trim().replace(/^["']|["']$/g, '');
};

const guideApi = () => ({
  name: 'guide-api',
  configureServer(server) {
    attachGuide(server.middlewares);
  },
  configurePreviewServer(server) {
    attachGuide(server.middlewares);
  },
});

const readJson = (req) => new Promise((resolveBody, reject) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    try {
      resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
    } catch (error) {
      reject(error);
    }
  });
});

const attachGuide = (middlewares) => {
  middlewares.use('/api/report', (req, res) => {
    const reply = (status, body) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    };
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      reply(405, { stored: false, error: 'method' });
      return;
    }
    void readJson(req).then(async (body) => {
      const accepted = acceptReport(body);
      if (!accepted.ok) {
        reply(accepted.status, { stored: false, error: accepted.error });
        return;
      }
      try {
        reply(200, await saveReport(accepted.record));
      } catch (error) {
        const status = error && typeof error.status === 'number' ? error.status : 502;
        reply(status, { stored: false, error: status === 503 ? 'unconfigured' : 'store' });
      }
    }).catch(() => reply(400, { stored: false, error: 'json' }));
  });
  middlewares.use('/api/guide', (req, res) => {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.end();
      return;
    }
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      void (async () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          if (body.image || body.photo || body.pixels || body.dataUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'photo' }));
            return;
          }
          const plan = await planEdit({
            message: body.message,
            state: body.state,
            history: body.history,
            apiKey: groqKey(),
          });
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(plan));
        } catch (error) {
          const status = error && typeof error.status === 'number' ? error.status : 502;
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: status === 503 ? 'unconfigured' : 'guide' }));
        }
      })();
    });
  });
};

const pages = [
  'index.html',
  'settings.html',
  'about.html',
  'faq.html',
  'privacy.html',
  'privacy-policy.html',
  'contact.html',
  'terms.html',
  'licensing.html',
  'copyright.html',
  'fontlicense.html',
];

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(pages.map((page) => [page.replace(/\.html$/, ''), resolve(page)])),
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] ?? '';
          if (name.endsWith('.css')) return 'style.css';
          if (/\.(png|jpe?g|webp|gif|svg|ico)$/i.test(name)) return 'images/[name][extname]';
          if (name.endsWith('.json')) return '[name][extname]';
          return 'assets/[name][extname]';
        },
      },
    },
  },
  plugins: [
    guideApi(),
    {
      name: 'copy-service-worker',
      closeBundle() {
        copyFileSync(resolve('sw.js'), resolve('dist/sw.js'));
        const ads = resolve('public/ads.txt');
        if (existsSync(ads)) copyFileSync(ads, resolve('dist/ads.txt'));
        const imagesDir = resolve('dist/images');
        mkdirSync(imagesDir, { recursive: true });
        for (const file of readdirSync(resolve('images'))) {
          copyFileSync(resolve('images', file), resolve(imagesDir, file));
        }
      },
    },
  ],
});
