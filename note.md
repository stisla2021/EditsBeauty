# EditsBeauty notes

Updated 1 October 2026.

- Site: https://stisla2021.github.io/EditsBeauty/
- Canonical Vercel URL: https://editsbeauty.vercel.app/
- Repository: https://github.com/stisla2021/EditsBeauty
- Branch: `main`
- Version: V1.0.0

Editing happens on the device. The AI guide edits a photo when asked, using the same tools a person can move by hand. It does not generate a new picture and it does not upload the photo.

Adjust holds Auto, Exposure, Brilliance, Highlights, Shadows, Contrast, Brightness, Black Point, Saturation, Vibrance, Warmth, Tint, Sharpness, Definition, Noise Reduction, and Vignette. Filters include Vivid, B/W, Soft, Pink, Vintage, Pop, Matte, Golden, and Beauty. Retouching includes Smooth and teeth whitening. Smooth keeps brows, eyes, and lips sharper than the skin. Beauty also raises smooth, warmth, and brilliance. Background tools include Blank, Blur, solid colors, gradients, and real-photo scenes, plus expansion. The person stays. Choose your own photo, then tap an example portrait to apply that look to it. Stickers are original emoji and word badges. Ask AI accepts a dropped photo and a task, including a named background such as blank, blur, a color, or a scene. The camera has Portrait, Live, and Video. Filters, Adjust, crop, and the camera open again offline after one visit. Delete chat empties the AI guide. Clear Cache in Settings deletes stored files and shows 0 B again.

The camera runs on the device. Portrait starts with a background blur and a feathered edge so the person stays sharper. A tray under the preview lists Original first, then beauty, makeup, fun, classic, and background lenses: Soft, Glow, Blush, Contour, Glasses, Cat, Crown, Earrings, Sparkle, Puppy, Hearts, Film, Portrait, White, and Sunset. The last lens is remembered. Long-press a lens, or tap Tune, for strength and sliders from 0 to 100: skin smooth, slim face, V-shape jaw, chin, eye enlarge, eye brighten, nose slim, lips plump, lip color, teeth, foundation, blush, contour and highlight, soft glow, portrait blur, and edge feather. Save look stores that mix on the device as My look. MediaPipe Face Mesh supplies eyes, nose, mouth, cheeks, jaw, and forehead for those effects. Mesh on the camera, or Face mesh overlay in Settings, draws a light mesh and stays off until turned on. If Face Mesh cannot load, color beauty still runs. Video and the short Live clip record the processed preview, including the current beauty and lens. Heavy effects use WebGL. Phones use a smaller preview. If the preview stays under 20 fps, Lite mode turns off face reshape and lenses; Full quality in Tune turns them back on.

Recent updates: live camera beauty, portrait blur, and face lenses; the full editor remains on the main page; backgrounds include blank, blur, colors, gradients, and more scenes; on-device looks and stickers were expanded; dragging stays smooth; the guide shows its finished edit; feedback goes out by email. The install prompt appears only where supported and is hidden on iPhone, iPad, and Mac and after installation.

Save downloads `editsbeauty-edit.jpg`. A blank background saves `editsbeauty-edit.png`. Settings, About, and the legal pages are linked from the app.

To publish a change, run `npm run build`, commit, and push `main`. GitHub Pages publishes through `.github/workflows/pages.yml`; wait for that workflow to succeed. `vercel.json` configures Vercel's build and output directory, but automatic Vercel deployment requires this repository to be connected to a Vercel project.
