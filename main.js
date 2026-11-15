// Faders website: an in-browser taste of Faders Moods, a break-switching demo, live songs,
// stations from the visitor's country, and gentle nudges to get the app.
// No analytics, no cookies, nothing stored.
"use strict";

const APP_STORE_URL = "https://apps.apple.com/app/id6825091695";
const NUDGE_AT = 4 * 60;     // seconds of listening: a friendly note about the app
const FADE_AT = 12 * 60;     // the web taste ends here (once extendable by 5 minutes)
const EXTRA = 5 * 60;
const PLUS_PRICE_RISES = new Date("2026-12-01T00:00:00Z");

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const root = document.documentElement;

// ---------- Stations ----------
const soma = (ch, n) => ({ n, u: `https://ice5.somafm.com/${ch}-128-mp3`, meta: ["soma", ch], logo: `https://somafm.com/logos/256/${ch}256.png`, by: "SomaFM" });
const rp = (mount, n) => ({ n, u: `https://stream.radioparadise.com/${mount}`, meta: null, logo: null, by: "Radio Paradise" });
const laut = (st, n) => ({ n, u: `https://stream.laut.fm/${st}`, meta: ["laut", st], logo: null, by: "laut.fm" });
// Each mood leads with streams that play in any browser; SomaFM is a backup (some networks get a 403 from it).
const MOODS = [
  { id: "focus", name: "Focus", h: 262, st: [
    { n: "ISEKOI Chill Zone", u: "https://public.isekoi-radio.com/listen/chill/radio.mp3", meta: ["azura", "https://public.isekoi-radio.com/api/nowplaying/chill"], by: "ISEKOI Radio" },
    soma("fluid", "Fluid"), soma("vaporwaves", "Vaporwaves")] },
  { id: "chill", name: "Chill", h: 152, st: [rp("mellow-128", "Radio Paradise Mellow"), soma("groovesalad", "Groove Salad"), soma("lush", "Lush")] },
  { id: "sleep", name: "Sleep", h: 226, st: [
    { n: "Ambient Sleeping Pill", u: "https://radio.stereoscenic.com/asp-h", meta: ["ice", "https://radio.stereoscenic.com/status-json.xsl"], by: "Ambient Sleeping Pill" },
    soma("dronezone", "Drone Zone"), soma("deepspaceone", "Deep Space One")] },
  { id: "jazz", name: "Jazz Café", h: 32, st: [laut("jazz", "Jazz"), soma("sonicuniverse", "Sonic Universe"), soma("secretagent", "Secret Agent")] },
  { id: "energy", name: "Energy", h: 336, st: [rp("rock-128", "Radio Paradise Rock"), rp("mp3-128", "Radio Paradise"), soma("indiepop", "Indie Pop Rocks")] },
  { id: "retro", name: "Retro", h: 292, st: [laut("80er", "80er"), soma("u80s", "Underground 80s"), soma("spacestation", "Space Station")] },
];

function moodForNow() {
  const h = new Date().getHours();
  if (h >= 5 && h < 10) return 4;
  if (h >= 10 && h < 17) return 0;
  if (h >= 17 && h < 21) return 1;
  if (h >= 21 && h < 23) return 3;
  return 2;
}

// ---------- Now-playing metadata ----------
async function getJSON(url, ms = 7000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, cache: "no-store" }); if (!r.ok) throw 0; return await r.json(); }
  finally { clearTimeout(t); }
}
async function nowPlaying(st) {
  if (!st.meta) return null;
  const [kind, arg] = st.meta;
  try {
    if (kind === "soma") {
      const j = await getJSON(`https://somafm.com/songs/${arg}.json`);
      const s = j.songs && j.songs[0];
      return s ? { title: s.title, artist: s.artist, cover: s.albumArt || st.logo } : null;
    }
    if (kind === "laut") {
      const s = await getJSON(`https://api.laut.fm/station/${arg}/current_song`);
      return s?.title ? { title: s.title, artist: s.artist?.name } : null;
    }
    if (kind === "azura") {
      const s = (await getJSON(arg)).now_playing?.song;
      return s ? { title: s.title, artist: s.artist, cover: s.art } : null;
    }
    if (kind === "ice") {
      let src = (await getJSON(arg)).icestats?.source;
      src = Array.isArray(src) ? (src.find((x) => /asp-h/.test(x.listenurl || "")) || src[0]) : src;
      const t = src?.title || "";
      const i = t.indexOf(" - ");
      return t ? (i > 0 ? { artist: t.slice(0, i), title: t.slice(i + 3) } : { title: t }) : null;
    }
  } catch { /* metadata is a nicety */ }
  return null;
}

