# EditsBeauty notes

Updated 3 October 2026 from the source on `main`.

- Site: https://stisla2021.github.io/EditsBeauty/
- Canonical URL: https://editsbeauty.vercel.app/
- Repository: https://github.com/stisla2021/EditsBeauty
- Branch: `main`
- Version: V1.1.11
- Service-worker cache: `editsbeauty-shell-v39`
- Publisher: StISLA2021, Jalangbam near Brikama, The Gambia
- Email: stisla2021@gmail.com
- Copyright: (c) StISLA2021

This file is the engineering record. The public project overview is `README.md`. Both were written from the files in this checkout, not from a feature list kept beside the code.

## What the application actually does

EditsBeauty is a multi-page static site plus three serverless endpoints. The editor is one canvas. A chosen image is decoded in the browser, scaled so the long edge is at most 1080 px on a phone and 1800 px otherwise, and stored as `originalImage`. `render()` crops to the canvas aspect, paints the look in pixels, applies Adjust, smooth, teeth, hair, body, face volume, enhance, brushes, the home effect, and the background mask, then the sticker layer is positioned over the canvas in the DOM.

Nothing in that path posts the canvas. The network calls that exist are listed later, and each one has a reason that is not “upload the edit.”

`phoneDevice` is `matchMedia('(max-width: 820px), (pointer: coarse)')` captured once at load in `app.ts`. It is not recomputed on resize. `maxDimension` follows it for the life of the page.

`scheduleRender` sets one `requestAnimationFrame`. A second input event before that frame does not schedule another. Pointer-up, a new photo, Auto, a guide result, and other one-shot actions call `render()` themselves.

Looks are not left to `ctx.filter` on `drawImage`. Phone browsers drop that filter. `paintFilterPixels` reads the destination rectangle and applies the recipe. Smooth uses two offscreen canvases and a box blur, and when an oval, eyes, and mouth are known it keeps the blur off those features.

## Source map

| File | Responsibility |
| --- | --- |
| `index.html` | Home sections, studio, crop screen, retouch and narrow screens, tools sheet, tool dock, profile dialog, camera view, guide, feedback form. Loads `menu.ts` then `app.ts`. |
| `app.ts` | Editor state, render, tools, undo, save, guide client, dock, local account. |
| `camera-live.ts` | getUserMedia loop, Face Mesh, lens tray, WebGL warp and blur, Lite mode, still-landmark export. |
| `menu.ts` | Theme, hamburger, install, update banner, settings switches, cache measure, `startReports`, `startUsage`, `inject()`. |
| `report.ts` | Diagnostic dialog and the allowlisted POST. Version string `1.1.11`. |
| `usage.ts` | Anonymous event queue, rating dialog. |
| `guide-plan.js` | Groq tool call and `normalizePlan`. |
| `api/guide.js` | Vercel handler and CORS for the guide. |
| `api/report.js` | Vercel handler for diagnostics. |
| `report-store.js` | Accept, store, and optional Resend mail. |
| `api/usage.js` | Vercel handler for counts. |
| `usage-store.js` | Accept, aggregate, summarize, store. |
| `usage.html` | Dashboard. Not precached. `noindex`. |
| `sw.js` | Hybrid cache. Version and cache name live here. |
| `vite.config.js` | Multi-page build, local API middleware, copy of `sw.js`, images, and `ads.txt`. |
| `manifest.json` | Standalone portrait PWA. Related app URL is the Vercel manifest. |
| `style.css` | Tokens, dock, studio, camera, dialogs. One emitted `style.css`. |
| `sql/usage-snapshot.sql` | Supabase-only usage table. Kept out of `api/`. |
| `api/diagnostic-reports.sql` | Supabase-only reports table. Name does not collide with `api/report.js`. |
| `.github/workflows/pages.yml` | `npm ci`, `npm run build`, deploy `dist` to GitHub Pages on Node 22. |

`tsconfig.json` includes only `app.ts`, `menu.ts`, `camera-live.ts`, `report.ts`, and `usage.ts`. The API files are plain JavaScript. Vite does not run `tsc`.

## Home screen

