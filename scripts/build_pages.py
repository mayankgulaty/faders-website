#!/usr/bin/env python3
"""Builds the station, country and genre pages, and sitemap.xml, from the radio-browser.info directory.

    python3 scripts/build_pages.py

Writes station/<slug>/index.html, radio/index.html, radio/<country>/index.html,
genre/index.html, genre/<tag>/index.html and sitemap.xml. Run it from the repo root. A GitHub
Action runs it once a month and commits the result; Cloudflare then publishes it.

Rules: no page for any station named BBC (we never name it in marketing), nothing tagged explicit,
and never "skip ads" (Faders changes the channel). Station names and logos belong to their owners.
"""
import datetime, html, json, os, re, shutil, time, unicodedata, urllib.parse, urllib.request

API = ["https://de1.api.radio-browser.info", "https://de2.api.radio-browser.info"]
SITE = "https://faders.app"
APP = "https://apps.apple.com/app/id6825091695"
MIN_STATIONS = 40          # countries with fewer stations don't get a page
PER_COUNTRY = 40           # station pages per country
PER_GENRE = 40
GENRES = ["pop", "rock", "jazz", "classical", "news", "talk", "dance", "electronic", "hip hop", "country", "chillout",
          "ambient", "lounge", "80s", "90s", "70s", "oldies", "blues", "soul", "reggae", "latin", "metal", "indie",
          "folk", "funk", "house", "techno", "lofi", "sports", "christmas"]
BLOCK_NAME = re.compile(r"\bbbc\b", re.I)
BLOCK_TAGS = re.compile(r"explicit|adult|xxx|porn|sex|erotic", re.I)
TODAY = datetime.date.today().isoformat()
UA = {"User-Agent": "FadersWebsite/1.0 (+https://faders.app)"}


def get(path):
    for base in API:
        try:
            with urllib.request.urlopen(urllib.request.Request(base + path, headers=UA), timeout=30) as r:
                return json.load(r)
        except Exception as e:
            print("  retry:", base, path, e)
            time.sleep(1)
    raise SystemExit(f"directory unavailable for {path}")


def slugify(text):
    t = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")[:60]


def e(s):
    return html.escape(str(s or ""), quote=True)


def clean_tags(s):
    tags = [t.strip() for t in (s.get("tags") or "").split(",") if t.strip()]
    return [t for t in tags if len(t) < 24 and not BLOCK_TAGS.search(t)][:4]


def ok(s):
    name = (s.get("name") or "").strip()
    return name and not BLOCK_NAME.search(name) and not BLOCK_TAGS.search(s.get("tags") or "") and len(name) < 90


# ---------- Collect ----------
countries = [c for c in get("/json/countries") if c.get("stationcount", 0) >= MIN_STATIONS and len(c.get("iso_3166_1", "")) == 2]
countries.sort(key=lambda c: -c["stationcount"])
print(len(countries), "countries")

stations = {}      # uuid -> station
by_country = {}    # cc -> [uuid]
by_genre = {}      # tag -> [uuid]


def keep(s):
    if not ok(s):
        return None
    stations.setdefault(s["stationuuid"], s)
    return s["stationuuid"]


for c in countries:
    cc = c["iso_3166_1"].upper()
    q = urllib.parse.urlencode({"countrycode": cc, "order": "clickcount", "reverse": "true", "limit": PER_COUNTRY * 2, "hidebroken": "true"})
    seen, ids = set(), []
    for s in get(f"/json/stations/search?{q}"):
        key = slugify(s.get("name") or "")
        if key in seen:
            continue
        uid = keep(s)
        if uid:
            seen.add(key); ids.append(uid)
        if len(ids) >= PER_COUNTRY:
            break
    by_country[cc] = ids
    time.sleep(0.2)

for tag in GENRES:
    q = urllib.parse.urlencode({"tag": tag, "order": "clickcount", "reverse": "true", "limit": PER_GENRE * 2, "hidebroken": "true"})
    seen, ids = set(), []
    for s in get(f"/json/stations/search?{q}"):
        key = slugify(s.get("name") or "")
        if key in seen:
            continue
        uid = keep(s)
        if uid:
            seen.add(key); ids.append(uid)
        if len(ids) >= PER_GENRE:
            break
    by_genre[tag] = ids
    time.sleep(0.2)

