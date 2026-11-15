#!/usr/bin/env python3
"""Builds the evergreen guides at /guides/<slug>/ and /guides/. Run from the repo root:

    python3 scripts/build_guides.py

Rules for the copy: only claims the app really makes good on; never "skip ads" or "block ads"
(Faders changes the channel and leaves every stream alone); never name the BBC.
"""
import html, json, os

SITE, APP = "https://faders.app", "https://apps.apple.com/app/id6825091695"
PUBLISHED = "2026-11-15"
STORE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.4 12.6c0-2.5 2-3.7 2.1-3.7-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.3.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1.1-2.8-4.2zM13.9 5.2c.7-.9 1.2-2 1-3.2-1 .1-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3.1-1.5z"/></svg>'
STORE = f'<a class="store" href="{APP}" rel="noopener">{STORE_SVG}<span><small>Download on the</small>App Store</span></a>'
CTA = f'<aside class="sp-listen"><h2>Try it with Faders</h2><p>Free on the App Store for iPhone, iPad, CarPlay and Apple Watch. No account, no tracking.</p><div class="sp-cta">{STORE}</div></aside>'

GUIDES = [
  {
    "slug": "what-song-is-playing-on-the-radio",
    "title": "How to find out what song is playing on the radio",
    "desc": "Heard a song on the radio and want to know what it is? Four ways to name it on iPhone, from the station’s own song info to recognising it by ear.",
    "body": """
<p>You’re in the car or the kitchen, a great song comes on, and the presenter doesn’t say what it was. Here’s how to find out, from the quickest to the most reliable.</p>
<h2>1. Look at what the station sends</h2>
<p>Most stations broadcast the title and artist alongside the audio, the same text you see on a car’s radio display. Any decent radio app shows it. The catch: plenty of stations send only their name or slogan, and some send the song a minute late.</p>
<h2>2. Check the station’s playlist page</h2>
<p>Many stations publish a “recently played” list on their website. It’s accurate, but it means stopping what you’re doing, finding the site and scrolling to the right time.</p>
<h2>3. Use Music Recognition in Control Center</h2>
<p>On iPhone you can add Music Recognition to Control Center (Settings › Control Center) and tap it while the song plays. It works for anything you can hear, but you have to catch the song while it’s still on, and it doesn’t know which station you were listening to.</p>
<h2>4. Let your radio app do it for you</h2>
<p><a href="/">Faders</a> combines the first and third: it shows what the station sends, and when the station doesn’t say, it listens to the stream itself and names the song, with the title, artist, album, year and cover, as each song starts. Every song you hear is saved to your history, so you can find the one from this morning later, and with Faders Plus one tap saves it to an Apple Music playlist (and loves it on Last.fm, if you’ve connected it).</p>
<p>It even works on your favourites before you tune in: their cards show what’s on right now.</p>
<h2>When it can’t name a song</h2>
<p>Song recognition needs a recording it knows. DJ mixes where songs blend into each other, live sessions, and presenters talking over the intro are the hardest. If one slips through, the station’s playlist page (tip 2) is your friend.</p>
""",
  },
  {
    "slug": "radio-in-carplay",
    "title": "How to listen to live radio in CarPlay (and in cars without it)",
    "desc": "Play live radio stations from anywhere in the world through CarPlay, or on a big-button screen in cars without CarPlay. What to set up before you drive.",
    "body": """
<p>Your car’s FM radio only reaches local stations, and DAB coverage comes and goes. Internet radio through your phone fixes both: any station, anywhere, as long as you have mobile data.</p>
<h2>In a car with CarPlay</h2>
<p>Any radio app that supports CarPlay appears on the car’s screen when you plug in or connect wirelessly. In <a href="/">Faders</a> you get five tabs designed to be used at a glance:</p>
<ul><li><b>Favorites:</b> your stations, in your order</li><li><b>Recents:</b> what you played last</li><li><b>Genres:</b> when you fancy something different</li><li><b>Near You:</b> local stations, wherever the road takes you</li><li><b>Your Music:</b> your own library, if you’ve connected one</li></ul>
<p>Tap a station and the Now Playing screen shows the song and cover. Next and previous move through your favourites.</p>
<h2>In a car without CarPlay</h2>
<p>Plenty of cars, including Teslas, don’t have CarPlay. Faders has a <b>Car Mode</b> for those: open it from the car icon on the Listen tab and you get big buttons and big type, made to be used in a phone mount, with sound through Bluetooth.</p>
<h2>Before you drive</h2>
<ul><li><b>Pick your favourites at home.</b> Searching while driving isn’t safe, and favourites are one tap away in CarPlay.</li><li><b>Data use:</b> a typical station uses about 60 MB an hour at 128 kbps.</li><li><b>Siri works too:</b> “Play Today FM on Faders” starts a station without touching anything.</li></ul>
<h2>Fewer ads on long drives</h2>
<p>Turn on <b>Change Station</b> in Settings › Breaks. When your station goes to an ad break, Faders tunes to another of your favourites that’s playing a song, then brings you back when your station’s music returns, like you’d do with the dial, but without taking your eyes off the road.</p>
""",
  },
  {
    "slug": "listen-to-irish-radio-abroad",
    "title": "How to listen to Irish radio abroad",
    "desc": "Living outside Ireland? How to listen to RTÉ, Today FM, Newstalk and local Irish stations live on your iPhone from anywhere in the world.",
    "body": """
<p>Moved away, on holiday, or just missing the local station from home? Almost every Irish station streams online, so you can listen live from anywhere with an internet connection.</p>
<h2>National stations</h2>
<p><a href="/station/rte-radio-1/">RTÉ Radio 1</a>, <a href="/station/rte-2-fm/">RTÉ 2FM</a>, <a href="/station/rte-lyric-fm/">RTÉ lyric fm</a>, <a href="/station/today-fm/">Today FM</a> and <a href="/station/newstalk-ireland/">Newstalk</a> all stream worldwide.</p>
<h2>Dublin and local stations</h2>
<p><a href="/station/dublin-s-fm104/">FM104</a>, <a href="/station/dublin-s-98fm/">98FM</a>, <a href="/station/sunshine-106-8/">Sunshine 106.8</a>, <a href="/station/radio-nova-100/">Radio Nova</a> and county stations from Cork to Donegal are all online too. Browse <a href="/radio/ireland/">every popular Irish station</a>.</p>
<h2>The easiest way: one app for all of them</h2>
<p>Instead of a different app for every broadcaster, <a href="/">Faders</a> plays them all in one place:</p>
<ul><li>Favourite the stations you grew up with, and see what’s on each before you tune in.</li><li>Every song named, even on stations that don’t send it.</li><li>Pause and rewind live radio with Faders Plus, handy when you’re in a different time zone and catch the end of something.</li><li>CarPlay, Apple Watch, widgets and Siri: “Play RTÉ Radio 1 on Faders”.</li></ul>
<h2>Will everything play abroad?</h2>
<p>The live streams do. Now and then a single programme, often sport, may not be available outside Ireland because of broadcasting rights.</p>
<h2>Time zones</h2>
<p>Ireland is on GMT in winter and GMT+1 in summer. If the breakfast show is at 3 am where you are, try Wake to Radio in Faders Plus at a sensible hour, or rewind.</p>
""",
  },
  {
    "slug": "radio-with-fewer-ads",
    "title": "How to listen to the radio with fewer ads",
    "desc": "Love radio, tired of ad breaks? Ad-free listener-supported stations, and how Faders changes the channel during breaks without touching the station’s stream.",
    "body": """
<p>Commercial radio pays for itself with ads, and that’s fair: they keep the station on air. But nobody tunes in for ten minutes of them. Here are honest ways to hear more music.</p>
<h2>1. Listener-supported stations</h2>
<p>Some of the best radio in the world has no ads at all, because listeners fund it: SomaFM, Radio Paradise and many community stations. In Faders these are the <b>Moods</b>: Focus, Chill, Sleep, Jazz Café, Energy and Retro, hand-picked and ad-free. If you enjoy one, consider supporting it directly.</p>
<h2>2. Public broadcasters</h2>
<p>Many public broadcasters carry few or no ads on their radio stations. Browse by country in <a href="/radio/">our station directory</a>.</p>
<h2>3. Change the channel, automatically</h2>
<p>This is what <a href="/">Faders</a> was made for. Turn on <b>Change Station</b> in Settings › Breaks, and when your station goes to an ad break, Faders tunes to another of your favourite stations that’s playing a song. It keeps listening to your station and brings you back when its music returns.</p>
<p>It’s the same thing you’d do with a radio dial, just done for you. Faders never cuts, mutes or alters the station’s stream: the ads still play on the station, you’re simply listening to something else for a few minutes.</p>
<ul><li><b>Stay</b> leaves you on your station.</li><li><b>Change Station</b> moves during ad breaks.</li><li><b>Music Only</b> also moves when the presenter talks for a while.</li></ul>
<p>You can choose differently for each station, so a talk station you love can stay as it is. It works with your phone locked too.</p>
<h2>Is it perfect?</h2>
<p>Not yet, and we’re honest about it: a break can take a few seconds to spot, and every station is different. If Faders gets one wrong, tap “It wasn’t a break” and it learns your station.</p>
""",
  },
  {
    "slug": "wake-up-to-the-radio-on-iphone",
    "title": "How to wake up to the radio on iPhone",
    "desc": "Set an iPhone alarm that wakes you up to your favourite live radio station, even in silent mode. A step-by-step guide.",
    "body": """
<p>The iPhone’s Clock app can play songs and tones, but not live radio. To wake up to your favourite station, you need a radio app with alarms.</p>
<h2>With Faders</h2>
<ol><li>Get <a href="/">Faders</a> and favourite your station.</li><li>Open Settings › <b>Wake to Radio</b> (part of Faders Plus).</li><li>Pick a time, the days, and the station.</li></ol>
<p>Faders uses a real iPhone alarm, so it rings even in silent mode and through Focus. Tap <b>Listen</b> on the alarm and Faders opens playing your station.</p>
<h2>Tips for a gentle morning</h2>
<ul><li><b>Pick a breakfast show you like:</b> a good presenter beats an alarm tone.</li><li><b>Use the sleep timer at night:</b> fall asleep to a Sleep mood, and it fades out gently.</li><li><b>Calm mode</b> (Faders Plus) turns your phone into a quiet bedside clock while the music plays.</li><li><b>Check your volume:</b> the alarm uses your ringer volume.</li></ul>
<h2>Why live radio?</h2>
<p>Weather, traffic and the news from your own area, plus the same voices every morning. That’s why clock radios were on bedside tables for 50 years.</p>
""",
  },
  {
    "slug": "radio-on-apple-watch",
    "title": "How to listen to live radio on Apple Watch",
    "desc": "Play live radio stations on your Apple Watch with Bluetooth headphones, without your iPhone. What you need and how to set it up.",
    "body": """
<p>Going for a run and leaving the phone at home? Your Apple Watch can play live radio on its own.</p>
<h2>What you need</h2>
<ul><li>An Apple Watch with mobile data or Wi-Fi.</li><li>Bluetooth headphones paired with the Watch: the Watch speaker isn’t used for music.</li><li>A radio app with a Watch app, such as <a href="/">Faders</a>.</li></ul>
<h2>Set up your stations</h2>
<p>Favourite your stations in Faders on your iPhone and they appear on your Watch. On the Watch, tap a station to play it. If no headphones are connected, the Watch asks you to connect them.</p>
<h2>Good to know</h2>
<ul><li><b>Data:</b> streaming over mobile data uses about 60 MB an hour at 128 kbps.</li><li><b>Battery:</b> streaming is heavier on the Watch battery than playing downloaded music.</li><li><b>Controls:</b> pause and play from the Watch, as with any audio app.</li></ul>
<h2>With your iPhone nearby</h2>
<p>When your iPhone is with you, it’s usually better to play on the phone and control it from the Watch: better battery, and every Faders feature, like song names and changing station during breaks.</p>
""",
  },
]