// ---------- Player ----------
const ui = {
  tuner: $(".tuner"), play: $("#play"), next: $("#next"), vol: $("#volume"), dial: $("#dial"),
  cover: $("#cover"), station: $("#station"), title: $("#title"), artist: $("#artist"), viz: $("#viz"),
};
let moodIndex = moodForNow();
let stationIndex = 0;
let audio = null;
let ctx = null, analyser = null, freq = null;
let playing = false;
let metaTimer = 0, stallTimer = 0;
let listened = 0, limit = FADE_AT, extended = false, nudged = false;

function setHue(h) { root.style.setProperty("--h", h); }

function buildDial() {
  MOODS.forEach((m, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "mood"; b.textContent = m.name;
    b.setAttribute("role", "radio");
    b.addEventListener("click", () => tune(i, true));
    ui.dial.appendChild(b);
  });
  // Drag along the dial, like a real tuner.
  let dragging = false;
  const pick = (x) => {
    const r = ui.dial.getBoundingClientRect();
    const i = Math.max(0, Math.min(MOODS.length - 1, Math.floor(((x - r.left) / r.width) * MOODS.length)));
    if (i !== moodIndex) tune(i, playing);
  };
  ui.dial.addEventListener("pointerdown", (e) => { if (e.target.classList.contains("mood")) return; dragging = true; ui.dial.setPointerCapture(e.pointerId); pick(e.clientX); });
  ui.dial.addEventListener("pointermove", (e) => dragging && pick(e.clientX));
  ui.dial.addEventListener("pointerup", () => (dragging = false));
  ui.dial.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      tune((moodIndex + (e.key === "ArrowRight" ? 1 : MOODS.length - 1)) % MOODS.length, playing);
      $$(".mood", ui.dial)[moodIndex].focus();
    }
  });
  showMood();
}

function showMood() {
  const m = MOODS[moodIndex];
  setHue(m.h);
  $$(".mood", ui.dial).forEach((b, i) => { b.setAttribute("aria-checked", i === moodIndex); b.tabIndex = i === moodIndex ? 0 : -1; });
  ui.dial.style.setProperty("--needle", `${((moodIndex + 0.5) / MOODS.length) * 100}%`);
  const st = m.st[stationIndex];
  ui.station.textContent = `${m.name} · ${st.n}`;
}

function setState(s) {
  ui.tuner.classList.toggle("playing", s === "playing");
  ui.tuner.classList.toggle("loading", s === "loading");
  ui.play.setAttribute("aria-label", s === "playing" ? "Pause" : "Play");
}

function stopAudio() {
  clearTimeout(stallTimer);
  if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); audio = null; }
}

function ensureContext() {
  if (isIOS || ctx) return;   // iOS Safari can go silent through Web Audio with live streams: draw a gentle animation instead
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
}

function start(withCors = !isIOS) {
  stopAudio();
  const st = MOODS[moodIndex].st[stationIndex];
  const a = new Audio();
  if (withCors) a.crossOrigin = "anonymous";
  a.preload = "none";
  a.volume = +ui.vol.value;
  a.src = st.u;
  audio = a;
  analyser = null;
  setState("loading");
  showMood();
  ui.title.textContent = "Tuning in…";
  ui.artist.textContent = st.by;
  ui.cover.src = st.logo || "assets/icon.png";

  a.addEventListener("playing", () => {
    if (audio !== a) return;
    clearTimeout(stallTimer);
    playing = true; setState("playing");
    if (withCors && ctx && !analyser) {
      try {
        const src = ctx.createMediaElementSource(a);
        analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.8;
        freq = new Uint8Array(analyser.frequencyBinCount);
        src.connect(analyser); analyser.connect(ctx.destination);
      } catch { analyser = null; }
    }
    refreshMeta();
  });
  a.addEventListener("error", () => {
    if (audio !== a) return;
    if (withCors) return start(false);       // try once more without Web Audio
    failover();
  });
  stallTimer = setTimeout(() => { if (audio === a && !playing) failover(); }, 12000);
  if (ctx && ctx.state === "suspended") ctx.resume();
  a.play().catch(() => { if (audio === a) failover(); });
}

