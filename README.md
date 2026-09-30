# EditsBeauty

On-device portrait and photo editor. Photos stay in the browser. Filters, crop, retouch, and save all run on the device.

**Live app:** https://stisla2021.github.io/EditsBeauty/

Version V1.0.0. Copyright (c) StISLA2021.

## Run it locally

From this folder:

```powershell
python -m http.server 5173
```

Open http://localhost:5173/index.html

## Build

TypeScript in `app.ts` and `menu.ts` compiles into `dist/`.

```powershell
npm run build
```

`sw.js` is plain JavaScript and is not compiled.

## Deploy

Pushes to `main` publish the site with GitHub Actions (`.github/workflows/pages.yml`). The live address is https://stisla2021.github.io/EditsBeauty/

After a push, the Pages workflow must finish before the new files show up.

## Pages

| File | What it is |
| --- | --- |
| `index.html` | Editor |
| `settings.html` | Settings |
| `about.html` | About |
| `privacy.html` | Privacy Policy |
| `terms.html` | Terms of Service |
| `licensing.html` | Open-source licensing |
| `copyright.html` | Copyright notice |
| `fontlicense.html` | Font license |
