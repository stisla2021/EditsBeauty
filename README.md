# EditsBeauty

EditsBeauty is a privacy-first photo and portrait editor that runs in the browser. A person opens the page, chooses or captures a picture, and every filter, adjustment, crop, retouch, sticker, and background change is painted on a canvas on that device. The finished file is saved from that canvas. The photograph is not uploaded to an EditsBeauty server, and it is not kept after the page is left.

The optional AI guide does not generate a new picture. It chooses the same sliders and looks a person can move by hand. A small compressed copy of the photo is sent only after Settings has “Allow AI to see my photo (better results)” turned on, and that copy is not stored.

**Live app:** [https://editsbeauty.vercel.app/](https://editsbeauty.vercel.app/)  
**GitHub Pages:** [https://stisla2021.github.io/EditsBeauty/](https://stisla2021.github.io/EditsBeauty/)  
**Repository:** [https://github.com/stisla2021/EditsBeauty](https://github.com/stisla2021/EditsBeauty)

Version **V1.1.11**. Published by **StISLA2021**, Jalangbam near Brikama, The Gambia. Contact: [stisla2021@gmail.com](mailto:stisla2021@gmail.com). Copyright (c) StISLA2021.

`package.json` sets `"private": true`, so this package is not published to npm. The source is the product.

## What a person can do

### Open a photo and edit it

Start Editing, or any tool in the bottom bar, asks for a photo from the camera roll when none is loaded. The file is read with `FileReader` into an `HTMLImageElement` and drawn on `#canvas`. The longest edge is capped at **1080 px** on a phone (`max-width: 820px` or a coarse pointer, measured once when `app.ts` loads) and **1800 px** on a larger screen. That limit keeps the pixel work inside a phone browser.

The editor is a fixed studio (`#editor`). On a phone it fills the screen. From **1025 px** wide it becomes a centered card with a left tool rail, the canvas, and the control sheet. Back closes the studio and returns to the home screen. The original file on the device is not overwritten. Save writes a new file.

### Homepage

The home screen is Start Editing, Ask AI, then Face Details and the portrait rows. The bottom bar is the short pill: Home, a raised black Camera button, and Templates. Home scrolls to the top. Templates scrolls to the template grid. The scrolling editor tool bar stays hidden until a photo is open.

### Bottom tool bar

While the editor is open, the bottom of the screen is a horizontal tool dock (`.tool-dock`).

The camera is a black circle, slightly raised, fixed at the left of the bar so it stays reachable while the rest of the row scrolls. The scrolling row holds:

| Tool | What it opens |
| --- | --- |
| Filters | The filter sheet |
| Adjust | The Adjust board |
| Beauty | Retouch (smooth skin) |
| Background | Background scenes, after a person mask |
| Effects | The Glow look, titled Effects |
| Text | The text overlay field |
| Stickers | The sticker tray |
| Crop | The crop screen |
| Enhance | The enhance control, turned on |
| Compare | Hold to see the original pixels |
| Auto | One-tap Auto Beauty (filled teal so it stands out) |
| More | The full tools sheet |
| Profile | The on-device profile dialog |

The selected tool uses the teal accent `#14B8A6` with dark text `#042f2e`. On viewports up to 1024 px the older studio rail and the in-sheet Adjust / Filters / Crop tabs are hidden, so the dock is the toolbar. On a wide screen the left rail remains.

### Looks

Filter chips inside the editor apply a look in one tap. A second tap inside 350 ms is ignored so a finger that fires both `pointerup` and `click` does not apply the look twice. If no photo is loaded, the look is remembered and the file picker opens.

Beauty sets the Beauty color recipe and raises Smooth to 72. It does not move the Adjust sliders.

### Auto Beauty

Auto applies the Adjust recipe below, sets the Beauty look, and sets Smooth to 72. The editor title becomes “Auto Beauty”. If there is no photo yet, the recipe is ready and the file picker opens.

| Control | Value |
| --- | --- |
| Exposure | +10 |
| Brilliance | +18 |
| Highlights | −14 |
| Shadows | +20 |
| Contrast | +8 |
| Brightness | +4 |
| Black point | +6 |
| Saturation | +4 |
| Vibrance | +16 |
| Warmth | +6 |
| Tint | 0 |
| Sharpness | +16 |
| Definition | +12 |
| Noise reduction | 0 |
| Vignette | +8 |

### Adjust

Adjust is one horizontal row of circular icons and one slider for the selected tool. The tools, in order, are Auto, Exposure, Brilliance, Highlights, Shadows, Contrast, Brightness, Black Point, Saturation, Vibrance, Warmth, Tint, Sharpness, Definition, Noise Reduction, and Vignette. Every slider starts at 0. Opening a new photo resets them to 0 before the first paint, so a picture is not quietly graded. The photo changes when a slider moves or when Auto is tapped. The selected name and a signed value sit above the slider. A teal dot marks a control that is not 0, and Auto’s pressed state means the recipe above is applied. Undo and Redo include these moves.

Phone browsers ignore `CanvasRenderingContext2D.filter` on `drawImage` for several of these looks, so color recipes are painted by reading pixels (`paintFilterPixels`) rather than relying on the CSS filter string alone.

### Filters

The filter select and chips cover Original, Vivid, Vivid Warm, Vivid Cool, Dramatic, Dramatic Warm, Dramatic Cool, B/W (`mono` and `noir`), Silvertone, Fade, Instant, Transfer, Chrome, Film, Warm, Glow, Cool, Soft, Pink, Vintage, Pop, Matte, Golden, and Beauty. Each look is a small recipe of saturate, contrast, sepia, grayscale, hue, and brightness, mixed by the Intensity slider (default 100%).

### Retouch, teeth, and narrow

Retouch opens a full-screen smooth brush. Smooth is a two-layer box blur. When face landmarks exist, the blur is kept off the eyes, brows, and lips so those edges stay sharper than the skin. Teeth whitening lifts the mouth region (default amount 68 when the Teeth tool is used and the slider is still 0). Narrow Nose uses the same on-device face mesh to pull the nose region. If MediaPipe cannot load, the color tools still run and the page says so.

Face Details on the home screen are one-tap effects painted on the canvas: Smooth Skin, Lipstick, Eyelashes, Double Chin, Acne, and the related home effects (AI Retouch, AI BG Change, Red Car Light, Golden Hour, Slim, and others). They are canvas operations, not a generative model.

### Backgrounds

Background replacement uses MediaPipe Selfie Segmentation in the browser (`@mediapipe/selfie_segmentation` from jsDelivr) to build a person mask. The person stays. Behind them the page can place:

- **Blank**, a real transparent canvas. The stage shows a checkerboard. Save writes a PNG.
- **Blur**, a blurred copy of the original scene.
- Solid colors: White, Black, Gray, Cream, Red, Pink, Blue, Navy, Green, Teal, Yellow, Purple.
- Gradients: Sunset wash, Rose, Sky wash, Studio wash, Gold, Neon, Night wash, Mint.
- Photographs from Unsplash: Beach, City, Studio, Garden, Sunset, Mountains, Forest, Night, Cafe, Sky, Flowers, Ocean, Office, Snow, Desert, Library, Room, Brick, Street, Autumn, Waterfall, Park, Rain, Space.

Those scene files are stock pictures requested when a photo background is chosen. The person’s photo is not sent to Unsplash or to EditsBeauty. There is no generative background model in this repository.

Cutout is a local color-key around a chosen color and tolerance. The page states that a remove.bg key would have to live on a server and is not wired into the page.

### Text, stickers, and brushes

Text is drawn on the canvas from the overlay field. Stickers are a DOM layer on top of the canvas, not baked in until the picture is composited for save. The catalog is drawn in the page, not a commercial sticker pack:

- Shapes: star, heart, spark, blossom, sun, moon, ring, drop, diamond
- Beauty marks: gloss, lash, petal, mirror, blush
- Words: SOFT, GLOW, LOVE, YES, CUTE, WOW, HI, OK, NEW, SLAY
- Emoji groups: Smileys, Cute, Fun

Up to 24 stickers can sit on one photo. Drag moves one. Handles resize (scale 0.35 to 3.2) and rotate it. Brushes paint colored strokes into the canvas, with a size and color control.

### Crop, enhance, and compare

Crop opens its own screen with an angle slider and aspect choices, then replaces the working image with the cropped JPEG. Canvas shape in the editor includes the original ratio, a 4:5 ID portrait, a square crop, and expand-to-square, expand-to-portrait, and expand-to-story.

Enhance turns on a local clarity pass. The quick export row under Save sets the canvas shape and then uses the same save path:

| Button | Canvas value |
| --- | --- |
| Post | `id` (4:5 portrait) |
| Story | `expand-story` |
| Original | `free` |

Hold the photo, or hold Compare, and the canvas paints the untouched source and returns before filters and adjustments. Stickers are a separate layer, so a hold compares the photograph, not the sticker positions.

### Save

The file name is `EditsBeauty-YYYYMMDD-HHMMSS.jpg`, or `.png` when the background is Blank. JPEG quality is 0.95. The blob is built synchronously from `toDataURL` so a phone can still call `navigator.share` inside the user gesture. `toBlob` is a later task and would lose that gesture.

On Android, or on a phone-sized or coarse-pointer device, Save uses the system share sheet with a `File` when `canShare` allows it, and the toast says “Saved to Photos”. Cancelling the sheet does not also download. If share is unavailable, the file downloads and the toast says to open Photos or Gallery. A website cannot write the system photo library by itself. On a desktop browser the file downloads, and the toast names the file.

### Undo and redo

The editor keeps the last **15** stamps. A stamp can include the image, filter, intensity, smooth, teeth, nose, body, face volume, enhance, hair tint, every Adjust slider, the background, the home effect, stickers, and brush strokes. Undo and Redo restore that stamp and paint again.

### Camera

The camera button opens a full-screen view with three modes: **Portrait**, **Live**, and **Video**. Portrait starts on the Portrait lens: background blur 62 and edge feather 42, so the person stays sharper than the room. The front camera is mirrored.

A tray lists Original first, then Soft, Glow, Blush, Contour, Glasses, Cat, Crown, Earrings, Sparkle, Puppy, Hearts, Film, Portrait, White, and Sunset. Categories are All, Beauty, Makeup, Fun, Classic, and Backgrounds. The last lens and its strength are remembered on the device (`editsbeauty-camera-lens`, `editsbeauty-camera-strength`). Long-press a lens, or tap Tune, for strength and sliders from 0 to 100: skin smooth, slim face, V-shape jaw, chin, eye enlarge, eye brighten, nose slim, lips plump, lip color, teeth, foundation, blush, contour and highlight, soft glow, portrait blur, and edge feather. Save look stores that mix as My look (`editsbeauty-custom-look`).

Face landmarks come from MediaPipe Face Mesh, loaded from jsDelivr only when the camera or a face tool needs it. One face is tracked. `refineLandmarks` is on for a desktop machine with at least eight cores. Mesh drawing is off until the camera Mesh button or Settings “Face mesh overlay” is turned on. If the mesh script fails, color beauty still runs and the hint says so.

Fun lenses (glasses, cat ears, crown, earrings, sparkles, puppy ears, hearts) are drawn on the canvas from the landmark groups. They are original shapes in this repository, not copied lens assets.

Heavy reshape (slim, jaw, chin, eyes, nose, lips) runs in WebGL. The preview is capped: 480 px in Lite mode, 540 px on a low-core phone, 640 px on other phones, 960 px on desktop. If a frame costs more than 40 ms for several frames, or the preview stays under 20 fps, Lite mode turns reshape and decorative lenses down. Full quality in Tune turns them back on. Video and the short Live clip record the processed preview, including the current beauty and lens.

A denied camera permission does not block the editor. The camera view offers Upload photo.

### Grid studio and video studio

Photo grids take 1 to 9 pictures and lay them out as two columns, 2×2, 3×3, a horizontal strip, or a vertical strip. Tile shape is rectangle, rounded, or circle. Spacing, background color, and canvas shape (square, 4:5, 3:2, 9:16) are local. Save exports the grid canvas.

Video Studio previews a chosen video with a local look: Original, Soft retouch, Film, Monochrome, or Warm. Those are filters on the preview, not a generative video model. Export is a silent WebM. A screenshot button grabs the current preview frame.

### Other home tools

The tools sheet and the home cards also open paths that reuse the same editor: ID Photo, Cutout, Remover, Background Expansion, Batch Edit (the current filter and enhance pass on up to nine photos), Brushes, Hair tint, Body Tuner, Face Volume, Outfit, Fan Merch, Collage, Photo Strip, and Photobooth-style camera looks (Film Cam, Apple Mode, Glow Cam, Timestamp Cam). ChatEdit opens the guide. Tools that do not have a separate model fall through to Adjust, Filters, the camera, or a toast that names the limit. The page does not claim to be another company’s editor, and it does not ship that company’s sticker packs or lenses.

### Ask AI

Ask AI on the home screen, or AI in the editor, opens a chat. The person can drop or choose a photo and type a task in ordinary language, for example “make my skin smoother” or “brighten the photo and change the background to beach.”

The client sends `{ message, state, history, preview? }` to `/api/guide` when the host is `editsbeauty.vercel.app`, `localhost`, or `127.0.0.1`. From GitHub Pages the same request goes to `https://editsbeauty.vercel.app/api/guide`. The server calls Groq and forces a single `edit_photo` tool call. The tool may set smooth, teeth, a look, a background id, a home effect, a crop, auto, reset, save, and any Adjust slider. The reply is one or two sentences. The client then moves the real controls and paints. If Groq is unreachable or no `GROQ_API_KEY` is set, an on-device reader (`answerGuideLocal`) maps the same words onto the same controls.

Vision is off by default (`editsbeauty-ai-vision`). The first time it is turned on, a dialog explains that a small compressed copy is sent for that request only and is not stored. While it is on, and a photo is loaded, and the person just asked, the client builds a JPEG whose long edge starts at 384 px, quality 0.55 then 0.4, and whose data URL is at most 100,000 characters. The field name is `preview`. The server accepts only a `data:image/jpeg;base64` string under 120,000 characters. It is not written to a database or a log. The text model is `llama-3.3-70b-versatile`. If a preview is present, the server tries `meta-llama/llama-4-scout-17b-16e-instruct`, then `llama-3.2-11b-vision-preview`, and falls back to the text model. Temperature is 0.1 and `max_tokens` is 500. The guide does not identify the person and does not invent a new photograph.

Delete chat clears that conversation in the page.

### Profile

Profile in the dock opens a dialog. Sign in sends the email and password to `/api/account` over HTTPS. The server stores a salted scrypt hash, never the password itself, plus the display name, a profile photo no larger than a 96×96 JPEG, and up to 12 saved Looks. Editing photos are rejected. The same email and password sign the person in again after the app is deleted, and the name, photo, and Looks come back.

The browser keeps a session token in `editsbeauty-account`, not the password. Sign out removes that token from this browser. The server record remains.

If the database is not connected, sign-in falls back to this device only and the dialog says that deleting the app will remove the password.

Continue with Google and Continue with X do not perform OAuth and are not sent to Google or X. They keep a display name on this device. They do not survive deleting the app. Email and password do.

Saved Looks store the filter id and the Smooth value. Adjust sliders are not part of a saved Look.

### Feedback, diagnostics, and ratings

Feedback on the home page opens the mail client to stisla2021@gmail.com. That note is not stored by the site.

Diagnostic reports are off until Settings is turned on. Even then, nothing is posted until the person checks “I agree to send only the items listed above” and taps Store or Email. A report may include the app version, browser name and major version, mobile or desktop, a screen size rounded to the nearest 40 px, the tool or screen read from the page, the error and a short stack, a note, and a timestamp the server overwrites. It never includes the photo, the canvas, face landmarks, a name, or an email address. Store posts the allowlist and also opens the same text in the mail client. Email only opens the mail client. If the database is not configured, the mail draft is the backup and the response says nothing was stored.

After five edits, or after three days and at least one edit, the home page can ask for 1 to 5 stars and an optional note. Not now hides the question for 21 days. A rating does not include the photo. The totals are on [https://editsbeauty.vercel.app/usage](https://editsbeauty.vercel.app/usage).

## Architecture

```
index.html and the other pages
        │
        ├── menu.ts          theme, install, updates, settings, Vercel Analytics
        ├── app.ts           editor, guide client, save, dock, account
        ├── camera-live.ts   camera, Face Mesh, WebGL lenses
        ├── report.ts        diagnostic dialog
        └── usage.ts         anonymous counts and the rating dialog

Vite build  →  dist/
                 ├── HTML pages, style.css, assets/index.js, assets/menu.js
                 ├── sw.js and images/ copied after the bundle
                 └── ads.txt

Vercel
  ├── static dist/
  ├── api/guide.js     Groq tool call
  ├── api/report.js    diagnostic store
  ├── api/usage.js     anonymous counters
  └── api/account.js   email sign-in (salted password hash, name, small profile photo, saved Looks)
```

The client is TypeScript, target ES2020, `"strict": true`, compiled by Vite 8. Vite does not typecheck; `npx tsc --noEmit` does. There is no React and no framework runtime. `menu.ts` imports `inject` from `@vercel/analytics` and calls it once. The Next.js entry `@vercel/analytics/next` is not used, because it depends on React.

`vite.config.js` is a multi-page build. `base` is `./` so the same `dist` works on GitHub Pages in a project subpath and on the Vercel root. `publicDir` is false. Entry and chunk names are `assets/[name].js` with no content hash, so `sw.js` can precache stable paths. CSS is emitted as `style.css`. A `closeBundle` hook copies `sw.js`, `public/ads.txt`, and every file in `images/` into `dist`.

Local `vite` and `vite preview` also mount `/api/guide`, `/api/report`, and `/api/usage` through the same modules the Vercel functions use. `GROQ_API_KEY` is read from the environment or from a local `.env` that is gitignored. The key is not written into the client bundle.

Rendering is coalesced. Slider input calls `scheduleRender`, which paints on the next animation frame. Discrete actions (opening a photo, releasing a pointer, applying a look, Auto, the guide) call `render()` directly.

### Service worker

`sw.js` is hand-written, not generated. `APP_VERSION` is `1.1.11` and `CACHE` is `editsbeauty-shell-v39`. Those two constants change together. Install precaches the shell and does not call `skipWaiting`, so an open session keeps running. Activate deletes every other cache and calls `clients.claim()`.

Fetch handles same-origin GET requests for images, HTML, JS, CSS, and JSON. Images are cache-first. Documents and code are network-first, then cached. A failed navigation falls back to `index.html`. POST requests, including `/api/guide`, `/api/report`, and `/api/usage`, are not intercepted. `usage.html` is not in the precache list.

`menu.ts` registers `./sw.js` with `updateViaCache: 'none'`, asks the worker for its version over a `MessageChannel`, and checks again when the tab becomes visible, on `pageshow`, and once an hour.

The update banner is deliberate:

- A normal browser tab does not show it.
- The first launch from the Home Screen does not show it.
- iPhone and iPad never show it. A newer version is applied quietly, caches are cleared, and the page reloads with a cache-busting query.
- On other installed devices, after the app has been opened before, the banner appears only when the waiting worker’s version differs. Update posts `SKIP_WAITING` and reloads. The × stores the dismissed version in `sessionStorage` for this visit.

### Install

`beforeinstallprompt` is captured in a small inline script and again in `menu.ts`, and `preventDefault` is always called so the browser does not show its own mini-infobar. Install is hidden on Apple devices, including iPadOS that reports as Mac with a touch screen. It stays hidden after install: `localStorage` key `editsbeauty-installed`, a standalone or fullscreen display mode, `navigator.standalone`, or `getInstalledRelatedApps`. A later `beforeinstallprompt` does not clear that flag, which is what kept the button from returning on Android. The button stays hidden until a real prompt exists. A touch `pointerup` starts the native prompt once; the following click is ignored while that prompt is opening.

The manifest is standalone, portrait-primary, with 192 and 512 icons and a maskable 512. `related_applications` points at the Vercel manifest so a related-app check can see an existing install.

## Privacy

| Data | Where it goes |
| --- | --- |
| The photo being edited | Canvas and memory on the device. Dropped when the page closes. Not posted. |
| Camera frames and face landmarks | On the device, for the session. Not posted. |
| Optional guide preview | One JPEG for that request, only if the Settings switch is on. Not stored by the API. |
| Profile name, small profile photo, saved Looks, and a salted password hash | `/api/account`, so sign-in works after the app is deleted. The password itself is not stored. Editing photos are not accepted. |
| Diagnostic report | Only after the Settings switch and an explicit checkbox. Allowlisted fields. |
| Usage event | Anonymous. Visitor id is hashed on the server to 24 hex characters. No name, email, photo, or face data. |
| Vercel Web Analytics | Page views on `editsbeauty.vercel.app` only, from `@vercel/analytics`. GitHub Pages does not load a working insights script. |
| Scene backgrounds | Stock Unsplash URLs. The user’s photo is not part of that request. |
| MediaPipe files | Loaded from jsDelivr when a face or background tool needs them. |

Country on the usage record is taken only from the `x-vercel-ip-country` header. The client does not send a location.

## PWA and performance choices

- Viewport is `width=device-width, initial-scale=1`. Pinch zoom stays available.
- `touch-action: manipulation` is on buttons and fields. Adjust icon rows and the tool dock use `pan-x` so a sideways swipe scrolls the tools instead of the page.
- `scroll-behavior` on the document is `auto`. A few in-app jumps still use `behavior: 'smooth'`.
- `will-change` is limited to the studio sheet transform and the sheet backdrop opacity.
- Preview paints are coalesced with `requestAnimationFrame`.
- Phone canvases are capped at 1080 px on the long edge. The live camera uses a smaller cap and drops to Lite mode under 20 fps.
- WebGL does the camera warp and blur. If WebGL is missing, a 2D fallback still draws color beauty.
- The shell is precached after the first successful visit, so Filters, Adjust, crop, and the camera can open again offline. A background that needs a new Unsplash file, or a mesh script that was never cached, still needs the network.
- Theme follows System, Light, or Dark (`editsbeauty-theme`). The control is on the Settings page. Dark mode keeps the same teal accent and shifts surfaces to `#14181f` / `#1e242e`. The theme-color meta tag updates with the theme.
- A splash mark shows while the first paint settles. An online/offline pill tracks connectivity.

## Design

The accent is `#14B8A6`. Text on a teal fill is `#042f2e` so it stays readable in both themes. Cards are softly rounded. Tool icons share a 1.75 px stroke. The dock uses the surface color, a 28 px radius, and a shadow, with the camera circle sitting above the pill. Focus rings use the accent.

## Analytics and storage order

Anonymous usage and diagnostic reports share a storage order:

1. Postgres, through `@neondatabase/serverless`, when `POSTGRES_URL`, `DATABASE_URL`, or `POSTGRES_URL_NON_POOLING` is set. The code creates `usage_snapshot` or `diagnostic_reports` if needed.
2. Supabase REST when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set. Run `sql/usage-snapshot.sql` once for usage, and `api/diagnostic-reports.sql` once for reports. The SQL file for usage lives outside `api/` on purpose: Vercel treats every file under `api/` as a function, and `api/usage.sql` next to `api/usage.js` fails the deploy.
3. Redis or Upstash when `KV_REST_API_URL` / `UPSTASH_REDIS_REST_URL` and the matching token are set. Reports are an `LPUSH` trimmed to 200. Usage is a single JSON document.
4. If the process is not on Vercel, a local file: `data/usage.json` or `data/reports.json`, capped at 200 reports. `data/` is gitignored.
5. On Vercel with none of the above, the handler returns 503.

After a report is stored, `RESEND_API_KEY` can email it to stisla2021@gmail.com. A mail failure does not fail the store. `REPORT_EMAIL_FROM` overrides the default Resend sender.

`GET /api/usage` returns the summary. Rating comments are included only when `USAGE_VIEW_KEY` is unset and the process is not on Vercel, or when the `X-Usage-Key` header matches the key. The usage page sends that key from a password field. It is `noindex`.

Vercel Web Analytics is separate. `inject()` in `menu.ts` loads `/_vercel/insights/script.js` in production. It does not send from local development. It is not also called from `app.ts`, so a page view is counted once.

## Pages

| File | Role |
| --- | --- |
| `index.html` | Home, editor, camera, guide, dock, profile |
| `settings.html` | Settings. `noindex`. Shows V1.1.11 |
| `about.html` | Publisher, mission, and a short description of each face tool |
| `faq.html` | Editor, privacy, and site questions |
| `privacy-policy.html` | Privacy policy |
| `privacy.html` | Redirects to the privacy policy |
| `terms.html` | Terms of use |
| `contact.html` | Contact |
| `licensing.html` | Open-source component notices |
| `copyright.html` | Copyright notice |
| `fontlicense.html` | Font license |
| `usage.html` | Anonymous usage dashboard. `noindex` |

`ads.txt` publishes the AdSense line `google.com, pub-7160015922473007, DIRECT, f08c47fec0942fa0`. The homepage and terms page load the official AdSense script for that publisher id. The id is public by design.

## Run it locally

```powershell
npm install
npx tsc --noEmit
npm run build
npx vite preview
```

`npm run build` is `vite build`. The site is written to `dist/`. For live reload while editing, `npx vite` serves the TypeScript modules directly and attaches the three API routes. Put `GROQ_API_KEY` in `.env` if you want the guide to call Groq. Without it, the guide falls back to the on-device reader and the preview still edits photos.

Node 22 is what GitHub Actions uses. The lockfile is `package-lock.json`.

## Deploy

Pushes to `main` do two things.

GitHub Actions (`.github/workflows/pages.yml`) runs `npm ci` and `npm run build` on Node 22 and deploys `dist` to GitHub Pages. Wait for that workflow before expecting [https://stisla2021.github.io/EditsBeauty/](https://stisla2021.github.io/EditsBeauty/) to change. Pages can serve the app. It cannot record Vercel Web Analytics, and its guide calls are sent to the Vercel origin.

`vercel.json` sets `buildCommand` to `npm run build`, `outputDirectory` to `dist`, and `cleanUrls` to true. Vercel also picks up `api/*.js`. The production site is [https://editsbeauty.vercel.app/](https://editsbeauty.vercel.app/). Set `GROQ_API_KEY` on the Vercel project for the hosted guide. Connect Postgres, Supabase, or Redis if reports and usage should be stored. Set `USAGE_VIEW_KEY` if rating notes should stay hidden until that key is typed on the usage page. None of those secrets belong in git.

When shipping a visible change, bump `APP_VERSION` and `CACHE` in `sw.js` together, and the same version string in `report.ts`, `settings.html`, `about.html`, this file, and `note.md`. The update banner keys off `APP_VERSION`.

## Environment variables

| Name | Used for |
| --- | --- |
| `GROQ_API_KEY` | Guide completions. Absent means 503, then the on-device reader. |
| `POSTGRES_URL`, `DATABASE_URL`, `POSTGRES_URL_NON_POOLING` | Reports and usage. Tables are created if missing. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | REST fallback. Tables must already exist. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Redis fallback. Upstash names are also read. |
| `RESEND_API_KEY`, `REPORT_EMAIL_FROM` | Optional email after a report is stored. |
| `USAGE_VIEW_KEY` | Shows rating comments on `GET /api/usage`. |
| `VERCEL` | Set by Vercel. When set, the file fallback is disabled. |

## What this repository does not do

- It does not upload the picture a person is editing.
- It does not generate a new photograph or a new background.
- It does not sign in to Google or X. Those buttons keep a display name on the device.
- It does not store a readable password. Sign-in keeps a salted hash so the same password works after the app is deleted.
- It does not write the system photo library silently. Phones go through the share sheet.
- It does not apply the Settings switches for HEIC, “Save to EditsBeauty Album”, sticker cleanup, image-resolution label, Live Photo format, or language to the canvas. Those controls store a preference in `localStorage`. Save is still JPEG, or PNG for a blank background, at the sizes described above.
- It does not ship BeautyPlus, Snapchat, CapCut, or other commercial lens and sticker packs. The dock is inspired by a horizontal editing bar. The assets are the ones in this repository.

## License and attribution

Copyright (c) StISLA2021. Component notices are in `licensing.html`, `copyright.html`, and `fontlicense.html`. Scene photographs are loaded from Unsplash at the URLs in `app.ts`. MediaPipe is loaded from the jsDelivr npm CDN when a face or segmentation tool runs.
