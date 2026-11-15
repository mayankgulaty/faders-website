# Faders website

The product site for [Faders](https://github.com/mayankgulaty/faders), the radio app that doesn’t suck. Lives at **faders.app** (GitHub Pages from `main`; DNS on Cloudflare).

Static HTML, CSS and JS: no build step and no tracking. Serve the folder (`python3 -m http.server`) and open it.

- `index.html`: the product page.
  - **Tuner:** Faders Moods playing live in the browser, with a dial, song data and a visualizer.
  - **Break demo:** an animated "changes the channel" explainer.
  - **Live ticker:** songs playing now on the moods.
  - **World:** the most-listened stations in the visitor's country, from radio-browser.info. Tapping one opens the download sheet.
  - Then features, the iPhone Duo film, the gallery, pricing, privacy and the download section.
- `main.js`: everything interactive.
  - `MOODS` lists the streams. Each mood leads with a stream that plays in any browser (Radio Paradise, ISEKOI, Ambient Sleeping Pill, laut.fm); SomaFM is a backup, because some networks get a 403 from it.
  - Song data comes from SomaFM `songs/*.json`, AzuraCast `nowplaying`, Icecast `status-json.xsl` and the laut.fm API. Radio Paradise's API has no CORS, so it shows only the station.
  - The visualizer uses Web Audio when the stream allows CORS. Otherwise, and always on iOS Safari (which can go silent through Web Audio), it draws an animation.
  - **The web taste:** a note about the app after 4 minutes of listening; at 12 minutes the sound fades and the download sheet opens, with one "5 more minutes".
  - The Plus price switches to €9.99 on 1 Dec 2026 by itself.
  - Broadcaster rule: station lists drop anything named BBC (we never name it in marketing).
- `support.html`, `privacy.html`: support and the privacy policy. Keep the privacy text in step with the `faders-app` repo, which App Store Connect links to until the URLs move to faders.app.
- `assets/`: `shots/` (from `AppStore/screenshots` in the app repo, made with `cwebp -q 78 -resize 660 0`), `duo-film.mp4` (the Duo preview at 1280 px, crf 28, no audio), and `og.png` (1200×630, rendered from HTML).

Never show lyrics (App Store builds don't have them), never say "skip ads", and never name the BBC.
