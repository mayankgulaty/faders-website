// Faders website. The page is a radio: drag the dial, hear static between stations, lock onto a mood.
// Also: a now-playing marquee and log, the break timeline, a departures board of real stations,
// feature previews that follow the cursor, a mini player while you scroll, and a gentle end to
// the web taste. No analytics, no cookies, nothing stored.
"use strict";

const NUDGE_AT = 4 * 60;
const FADE_AT = 12 * 60;
const EXTRA = 5 * 60;
const PLUS_PRICE_RISES = new Date("2026-12-01T00:00:00Z");
const FMIN = 87.5, FMAX = 108;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// ---------- Stations ----------
// Every mood leads with a stream that plays in any browser; SomaFM is a backup (some networks get a 403).
const soma = (ch, n) => ({ n, u: `https://ice5.somafm.com/${ch}-128-mp3`, meta: ["soma", ch], logo: `https://somafm.com/logos/256/${ch}256.png`, by: "SomaFM" });
const rp = (mount, n) => ({ n, u: `https://stream.radioparadise.com/${mount}`, meta: null, by: "Radio Paradise" });
const laut = (st, n) => ({ n, u: `https://stream.laut.fm/${st}`, meta: ["laut", st], by: "laut.fm" });
// Mood colours stay in the brand range (violet, magenta, pink, amber): only the dial's glow uses them.
const MOODS = [
  { name: "Focus", f: 88.9, h: 265, st: [
    { n: "ISEKOI Chill Zone", u: "https://public.isekoi-radio.com/listen/chill/radio.mp3", meta: ["azura", "https://public.isekoi-radio.com/api/nowplaying/chill"], by: "ISEKOI Radio" },
    soma("fluid", "Fluid"), soma("vaporwaves", "Vaporwaves")] },
  { name: "Chill", f: 91.7, h: 292, st: [rp("mellow-128", "Radio Paradise Mellow"), soma("groovesalad", "Groove Salad"), soma("lush", "Lush")] },
  { name: "Sleep", f: 94.5, h: 246, st: [
    { n: "Ambient Sleeping Pill", u: "https://radio.stereoscenic.com/asp-h", meta: ["ice", "https://radio.stereoscenic.com/status-json.xsl"], by: "Ambient Sleeping Pill" },
    soma("dronezone", "Drone Zone"), soma("deepspaceone", "Deep Space One")] },
  { name: "Jazz Café", f: 98.3, h: 22, st: [laut("jazz", "Jazz"), soma("sonicuniverse", "Sonic Universe"), soma("secretagent", "Secret Agent")] },
  { name: "Energy", f: 102.1, h: 340, st: [rp("rock-128", "Radio Paradise Rock"), rp("mp3-128", "Radio Paradise"), soma("indiepop", "Indie Pop Rocks")] },
  { name: "Retro", f: 105.7, h: 314, st: [laut("80er", "80er"), soma("u80s", "Underground 80s"), soma("spacestation", "Space Station")] },
];
function moodForNow() {
  const h = new Date().getHours();
  if (h >= 5 && h < 10) return 4;
  if (h >= 10 && h < 17) return 0;
  if (h >= 17 && h < 21) return 1;
  if (h >= 21 && h < 23) return 3;
  return 2;
}

// ---------- Song data ----------
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
    if (kind === "soma") { const s = (await getJSON(`https://somafm.com/songs/${arg}.json`)).songs?.[0]; return s ? { title: s.title, artist: s.artist, cover: s.albumArt || st.logo } : null; }
    if (kind === "laut") { const s = await getJSON(`https://api.laut.fm/station/${arg}/current_song`); return s?.title ? { title: s.title, artist: s.artist?.name } : null; }
    if (kind === "azura") { const s = (await getJSON(arg)).now_playing?.song; return s ? { title: s.title, artist: s.artist, cover: s.art } : null; }
    if (kind === "ice") {
      let src = (await getJSON(arg)).icestats?.source;
      src = Array.isArray(src) ? (src.find((x) => /asp-h/.test(x.listenurl || "")) || src[0]) : src;
      const t = src?.title || "", i = t.indexOf(" - ");
      return t ? (i > 0 ? { artist: t.slice(0, i), title: t.slice(i + 3) } : { title: t }) : null;
    }
  } catch { /* song data is a nicety */ }
  return null;
}

