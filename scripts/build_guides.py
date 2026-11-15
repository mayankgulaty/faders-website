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
  {
    "slug": "christmas-radio-stations",
    "title": "Christmas radio stations to stream online",
    "desc": "The best Christmas radio stations to stream live in 2026, from Ireland’s Christmas FM to 24/7 carols and classics, and how to play them on iPhone and in CarPlay.",
    "body": """
<p>From late November, radio stations around the world switch to Christmas songs, and some exist only for the season. Here’s where to find them, and how to listen on your iPhone, in the car or on a smart speaker.</p>
<h2>Christmas FM (Ireland)</h2>
<p>An Irish favourite: a charity station that comes on air every year for the season, playing Christmas music non-stop. It streams worldwide, so it’s a taste of home for Irish people abroad. Find <a href="/station/christmas-fm-ireland/">Christmas FM Ireland</a> and its sister channels for classical carols.</p>
<h2>24/7 Christmas stations</h2>
<p>Dozens of internet stations play Christmas music all season, and some all year: classic crooners, modern pop, carols, country and kids’ songs. Browse <a href="/genre/christmas/">the most-listened Christmas stations</a>.</p>
<h2>Your usual station</h2>
<p>Many pop and adult-contemporary stations switch to all-Christmas playlists in December. Check your favourites: in Faders their cards show what’s playing before you tune in.</p>
<h2>The easy way: a Christmas shelf in Faders</h2>
<p>From <b>20 November to 6 January</b>, <a href="/">Faders</a> adds a <b>Christmas</b> shelf to the Listen tab, with stations from your own country first. There’s gentle snow at the top of the screen, and a festive app icon if you’d like one. No update needed: it turns up by itself.</p>
<ul><li>Every song named, even on stations that don’t send it</li><li>In CarPlay for the drive home</li><li>On Apple Watch with Bluetooth headphones</li><li>A sleep timer for falling asleep to carols</li></ul>
<h2>On a speaker</h2>
<p>Use AirPlay to send any station from Faders to a HomePod, an AirPlay speaker or your TV, or connect any Bluetooth speaker.</p>
""",
  },
  {
    "slug": "internet-radio-data-usage",
    "title": "How much data does internet radio use?",
    "desc": "Internet radio uses about 30 to 150 MB an hour depending on the station’s quality. A table by bitrate, and how to keep mobile data use down on iPhone.",
    "body": """
<p>Streaming radio uses mobile data at a steady rate, set by the station’s <b>bitrate</b>: the higher the bitrate, the better it sounds and the more data it uses. Unlike video, it’s modest.</p>
<h2>Data per hour by bitrate</h2>
<table class="data"><thead><tr><th>Bitrate</th><th>Per hour</th><th>Typical stations</th></tr></thead><tbody>
<tr><td>48 kbps (AAC+)</td><td>about 22 MB</td><td>talk and news, mobile streams</td></tr>
<tr><td>64 kbps</td><td>about 29 MB</td><td>talk, many local stations</td></tr>
<tr><td>128 kbps</td><td>about 58 MB</td><td>most music stations</td></tr>
<tr><td>192 kbps</td><td>about 86 MB</td><td>higher-quality music</td></tr>
<tr><td>320 kbps</td><td>about 144 MB</td><td>audiophile streams</td></tr>
</tbody></table>
<p>So an hour of a typical music station is about the same as five minutes of standard-definition video. A daily one-hour commute at 128 kbps uses about 1.2 GB a month.</p>
<h2>How to use less</h2>
<ul><li><b>Pick stations with a lower bitrate</b> for talk and news; speech sounds fine at 48 to 64 kbps. Faders shows each station’s bitrate in the player.</li><li><b>Use Wi-Fi at home and work.</b></li><li><b>Turn on Low Data Mode</b> (Settings › Mobile Data › Mobile Data Options) if your plan is tight. Faders saves its background song recognition for Wi-Fi.</li><li><b>Download your own music</b> for flights and tunnels: Faders plays albums from your Plex or Jellyfin server offline.</li></ul>
<h2>Does recognising songs use data?</h2>
<p>Very little. When a station doesn’t say what’s playing, Faders sends a short audio signature, not the audio, to name the song. On your favourites’ cards it only does this on Wi-Fi.</p>
""",
  },
  {
    "slug": "fm-radio-on-iphone",
    "title": "FM radio on iPhone: what actually works",
    "desc": "iPhones don’t have a working FM radio tuner. Here are the ways that do work to listen to your local FM stations on iPhone, and which is best.",
    "body": """
<p>Short answer: iPhones can’t pick up FM broadcasts. There’s no FM tuner that apps can use, and “FM radio” apps on the App Store are internet radio. The good news is that almost every FM station also streams online, with the same programmes at the same time.</p>
<h2>1. An internet radio app</h2>
<p>Search for your station by name or frequency in a radio app and it plays the station’s live stream, the same as on FM. In <a href="/">Faders</a> you can search by frequency (try “98.1”), see what’s on before you tune in, and browse your country’s stations (in CarPlay, <b>Near You</b> shows the local ones).</p>
<h2>2. The station’s own app</h2>
<p>Big broadcasters have their own apps. They work, but you end up with one app per station, each with its own adverts and sign-in.</p>
<h2>3. A smart speaker or car radio</h2>
<p>Your car’s FM and DAB radio still work, of course. To get your phone’s stations in the car, use CarPlay or Bluetooth.</p>
<h2>FM or internet: what’s the difference?</h2>
<ul><li><b>Coverage:</b> FM fades outside the station’s area; the stream works anywhere with data.</li><li><b>Sound:</b> most streams are 128 kbps, close to FM quality, and without static.</li><li><b>Delay:</b> streams run 10 to 30 seconds behind FM, which only matters if you’re listening to both at once.</li><li><b>Extras:</b> song names, pausing, rewinding and favourites, which FM can’t do.</li></ul>
""",
  },
{
    "slug": "tunein-alternative-iphone",
    "title": "Looking for a TuneIn alternative on iPhone?",
    "desc": "A fair comparison of TuneIn and Faders for live radio on iPhone: subscriptions, song names, ad breaks, CarPlay, privacy, and when TuneIn is still the better pick.",
    "body": """
<p>TuneIn is one of the biggest radio apps in the world, with over 100,000 stations, podcasts and, with its Premium subscription, live sports and audiobooks. If you mainly want live radio, though, you might want something simpler. Here’s an honest comparison.</p>
<h2>At a glance</h2>
<table class="data"><thead><tr><th></th><th>TuneIn</th><th>Faders</th></tr></thead><tbody>
<tr><td>Price</td><td>Free, with a Premium subscription</td><td>Free, with an optional one-time Plus purchase</td></tr>
<tr><td>Live radio stations</td><td>100,000+</td><td>Tens of thousands, from every country</td></tr>
<tr><td>Song names</td><td>Shows the station’s song info</td><td>Shows the station’s, and names the song itself when it’s missing</td></tr>
<tr><td>Ad breaks</td><td>Premium offers commercial-free stations</td><td>Changes the channel to another of your stations, free</td></tr>
<tr><td>CarPlay and Apple Watch</td><td>Yes</td><td>Yes, plus Car Mode for cars without CarPlay</td></tr>
<tr><td>Podcasts, audiobooks, live sports</td><td>Yes (sports and audiobooks with Premium)</td><td>No</td></tr>
</tbody></table>
<h2>Where Faders is different</h2>
<ul><li><b>No subscription.</b> Listening is free. Faders Plus is a single purchase, shared with your family, for extras like pause and rewind, skins and alarms.</li><li><b>Every song named.</b> When a station doesn’t say what’s playing, Faders listens and identifies it, with the album, year and cover.</li><li><b>Changing the channel during breaks.</b> Faders can move you to one of your stations playing a song while yours is on an ad break, and bring you back after. It never alters any station’s stream.</li><li><b>Private by design.</b> No account and no tracking: the App Store privacy label says “Data Not Collected”.</li><li><b>Ad-free moods</b> from listener-supported stations, for focus, sleep and more.</li></ul>
<h2>When TuneIn is the better pick</h2>
<p>If you want podcasts, audiobooks or US live sports coverage in the same app as your radio, TuneIn does all of that and Faders doesn’t. Faders is for people who want live radio, done really well.</p>
<p class="fine">Compared using each app’s App Store listing in November 2026. Features and prices change; check the App Store for the latest.</p>
""",
  },
  {
    "slug": "radio-garden-alternative",
    "title": "Radio Garden alternative for iPhone",
    "desc": "Love Radio Garden’s globe? How it compares with Faders on iPhone: a world map too, plus song names, CarPlay, ad-free moods and changing station during breaks.",
    "body": """
<p>Radio Garden is a beautiful idea: spin a globe, tap a green dot, and hear the radio from that town. If you love it but want an everyday radio app as well, here’s how Faders compares.</p>
<h2>What Radio Garden does well</h2>
<ul><li>The globe is a joy for discovering stations by place.</li><li>It’s free, with visual ads; a Premium purchase removes them and adds a sleep timer.</li><li>Favourites sync with iCloud, and the Lock Screen shows the song when the station sends it.</li></ul>
<h2>What Faders adds</h2>
<ul><li><b>A World Map too,</b> plus search by name or frequency, genres in the languages you speak, and a country’s stations sorted by what’s popular.</li><li><b>Every song named,</b> even when the station doesn’t send it, with album, year and cover, and a history of everything you heard.</li><li><b>Changing the channel during ad breaks</b> to another of your stations playing music, then back. It never alters any stream.</li><li><b>Ad-free moods,</b> CarPlay, Car Mode, Apple Watch, widgets, Siri and a sleep timer, free.</li><li><b>No ads of ours and no tracking.</b> The App Store privacy label is “Data Not Collected”.</li></ul>
<h2>Use both</h2>
<p>They’re not either/or. Many people use the globe to discover a station, then add it to an everyday app for the car and the kitchen. In Faders you can also <a href="/">spin our globe on the website</a> and land somewhere random.</p>
<p>Browse <a href="/radio/">stations by country</a> or <a href="/genre/">by genre</a> to find your next favourite.</p>
<p class="fine">Compared using each app’s App Store listing in November 2026. Features and prices change; check the App Store for the latest.</p>
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


def write(path, title, desc, body, ld, og="/assets/og-home.png"):
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