function failover() {
  const m = MOODS[moodIndex];
  if (stationIndex < m.st.length - 1) { stationIndex++; start(); }
  else { playing = false; setState("idle"); ui.title.textContent = "This mood isn’t answering"; ui.artist.textContent = "Try another one, or get the app"; }
}

function tune(i, autoplay) {
  moodIndex = i; stationIndex = 0;
  showMood();
  if (autoplay) { ensureContext(); start(); }
}

function togglePlay() {
  if (playing) { playing = false; stopAudio(); setState("idle"); clearInterval(metaTimer); return; }
  if (listened >= limit) { openSheet("ended"); return; }
  ensureContext();
  start();
}

async function refreshMeta() {
  clearInterval(metaTimer);
  const update = async () => {
    const st = MOODS[moodIndex].st[stationIndex];
    const np = await nowPlaying(st);
    if (!playing) return;
    if (np && np.title) {
      ui.title.textContent = np.title;
      ui.artist.textContent = np.artist || st.by;
      const cover = np.cover || st.logo;
      if (cover && ui.cover.src !== cover) ui.cover.src = cover;
    } else {
      ui.title.textContent = st.n;
      ui.artist.textContent = `Live · ${st.by}`;
    }
  };
  await update();
  metaTimer = setInterval(update, 20000);
}

ui.cover.addEventListener("error", () => { ui.cover.src = "assets/icon.png"; });
ui.play.addEventListener("click", togglePlay);
ui.next.addEventListener("click", () => {
  const m = MOODS[moodIndex];
  stationIndex = (stationIndex + 1) % m.st.length;
  showMood();
  if (playing || ui.tuner.classList.contains("loading")) { ensureContext(); start(); }
});
ui.vol.addEventListener("input", () => { if (audio) audio.volume = +ui.vol.value; });
$$("[data-play]").forEach((b) => b.addEventListener("click", () => {
  if (matchMedia("(max-width: 980px)").matches) ui.tuner.scrollIntoView({ behavior: "smooth", block: "center" });
  if (!playing) togglePlay();
}));

// The web taste: a nudge, then a gentle ending.
setInterval(() => {
  if (!playing) return;
  listened++;
  if (!nudged && listened >= NUDGE_AT) { nudged = true; openSheet("nudge"); }
  if (listened >= limit) fadeOutAndEnd();
}, 1000);

function fadeOutAndEnd() {
  if (!audio) return;
  const a = audio;
  playing = false;
  const step = () => {
    a.volume = Math.max(0, a.volume - 0.04);
    if (a.volume > 0.01) setTimeout(step, 80);
    else { stopAudio(); setState("idle"); clearInterval(metaTimer); openSheet("ended"); }
  };
  step();
}

// ---------- Visualizer ----------
const vctx = ui.viz.getContext("2d");
let fake = new Array(48).fill(0);
function sizeCanvas(c) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  return dpr;
}
function drawViz(t) {
  const dpr = sizeCanvas(ui.viz);
  const W = ui.viz.width, H = ui.viz.height;
  vctx.clearRect(0, 0, W, H);
  const bars = 48, gap = 3 * dpr, bw = (W - gap * (bars - 1)) / bars;
  const hue = +getComputedStyle(root).getPropertyValue("--h") || 300;
  let vals;
  if (analyser && playing) {
    analyser.getByteFrequencyData(freq);
    vals = Array.from({ length: bars }, (_, i) => {
      const lo = Math.floor(Math.pow(i / bars, 1.6) * (freq.length - 2)), hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / bars, 1.6) * (freq.length - 2)));
      let s = 0; for (let k = lo; k < hi; k++) s += freq[k];
      return s / (hi - lo) / 255;
    });
  } else {
    fake = fake.map((v, i) => {
      const target = playing ? 0.25 + 0.55 * Math.abs(Math.sin(t / 380 + i * 0.55) * Math.sin(t / 910 + i * 0.13)) + Math.random() * 0.12 : 0.04 + 0.03 * Math.sin(t / 900 + i * 0.4);
      return v + (target - v) * 0.18;
    });
    vals = fake;
  }
  vals.forEach((v, i) => {
    const h = Math.max(3 * dpr, v * H * 0.95);
    const x = i * (bw + gap), y = (H - h) / 2;
    vctx.fillStyle = `hsla(${hue + i * 1.6}, 90%, ${60 + v * 18}%, ${0.45 + v * 0.55})`;
    vctx.beginPath();
    if (vctx.roundRect) vctx.roundRect(x, y, bw, h, bw / 2); else vctx.rect(x, y, bw, h);
    vctx.fill();
  });
}