// ---------- Elements ----------
const ui = {
  radio: $("#radio"), band: $("#band"), scale: $("#scale"), freq: $("#freq"), station: $("#station"), title: $("#title"), artist: $("#artist"),
  play: $("#play"), prev: $("#prev"), next: $("#nextMood"), another: $("#another"), scope: $("#scope"),
  onair: $("#onair"), mini: $("#mini"), miniPlay: $("#miniPlay"), miniStation: $("#miniStation"), miniTitle: $("#miniTitle"), sticky: $("#sticky"),
};

// ---------- Audio ----------
let ctx = null, analyser = null, timeData = null, staticGain = null;
let everPlayed = false;
let audio = null, session = false, playing = false, playingMood = -1, stationIndex = 0;
let metaTimer = 0, stallTimer = 0;
let listened = 0, limit = FADE_AT, extended = false, nudged = false;
const volume = 0.85;

function ensureContext() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  // Static between stations: filtered noise, like the gaps on a real dial.
  const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const band = ctx.createBiquadFilter(); band.type = "bandpass"; band.frequency.value = 2400; band.Q.value = 0.6;
  staticGain = ctx.createGain(); staticGain.gain.value = 0;
  src.connect(band).connect(staticGain).connect(ctx.destination); src.start();
}
function setStatic(v) { if (staticGain && ctx) staticGain.gain.setTargetAtTime(v, ctx.currentTime, 0.04); }

function stopAudio() {
  clearTimeout(stallTimer);
  if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); audio = null; }
  analyser = null;
}
function setState(s) {
  ui.radio.classList.toggle("playing", s === "playing");
  ui.radio.classList.toggle("loading", s === "loading");
  ui.mini.classList.toggle("playing", s === "playing");
  ui.play.setAttribute("aria-label", s === "playing" ? "Pause" : "Play");
  ui.miniPlay.setAttribute("aria-label", s === "playing" ? "Pause" : "Play");
  ui.onair.classList.toggle("on", s === "playing");
  ui.onair.querySelector("span").textContent = s === "playing" ? `On air · ${MOODS[playingMood]?.name || ""}` : "Off air";
}

function start(mood, withCors = !isIOS) {
  stopAudio();
  playingMood = mood;
  const st = MOODS[mood].st[stationIndex];
  const a = new Audio();
  if (withCors) a.crossOrigin = "anonymous";
  a.preload = "none"; a.volume = volume; a.src = st.u;
  audio = a;
  setState("loading");
  ui.title.textContent = "Tuning in…";
  ui.artist.textContent = st.by;
  updateMini();
  setStatic(0.05);
  a.addEventListener("playing", () => {
    if (audio !== a) return;
    clearTimeout(stallTimer);
    playing = true; setState("playing"); setStatic(0);
    if (withCors && ctx && !isIOS && !analyser) {
      try {
        const src = ctx.createMediaElementSource(a);
        analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
        timeData = new Uint8Array(analyser.fftSize);
        src.connect(analyser).connect(ctx.destination);
      } catch { analyser = null; }
    }
    refreshMeta();
  });
  a.addEventListener("error", () => { if (audio !== a) return; if (withCors) return start(mood, false); failover(); });
  stallTimer = setTimeout(() => { if (audio === a && !playing) failover(); }, 12000);
  a.play().catch(() => { if (audio === a) failover(); });
}
function failover() {
  const m = MOODS[playingMood];
  if (stationIndex < m.st.length - 1) { stationIndex++; start(playingMood); return; }
  playing = false; setState("idle"); setStatic(0);
  ui.title.textContent = "This one isn’t answering.";
  ui.artist.textContent = "Turn the dial, or get the app for tens of thousands more.";
}
function pauseSession() { session = false; playing = false; stopAudio(); setStatic(0); setState("idle"); clearInterval(metaTimer); onScroll(); }
function togglePlay() {
  if (session) return pauseSession();
  if (listened >= limit) return openSheet("ended");
  ensureContext();
  session = true; everPlayed = true;
  stationIndex = 0;
  start(nearest().i);
  onScroll();
}

