# EditsBeauty

On-device portrait and photo editor. Photos stay in the browser. Filters, Adjust, crop, retouch, and save all run on the device. The AI guide can edit a photo when someone asks, and every control can still be used by hand.

**Live app:** https://stisla2021.github.io/EditsBeauty/

Version V1.0.0. Copyright (c) StISLA2021.

## What you can do

- **Ask AI** on the home page, or **AI** in the editor. Ask it to edit a photo, brighten the lighting, smooth skin, apply a look, change the background, or save. It uses the tools already in the editor. It does not send the picture to a server or generate a new one.
- **Adjust** has Auto, Exposure, Brilliance, Highlights, Shadows, Contrast, Brightness, Black Point, Saturation, Vibrance, Warmth, Tint, Sharpness, Definition, Noise Reduction, and Vignette. Move the sliders yourself any time.
- **Filters** are the looks, including Vivid and Noir, plus Smooth. Past 60, Smooth keeps the same softness and adds a warm finish.
- **Backgrounds** under Adjust, then More tools: Beach, City, Studio, Garden, Sunset, Mountains, Forest, Night, Cafe, Sky, Flowers, and Ocean. The person stays. The scene is a real photo.
- **Choose your photo**, then tap an example portrait to apply that look to your picture. The example does not replace your photo.
- **Delete chat** in the AI guide clears that conversation. Cache starts at 0 B. **Clear Cache** in Settings deletes stored files and returns the size to 0 B. Photos are not stored in the cache.

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