// ---------- Break demo ----------
const demo = {
  A: { el: $("#stripA"), c: $("#waveA"), s: $("#stateA"), mode: "music", hist: [] },
  B: { el: $("#stripB"), c: $("#waveB"), s: $("#stateB"), mode: "idle", hist: [] },
  caption: $("#breakCaption"), btn: $("#breakDemo"), steps: $$("#timeline li"), running: false, timers: [], visible: false, autoplayed: false,
};
function sample(mode, t) {
  if (mode === "music") return 0.35 + 0.5 * Math.abs(Math.sin(t / 140)) * (0.6 + Math.random() * 0.4);
  if (mode === "speech") { const burst = Math.sin(t / 260) > -0.2 ? 1 : 0; return burst * (0.12 + Math.random() * 0.45) * (Math.random() > 0.25 ? 1 : 0.1); }
  return 0.03 + Math.random() * 0.02;
}
function drawWave(ch, t) {
  const dpr = sizeCanvas(ch.c);
  const g = ch.c.getContext("2d"), W = ch.c.width, H = ch.c.height;
  const n = Math.floor(W / (4 * dpr));
  ch.hist.push(sample(ch.mode, t));
  while (ch.hist.length > n) ch.hist.shift();
  g.clearRect(0, 0, W, H);
  const hue = +getComputedStyle(root).getPropertyValue("--h") || 300;
  ch.hist.forEach((v, i) => {
    const h = Math.max(2 * dpr, v * H * 0.9), x = W - (ch.hist.length - i) * 4 * dpr;
    g.fillStyle = ch.mode === "speech" ? `rgba(255,255,255,${0.25 + v})` : `hsla(${hue}, 90%, 66%, ${0.35 + v * 0.65})`;
    g.fillRect(x, (H - h) / 2, 2 * dpr, h);
  });
}
function demoState(a, b, onA, caption, step) {
  demo.A.mode = a.mode; demo.A.s.textContent = a.label;
  demo.B.mode = b.mode; demo.B.s.textContent = b.label;
  demo.A.el.classList.toggle("on", onA); demo.A.el.classList.toggle("dim", !onA);
  demo.B.el.classList.toggle("on", !onA && b.mode !== "idle"); demo.B.el.classList.toggle("dim", onA);
  demo.caption.textContent = caption;
  demo.steps.forEach((li, i) => li.classList.toggle("done", i <= step));
}
function runDemo() {
  demo.timers.forEach(clearTimeout); demo.timers = [];
  demo.running = true; demo.btn.disabled = true;
  const at = (s, f) => demo.timers.push(setTimeout(f, s * 1000));
  demoState({ mode: "music", label: "A song" }, { mode: "idle", label: "Standing by" }, true, "You’re listening to your station.", 0);
  at(2.5, () => demoState({ mode: "speech", label: "Ad break" }, { mode: "idle", label: "Standing by" }, true, "Your station goes to a break…", 1));
  at(4.6, () => demoState({ mode: "speech", label: "Still in its break" }, { mode: "music", label: "Playing a song" }, false, "…so Faders changes the channel to one of your stations playing a song.", 2));
  at(9.2, () => demoState({ mode: "music", label: "Music’s back" }, { mode: "music", label: "Playing a song" }, false, "Faders keeps listening. Your station’s music is back…", 3));
  at(10.8, () => demoState({ mode: "music", label: "A song" }, { mode: "idle", label: "Standing by" }, true, "…and you’re home. You missed the break, not the music.", 4));
  at(12.5, () => { demo.running = false; demo.btn.disabled = false; demo.btn.textContent = "↻ Play it again"; });
}
demo.btn.addEventListener("click", runDemo);
demoState({ mode: "music", label: "A song" }, { mode: "idle", label: "Standing by" }, true, "You’re listening to your station.", 0);
new IntersectionObserver(([e]) => {
  demo.visible = e.isIntersecting;
  if (e.isIntersecting && !demo.autoplayed && !reduceMotion) { demo.autoplayed = true; setTimeout(runDemo, 600); }
}, { threshold: 0.45 }).observe($(".breaks"));