async function refreshMeta() {
  clearInterval(metaTimer);
  const update = async () => {
    const st = MOODS[playingMood].st[stationIndex];
    const np = await nowPlaying(st);
    if (!playing) return;
    ui.title.textContent = np?.title || st.n;
    ui.artist.textContent = np?.title ? `${np.artist || ""}${np.artist ? " · " : ""}${st.n}` : `Live from ${st.by}`;
    updateMini();
  };
  await update();
  metaTimer = setInterval(update, 20000);
}
function updateMini() {
  const m = MOODS[playingMood];
  if (!m) return;
  ui.miniStation.textContent = `${m.f.toFixed(1)} · ${m.name}`;
  ui.miniTitle.textContent = ui.title.textContent === "Tuning in…" ? "Tuning in…" : `${ui.title.textContent}${ui.artist.textContent ? " — " + ui.artist.textContent.split(" · ")[0] : ""}`;
}

// ---------- The dial ----------
let freq = MOODS[moodForNow()].f;
let pxPerMHz = 90;
let snapAnim = 0;
function buildScale() {
  pxPerMHz = innerWidth < 640 ? 62 : 92;
  const w = (FMAX - FMIN) * pxPerMHz;
  ui.scale.innerHTML = "";
  ui.scale.style.width = `${w}px`;
  const ticks = document.createElement("div"); ticks.className = "ticks";
  ticks.style.setProperty("--tick", `${pxPerMHz / 10 * 2}px`);
  ticks.style.backgroundPosition = `${(88 - FMIN) * pxPerMHz}px 0, ${(88 - FMIN) * pxPerMHz}px 0`;
  ui.scale.appendChild(ticks);
  for (let f = 88; f <= 108; f += 2) {
    const n = document.createElement("span"); n.className = "num"; n.textContent = f;
    n.style.left = `${(f - FMIN) * pxPerMHz}px`; ui.scale.appendChild(n);
  }
  MOODS.forEach((m, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "mark"; b.textContent = m.name; b.tabIndex = -1;
    b.style.left = `${(m.f - FMIN) * pxPerMHz}px`;
    b.addEventListener("click", (e) => { e.stopPropagation(); glideTo(m.f); });
    ui.scale.appendChild(b);
  });
  render();
}
function nearest(f = freq) {
  let best = 0;
  MOODS.forEach((m, i) => { if (Math.abs(m.f - f) < Math.abs(MOODS[best].f - f)) best = i; });
  return { i: best, d: Math.abs(MOODS[best].f - f) };
}
function render() {
  const x = ui.band.clientWidth / 2 - (freq - FMIN) * pxPerMHz;
  ui.scale.style.transform = `translate3d(${x}px, 0, 0)`;
  ui.freq.textContent = freq.toFixed(1);
  const { i, d } = nearest();
  const locked = d < 0.12;
  ui.radio.classList.toggle("searching", !locked);
  $$(".mark", ui.scale).forEach((b, k) => b.classList.toggle("on", locked && k === i));
  ui.radio.style.setProperty("--h", MOODS[i].h);
  ui.band.setAttribute("aria-valuenow", freq.toFixed(1));
  ui.band.setAttribute("aria-valuetext", locked ? `${MOODS[i].name}, ${freq.toFixed(1)} megahertz` : `${freq.toFixed(1)} megahertz, between stations`);
  if (!session) {
    ui.station.textContent = locked ? `${MOODS[i].name} · ${MOODS[i].st[0].n}` : "Between stations";
    return;
  }
  // While turning: static grows between stations; the station playing fades as you leave it.
  setStatic(locked ? 0 : clamp(d / 0.7, 0.15, 1) * 0.16);
  if (audio) audio.volume = i === playingMood ? volume * (1 - clamp((d - 0.12) / 0.5, 0, 1)) : 0;
  ui.station.textContent = locked ? `${MOODS[i].name} · ${MOODS[i].st[stationIndex]?.n || ""}` : "Searching…";
}
function glideTo(target, then) {
  cancelAnimationFrame(snapAnim);
  const from = freq, t0 = performance.now(), dur = reduceMotion ? 1 : clamp(Math.abs(target - from) * 90, 260, 900);
  const step = (t) => {
    const k = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
    freq = from + (target - from) * e; render();
    if (k < 1) snapAnim = requestAnimationFrame(step); else { freq = target; render(); landed(); then?.(); }
  };
  snapAnim = requestAnimationFrame(step);
}
function landed() {
  const { i } = nearest();
  if (session && i !== playingMood) { stationIndex = 0; start(i); }
  else if (session && audio) audio.volume = volume;
}
function snap() { glideTo(MOODS[nearest().i].f); }