HEAD = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title><meta name="description" content="{desc}"><meta name="theme-color" content="#3a128c"><meta name="apple-itunes-app" content="app-id=6825091695">
<link rel="canonical" href="{url}"><meta property="og:title" content="{title}"><meta property="og:description" content="{desc}"><meta property="og:site_name" content="Faders">
<meta property="og:url" content="{url}">
<meta property="og:image" content="https://faders.app{og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{title}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="https://faders.app{og}"><meta property="og:type" content="article">
<link rel="icon" type="image/png" href="/assets/favicon.png"><link rel="stylesheet" href="/styles.css">{ld}</head>
<body class="doc sp"><header class="nav"><div class="nav-inner"><a class="brand" href="/"><img src="/assets/icon.png" alt="" width="30" height="30"><span>Faders</span></a><nav class="nav-links" aria-label="Pages"><a href="/radio/">Stations</a><a href="/guides/">Guides</a><a href="{app}" rel="noopener">Get the app</a></nav></div></header>
<main class="sp-main guide">{body}</main>
<footer class="footer"><div class="footer-inner"><nav aria-label="Footer"><a href="/">Faders</a><a href="/guides/">Guides</a><a href="/radio/">Stations</a><a href="/updates">Updates</a><a href="/support">Support</a><a href="/privacy">Privacy</a></nav><p>© 2026 Mayank Gulaty, Ireland.</p></div></footer>
<script src="/assets/campaign.js" defer></script>
</body></html>
"""


def esc(s):
    return html.escape(s, quote=True)


def write(path, title, desc, body, ld, og="/assets/og.png"):
    url = SITE + path
    out = HEAD.format(title=esc(title), desc=esc(desc), url=url, app=APP, body=body, og=og,
                      ld="".join(f'<script type="application/ld+json">{json.dumps(j, ensure_ascii=False)}</script>' for j in ld))
    os.makedirs(path.strip("/"), exist_ok=True)
    with open(path.strip("/") + "/index.html", "w") as f:
        f.write(out)


for g in GUIDES:
    path = f"/guides/{g['slug']}/"
    others = "".join(f'<li><a href="/guides/{o["slug"]}/">{esc(o["title"])}</a></li>' for o in GUIDES if o is not g)
    body = (f'<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Faders</a> / <a href="/guides/">Guides</a></nav>'
            f'<article><p class="eyebrow">Guide</p><h1 class="guide-title">{esc(g["title"])}</h1>{g["body"]}</article>{CTA}'
            f'<section><h2>More guides</h2><ul class="guide-list">{others}</ul></section>')
    ld = [{"@context": "https://schema.org", "@type": "Article", "headline": g["title"], "description": g["desc"], "datePublished": PUBLISHED,
           "author": {"@type": "Person", "name": "Mayank Gulaty"}, "publisher": {"@type": "Organization", "name": "Faders", "logo": {"@type": "ImageObject", "url": SITE + "/assets/icon.png"}},
           "mainEntityOfPage": SITE + path, "image": SITE + f"/assets/og/guide-{g['slug']}.png"}]
    write(path, f"{g['title']} | Faders", g["desc"], body, ld, og=f"/assets/og/guide-{g['slug']}.png")

items = "".join(f'<a class="guide-card" href="/guides/{g["slug"]}/"><b>{esc(g["title"])}</b><small>{esc(g["desc"])}</small></a>' for g in GUIDES)
write("/guides/", "Radio guides | Faders", "Practical guides to live radio on iPhone, iPad, CarPlay and Apple Watch: song names, fewer ads, waking up to the radio and more.",
      f'<section class="sp-hero plain"><div><p class="eyebrow">Guides</p><h1>Radio, made easy.</h1><p>Practical answers to the questions people ask about listening to the radio on Apple devices.</p></div></section><section><div class="guide-grid">{items}</div></section>{CTA}', [], og="/assets/og/guides.png")
print(f"{len(GUIDES)} guides")
