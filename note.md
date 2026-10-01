# EditsBeauty notes

Updated 1 October 2026.

- Site: https://stisla2021.github.io/EditsBeauty/
- Canonical Vercel URL: https://editsbeauty.vercel.app/
- Repository: https://github.com/stisla2021/EditsBeauty
- Branch: `main`
- Version: V1.0.0

Editing happens on the device. The AI guide edits a photo when asked, using the same tools a person can move by hand. It does not generate a new picture and it does not upload the photo.

Adjust holds Auto, Exposure, Brilliance, Highlights, Shadows, Contrast, Brightness, Black Point, Saturation, Vibrance, Warmth, Tint, Sharpness, Definition, Noise Reduction, and Vignette. Filters include Vivid and B/W; retouching includes Smooth and teeth whitening. Background tools include scene replacement and expansion, with real-photo scenes and a blank option. Choose your own photo, then tap an example portrait to apply that look to it. Ask AI accepts a dropped photo and a task, including a named background. The camera has Portrait, Live, and Video. Filters, Adjust, crop, and the camera open again offline after one visit. Delete chat empties the AI guide. Clear Cache in Settings deletes stored files and shows 0 B again.

Recent updates: the full editor remains available on the main page; the background collection and on-device looks were expanded; dragging and Adjust scrolling were improved; the guide displays its finished edit; and users can send feedback by email. The install prompt appears only where supported and is hidden on iPhone, iPad, and Mac and after installation.

Save downloads a JPEG named `editsbeauty-edit.jpg`. Settings, About, and the legal pages are linked from the app.

To publish a change, run `npm run build`, commit, and push `main`. GitHub Pages publishes through `.github/workflows/pages.yml`; wait for that workflow to succeed. `vercel.json` configures Vercel's build and output directory, but automatic Vercel deployment requires this repository to be connected to a Vercel project.