NAMES = {"GB": "United Kingdom", "US": "United States", "KR": "South Korea", "KP": "North Korea", "RU": "Russia", "IR": "Iran",
         "TZ": "Tanzania", "VE": "Venezuela", "BO": "Bolivia", "TW": "Taiwan", "MD": "Moldova", "SY": "Syria", "LA": "Laos",
         "VN": "Vietnam", "CZ": "Czechia", "NL": "Netherlands", "PH": "Philippines", "AE": "United Arab Emirates",
         "DO": "Dominican Republic", "CD": "DR Congo", "CG": "Congo", "MK": "North Macedonia", "PS": "Palestine", "BS": "Bahamas"}


def nice_country(cc, name):
    if cc in NAMES:
        return NAMES[cc]
    n = re.sub(r"\s*\(.*?\)", "", name).strip()
    n = re.sub(r"^The\s+", "", n)
    return re.sub(r"\b(Of|And|The)\b", lambda m: m.group(1).lower(), n)


country_name = {c["iso_3166_1"].upper(): nice_country(c["iso_3166_1"].upper(), c["name"]) for c in countries}
country_slug = {cc: slugify(n) for cc, n in country_name.items()}
genre_slug = {t: slugify(t) for t in GENRES}

# Stable, readable slugs: the name, then the country, then a bit of the id.
slug_of, taken = {}, set()
for uid, s in sorted(stations.items(), key=lambda kv: -(kv[1].get("clickcount") or 0)):
    base = slugify(s["name"]) or "station"
    for cand in (base, f"{base}-{(s.get('countrycode') or '').lower()}", f"{base}-{uid[:6]}"):
        if cand and cand not in taken:
            slug_of[uid] = cand; taken.add(cand); break
print(len(stations), "stations")

# ---------- Templates ----------
STORE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.4 12.6c0-2.5 2-3.7 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.3.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1.1-2.8-4.2zM13.9 5.2c.7-.9 1.2-2 1-3.2-1 .1-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>'
STORE = f'<a class="store" href="{APP}" rel="noopener">{STORE_SVG}<span><small>Download on the</small>App Store</span></a>'


def page(path, title, desc, body, jsonld=None, crumbs=None, og="/assets/og-home.png", app_arg=None):
    crumbs_html = ""
    if crumbs:
        crumbs_html = '<nav class="crumbs" aria-label="Breadcrumb">' + " / ".join(
            f'<a href="{u}">{e(n)}</a>' if u else f"<span>{e(n)}</span>" for n, u in crumbs) + "</nav>"
        bl = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, **({"item": SITE + u} if u else {})} for i, (n, u) in enumerate(crumbs)]}
        jsonld = (jsonld or []) + [bl]
    ld = "".join(f'<script type="application/ld+json">{json.dumps(j, ensure_ascii=False)}</script>' for j in (jsonld or []))
    out = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="theme-color" content="#3a128c">
