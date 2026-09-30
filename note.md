# EditsBeauty notes

Updated 30 September 2026.

- Site: https://stisla2021.github.io/EditsBeauty/
- Repository: https://github.com/stisla2021/EditsBeauty
- Branch: `main`
- Version: V1.0.0

Editing happens on the device. The AI guide edits a photo when asked, using the same tools a person can move by hand. It does not generate a new picture and it does not upload the photo.

Adjust holds Auto, Exposure, Brilliance, Highlights, Shadows, Contrast, Brightness, Black Point, Saturation, Vibrance, Warmth, Tint, Sharpness, Definition, Noise Reduction, and Vignette. Filters hold the looks and Smooth. Background change keeps the person and places a real scene behind them. Choose your own photo, then tap an example portrait to apply that look to it. Delete chat empties the AI guide. The cache starts at 0 B. Photos and pages are not stored in it. Clear Cache in Settings deletes anything that was stored and shows 0 B again.

Save downloads a JPEG named `editsbeauty-edit.jpg`. Settings, About, and the legal pages are linked from the app.

To publish a change: edit the files, run `npm run build` if `app.ts` or `menu.ts` changed, commit, and push `main`. GitHub Pages updates after the deploy workflow succeeds.