The hidden heading is “EditsBeauty free photo editor.” Visible first actions are Start Editing and Ask AI. Then a Looks row (`data-look`: beauty, glow, golden, soft, film, vivid, vintage, pink). Then Face Details cards (`data-effect`), example portraits (`data-sample`), and the category grids (Better Vibes, outfits, trending, ink, looks, retouch, PFP, carousels, photobooth, templates). A short note from Jalangbam sits lower on the page. Feedback is a mailto form. The footer links Home, About, Privacy, Terms, Feedback, Contact, and FAQ.

Example portraits do not replace the user’s photo. Choosing one applies that look to the photo already chosen.

The splash is `#splash` with `images/logo.png`. `#offlinePill` reads Online or Offline.

## Tool dock

Markup is `<nav class="tool-dock">`. `#navCamera` is a sibling of `.tool-dock-row`, not a child, so horizontal overflow does not clip the raised circle. CSS: the camera SVG is 58×58, black, `translateY(-16px)`. The row scrolls with `overflow-x: auto`, `touch-action: pan-x`, and a hidden scrollbar.

`data-dock` values and handlers in `app.ts`:

- Camera is the existing `#navCamera` click. The dock listener returns immediately for Camera so the prompt is not opened twice. It calls `openCamera` and `noteTool('Camera')`.
- Filters and Adjust call `setStudioTab` and, with no photo, `requestPhoto`.
- Beauty calls `openPortrait('retouch')`.
- Effects sets the Glow look, opens Filters, and titles the studio “Effects.”
- Text, Stickers, Crop, Enhance, and Background call the first matching `[data-tool]` button, which is the existing tool router.
- Compare is pointer-driven, not click-driven. `holdCompare` makes `render` draw `originalImage` with filter `none` and return. The canvas listener skips the hold when a brush stroke is active or the point hits a sticker.
- Auto Beauty calls `remember`, sets filter `beauty`, Smooth 72, `applyAutoAdjust(true)`, titles the studio “Auto Beauty”, and notes Retouch plus an edit.
- More calls `openTools()`.
- Profile calls `accountSheet.showModal()`.

`markDock` sets `aria-pressed` on the matching `data-dock` button. `setStudioTab` also marks Filters, Adjust, or Crop. Selected fill is `var(--accent)` and `var(--accent-ink)`. Auto uses `.tool-dock-auto` so the teal fill is present before selection. A selected Auto adds an inset ring.

`z-index`: dock 36, studio 32, crop 34, portrait 40, camera 24, toast 42, install button 38. The dock is `visibility: hidden` while `#cameraView` is shown, because the camera layer is underneath it. `body` has bottom padding so the home page clears the dock. `.studio` and `.crop-screen` have bottom padding so the canvas clears it.

At `max-width: 1024px`, `.studio-rail` and `.studio .editor-tabs` / `.crop-screen .editor-tabs` are `display: none`. The later desktop media query still turns the rail into a left grid at `min-width: 1025px`.

## Adjust board

Order of `adjustControlIds`: exposure, brilliance, highlights, shadows, contrast, brightness, black point, saturation, vibrance, warmth, tint, sharpness, definition, noise, vignette.

`autoAdjustRecipe`: 10, 18, −14, 20, 8, 4, 6, 4, 16, 6, 0, 16, 12, 0, 8.

`applyAutoAdjust(true)` writes every slider, then `syncAdjustBoard()`, so `#adjustLive` shows the signed value of the selected tool (Exposure reads `+10`) and Auto’s `aria-pressed` follows `autoRecipeActive()`. `applyAutoAdjust(false)` writes zeros. `zeroAdjustControls()` runs at the start of a new photo inside `openPhoto`, before `render`. The Beauty filter sets Smooth to 72 and does not write warmth or brilliance.

Selection is the class `is-selected`. Auto’s `aria-pressed` means the recipe is on, not that Auto is the selected icon. The default selected tool is Exposure. Selecting a tool scrolls the icon row with `scrollTo`, not `scrollIntoView`. The initial `selectAdjustTool('adjustExposure')` does not scroll. Auto hides the slider by adding `is-auto` on the board.

