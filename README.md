# EditsBeauty

EditsBeauty is a portrait and photo editor that runs in the browser. A person opens the page, chooses or takes a picture, and filters, adjustments, crop, retouch, stickers, and background changes are painted on a canvas on that device. Save writes a new file. The photograph is not uploaded to an EditsBeauty server.

**Live app:** [https://editsbeauty.vercel.app/](https://editsbeauty.vercel.app/)  
**Repository:** [https://github.com/stisla2021/EditsBeauty](https://github.com/stisla2021/EditsBeauty)

Version **1.1.12**. Published by StISLA2021 (Ismaila Jallow), Jalangbam near Brikama, The Gambia. Contact: [stisla2021@gmail.com](mailto:stisla2021@gmail.com).

The license is proprietary. See `LICENSE`. A buyer may replace that file.

## What it does

- Open a photo or use the camera, then edit it in the studio.
- One-tap looks, including Pearl, Honey, and Mist, plus Adjust, smooth skin, teeth, crop, text, stickers, and backgrounds.
- Compare the original with the edit by holding the photo or dragging Before / After.
- Save a JPEG, PNG, or WebP. The default save is still a 95% JPEG at the on-screen size, or a PNG when the background is blank. Full resolution and social sizes (Instagram square and story, Facebook cover, YouTube thumbnail, TikTok) are optional.
- Ask the optional AI guide to move the same controls. It does not invent a new photograph.
- Install the page on a home screen. A short first-run tour explains the first steps and can be skipped.
- Pro lists HD export, no ads, and extra presets. Payments are not connected. The plug-in point is `startProCheckout` in `menu.ts`.

Editing previews keep the long edge at 1080 px on a phone and 1800 px on a larger screen so the page stays responsive. Full-resolution export paints from the original pixels at save time, with a browser safety cap of 4096 px on a phone and 8192 px on desktop.

## Offline

After the page has loaded once, filters, Adjust, crop, and the camera open again without a connection. The optional AI guide, a stock background that has not been saved yet, and the face model the first time it is downloaded still need the network.

Use that same description in the GitHub About text. Do not describe the app as working 100% offline.

## Run it locally

Node 22 is what GitHub Actions uses.

```bash
npm install
npx tsc --noEmit
npm run build
npx vite preview
```

`npm run build` writes the site to `dist/`. For live reload, `npx vite` serves the TypeScript directly and attaches the API routes.

Copy `.env.example` to `.env` if you want the guide or ads locally. Without `GROQ_API_KEY`, the guide falls back to the on-device reader and photos still edit.

## Deploy

Pushes to `main` deploy in two places.

GitHub Actions (`.github/workflows/pages.yml`) runs `npm ci` and `npm run build` on Node 22 and publishes `dist` to GitHub Pages. Pages can serve the app. The guide calls from Pages go to the Vercel origin, and Pages does not record Vercel Web Analytics.

`vercel.json` sets the build to `npm run build`, the output to `dist`, and clean URLs. Vercel also publishes `api/*.js`. The production site is [https://editsbeauty.vercel.app/](https://editsbeauty.vercel.app/).

Set the environment variables below on the Vercel project before you expect ads, the hosted guide, or stored accounts. None of those values belong in git.

When a visible change ships, bump `APP_VERSION` and `CACHE` together in `sw.js`, and the same version in `report.ts`, `settings.html`, `about.html`, and this file.

## Environment variables

| Name | Used for |
| --- | --- |
| `GROQ_API_KEY` | Guide completions. Absent means the on-device reader. |
| `ADSENSE_CLIENT` | Public publisher id, `ca-pub-` plus digits. Injected into the ad script at build time. Blank means no ad script. |
| `ADSENSE_ADS_TXT` | Optional full `ads.txt` line. Blank with a client id writes the standard Google line for that publisher. |
| `POSTGRES_URL`, `DATABASE_URL`, `POSTGRES_URL_NON_POOLING` | Accounts, reports, and usage. Tables are created if missing. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | REST fallback. Tables must already exist. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Redis fallback. `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are also read. |
| `RESEND_API_KEY`, `REPORT_EMAIL_FROM` | Optional email after a report is stored. |
| `USAGE_VIEW_KEY` | Shows rating comments on `GET /api/usage`. |
| `VERCEL` | Set by Vercel. When set, the local file fallback is disabled. |

The AdSense publisher id used by the previous build was public: `ca-pub-7160015922473007`. Set `ADSENSE_CLIENT` to that value on Vercel if the current owner wants the same ads to keep loading. It is not a secret key. Leave it unset for a build with no ads.

`ads.txt` is generated during `npm run build`. It is not stored with a publisher id in git.

## Project layout

```
index.html and the other pages
        │
        ├── menu.ts          theme, install, settings, Pro placeholder, analytics
        ├── app.ts           editor, guide client, save, camera entry, account
        ├── camera-live.ts   camera, Face Mesh, lenses
        ├── report.ts        diagnostic dialog
        └── usage.ts         anonymous counts and the rating dialog

Vite build → dist/
Vercel     → api/guide.js, api/report.js, api/usage.js, api/account.js
```

`menu.ts` calls `inject` from `@vercel/analytics` once per page. Do not add a second call.

Storage order for accounts, reports, and usage is Postgres, then Supabase, then Redis, then a local file when the process is not on Vercel, otherwise 503.

## What this repository does not do

- It does not upload the picture a person is editing.
- It does not generate a new photograph.
- It does not sign in with Google or X. Those buttons are marked coming soon.
- It does not charge for Pro. `startProCheckout` in `menu.ts` is the marked plug-in point.
- It does not write the system photo library by itself. Phones use the share sheet.
- It does not include a separate HEIC encoder, an album switch, or a language picker. Those controls did not change the photo, so they were removed.

## License

Copyright (c) 2026 Ismaila Jallow. All rights reserved. See `LICENSE`. A buyer can replace that file. Component notices are in `licensing.html`, `copyright.html`, and `fontlicense.html`.