// ---------- Animation loop (only what's on screen) ----------
let tunerVisible = true;
new IntersectionObserver(([e]) => (tunerVisible = e.isIntersecting)).observe(ui.tuner);
function frame(t) {
  if (tunerVisible) drawViz(t);
  if (demo.visible) { drawWave(demo.A, t); drawWave(demo.B, t); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- Live songs ticker ----------
const tickerEl = $("#ticker");
const TICKER = [
  { st: MOODS[0].st[0], mood: "Focus" }, { st: MOODS[3].st[0], mood: "Jazz Café" }, { st: MOODS[5].st[0], mood: "Retro" },
  { st: MOODS[1].st[1], mood: "Chill" }, { st: MOODS[2].st[0], mood: "Sleep" }, { st: MOODS[4].st[2], mood: "Energy" },
];
const tickerSeen = new Map();
async function refreshTicker() {
  const rows = await Promise.all(TICKER.map(async (x) => ({ x, np: await nowPlaying(x.st) })));
  rows.filter((r) => r.np && r.np.title).forEach(({ x, np }) => {
    const key = x.st.n;
    const sig = `${np.title}|${np.artist}`;
    if (tickerSeen.get(key) === sig) return;
    tickerSeen.set(key, sig);
    let li = tickerEl.querySelector(`[data-k="${CSS.escape(key)}"]`);
    if (li) li.remove();
    li = document.createElement("li"); li.dataset.k = key;
    const img = document.createElement("img"); img.alt = ""; img.loading = "lazy";
    img.src = np.cover || x.st.logo || "assets/icon.png"; img.onerror = () => { img.src = "assets/icon.png"; };
    const t = document.createElement("div"); t.className = "t";
    const b = document.createElement("b"); b.textContent = np.title;
    const s = document.createElement("span"); s.textContent = `${np.artist || ""}${np.artist ? " · " : ""}${x.mood}`;
    t.append(b, s); li.append(img, t);
    tickerEl.prepend(li);
  });
  while (tickerEl.children.length > 6) tickerEl.lastElementChild.remove();
}
let tickerTimer = 0;
new IntersectionObserver(([e]) => {
  clearInterval(tickerTimer);
  if (e.isIntersecting) { refreshTicker(); tickerTimer = setInterval(refreshTicker, 30000); }
}).observe($(".ticker"));

// ---------- World: stations from the visitor's country ----------
const MIRRORS = ["de1", "de2"];
async function directory(path) {
  for (const m of MIRRORS) { try { return await getJSON(`https://${m}.api.radio-browser.info${path}`, 8000); } catch { /* next */ } }
  return null;
}
const regionNames = (() => { try { return new Intl.DisplayNames(["en"], { type: "region" }); } catch { return null; } })();
const flag = (cc) => cc.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
function visitorCountry() {
  for (const l of navigator.languages || [navigator.language]) { const m = /-([A-Z]{2})$/i.exec(l || ""); if (m) return m[1].toUpperCase(); }
  return "US";
}
const countries = [...new Set([visitorCountry(), "IE", "GB", "US", "IN", "DE", "FR", "ES", "BR", "JP", "AU", "NG"])].slice(0, 11);
const chipsEl = $("#countries"), stationsEl = $("#stations");
countries.forEach((cc, i) => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "chip"; b.setAttribute("aria-pressed", i === 0);
  b.textContent = `${flag(cc)} ${regionNames?.of(cc) || cc}`;
  b.addEventListener("click", () => { $$(".chip", chipsEl).forEach((c) => c.setAttribute("aria-pressed", c === b)); loadCountry(cc); });
  chipsEl.appendChild(b);
});
const initials = (n) => n.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "FM";
async function loadCountry(cc) {
  stationsEl.innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton"></div>').join("");
  const list = await directory(`/json/stations/search?countrycode=${cc}&order=clickcount&reverse=true&limit=60&hidebroken=true`);
  stationsEl.innerHTML = "";
  if (!list) { stationsEl.innerHTML = '<p class="fine">The station directory isn’t answering right now. Faders has them all in the app.</p>'; return; }
  const seen = new Set();
  // We never name one broadcaster in our marketing; its stations are still in the app.
  const picks = list.filter((s) => !/\bbbc\b/i.test(s.name) && !seen.has(s.name.trim().toLowerCase()) && seen.add(s.name.trim().toLowerCase())).slice(0, 18);
  picks.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "st"; b.style.animationDelay = `${i * 35}ms`;
    let logo;
    if (s.favicon && s.favicon.startsWith("https://")) {
      logo = document.createElement("img"); logo.className = "logo"; logo.alt = ""; logo.loading = "lazy"; logo.referrerPolicy = "no-referrer"; logo.src = s.favicon;
      logo.onerror = () => logo.replaceWith(placeholder(s.name, i));
    } else logo = placeholder(s.name, i);
    const name = document.createElement("b"); name.textContent = s.name.trim();
    const tags = document.createElement("span"); tags.textContent = (s.tags || "").split(",").filter(Boolean).slice(0, 2).join(" · ") || s.country || "";
    const go = document.createElement("span"); go.className = "go"; go.textContent = "▶ Listen in Faders";
    b.append(logo, name, tags, go);
    b.addEventListener("click", () => openSheet("station", s.name.trim()));
    stationsEl.appendChild(b);
  });
}
function placeholder(name, i) {
  const d = document.createElement("div"); d.className = "logo ph"; d.style.setProperty("--sh", (i * 47) % 360); d.textContent = initials(name); return d;
}
let worldLoaded = false;
new IntersectionObserver(([e]) => {
  if (!e.isIntersecting || worldLoaded) return;
  worldLoaded = true;
  loadCountry(countries[0]);
  directory("/json/stats").then((s) => { if (s?.stations) $("#stationCount").textContent = `${Math.floor(s.stations / 1000) * 1000}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "+"; });
}, { rootMargin: "300px" }).observe($("#world"));

// ---------- Download sheet ----------
const sheet = $("#sheet"), sheetMore = $("#sheetMore");
let lastFocus = null;
function openSheet(kind, name) {
  const T = {
    nudge: ["Enjoying it?", "That’s Faders Moods. In the app it keeps going with your phone locked, names every song, and has tens of thousands more stations."],
    ended: ["Keep listening in Faders", "The web player is a taste. The app is the real thing, and it’s free."],
    station: [`Listen to ${name} in Faders`, `${name} and tens of thousands more stations play in the app, with every song named.`],
  }[kind];
  $("#sheetTitle").textContent = T[0];
  $("#sheetText").textContent = T[1];
  sheetMore.hidden = !(kind === "ended" && !extended);
  lastFocus = document.activeElement;
  sheet.hidden = false;
  $(".sheet-card .btn", sheet).focus();
}
function closeSheet() { sheet.hidden = true; lastFocus?.focus?.(); }
sheet.addEventListener("click", (e) => { if (e.target === sheet || e.target.closest("[data-close]")) closeSheet(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });
sheetMore.addEventListener("click", () => { extended = true; limit = listened + EXTRA; closeSheet(); ensureContext(); start(); });

// ---------- Page chrome ----------
const nav = $("#nav");
const sticky = $(".sticky-cta");
const onScroll = () => {
  nav.classList.toggle("scrolled", scrollY > 8);
  sticky.classList.toggle("show", scrollY > innerHeight * 0.6);
};
onScroll();
addEventListener("scroll", onScroll, { passive: true });

const revealer = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); revealer.unobserve(e.target); } }),
  { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
$$(".reveal").forEach((el) => revealer.observe(el));

const film = $(".film video");
new IntersectionObserver(([e]) => { if (e.isIntersecting && !reduceMotion) film.play().catch(() => {}); else film.pause(); }, { threshold: 0.3 }).observe(film);

if (new Date() >= PLUS_PRICE_RISES) { $("#plusPrice").textContent = "€9.99"; $("#plusNote").textContent = "One payment. No subscription."; }

buildDial();