Icon chrome: light mode, a white circle and a 2.5 px black inset ring when selected; dark mode, `#1c1c1e` and a white ring. Unselected circles are `#ececf1` and `#3a3a3c`. A teal dot (`is-changed`) shows when the value is not 0, or when Auto is pressed.

`#panelAdjust` uses `touch-action: auto`. The icon row uses `pan-x`.

## Looks and the 350 ms guard

`selectLook` records `lastLookTap` and returns when the new tap is under 350 ms. Both `pointerup` and `click` call it, and `click` also `preventDefault`. A test or a script that fires both must wait. Do not remove the guard to “fix” a double event. A pointer that moves more than 12 px before release is treated as a scroll and does not select.

`lookRecipes` keys: original, film, warm, glow, cool, vivid, vivid-warm, vivid-cool, dramatic, dramatic-warm, dramatic-cool, mono, silvertone, noir, fade, instant, transfer, chrome, soft, pink, vintage, pop, matte, golden, beauty. Intensity mixes the recipe toward identity. `noir` and `mono` are both grayscale recipes; the visible B/W chips map onto them.

## Backgrounds

`backgroundScenes` kinds are `blank`, `blur`, `color`, `gradient`, and `photo`. Photo entries are Unsplash URLs with `w=1600`. The person mask comes from MediaPipe Selfie Segmentation. The script URL is `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js`, and `locateFile` uses the same package path. Blank clears the outside of the mask. The stage uses a checkerboard in CSS. Save of a blank background uses `image/png`. Every other save uses `image/jpeg` at 0.95.

There is no model in the repo that invents a background. “AI BG Change” on the home screen is the on-device blur-behind-person effect.

## Stickers, text, brushes

`stickerCatalog` groups: Shapes, Beauty, Words, Smileys, Cute, Fun. The items are listed in `app.ts` around the catalog constant. Cap is 24. Positions are normalized 0–1. Scale is clamped from 0.35 to 3.2. Rotation is radians from the handle. Stickers live in `stickerOverlays` and are part of the undo stamp. They are not pixels until a composite for export includes them.

Brushes push `BrushStroke` records (`color`, `size`, `mode`, `points`) and are in the same stamp. A brush pointer-down does not start hold-to-compare.

## Undo

`HISTORY_LIMIT` is 15. `EditorStamp` holds a token, optional image data URL, filter, intensity, smooth, teeth, nose, body, face, enhance, enhanced flag, hair, hair color, the Adjust map, background, effect, stickers, and brushes. `remember()` pushes before a mutating gesture. Redo is the other stack. Applying a stamp sets `applyingHistory` so slider listeners do not record the restore as a new edit.

## Save path

`photoFileName` builds `EditsBeauty-YYYYMMDD-HHMMSS.jpg` or `.png`. `blobFromCanvas` uses `toDataURL` and `atob` in the same turn so `navigator.share` still sees a user activation. `wantsPhotoLibrary` is true for an Android user agent or for `phoneDevice`. When that is true and `canShare({ files })` is true, `navigator.share({ files, title: 'EditsBeauty' })` runs and the toast is “Saved to Photos”. `AbortError` returns without a download. Any other share failure falls through to `downloadBlob` and the toast “Saved. Open Photos or Gallery to see it.” Desktop toast is `Saved ${fileName}`.

Export presets set `#photoRatio` to `id`, `expand-story`, or `free`, dispatch `change`, then click `#downloadBtn`. That is the only save path. If there is no photo, the buttons toast and open the picker.

The About page still describes an older filename, `editsbeauty-edit.jpg`. The code path above is the one that runs.

## Camera

Modes are only `portrait`, `live`, and `video`. Default lens id is `portrait` with blur 62 and feather 42. `starterLenses` is the full tray: original, soft, glow, blush, contour, glasses, cat, crown, earrings, sparkle, puppy, hearts, film, portrait, white, sunset. Decorative `draw` functions use landmark groups from `groupLandmarks`. A set with fewer than 300 points is rejected.

`processingCap`: Lite 480, phone with `hardwareConcurrency <= 4` then 540, other phones 640, otherwise 960. Mesh input is further scaled so its width is at most 320. Face Mesh options: `maxNumFaces: 1`, `refineLandmarks` only when not a phone and cores are at least 8, detection and tracking confidence 0.5. The script is `@mediapipe/face_mesh` from jsDelivr.

