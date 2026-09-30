import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

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
