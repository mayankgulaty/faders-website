#!/usr/bin/env python3
"""Renders the 1200×630 sharing images (Open Graph / X cards) into assets/og/, with headless Chrome.

    python3 scripts/make_og.py

Run locally when a guide or page headline changes; the images are committed. Pages without their
own image use assets/og-home.png (copied from assets/og/home.png; renamed when it changes, so X fetches it afresh).
"""
import html, os, subprocess, sys, tempfile, shutil

CHROME = next((p for p in ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", shutil.which("google-chrome") or "", shutil.which("chromium") or ""] if p and os.path.exists(p)), None)
if not CHROME:
    sys.exit("Chrome not found")

ROOT = os.path.abspath(".")
CARDS = [
    ("home", "Free on the App Store", "Radio that doesn’t", "suck.", "#3a128c"),
    # (file, kicker, headline, italic tail, background)
    ("updates", "What’s new", "Every update,", "newest first.", "#3a128c"),
    ("press", "Press kit", "Writing about", "Faders?", "#ff3d7f"),
    ("stations", "Live radio", "50,000+ stations,", "worldwide.", "#ff7a2f"),
    ("genres", "Live radio", "Radio by", "genre.", "#3a128c"),
    ("guides", "Guides", "Radio,", "made easy.", "#ff3d7f"),
    ("guide-what-song-is-playing-on-the-radio", "Guide", "What song is playing", "on the radio?", "#ff3d7f"),
    ("guide-radio-in-carplay", "Guide", "Live radio", "in CarPlay.", "#3a128c"),
    ("guide-listen-to-irish-radio-abroad", "Guide", "Irish radio,", "anywhere.", "#ff7a2f"),
    ("guide-radio-with-fewer-ads", "Guide", "Radio with", "fewer ads.", "#3a128c"),
    ("guide-wake-up-to-the-radio-on-iphone", "Guide", "Wake up to", "the radio.", "#ff7a2f"),
    ("guide-radio-on-apple-watch", "Guide", "Radio on your", "Apple Watch.", "#ff3d7f"),
    ("guide-christmas-radio-stations", "Guide", "Christmas radio,", "all season.", "#ff3d7f"),
    ("guide-internet-radio-data-usage", "Guide", "How much data", "does radio use?", "#3a128c"),
    ("guide-fm-radio-on-iphone", "Guide", "FM radio", "on iPhone?", "#ff7a2f"),
    ("guide-tunein-alternative-iphone", "Compared", "A TuneIn", "alternative.", "#3a128c"),
    ("guide-radio-garden-alternative", "Compared", "Radio Garden,", "and beyond.", "#ff7a2f"),
]

TEMPLATE = """<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:B;src:url(file://{root}/assets/fonts/bricolage.woff2);font-weight:200 800}}
@font-face{{font-family:S;font-style:italic;src:url(file://{root}/assets/fonts/instrument-serif-italic.woff2)}}
html,body{{margin:0;width:1200px;height:630px;overflow:hidden;background:{bg};color:{fg};font-family:B,-apple-system,sans-serif}}
.k{{position:absolute;left:80px;top:70px;font:800 26px B;letter-spacing:.12em;text-transform:uppercase;display:flex;align-items:center;gap:14px;opacity:.9}}
.k i{{width:16px;height:16px;border-radius:50%;background:#d4ff4f;box-shadow:0 0 0 7px rgba(212,255,79,.3)}}
h1{{position:absolute;left:76px;top:150px;width:1000px;margin:0;font:800 112px/0.95 B;letter-spacing:-.04em}}
h1 em{{font:400 italic 122px/0.95 S;letter-spacing:-.01em;display:block;margin-top:6px}}
.brand{{position:absolute;left:80px;bottom:60px;display:flex;align-items:center;gap:16px;font:800 40px B;letter-spacing:-.03em}}
.brand img{{width:64px;height:64px;border-radius:15px}}
.url{{position:absolute;right:80px;bottom:72px;font:700 26px B;opacity:.85}}
.sticker{{position:absolute;right:70px;top:60px;width:150px;height:150px;border-radius:50%;background:#d4ff4f;color:#170b2e;display:grid;place-items:center;text-align:center;font:800 28px/1 B;transform:rotate(12deg);box-shadow:0 10px 0 rgba(0,0,0,.18)}}
</style></head><body>
<div class="k"><i></i>{kicker}</div>
<h1>{head}<em>{tail}</em></h1>
<div class="sticker">free<br>app!</div>
<div class="brand"><img src="file://{root}/assets/icon.png">Faders</div><div class="url">faders.app</div>
</body></html>"""

os.makedirs("assets/og", exist_ok=True)
with tempfile.TemporaryDirectory() as tmp:
    for name, kicker, head, tail, bg in CARDS:
        fg = "#170b2e" if bg in ("#ff7a2f", "#ff3d7f") else "#fff3e3"
        page = os.path.join(tmp, f"{name}.html")
        with open(page, "w") as f:
            f.write(TEMPLATE.format(root=ROOT, bg=bg, fg=fg, kicker=html.escape(kicker), head=html.escape(head), tail=html.escape(tail)))
        out = os.path.abspath(f"assets/og/{name}.png")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--user-data-dir={tmp}/chrome",
                        "--allow-file-access-from-files", "--window-size=1200,630", "--virtual-time-budget=3000", f"--screenshot={out}", f"file://{page}"],
                       check=True, capture_output=True)
        print("rendered", out)