`meter` counts a frame over 40 ms as slow. Eight slow frames (eighteen if the person asked for full quality) turn Lite on. Independently, two half-second windows under 20 fps turn Lite on unless full quality was requested. The hint line is `WebGL` or `Basic` or `Lite mode`, preview fps, and mesh fps or a failure sentence.

Front camera frames are scaled by −1 on the x axis in `blitSource`. WebGL programs are a warp (slim, jaw, chin, eye, nose, lips), a blur, and a composite. `reshapeOn` is false in Lite or when those six amounts sum to 0. `drawFallback` covers a missing WebGL context.

Keys: `editsbeauty-face-mesh`, `editsbeauty-camera-lens`, `editsbeauty-custom-look`, `editsbeauty-camera-strength`.

`currentLandmarks` and `publishStillLandmarks` let the still editor reuse a mesh result. The still editor also loads Face Mesh itself for retouch and narrow, with the same CDN.

## Guide

Client `guideEndpoint()`: same origin `/api/guide` on vercel.app, localhost, and 127.0.0.1. Otherwise `https://editsbeauty.vercel.app/api/guide`.

Body keys allowed: `message`, `state`, `history`, `preview`. Any other key is rejected as `photo` so a data URL cannot ride in under another name. State must not contain `data:image`. Message is trimmed to 500 characters and rejected if it contains `data:image` or `base64,`.

`guidePreview` returns `''` unless `editsbeauty-ai-vision` is `on` and `originalImage` exists. It shrinks the long edge from 384 toward 64 until the JPEG data URL is at most 100,000 characters. First quality is 0.55, later attempts 0.4. The server `acceptPreview` allows only `data:image/jpeg;base64,…` up to 120,000 characters.

Local dev middleware rejects a body over 180,000 bytes with `{ error: 'photo' }`.

Models and call shape are in `guide-plan.js`: text `llama-3.3-70b-versatile`; vision scout then llama-3.2-11b-vision-preview; `tool_choice` forced to `edit_photo`; temperature 0.1; `max_tokens` 500. No paid Qwen model is called. Vision HTTP statuses 400, 404, 408, 413, 422, 429, 500, 502, and 503 try the next vision model and then the text model. A missing key is status 503 and code `unconfigured`. The client treats a non-OK response as “use `answerGuideLocal`.”

`normalizePlan` clamps smooth and teeth to 0–100, noise to 0–100, other Adjust keys to −100–100, and drops unknown look, background, effect, and crop names. Crop names become the numeric ratios in `CROPS`.

The system prompt tells the model to omit controls the person did not ask to change, to treat “a little” as small numbers (brightness 12, smooth 40, teeth 35, warmth 10) and a normal request as smooth 72, teeth 68, brightness 24, and to set `save` only when the person asked to save. `reply` is capped at 400 characters.

`noteGuide` counts a guide request. `noteVision` counts the moment the Settings switch is turned on, not every preview.

Timeouts in the client are 25 seconds with a preview and 15 seconds without. On timeout or network failure the local reader runs.

## Profile

Sign in posts `{ action: 'sign-in', email, password, name }` to `/api/account`. The same host rule as usage applies: same origin on Vercel or localhost, otherwise `https://editsbeauty.vercel.app/api/account`. GitHub Pages can sign in through the Vercel function.

`account-store.js` stores a scrypt hash as `scrypt$<salt hex>$<hash hex>`. The password is not written, not logged, and not returned. A random 32-byte token is returned once. The server keeps only `sha256(token)`. Later profile-photo and Look updates send `Authorization: Bearer <token>` with `action: 'update'`. A wrong password is 401. A new email creates the account. The same email and the same password sign in again and return the name, the small JPEG, and the saved Looks.

Allowed body keys are `action`, `email`, `password`, `name`, `photo`, and `looks`. A profile photo must be a JPEG data URL of at most 30,000 characters. Looks are at most 12 items of `{ name, look, smooth }`. Keys that look like a canvas, landmark, or edit are rejected.

