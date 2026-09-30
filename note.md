# EditsBeauty notes

Updated 30 September 2026.

- Site: https://stisla2021.github.io/EditsBeauty/
- Repository: https://github.com/stisla2021/EditsBeauty
- Branch: `main`
- Version: V1.0.0

Editing happens on the device. The AI guide edits a photo when asked, using the same tools a person can move by hand. It does not generate a new picture and it does not upload the photo.

Adjust holds Auto, Exposure, Brilliance, Highlights, Shadows, Contrast, Brightness, Black Point, Saturation, Vibrance, Warmth, Tint, Sharpness, Definition, Noise Reduction, and Vignette. Filters hold the looks and Smooth. Background change keeps the person and places a real scene behind them. Example portraits open 30 different people in Adjust.

Save downloads a JPEG named `editsbeauty-edit.jpg`. Settings, About, and the legal pages are linked from the app. The service worker keeps the app usable when the network is off, and loads fresh HTML when the network is on.

To publish a change: edit the files, run `npm run build` if `app.ts` or `menu.ts` changed, commit, and push `main`. GitHub Pages updates after the deploy workflow succeeds.
