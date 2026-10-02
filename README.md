# EditsBeauty

On-device portrait and photo editor. Photos stay in the browser. Filters, Adjust, crop, retouch, and save all run on the device. The AI guide can edit a photo when someone asks, and every control can still be used by hand.

**Live app:** https://stisla2021.github.io/EditsBeauty/

Version V1.1.1. Copyright (c) StISLA2021.

## What you can do

- **Ask AI** on the home page, or **AI** in the editor. Ask in ordinary language, for example “make my skin smoother” or “brighten the photo and change the background to beach.” Groq’s Llama 3.3 70B chooses the existing Adjust, filter, beauty, background, crop, and Save controls. The photo stays in the browser and is not uploaded or regenerated. If that connection is unavailable, a simpler on-device reader uses the same controls.
- **Adjust** has Auto, Exposure, Brilliance, Highlights, Shadows, Contrast, Brightness, Black Point, Saturation, Vibrance, Warmth, Tint, Sharpness, Definition, Noise Reduction, and Vignette. B/W is a filter. Move the sliders yourself any time.
- **Filters and retouching** include Vivid, B/W, Soft, Pink, Vintage, Pop, Matte, Golden, Beauty, Smooth, and teeth whitening. Smooth keeps edges such as brows and lips sharper than the skin. Beauty also raises smooth, warmth, and brilliance.
- **Backgrounds** under Adjust, then More tools: Blank, Blur, solid colors, gradients, and photo scenes (Beach, City, Studio, Garden, Sunset, Mountains, Forest, Night, Cafe, Sky, Flowers, Ocean, Office, Snow, Desert, Library, Room, Brick, Street, Autumn, Waterfall, Park, Rain, Space). The person stays. Blank saves a PNG; other saves stay JPEG. Scenes use real photos.
- **Choose your photo**, then tap an example portrait to apply that look to your picture. The example does not replace your photo.
- **Ask AI** accepts a dropped photo and a task, including a named background such as beach, garden, night, blank, or blur. **Delete chat** clears that conversation.
- The **camera** has Portrait, Live, and Video. Portrait opens with a background blur. A horizontal tray holds Original plus beauty, makeup, fun, classic, and background lenses (Soft, Glow, Blush, Contour, Glasses, Cat, Crown, Earrings, Sparkle, Puppy, Hearts, Film, Portrait, White, Sunset). Original stays first. The last lens is remembered. Long-press a lens, or tap Tune, to set strength and the beauty sliders: skin smooth, slim face, V-shape jaw, chin, eye enlarge, eye brighten, nose slim, lips, lip color, teeth, foundation, blush, contour and highlight, soft glow, portrait blur, and edge feather. Save look stores that mix on the device as My look. Face landmarks come from MediaPipe Face Mesh on the device. Mesh in the camera, or Face mesh overlay in Settings, draws a light mesh and is off until turned on. If the mesh cannot load, color beauty still runs. Video and the short Live clip record the preview with the current beauty and lens. Heavy effects use WebGL. Phones use a smaller preview. If the preview stays under 20 fps, Lite mode turns off face reshape and lenses; Full quality in Tune turns them back on.
- **Stickers** are drawn on the device: shapes, beauty marks, short words, and emoji. Tap one to add it, then drag to move it and use the handles to resize or rotate. You can stack several. **Undo** and **Redo** in the editor step back through adjustments, filters, beauty, stickers, crop, and background changes, up to 15 steps.
- The install prompt is shown only where supported and is hidden on Apple devices and after installation. A normal browser visit and a brand-new Home Screen install do not show an update prompt. On iPhone and iPad the update prompt never appears; a newer version is applied on its own. On other devices, after the installed app has already been opened, **Update available** appears on the home screen only when the version number changes, with an orange **Update** button. **Update** switches to the new version and reloads. The **×** hides the banner for this visit, and it can show again the next time the app opens if that version is still waiting. After the new version is running, the banner stays hidden until the next version. Filters, Adjust, crop, and the camera still open offline after the app has been visited once. **Clear Cache** in Settings deletes stored files and returns the size to 0 B.
- **Feedback** opens an email draft addressed to the publisher; feedback text is not stored on the website.

## Run it locally

```powershell
npm install
npm run build
npx vite preview
```

The preview serves the built site. `npm run build` runs Vite and writes the site into `dist/`.

## Deploy

Pushes to `main` publish the site with GitHub Actions (`.github/workflows/pages.yml`). The live address is https://stisla2021.github.io/EditsBeauty/

After a push, the Pages workflow must finish before the new files show up.

`vercel.json` also configures Vercel to run `npm run build` and serve `dist/`. The AI guide’s `/api/guide` function runs on Vercel and calls Groq. Set `GROQ_API_KEY` in the Vercel project environment. The key stays there and is not written into the page. Vercel deploys on push only when this GitHub repository is connected to a Vercel project; that project connection is not stored in this checkout. The canonical Vercel address in the app is https://editsbeauty.vercel.app/.

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