Storage order matches usage: Postgres (`accounts` is created if needed), else Supabase REST (run `sql/accounts.sql` once), else Redis key `editsbeauty:accounts`, else `data/accounts.json` when not on Vercel, else 503. On 503 the page keeps a device-only hash and says deleting the app removes it.

`editsbeauty-account` on the device is `{ email, name, photo, token, provider, synced }`. `synced: true` means the token is a server session. The password is not in that object. Sign out deletes the local record only.

Continue with Google or X still writes a display name on this device and does not call Google or X.

`looksKey` is `editsbeauty-saved-looks`. A saved look is `{ name, look, smooth }`. The list is deduped by `look`, newest first, sliced to 12. A synced account also posts that list. Applying one sets the filter and Smooth. It does not restore Adjust.

## Settings that the editor does not read

`menu.ts` persists these keys. `app.ts` never reads them. They change the label or the switch on the Settings page and nothing else:

| Key | Control | Default |
| --- | --- | --- |
| `editsbeauty-save-album` | Save to EditsBeauty Album | on |
| `editsbeauty-resolution` | Image Resolution cycles High, Standard, Original | High |
| `editsbeauty-live-format` | Live Photo format cycles Ask every time, Live, Still | Ask every time |
| `editsbeauty-sticker-optimize` | Sticker storage switch | off |
| `editsbeauty-heic` | Use HEIC Format | on |
| `editsbeauty-language` | English or Français | English |

Save format is decided only by blank-background PNG versus JPEG, as described above. Language does not translate the UI. HEIC is not encoded.

Settings that do change behavior:

| Key | Effect |
| --- | --- |
| `editsbeauty-theme` | System, Light, or Dark on the Settings page. `light` or `dark` is stored. Missing means system. |
| `editsbeauty-face-mesh` | Camera mesh overlay and the still-editor mesh drawing. Default off. |
| `editsbeauty-ai-vision` | Allows `guidePreview`. Default off. |
| `editsbeauty-ai-vision-warned` | Skips the first-run warning after Allow. |
| `editsbeauty-diagnostics` | Arms the report dialog. Default off. |
| `editsbeauty-id` | A random `EB-…` string shown from About. Created on first tap. |

Clear Cache deletes every Cache Storage entry and `sessionStorage`, then writes 0 B into `#cacheSize`. It does not wipe `localStorage`, so theme, install flag, account, and vision consent remain.

## Install and updates

`installedKey` is `editsbeauty-installed`. `rememberInstalled` sets it. `forgetInstalled` is not called from `beforeinstallprompt`. Apple detection covers iPhone, iPad, iPod, Macintosh, Mac OS X, and MacIntel with `maxTouchPoints > 1`.

`runInstall` no-ops on Apple and while `installOpening` is true. If a prompt exists it is nulled, `prompt()` is called, and acceptance calls `hideInstall`, which also `noteInstall()`. Dismissal leaves the button available. No prompt shows the help dialog: “Open the browser menu and choose Install app or Add to Home screen.”

`appinstalled`, a standalone launch, and a non-empty `getInstalledRelatedApps()` result all hide the button.

Update keys:

- `editsbeauty-applied-version`
- `editsbeauty-update-dismissed` in `sessionStorage`
- `editsbeauty-homescreen-seen`
- `editsbeauty-homescreen-first-session` in `sessionStorage`
- `editsbeauty-quiet-update` in `sessionStorage`, so a quiet apply runs once per version

`returningHomeScreen` is “launched installed, seen on a previous visit, not the first session, not iOS.” Only that case shows the banner, and only when the waiting worker’s version differs from the controller. Same `APP_VERSION` does not show a banner. iOS and a first installed launch call `applyQuietly`, which posts `SKIP_WAITING` and reloads. iOS reload also deletes caches and adds a `refresh` query.

The banner is injected at the top of `body`. CSS offsets it by `76px` plus the top safe area.

Registration uses `updateViaCache: 'none'`. Version is requested with `{ type: 'GET_VERSION' }` and answered `{ type: 'VERSION', version }`. `SKIP_WAITING` calls `self.skipWaiting()`.