let drag = null;
ui.band.addEventListener("pointerdown", (e) => {
  if (e.target.classList.contains("mark")) return;
  cancelAnimationFrame(snapAnim);
  drag = { x: e.clientX, f: freq, id: e.pointerId, moved: false };
  ui.band.setPointerCapture(e.pointerId);
});
ui.band.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  if (Math.abs(dx) > 3) drag.moved = true;
  freq = clamp(drag.f - dx / pxPerMHz, FMIN, FMAX); render();
});
const endDrag = () => { if (!drag) return; drag = null; snap(); };
ui.band.addEventListener("pointerup", endDrag);
ui.band.addEventListener("pointercancel", endDrag);
let wheelTimer = 0;
ui.band.addEventListener("wheel", (e) => {
  const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
  if (!dx) return;
  e.preventDefault(); cancelAnimationFrame(snapAnim);
  freq = clamp(freq + dx / pxPerMHz, FMIN, FMAX); render();
  clearTimeout(wheelTimer); wheelTimer = setTimeout(snap, 160);
}, { passive: false });
const stepMood = (dir) => { const i = (nearest().i + dir + MOODS.length) % MOODS.length; glideTo(MOODS[i].f); };
ui.band.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); stepMood(e.key === "ArrowRight" ? 1 : -1); }
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); togglePlay(); }
});
ui.prev.addEventListener("click", () => stepMood(-1));
ui.next.addEventListener("click", () => stepMood(1));
ui.play.addEventListener("click", togglePlay);
ui.miniPlay.addEventListener("click", togglePlay);
ui.another.addEventListener("click", () => {
  const i = nearest().i;
  if (!session) { ensureContext(); session = true; everPlayed = true; onScroll(); }
  stationIndex = playingMood === i ? (stationIndex + 1) % MOODS[i].st.length : 0;
  start(i);
});
addEventListener("resize", () => { clearTimeout(buildScale.t); buildScale.t = setTimeout(buildScale, 120); });

// The web taste: a nudge, then a gentle ending.
setInterval(() => {
  if (!playing) return;
  listened++;
  if (!nudged && listened >= NUDGE_AT) { nudged = true; openSheet("nudge"); }
  if (listened >= limit) fadeOutAndEnd();
}, 1000);
function fadeOutAndEnd() {
  if (!audio) return;
  const a = audio; playing = false;
  const step = () => { a.volume = Math.max(0, a.volume - 0.04); if (a.volume > 0.01) setTimeout(step, 80); else { pauseSession(); openSheet("ended"); } };
  step();
}

