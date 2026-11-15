# Faders website

The product site for [Faders](https://github.com/mayankgulaty/faders), the radio app that doesn’t suck. Lives at **faders.app**: Cloudflare Workers static assets, deployed automatically from `main` (also at faders-website.mayankgulaty.workers.dev). The old GitHub Pages copy stays up for old links. `.assetsignore` keeps README and git files off the site.

Static HTML, CSS and JS: no build step and no tracking. Serve the folder (`python3 -m http.server`) and open it.

- **Art direction:** the page is a radio. Warm near-black, paper-white type, one on-air red (`--signal`). Instrument Serif (self-hosted in `assets/fonts`, OFL) for display, the system sans for reading, monospace for broadcast details, and film grain over everything. The screenshots carry the brand colour; the page stays quiet around them. No gradient blobs, glass cards or emoji.
- `index.html`, top to bottom:
  - **The dial:** drag it, scroll sideways or use ← →. There's static (Web Audio noise) between stations, and it locks onto six moods at 88.9 to 105.7 MHz. Live song data and a real oscilloscope when the stream allows CORS.
  - **Marquee and "named just now" log:** songs on air on the moods.
  - **Break timeline:** two lanes like an audio editor, a playhead, and the "what you hear" route.
  - **World:** a departures board of the most-played stations in the visitor's country, with split-flap names. Tapping one opens the download sheet.
  - **Feature index:** a screenshot follows the cursor on hover.
  - Then the Duo film, pricing, privacy, "Turn it up" and an outlined wordmark.
  - **Mini player:** follows you after the first play. On phones, before that, a "Get" bar.
- `main.js`:
  - `MOODS` holds the frequencies, streams and colours. Each mood leads with a stream that plays in any browser; SomaFM is a backup.
  - Song data comes from the SomaFM, AzuraCast, Icecast and laut.fm APIs.
  - **The web taste:** a note after 4 minutes; at 12 minutes it fades and opens the sheet, with one "5 more minutes".
  - The Plus price switches on 1 Dec 2026.
  - Station lists drop anything named BBC.
- `assets/screens/`: the iPhone App Store screenshots with the caption and frame cropped off (`crop=1100:2384:110:410`, then `cwebp -q 80`). Replace them with clean simulator captures when there's a chance.
- `support.html`, `privacy.html`: support and the privacy policy. Keep the privacy text in step with the `faders-app` repo, which App Store Connect links to until the URLs move to faders.app.
- `assets/`: `shots/` (from `AppStore/screenshots` in the app repo, made with `cwebp -q 78 -resize 660 0`), `duo-film.mp4` (the Duo preview at 1280 px, crf 28, no audio), and `og.png` (1200×630, rendered from HTML).

Never show lyrics (App Store builds don't have them), never say "skip ads", and never name the BBC.