Bump `APP_VERSION` and `CACHE` together in `sw.js`, and the visible version in `report.ts` (`reportVersion`), `settings.html`, `about.html`, `README.md`, and this file. A future visible update that forgets the version bump will not show the banner.

## Usage counts

Client queue flushes at 8 events or after 2.5 seconds, and on `visibilitychange` hidden and `pagehide`. POST body is `{ visitor, device, browser, events }` and must be at most 6000 characters on the client. The server rejects a body over 8000 bytes.

Visitor id is `crypto.randomUUID()` in `editsbeauty-visitor`. The server hashes it with SHA-256 and keeps 24 hex characters. Visit is once per UTC day (`editsbeauty-visit-day`). Install is once per browser (`editsbeauty-install-counted`), fired from `hideInstall`.

Tool allowlist, client and server: Adjust, Filters, Crop, Retouch, Smooth, Teeth, Background, Camera, Stickers, Narrow, Enhance, Cutout, Text, Brushes. Anything else is dropped before enqueue. The same tool inside 800 ms counts once.

Guide counts at the start of a guide answer. Vision counts when the switch is allowed. Session length is recorded on hide if at least 15 seconds have passed since the mark, rounded to 30 seconds, capped at 1800. The mark moves forward so a long tab does not send the whole lifetime at once.

Rating: index page only, not if `editsbeauty-rated` is `1`, not if dismissed within 21 days, after 5 edits or (3 days and at least 1 edit). Edits increment 450 ms after `noteEdit` so a burst is one edit. The dialog is built in `usage.ts`, not in HTML. Stars 1–5, comment sliced to 280 on the server, emails and data/blob URLs stripped. One rating per visitor replaces the previous.

Aggregation keeps 40 days of visitor buckets, at most 5000 visitor hashes per day, 100 ratings, and 20,000 install hashes. Summary fields: daily, weekly, and monthly unique visitors, install count, tool counts, guide count, vision count, device, browser, and country maps over 30 days, session count, average session seconds, and rating average. Comments are omitted unless `commentsAllowed` passes.

`GET /api/usage` on the usage page uses the same host rule as the poster. The view-key form sends `X-Usage-Key`.

## Diagnostic reports

Default off. `window.onerror` and `unhandledrejection` open the dialog only when the switch is on, the dialog is not already open, the message is non-empty, and it has not been shown this visit. Errors whose `filename` is another origin are ignored, except localhost and 127.0.0.1.

The client strips `data:` and `blob:` URLs and common PNG and JPEG base64 prefixes before display or POST. Browser is name plus major version, not the raw user agent. Screen size is bucketed to 40 px. Tool is “Editor · {rail label}” when the studio is visible, otherwise the page name. The server overwrites `timestamp`, assigns a UUID, and rejects any key outside the allowlist or matching `/image|photo|pixel|dataurl|canvas|landmark|face|file|email|name/i`.

Store starts `fetch` and immediately sets `mailto:stisla2021@gmail.com`. Email failure after a successful store does not change `stored: true`; `emailed` is false and the dialog says the mail app has the copy.

Storage order in `saveReport`: Postgres (`diagnostic_reports` created if needed), else Supabase REST (table must exist), else Redis `LPUSH editsbeauty:reports` then `LTRIM 0 199`, else if not `VERCEL` then `data/reports.json` capped at 200, else 503. Then `emailReport` if `RESEND_API_KEY` is set.

## Vercel Web Analytics

`menu.ts` imports `{ inject } from '@vercel/analytics'` and calls `inject()` after `startReports()` and `startUsage()`. Do not import `@vercel/analytics/next`. That module pulls in React, and this site has no React root. Do not call `inject()` again from `app.ts`.

In production the script is `/_vercel/insights/script.js`. In development it loads the debug script and does not send. Web Analytics must be enabled on the Vercel project. GitHub Pages returns 404 for that script path. The custom `/api/usage` store is separate and stays.

Install the package with `npm i @vercel/analytics --legacy-peer-deps` if npm stalls on the optional React, Next, Vue, Remix, Svelte, and Nuxt peers.

## Build and hosting