// ---------- Oscilloscope ----------
const sctx = ui.scope.getContext("2d");
function sizeCanvas(c) {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return dpr;
}
let level = 0;
function drawScope(t) {
  const dpr = sizeCanvas(ui.scope), W = ui.scope.width, H = ui.scope.height;
  sctx.clearRect(0, 0, W, H);
  const searching = session && nearest().d >= 0.12;
  level += ((playing ? 1 : searching ? 0.5 : 0.08) - level) * 0.06;
  sctx.lineWidth = 1.5 * dpr;
  sctx.strokeStyle = "rgba(242,236,227,0.85)";
  sctx.beginPath();
  const n = 220;
  for (let k = 0; k <= n; k++) {
    const x = (k / n) * W;
    let v;
    if (analyser && playing && !searching) {
      analyser.getByteTimeDomainData(timeData);
      v = (timeData[Math.floor((k / n) * (timeData.length - 1))] - 128) / 128 * 1.6;
    } else if (searching) {
      v = (Math.random() * 2 - 1) * 0.35;
    } else {
      v = (Math.sin(k * 0.21 + t / 260) * 0.35 + Math.sin(k * 0.047 - t / 700) * 0.4 + Math.sin(k * 0.6 + t / 90) * 0.08) * level;
    }
    const edge = Math.sin((k / n) * Math.PI);
    const y = H / 2 + v * edge * H * 0.42;
    k ? sctx.lineTo(x, y) : sctx.moveTo(x, y);
  }
  sctx.stroke();
}

// ---------- Break timeline ----------
const tl = { el: $("#timeline"), head: $("#playhead"), route: $("#route"), caption: $("#caption"), lanes: $$(".lane"), visible: false, t0: 0, len: 0 };
const STORY = [
  [0, "Your station is playing a song.", "a"],
  [0.3, "The ads start. Faders hears them…", "a"],
  [0.35, "…and changes to a favourite that’s playing a song.", "b"],
  [0.74, "Your station’s music is back…", "b"],
  [0.765, "…so Faders takes you home. You missed the break, not the music.", "a"],
];
const DUR = 11000, PAUSE = 2200;
function drawTimeline(now) {
  if (!tl.len) { tl.len = tl.route.getTotalLength(); tl.route.style.strokeDasharray = tl.len; }
  const cycle = (now - tl.t0) % (DUR + PAUSE);
  const p = clamp(cycle / DUR, 0, 1);
  const body = tl.lanes[0].querySelector(".lane-body");
  const offset = body.offsetLeft;
  tl.head.style.left = `${offset + p * body.clientWidth}px`;
  tl.route.style.strokeDashoffset = tl.len * (1 - p);
  let s = STORY[0];
  for (const row of STORY) if (p >= row[0]) s = row;
  if (tl.caption.textContent !== s[1]) tl.caption.textContent = s[1];
  tl.lanes.forEach((l) => l.classList.toggle("live", l.dataset.lane === s[2]));
}
new IntersectionObserver(([e]) => { if (e.isIntersecting && !tl.visible) tl.t0 = performance.now(); tl.visible = e.isIntersecting; }, { threshold: 0.4 }).observe(tl.el);
if (reduceMotion) { tl.route.style.strokeDasharray = "none"; tl.head.style.display = "none"; tl.caption.textContent = STORY[4][1]; }