<meta name="apple-itunes-app" content="app-id=6825091695{(", app-argument=" + e(app_arg)) if app_arg else ""}">
<link rel="canonical" href="{SITE}{path}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:site_name" content="Faders">
<meta property="og:url" content="{SITE}{path}">
<meta property="og:image" content="{SITE}{og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{e(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(title)}">
<meta name="twitter:description" content="{e(desc)}">
<meta name="twitter:image" content="{SITE}{og}">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link rel="stylesheet" href="/styles.css">
{ld}
</head>
<body class="doc sp">
<header class="nav"><div class="nav-inner"><a class="brand" href="/"><img src="/assets/icon.png" alt="" width="30" height="30"><span>Faders</span></a><nav class="nav-links" aria-label="Pages"><a href="/radio/">Stations</a><a href="/genre/">Genres</a><a href="{APP}" rel="noopener">Get the app</a></nav></div></header>
<main class="sp-main">{crumbs_html}{body}</main>
<footer class="footer"><div class="footer-inner"><nav aria-label="Footer"><a href="/">Faders</a><a href="/radio/">Stations by country</a><a href="/genre/">Genres</a><a href="/guides/">Guides</a><a href="/updates">Updates</a><a href="/support">Support</a><a href="/privacy">Privacy</a></nav><p>Station information from <a href="https://www.radio-browser.info" rel="noopener">radio-browser.info</a>. Faders is independent and isn’t affiliated with or endorsed by any station listed. Station names and logos belong to their owners; Faders plays each station’s own public stream and never alters it. © 2026 Mayank Gulaty, Ireland.</p></div></footer>
<div class="sheet" id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle" hidden><div class="sheet-card"><button class="sheet-close" type="button" aria-label="Close" data-close>✕</button><img src="/assets/icon.png" alt="" width="68" height="68"><h3 id="sheetTitle">Keep listening in Faders</h3><p id="sheetText">That was a taste. The app is free, plays on with your phone locked and names the songs, even when the station doesn’t.</p>{STORE}</div></div>
<script src="/assets/page.js" defer></script>
<script src="/assets/campaign.js" defer></script>
</body>
</html>
"""
    fp = path.strip("/") + "/index.html" if path.endswith("/") else path.strip("/") + ".html"
    os.makedirs(os.path.dirname(fp) or ".", exist_ok=True)
    with open(fp, "w") as f:
        f.write(out)


def logo(s, size=56):
    fav = s.get("favicon") or ""
    if fav.startswith("https://"):
        return f'<img class="sp-logo" src="{e(fav)}" alt="" width="{size}" height="{size}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{{className:\'sp-logo ph\',textContent:\'{e(initials(s["name"]))}\'}}))">'
    return f'<span class="sp-logo ph">{e(initials(s["name"]))}</span>'


def initials(n):
    w = [x for x in re.split(r"[^\w]+", n) if x]
    return ("".join(x[0] for x in w[:2]) or "FM").upper()


def place(s):
    cc = (s.get("countrycode") or "").upper()
    parts = [p for p in [(s.get("state") or "").strip(), country_name.get(cc) or s.get("country") or ""] if p]
    return ", ".join(dict.fromkeys(parts))


def card(uid):
    s = stations[uid]
    tags = " · ".join(clean_tags(s)[:2]) or place(s)
    return f'<a class="sp-card" href="/station/{slug_of[uid]}/">{logo(s, 44)}<span><b>{e(s["name"].strip())}</b><small>{e(tags)}</small></span></a>'


def article(word):
    return "an" if word[:1].lower() in "aeiou" else "a"


# ---------- Station pages ----------
station_country = {}
for cc, ids in by_country.items():
    for u in ids:
        station_country.setdefault(u, cc)
station_genres = {}
for t, ids in by_genre.items():
    for u in ids:
        station_genres.setdefault(u, []).append(t)

shutil.rmtree("station", ignore_errors=True)
for uid, s in stations.items():
    name, slug = s["name"].strip(), slug_of[uid]
    cc = (s.get("countrycode") or "").upper()
    where = place(s) or "the internet"
    tags = clean_tags(s)
    lang = (s.get("language") or "").split(",")[0].strip().title()
    stream = s.get("url_resolved") or ""
    desc_tags = f" playing {', '.join(tags[:3])}" if tags else ""
    about = f"{e(name)} is {article(lang or 'r')} {e(lang + ' ') if lang else ''}radio station from {e(where)}{e(desc_tags)}."
    if s.get("bitrate"):
        about += f" It streams at {int(s['bitrate'])} kbps{(' ' + e(s.get('codec'))) if s.get('codec') else ''}."
    if s.get("homepage", "").startswith("http"):
        about += f' Its own website is <a href="{e(s["homepage"])}" rel="nofollow noopener">{e(urllib.parse.urlparse(s["homepage"]).netloc)}</a>.'
    more_country = [u for u in by_country.get(station_country.get(uid, cc), []) if u != uid][:12]
    similar = []
    for t in station_genres.get(uid, []) + [t for t in tags if t in by_genre]:
        similar += [u for u in by_genre.get(t, []) if u != uid and u not in similar and u not in more_country]
    similar = similar[:8]
    # Opens the app on this station (a universal link: open.faders.app, so iOS hands it to Faders;
    # without the app it's this same page there, canonical to faders.app). Needs Faders 1.6.
    open_app = f'<a class="btn sp-open" href="https://open.faders.app/station/{slug}/?id={e(uid)}">Open in Faders</a>'
    preview = (f'<button class="btn sp-play" type="button" data-stream="{e(stream)}" data-name="{e(name)}">▶ Listen for a minute</button>'
               if stream.startswith("https://") else "")
    faq = [
        (f"How can I listen to {name} on iPhone?", f"Download Faders, free on the App Store, search for {name} and tap it. Already have Faders? Tap Open in Faders on this page and {name} starts playing. Add it to your favourites to see what’s on before you tune in."),
        (f"Can I listen to {name} in CarPlay?", f"Yes. In Faders, {name} plays in CarPlay, on Apple Watch, and in Car Mode for cars without CarPlay."),
        (f"What song is playing on {name}?", f"Faders shows the song, artist and cover as each song starts. When {name} doesn’t send it, Faders listens and names the song itself."),
    ]
    body = f"""
