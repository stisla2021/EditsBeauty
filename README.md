# EditsBeauty

On-device portrait and photo editor. Photos stay in the browser. Filters, Adjust, crop, retouch, and save all run on the device. The AI guide can edit a photo when someone asks, and every control can still be used by hand.

**Live app:** https://stisla2021.github.io/EditsBeauty/

Version V1.0.0. Copyright (c) StISLA2021.

## What you can do

- **Ask AI** on the home page, or **AI** in the editor. Ask it to edit a photo, brighten the lighting, smooth skin, apply a look, change the background, or save. It uses the tools already in the editor. It does not send the picture to a server or generate a new one.
- **Adjust** has Auto, Exposure, Brilliance, Highlights, Shadows, Contrast, Brightness, Black Point, Saturation, Vibrance, Warmth, Tint, Sharpness, Definition, Noise Reduction, and Vignette. B/W is a filter. Move the sliders yourself any time.
- **Filters and retouching** include Vivid, B/W, Soft, Pink, Vintage, Pop, Matte, Golden, Beauty, Smooth, and teeth whitening. Smooth keeps edges such as brows and lips sharper than the skin. Beauty also raises smooth, warmth, and brilliance.
- **Backgrounds** under Adjust, then More tools: Blank, Blur, solid colors, gradients, and photo scenes (Beach, City, Studio, Garden, Sunset, Mountains, Forest, Night, Cafe, Sky, Flowers, Ocean, Office, Snow, Desert, Library, Room, Brick, Street, Autumn, Waterfall, Park, Rain, Space). The person stays. Blank saves a PNG; other saves stay JPEG. Scenes use real photos.
- **Choose your photo**, then tap an example portrait to apply that look to your picture. The example does not replace your photo.
- **Ask AI** accepts a dropped photo and a task, including a named background such as beach, garden, night, blank, or blur. **Delete chat** clears that conversation.
- The **camera** has Portrait, Live, and Video. Portrait opens with a background blur. A horizontal tray holds Original plus beauty, makeup, fun, classic, and background lenses (Soft, Glow, Blush, Contour, Glasses, Cat, Crown, Earrings, Sparkle, Puppy, Hearts, Film, Portrait, White, Sunset). Original stays first. The last lens is remembered. Long-press a lens, or tap Tune, to set strength and the beauty sliders: skin smooth, slim face, V-shape jaw, chin, eye enlarge, eye brighten, nose slim, lips, lip color, teeth, foundation, blush, contour and highlight, soft glow, portrait blur, and edge feather. Save look stores that mix on the device as My look. Face landmarks come from MediaPipe Face Mesh on the device. Mesh in the camera, or Face mesh overlay in Settings, draws a light mesh and is off until turned on. If the mesh cannot load, color beauty still runs. Video and the short Live clip record the preview with the current beauty and lens. Heavy effects use WebGL. Phones use a smaller preview. If the preview stays under 20 fps, Lite mode turns off face reshape and lenses; Full quality in Tune turns them back on.
- **Stickers** are original emoji and word badges in the editor.
- The install prompt is shown only where supported and is hidden on Apple devices and after installation. Filters, Adjust, crop, and the camera still open offline after the app has been visited once. **Clear Cache** in Settings deletes stored files and returns the size to 0 B.
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

`vercel.json` also configures Vercel to run `npm run build` and serve `dist/`. Vercel deploys on push only when this GitHub repository is connected to a Vercel project; that project connection is not stored in this checkout. The canonical Vercel address in the app is https://editsbeauty.vercel.app/.

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