// ---------- One animation loop, only for what's on screen ----------
let radioVisible = true;
new IntersectionObserver(([e]) => (radioVisible = e.isIntersecting)).observe(ui.radio);
function frame(t) {
  if (radioVisible) drawScope(t);
  if (tl.visible && !reduceMotion) drawTimeline(t);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- Marquee and the "named just now" log ----------
const marquee = $("#marquee"), logEl = $("#log");
const heard = new Map();
async function refreshSongs() {
  const rows = await Promise.all(MOODS.map(async (m) => {
    const st = m.st.find((s) => s.meta) || m.st[0];
    return { m, st, np: await nowPlaying(st) };
  }));
  const items = rows.filter((r) => r.np?.title);
  if (!items.length) return;
  const html = items.map((r) => `<span><b>${esc(r.np.title)}</b> — ${esc(r.np.artist || r.st.n)} · ${esc(r.m.name)}</span>`).join("");
  marquee.innerHTML = html + html;
  marquee.style.setProperty("--dur", `${Math.max(30, items.length * 9)}s`);
  items.forEach((r) => {
    const key = `${r.np.title}|${r.np.artist}`;
    if (heard.has(key)) return;
    heard.set(key, true);
    const li = document.createElement("li");
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    li.innerHTML = `<span class="mono">${time}</span><b>${esc(r.np.title)} <span>— ${esc(r.np.artist || "")}</span></b><span class="mono">${esc(r.m.name)}</span>`;
    logEl.prepend(li);
  });
  while (logEl.children.length > 5) logEl.lastElementChild.remove();
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
refreshSongs();
setInterval(() => { if (!document.hidden) refreshSongs(); }, 30000);

// ---------- World: a departures board ----------
const MIRRORS = ["de1", "de2"];
async function directory(path) {
  for (const m of MIRRORS) { try { return await getJSON(`https://${m}.api.radio-browser.info${path}`, 8000); } catch { /* next mirror */ } }
  return null;
}
const regionNames = (() => { try { return new Intl.DisplayNames(["en"], { type: "region" }); } catch { return null; } })();
function visitorCountry() {
  for (const l of navigator.languages || [navigator.language]) { const m = /-([A-Z]{2})$/i.exec(l || ""); if (m) return m[1].toUpperCase(); }
  return "US";
}
const countries = [...new Set([visitorCountry(), "IE", "GB", "US", "IN", "DE", "FR", "ES", "BR", "JP", "AU", "NG"])].slice(0, 11);
const tabs = $("#countries"), board = $("#board");
countries.forEach((cc, i) => {
  const b = document.createElement("button");
  b.type = "button"; b.setAttribute("aria-pressed", i === 0); b.textContent = regionNames?.of(cc) || cc;
  b.addEventListener("click", () => { $$("button", tabs).forEach((x) => x.setAttribute("aria-pressed", x === b)); loadCountry(cc); });
  tabs.appendChild(b);
});
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function flap(el, text, delay) {
  // Split-flap: letters shuffle, then settle left to right.
  if (reduceMotion) { el.textContent = text; return; }
  const t0 = performance.now() + delay, dur = 520;
  const tick = (t) => {
    const k = clamp((t - t0) / dur, 0, 1), fixed = Math.floor(k * text.length);
    el.textContent = text.slice(0, fixed) + [...text.slice(fixed)].map((c) => (c === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
    if (k < 1) requestAnimationFrame(tick); else el.textContent = text;
  };
  requestAnimationFrame(tick);
}
const initials = (n) => n.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "FM";
async function loadCountry(cc) {
  board.innerHTML = '<div class="row skel"></div>'.repeat(8);
  const list = await directory(`/json/stations/search?countrycode=${cc}&order=clickcount&reverse=true&limit=60&hidebroken=true`);
  board.innerHTML = "";
  if (!list) { board.innerHTML = '<p class="note mono small">The station directory isn’t answering right now. They’re all in the app.</p>'; return; }
  const seen = new Set();
  // Marketing never names one broadcaster; its stations are still in the app.
  const picks = list.filter((s) => { const k = s.name.trim().toLowerCase(); return !/\bbbc\b/i.test(s.name) && !seen.has(k) && seen.add(k); }).slice(0, 10);
  picks.forEach((s, i) => {
    const row = document.createElement("button"); row.type = "button"; row.className = "row";
    const n = document.createElement("span"); n.className = "n"; n.textContent = String(i + 1).padStart(2, "0");
    let logo;
    if (s.favicon?.startsWith("https://")) {
      logo = document.createElement("img"); logo.className = "logo"; logo.alt = ""; logo.loading = "lazy"; logo.referrerPolicy = "no-referrer"; logo.src = s.favicon;
      logo.onerror = () => { const p = ph(s.name); logo.replaceWith(p); };
    } else logo = ph(s.name);
    const name = document.createElement("span"); name.className = "s";
    const g = document.createElement("span"); g.className = "g"; g.textContent = (s.tags || "").split(",").filter(Boolean).slice(0, 2).join(" · ") || s.state || s.country || "";
    const go = document.createElement("span"); go.className = "go"; go.textContent = "Listen in Faders →";
    row.append(n, logo, name, g, go);
    row.addEventListener("click", () => openSheet("station", s.name.trim()));
    board.appendChild(row);
    flap(name, s.name.trim(), i * 70);
  });
}
function ph(name) { const d = document.createElement("span"); d.className = "logo ph"; d.textContent = initials(name); return d; }
let worldLoaded = false;
new IntersectionObserver(([e]) => {
  if (!e.isIntersecting || worldLoaded) return;
  worldLoaded = true;
  loadCountry(countries[0]);
  directory("/json/stats").then((s) => { if (s?.stations) $("#count").textContent = `${(Math.floor(s.stations / 1000) * 1000).toLocaleString("en")}+`; });
}, { rootMargin: "400px" }).observe($("#world"));

// ---------- Feature index: screenshots follow the cursor ----------
const peek = $("#peek"), peekImg = peek.querySelector("img");
let px = 0, py = 0, tx = 0, ty = 0, peeking = false;
if (finePointer) {
  $$("#indexList li[data-img]").forEach((li) => {
    li.addEventListener("mouseenter", () => { peekImg.src = li.dataset.img; peek.classList.add("on"); peeking = true; });
    li.addEventListener("mouseleave", () => { peek.classList.remove("on"); peeking = false; });
  });
  addEventListener("mousemove", (e) => { tx = e.clientX + 28; ty = e.clientY - 170; });
  const follow = () => { px += (tx - px) * 0.16; py += (ty - py) * 0.16; if (peeking || peek.classList.contains("on")) peek.style.transform = `translate(${px}px, ${py}px) rotate(${clamp((tx - px) * 0.04, -6, 6)}deg)`; requestAnimationFrame(follow); };
  requestAnimationFrame(follow);
}

// ---------- Download sheet ----------
const sheet = $("#sheet"), sheetMore = $("#sheetMore");
let lastFocus = null;
function openSheet(kind, name) {
  const T = {
    nudge: ["Still listening?", "Good. In the app it keeps going with your phone locked, names every song, and has tens of thousands more stations."],
    ended: ["Keep listening in Faders", "The web player is a taste. The app is the real thing, and it’s free."],
    station: [`${name}, in Faders`, `${name} and tens of thousands more stations play in the app, with every song named.`],
  }[kind];
  $("#sheetTitle").textContent = T[0];
  $("#sheetText").textContent = T[1];
  sheetMore.hidden = !(kind === "ended" && !extended);
  lastFocus = document.activeElement;
  sheet.hidden = false;
  $(".badge", sheet).focus();
}
function closeSheet() { sheet.hidden = true; lastFocus?.focus?.(); }
sheet.addEventListener("click", (e) => { if (e.target === sheet || e.target.closest("[data-close]")) closeSheet(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });
sheetMore.addEventListener("click", () => { extended = true; limit = listened + EXTRA; closeSheet(); ensureContext(); session = true; start(nearest().i); onScroll(); });

// ---------- Page chrome ----------
const nav = $("#nav");
const onScroll = () => {
  nav.classList.toggle("scrolled", scrollY > 10);
  const past = scrollY > innerHeight * 0.75;
  ui.sticky.classList.toggle("show", past && !everPlayed);
  ui.mini.classList.toggle("show", past && everPlayed);
};
onScroll();
addEventListener("scroll", onScroll, { passive: true });

const clock = $("#clock");
const city = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").split("/").pop().replace(/_/g, " ");
const tickClock = () => { clock.textContent = `${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}${city ? " · " + city : ""}`; };
tickClock(); setInterval(tickClock, 15000);

const revealer = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); revealer.unobserve(e.target); } }), { threshold: 0.1 });
$$(".manifesto .big, .chapter-text, .device, .timeline, .index li, .film video, .price, .end > *").forEach((el, i) => { el.classList.add("rv"); el.style.transitionDelay = el.matches(".index li") ? `${(i % 12) * 40}ms` : "0ms"; revealer.observe(el); });

const film = $(".film video");
new IntersectionObserver(([e]) => { if (e.isIntersecting && !reduceMotion) film.play().catch(() => {}); else film.pause(); }, { threshold: 0.3 }).observe(film);

if (new Date() >= PLUS_PRICE_RISES) { $("#plusPrice").textContent = "€9.99"; $("#plusNote").textContent = "One payment. No subscription, shared with your family."; }

buildScale();