<section class="sp-hero">
  {logo(s, 96)}
  <div><p class="eyebrow">Live radio · {e(where)}</p><h1>{e(name)}</h1>
  <p class="sp-tags">{" ".join(f'<a href="/genre/{genre_slug[t]}/">{e(t)}</a>' if t in genre_slug else f"<span>{e(t)}</span>" for t in tags)}</p></div>
</section>
<section class="sp-listen">
  <div><h2>Listen to {e(name)} live</h2><p>Play {e(name)} in Faders, the radio app for iPhone, iPad, CarPlay and Apple Watch. See the song as it plays, and when the ads start, Faders can change the channel to one of your stations playing music, then bring you back.</p>
  <div class="sp-cta">{STORE}{open_app}{preview}</div></div>
</section>
<section><h2>About {e(name)}</h2><p>{about}</p><p class="fine">Faders is an independent app and isn’t affiliated with or endorsed by {e(name)}. The station’s name and logo belong to its owner.</p></section>
{f'<section><h2>More stations in {e(country_name.get(station_country.get(uid, cc), where))}</h2><div class="sp-grid">{"".join(card(u) for u in more_country)}</div><p><a href="/radio/{country_slug[station_country.get(uid, cc)]}/">All stations in {e(country_name.get(station_country.get(uid, cc)))} →</a></p></section>' if more_country else ''}
{f'<section><h2>Similar stations</h2><div class="sp-grid">{"".join(card(u) for u in similar)}</div></section>' if similar else ''}
<section class="sp-faq"><h2>Questions</h2>{"".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in faq)}</section>
"""
    ld = [{"@context": "https://schema.org", "@type": "RadioStation", "name": name, "url": f"{SITE}/station/{slug}/",
           **({"logo": s["favicon"]} if (s.get("favicon") or "").startswith("https://") else {}),
           **({"areaServed": country_name.get(cc)} if cc in country_name else {}),
           **({"sameAs": s["homepage"]} if (s.get("homepage") or "").startswith("http") else {})},
          {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
              {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}]
    crumbs = [("Faders", "/"), ("Stations", "/radio/")]
    if station_country.get(uid) in country_name:
        crumbs.append((country_name[station_country[uid]], f"/radio/{country_slug[station_country[uid]]}/"))
    crumbs.append((name, None))
    page(f"/station/{slug}/", f"{name} live – listen online | Faders",
         f"Listen to {name} live from {where}{desc_tags}. See the song as it plays, on iPhone, iPad, CarPlay and Apple Watch with Faders.",
         body, ld, crumbs, app_arg=f"faders://station/{uid}")

# ---------- Country pages ----------
shutil.rmtree("radio", ignore_errors=True)
for cc, ids in by_country.items():
    if not ids:
        continue
    n, slug = country_name[cc], country_slug[cc]
    body = f"""
