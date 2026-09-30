# EditsBeauty notes

Deployed 30 September 2026.

- Site: https://stisla2021.github.io/EditsBeauty/
- Repository: https://github.com/stisla2021/EditsBeauty
- Branch: `main`
- Version: V1.0.0

Editing happens on the device. Save downloads a JPEG named `editsbeauty-edit.jpg`. Settings, About, and the legal pages are linked from the app. The service worker keeps the app usable when the network is off, and loads fresh HTML when the network is on.

To publish a change: edit the files, run `npm run build` if `app.ts` or `menu.ts` changed, commit, and push `main`. GitHub Pages updates after the deploy workflow succeeds.
