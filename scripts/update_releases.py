"""Adds the App Store's current Faders release to updates.html when it isn't there yet.

Reads Apple's public lookup (version, release date and What's New), so a new version shows on
faders.app/updates on its own; run by .github/workflows/releases.yml every few hours.
What's New lines look like "TITLE: text"; each becomes a bullet with the title in sentence case.
"""
import datetime
import html
import json
import re
import sys
import time
import urllib.request

APP_ID = "6825091695"
PAGE = "updates.html"
# Names that keep their own capitals when a title is put in sentence case.
NAMES = ["AirPlay", "CarPlay", "iPhone", "iPad", "Apple Music", "Apple TV", "Apple Watch", "Faders Plus", "Faders",
         "Faders Picks", "Lock Screen", "Dynamic Island", "Siri", "Shortcuts", "Jellyfin", "Plex", "Last.fm", "Duo", "Hi-Fi", "FLAC",
         "Opus", "Shazam", "Spotify", "Insights", "Christmas", "CarPlay"]


def sentence_case(title: str) -> str:
    text = title.strip().lower().capitalize()
    for name in NAMES:
        text = re.sub(rf"\b{re.escape(name.lower())}\b", name, text, flags=re.IGNORECASE)
    return text


def bullets(notes: str) -> list[str]:
    items = []
    for line in notes.splitlines():
        line = line.strip().lstrip("•-– ").strip()
        if not line:
            continue
        match = re.match(r"^([A-Z0-9][A-Z0-9 ,'’&/+.-]{2,}):\s*(.+)$", line)
        if match:
            text = match.group(2).strip()
            text = text[0].upper() + text[1:]
            items.append(f"<li><b>{html.escape(sentence_case(match.group(1)), quote=False)}.</b> {html.escape(text, quote=False)}</li>")
        else:
            items.append(f"<li>{html.escape(line, quote=False)}</li>")
    return items


def main() -> int:
    request = urllib.request.Request(f"https://itunes.apple.com/lookup?id={APP_ID}&country=gb",
                                     headers={"User-Agent": "Mozilla/5.0 (faders.app updates page)", "Accept": "application/json"})
    result = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                result = json.load(response)["results"][0]
            break
        except Exception as error:  # Apple sometimes turns away cloud runners: try again shortly
            print(f"lookup failed ({error}); retrying")
            time.sleep(20 * (attempt + 1))
    if result is None:
        print("lookup unavailable; nothing changed")
        return 0
    version, notes = result["version"], result.get("releaseNotes", "")
    released = datetime.datetime.fromisoformat(result["currentVersionReleaseDate"].replace("Z", "+00:00")).date()
    anchor = "v" + version.replace(".", "-")
    page = open(PAGE, encoding="utf-8").read()
    if f'id="{anchor}"' in page:
        print(f"{version} already listed")
        return 0
    items = bullets(notes)
    if not items:
        print(f"{version} has no notes; skipped")
        return 0
    day = f"{released.day} {released.strftime('%B %Y')}"
    article = (f'    <article class="release" id="{anchor}">\n      <h2>{version} <small>{day}</small></h2>\n      <ul>\n'
               + "".join(f"        {item}\n" for item in items) + "      </ul>\n    </article>\n\n")
    first = page.index('    <article class="release"')
    open(PAGE, "w", encoding="utf-8").write(page[:first] + article + page[first:])
    print(f"added {version} ({day})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