<section class="sp-hero plain"><div><p class="eyebrow">Live radio</p><h1>Radio stations in {e(n)}</h1>
<p>The most-listened stations in {e(n)}, live. Faders plays all of them, and thousands more, on iPhone, iPad, CarPlay and Apple Watch, with song names.</p><div class="sp-cta">{STORE}</div></div></section>
<section><h2>Popular in {e(n)}</h2><div class="sp-grid">{"".join(card(u) for u in ids)}</div></section>
<section><h2>Other countries</h2><p class="sp-links">{" · ".join(f'<a href="/radio/{country_slug[c2]}/">{e(country_name[c2])}</a>' for c2 in list(by_country)[:40] if c2 != cc)}</p></section>
"""
    page(f"/radio/{slug}/", f"Radio stations in {n} – listen live online | Faders",
         f"Listen live to the most popular radio stations in {n}. With song names, on iPhone, iPad, CarPlay and Apple Watch with Faders.",
         body, None, [("Faders", "/"), ("Stations", "/radio/"), (n, None)], og="/assets/og/stations.png")

body = f"""<section class="sp-hero plain"><div><p class="eyebrow">Live radio</p><h1>Radio stations by country</h1>
<p>50,000+ live stations from around the world. Pick one, or spin the globe in the app.</p><div class="sp-cta">{STORE}</div></div></section>
<section><div class="sp-countries">{"".join(f'<a href="/radio/{country_slug[cc]}/"><b>{e(country_name[cc])}</b><small>{len(by_country[cc])} popular stations</small></a>' for cc in sorted(by_country, key=lambda c: country_name[c]))}</div></section>"""
page("/radio/", "Radio stations by country – listen live online | Faders",
     "Live radio from around the world: browse the most popular stations by country and listen on iPhone, iPad, CarPlay and Apple Watch with Faders.",
     body, None, [("Faders", "/"), ("Stations", None)], og="/assets/og/stations.png")

# ---------- Genre pages ----------
shutil.rmtree("genre", ignore_errors=True)
for t, ids in by_genre.items():
    if not ids:
        continue
    T = t.title() if t not in ("80s", "90s", "70s") else t
    body = f"""<section class="sp-hero plain"><div><p class="eyebrow">Live radio</p><h1>{e(T)} radio stations</h1>
<p>The most-listened {e(t)} stations from around the world, live. In Faders you can play them all, see what’s playing, and keep the music going when the ads start.</p><div class="sp-cta">{STORE}</div></div></section>
<section><h2>Popular {e(t)} stations</h2><div class="sp-grid">{"".join(card(u) for u in ids)}</div></section>
<section><h2>More genres</h2><p class="sp-links">{" · ".join(f'<a href="/genre/{genre_slug[g]}/">{e(g)}</a>' for g in GENRES if g != t)}</p></section>"""
    page(f"/genre/{genre_slug[t]}/", f"{T} radio stations – listen live online | Faders",
         f"Listen live to the best {t} radio stations from around the world, with song names, on iPhone, iPad and CarPlay with Faders.",
         body, None, [("Faders", "/"), ("Genres", "/genre/"), (T, None)], og="/assets/og/genres.png")
body = f"""<section class="sp-hero plain"><div><p class="eyebrow">Live radio</p><h1>Radio by genre</h1><p>Whatever you’re in the mood for, someone’s playing it live.</p><div class="sp-cta">{STORE}</div></div></section>
<section><div class="sp-countries">{"".join(f'<a href="/genre/{genre_slug[g]}/"><b>{e(g.title() if g not in ("80s","90s","70s") else g)}</b><small>{len(by_genre[g])} stations</small></a>' for g in GENRES if by_genre.get(g))}</div></section>"""
page("/genre/", "Radio by genre – listen live online | Faders",
     "Live radio by genre: pop, rock, jazz, classical, news, dance, chillout and more. Listen on iPhone, iPad, CarPlay and Apple Watch with Faders.",
     body, None, [("Faders", "/"), ("Genres", None)], og="/assets/og/genres.png")

# ---------- Sitemap ----------
urls = ["/", "/updates", "/press", "/support", "/privacy", "/radio/", "/genre/", "/guides/", "/llms.txt"]
urls += sorted(f"/guides/{d}/" for d in os.listdir("guides") if os.path.isfile(f"guides/{d}/index.html")) if os.path.isdir("guides") else []
urls += [f"/radio/{country_slug[c]}/" for c in by_country if by_country[c]]
urls += [f"/genre/{genre_slug[t]}/" for t in by_genre if by_genre[t]]
urls += [f"/station/{slug_of[u]}/" for u in stations]
with open("sitemap.xml", "w") as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
    for u in urls:
        f.write(f"  <url><loc>{SITE}{u}</loc><lastmod>{TODAY}</lastmod></url>\n")
    f.write("</urlset>\n")
print(f"done: {len(stations)} stations, {sum(1 for v in by_country.values() if v)} countries, {sum(1 for v in by_genre.values() if v)} genres, {len(urls)} urls")
