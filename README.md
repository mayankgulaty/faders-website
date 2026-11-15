# Faders website

The product site for [Faders](https://github.com/mayankgulaty/faders), the radio app that doesn’t suck. Lives at **faders.app**: Cloudflare Workers static assets, deployed automatically from `main` (also at faders-website.mayankgulaty.workers.dev). The old GitHub Pages copy stays up for old links. `.assetsignore` keeps README and git files off the site.

Static HTML, CSS and JS: no build step and no tracking. Serve the folder (`python3 -m http.server`) and open it.

- **Art direction: fun, like a record shop window.**
  - Colour blocks from the icon: violet `#3a128c`, pink `#ff3d7f`, orange `#ff7a2f`, with cream, ink and a lime pop.
  - Bricolage Grotesque for display and Instrument Serif italics for a wink, both self-hosted in `assets/fonts` (OFL).
  - Stickers, a rotating "Free" badge, tilting cards, ticket-stub pricing.
- `index.html`, top to bottom:
  - **The radio:** a retro transistor radio built in CSS. Turn the knob or drag the dial: static between stations, locking onto six moods. The speaker grille pulses with the sound, and an LCD shows the song.
  - **Lime marquee:** songs on air now.
  - **Spin the globe:** plays a random station from the 400 most-voted HTTPS MP3 stations on radio-browser for 60 s, then "Keep it in Faders".
  - **Song receipt:** names print onto a paper receipt.
  - **Skin picker:** Turntable, Cassette, Mixing Desk and Classic.
  - **Break timeline**, then feature cards, iPad and the Duo film, tickets, "Turn it up".
  - **Mini player** after the first play.
- `main.js`:
  - `MOODS`: each mood leads with a browser-safe stream; SomaFM is a backup.
  - **The taste:** moods nudge at 4 minutes and end at 12 (one "5 more minutes"); globe stations play 60 s each.
  - Station lists drop anything named BBC or tagged explicit.
- `assets/screens/`: raw simulator captures, made 15 Nov 2026 on a fresh, signed-out iPhone 18 Pro and iPad Pro 13" simulator.
  - Settings: status bar at 9:41, dark appearance.
  - Launch arguments: `-hasCompletedOnboarding YES -whatsNewSeen 1.4 -christmasPreview NO -festiveIcon off -addFavorites "SPIN 1038,Today FM,RTÉ 2FM,Radio Nova 100,FM104,KEXP,Sunshine 106.8,Classic Hits"`, plus `-autoplay`/`-openPlayer`/`-openSkin`/`-playMood`/`-openMap`/`-openCalm`/`-openCarMode`/`-tab`.
  - Then `cwebp -q 82 -resize 660`.
  - Never use `-demoLibrary` (it includes a BBC station), and crop any For You row that shows one.
- `assets/duo-film.mp4`: the Duo App Store preview, cropped to the phone (no captions).
- `support.html`, `privacy.html`: support and the privacy policy. Keep the privacy text in step with the `faders-app` repo, which App Store Connect links to until the URLs move to faders.app.
- `assets/`: `shots/` (from `AppStore/screenshots` in the app repo, made with `cwebp -q 78 -resize 660 0`), `duo-film.mp4` (the Duo preview at 1280 px, crf 28, no audio), and `og.png` (1200×630, rendered from HTML).

Never show lyrics (App Store builds don't have them), never say "skip ads", and never name the BBC.
