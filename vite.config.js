import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { planEdit } from './guide-plan.js';
import { acceptReport, saveReport } from './report-store.js';
import { acceptUsage, commentsAllowed, readUsage, saveUsage } from './usage-store.js';

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
  middlewares.use('/api/usage', (req, res) => {
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
    if (req.method === 'GET') {
      void readUsage(commentsAllowed(req.headers['x-usage-key'])).then((summary) => reply(200, summary)).catch((error) => {
        const status = error && typeof error.status === 'number' ? error.status : 502;
        reply(status, { stored: false, error: status === 503 ? 'unconfigured' : 'store' });
      });
      return;
    }
    if (req.method !== 'POST') {
      reply(405, { stored: false, error: 'method' });
      return;
    }
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 8000) req.destroy();
      else chunks.push(chunk);
    });
    req.on('end', () => {
      if (size > 8000) {
        reply(413, { stored: false, error: 'field' });
        return;
      }
      void (async () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const accepted = acceptUsage(body, req.headers['x-vercel-ip-country']);
          if (!accepted.ok) {
            reply(accepted.status, { stored: false, error: accepted.error });
            return;
          }
          reply(200, await saveUsage(accepted.record));
        } catch (error) {
          const status = error && typeof error.status === 'number' ? error.status : 400;
          reply(status, { stored: false, error: status === 503 ? 'unconfigured' : 'store' });
        }
      })();
    });
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
    let size = 0;
    let rejected = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (rejected) return;
      if (size > 180000) {
        rejected = true;
        res.statusCode = 413;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'photo' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (rejected) return;
      void (async () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
          const allowed = ['message', 'state', 'history', 'preview'];
          if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !allowed.includes(key))) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'photo' }));
            return;
          }
          const plan = await planEdit({
            message: body.message,
            state: body.state,
            history: body.history,
            preview: body.preview,
            apiKey: groqKey(),
          });
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(plan));
        } catch (error) {
          const status = error && typeof error.status === 'number' ? error.status : 502;
          const code = status === 503 ? 'unconfigured' : status === 400 && error?.message === 'photo' ? 'photo' : 'guide';
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: code }));
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
  'usage.html',
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