`npm run build` is `vite build` only. Output directory `dist/` is gitignored, as are `data/`, `node_modules/`, `.env`, and `.env.*`.

Rollup inputs are the HTML pages listed in `vite.config.js`, including `usage.html`. Output names have no hash: `assets/index.js`, `assets/menu.js`, and `style.css`. `closeBundle` copies `sw.js`, `public/ads.txt`, and `images/*`. `publicDir: false` is why that copy exists. `base: './'` keeps GitHub Pages project URLs working.

`vercel.json`:

```json
{ "buildCommand": "npm run build", "outputDirectory": "dist", "cleanUrls": true }
```

Do not add a second file under `api/` whose basename is `usage` or `guide` or `report`. `api/usage.js` and a former `api/usage.sql` failed the deploy with “conflicting paths.” The SQL now lives at `sql/usage-snapshot.sql`. `api/diagnostic-reports.sql` does not conflict with `api/report.js`.

GitHub Pages workflow does not cancel an in-progress deploy (`cancel-in-progress: false`). Vercel deploys from the GitHub connection on `main`. The Vercel CLI is not required and is not logged in from this repo. Do not commit a token.

Canonical link on the homepage is `https://editsbeauty.vercel.app/`. Settings canonical is `/settings` because `cleanUrls` is on.

`ads.txt` is one line: `google.com, pub-7160015922473007, DIRECT, f08c47fec0942fa0`. The AdSense loader on the homepage and terms page uses `ca-pub-7160015922473007`. That publisher id is public. Do not invent extra `data-ad-slot` units. Do not place ads beside the guide, Save, the camera, the contact form, or the feedback form.

## Design tokens

From `:root` in `style.css`:

- Page `#f3efe6`, surface `#fffdf8`, muted surface `#e7e1d6`, text `#1a2332`
- Accent `#14b8a6`, soft `#d7f5f1`, ink `#042f2e`, accent text `#0f766e`
- Dark page `#14181f`, dark accent text `#5eead4`, dark soft `#134e4a`
- Touch target `2.75rem`, font `clamp(12px, 2vw, 16px)`
- Focus visible is a 2 px accent outline
- Document scroll behavior is `auto`

`#ff2d78` appears as the neon background gradient stop in `app.ts`. It is a photo background color, not chrome.

## localStorage and sessionStorage index

| Key | Storage | Purpose |
| --- | --- | --- |
| `editsbeauty-theme` | local | light or dark; absent means system |
| `editsbeauty-installed` | local | Hide Install after a successful install |
| `editsbeauty-applied-version` | local | Last version the page accepted |
| `editsbeauty-homescreen-seen` | local | Distinguishes a later Home Screen launch |
| `editsbeauty-homescreen-first-session` | session | Suppresses the banner on the install launch |
| `editsbeauty-update-dismissed` | session | Version hidden by × |
| `editsbeauty-quiet-update` | session | Quiet apply already attempted for this version |
| `editsbeauty-face-mesh` | local | Mesh overlay |
| `editsbeauty-camera-lens` | local | Last lens id |
| `editsbeauty-camera-strength` | local | Per-lens strength map |
| `editsbeauty-custom-look` | local | My look |
| `editsbeauty-ai-vision` | local | Guide may attach a preview |
| `editsbeauty-ai-vision-warned` | local | Warning already accepted |
| `editsbeauty-diagnostics` | local | Reports may be offered |
| `editsbeauty-account` | local | Email, name, small photo, session token. The password is not stored here |
| `editsbeauty-saved-looks` | local | Up to 12 filter and Smooth pairs |
| `editsbeauty-id` | local | About-page id |
| `editsbeauty-visitor` | local | UUID, hashed before storage on the server |
| `editsbeauty-visit-day` | local | UTC date of the last counted visit |
| `editsbeauty-install-counted` | local | Install event sent once |
| `editsbeauty-first-seen` | local | ISO time for the rating delay |
| `editsbeauty-edit-count` | local | Edits toward the rating |
| `editsbeauty-rated` | local | Rating already sent |
| `editsbeauty-rating-dismissed` | local | ISO time of Not now |
| `editsbeauty-rating-shown` | session | Dialog already shown this visit |
| `editsbeauty-session-start` | session | Session clock |
| `editsbeauty-session-mark` | session | Last session sample |
| `editsbeauty-save-album` and the other unused setting keys | local | Preferences the canvas does not read |

## Release checklist

1. Change the behavior in the TypeScript or the pages.
2. Set `APP_VERSION` and `CACHE` in `sw.js` to a new pair.
3. Set the same version in `report.ts`, `settings.html`, `about.html`, `README.md`, and this file.
4. Run `npx tsc --noEmit` and `npm run build`.
5. Commit and push `main`.
6. Confirm the GitHub commit status for Vercel is success, then confirm `https://editsbeauty.vercel.app/sw.js` contains the new `APP_VERSION` and `CACHE`.
7. Do not commit `dist/`, `data/`, `.env`, or a SQL file beside `api/usage.js`.

## Recent updates in V1.1.11

- The homepage is the short pill again: Home, Camera, and Templates. The scrolling tool bar appears only while the editor is open. The Looks row under the header is gone.
- Shell version is 1.1.11 / `editsbeauty-shell-v39`.

## Recent updates in V1.1.10

- Email sign-in stores a salted password hash on the server, with the display name, a small profile photo, and saved Looks. The same email and password work after the app is deleted. The password itself is not stored. Editing photos are not accepted.
- Shell version is 1.1.10 / `editsbeauty-shell-v38`.

## Recent updates in V1.1.9

- The bottom bar is a horizontal tool row. The camera circle sits above the left end and does not scroll away. Filters, Adjust, Beauty, Background, Effects, Text, Stickers, Crop, Enhance, Compare, Auto, More, and Profile scroll. The selected tool uses `#14B8A6`. Auto stays filled.
- On the home screen the row opens a tool or asks for a photo. Inside the editor it switches panels. Below 1025 px the old rail and the in-sheet Adjust / Filters / Crop tabs are hidden.
- Looks on the home screen apply with one tap through the existing 350 ms `selectLook` path.
- Auto Beauty applies the Adjust recipe, the Beauty look, and Smooth 72, and the Adjust readout shows the signed value.
- Hold the photo or hold Compare to paint the original before adjustments.
- Post, Story, and Original set the canvas ratio and use the existing save path.
- Profile, the password hash, the 96 px profile photo, saved Looks, and Continue with Google or X stay in `localStorage`. Editing photos are not uploaded. Google and X are not OAuth sessions.
- Shell version is 1.1.9 / `editsbeauty-shell-v37`.

## Recent updates in V1.1.8

- The usage SQL file moved from `api/usage.sql` to `sql/usage-snapshot.sql` so Vercel can publish `api/usage.js`.
- On Android, Install opens the browser’s install dialog. After acceptance, Install stays hidden, including when `beforeinstallprompt` fires again.
- Save on a phone builds the file synchronously and hands it to `navigator.share` so Photos or Gallery can receive it. Cancelling the sheet does not also download.

## Recent updates in V1.1.7

- Anonymous usage counts visits, weekly and monthly visitors, installs, tool use, guide use, and vision opt-in. Device, browser, country, and a rough session length are included. Names, emails, photos, and face data are not. The dashboard is `/usage`.
- After about five edits, or a few days with at least one edit, a 1 to 5 star rating and an optional note can be sent. Not now hides it for three weeks.

## Recent updates in V1.1.6

- Adjust uses one row of circular icons and one named slider. Every control starts at 0. A new photo resets them.
- “Allow AI to see my photo (better results)” is off by default, warns the first time, and sends one temporary JPEG that is not stored. If the vision model fails, the text guide is used. With the switch off, the photo is not sent.
- Diagnostic reports are off by default. After the switch and a confirmation, the allowlisted list can be stored and emailed. It never includes the photo, the canvas, or face landmarks.

## Publishing

`npm run build`, commit, push `main`. GitHub Pages follows `.github/workflows/pages.yml`. Vercel follows `vercel.json` when the GitHub repository is connected to the Vercel project. That connection is not stored in this checkout. Wait until `sw.js` on the canonical host shows the version you pushed before calling a release done.
