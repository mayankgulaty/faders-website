// Faders website: a retro radio you can play (knob, dial, static between stations), Spin the globe
// (a real station from anywhere, for a minute), songs printing on a receipt, a skin picker, the
// break timeline, tilting cards, a mini player, and a friendly push to the app after every taste.
// No analytics, no cookies, nothing stored.
"use strict";

const NUDGE_AT = 4 * 60, FADE_AT = 12 * 60, EXTRA = 5 * 60;
const GLOBE_PREVIEW = 60;  // seconds a globe station plays before "keep it in Faders"
const PLUS_PRICE_RISES = new Date("2026-12-01T00:00:00Z");
const FMIN = 87.5, FMAX = 108;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- Moods (each leads with a stream any browser can play; SomaFM is a backup) ----------
const soma = (ch, n) => ({ n, u: `https://ice5.somafm.com/${ch}-128-mp3`, meta: ["soma", ch], by: "SomaFM" });
const rp = (mount, n) => ({ n, u: `https://stream.radioparadise.com/${mount}`, meta: null, by: "Radio Paradise" });
const laut = (st, n) => ({ n, u: `https://stream.laut.fm/${st}`, meta: ["laut", st], by: "laut.fm" });
const MOODS = [
  { name: "Focus", f: 88.9, h: 265, st: [{ n: "ISEKOI Chill Zone", u: "https://public.isekoi-radio.com/listen/chill/radio.mp3", meta: ["azura", "https://public.isekoi-radio.com/api/nowplaying/chill"], by: "ISEKOI Radio" }, soma("fluid", "Fluid")] },
  { name: "Chill", f: 91.7, h: 150, st: [rp("mellow-128", "Radio Paradise Mellow"), soma("groovesalad", "Groove Salad")] },
  { name: "Sleep", f: 94.5, h: 230, st: [{ n: "Ambient Sleeping Pill", u: "https://radio.stereoscenic.com/asp-h", meta: ["ice", "https://radio.stereoscenic.com/status-json.xsl"], by: "Ambient Sleeping Pill" }, soma("dronezone", "Drone Zone")] },
  { name: "Jazz Café", f: 98.3, h: 30, st: [laut("jazz", "Jazz"), soma("sonicuniverse", "Sonic Universe")] },
  { name: "Energy", f: 102.1, h: 340, st: [rp("rock-128", "Radio Paradise Rock"), rp("mp3-128", "Radio Paradise")] },
  { name: "Retro", f: 105.7, h: 300, st: [laut("80er", "80er"), soma("u80s", "Underground 80s")] },
];
function moodForNow() {
  const h = new Date().getHours();
  return h >= 5 && h < 10 ? 4 : h < 17 && h >= 10 ? 0 : h >= 17 && h < 21 ? 1 : h >= 21 && h < 23 ? 3 : 2;
}

async function getJSON(url, ms = 7000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, cache: "no-store" }); if (!r.ok) throw 0; return await r.json(); }
  finally { clearTimeout(t); }
}
async function nowPlaying(st) {
  if (!st?.meta) return null;
  const [kind, arg] = st.meta;
  try {
    if (kind === "soma") { const s = (await getJSON(`https://somafm.com/songs/${arg}.json`)).songs?.[0]; return s ? { title: s.title, artist: s.artist } : null; }
    if (kind === "laut") { const s = await getJSON(`https://api.laut.fm/station/${arg}/current_song`); return s?.title ? { title: s.title, artist: s.artist?.name } : null; }
    if (kind === "azura") { const s = (await getJSON(arg)).now_playing?.song; return s ? { title: s.title, artist: s.artist } : null; }
    if (kind === "ice") {
      let src = (await getJSON(arg)).icestats?.source;
      src = Array.isArray(src) ? (src.find((x) => /asp-h/.test(x.listenurl || "")) || src[0]) : src;
      const t = src?.title || "", i = t.indexOf(" - ");
      return t ? (i > 0 ? { artist: t.slice(0, i), title: t.slice(i + 3) } : { title: t }) : null;
    }
  } catch { /* a nicety */ }
  return null;
}

// ---------- Elements ----------
const ui = {
  radio: $("#radio"), band: $("#band"), scale: $("#scale"), freq: $("#freq"), station: $("#station"), title: $("#title"), artist: $("#artist"),
  play: $("#play"), knob: $("#knob"), scope: $("#scope"),
  mini: $("#mini"), miniPlay: $("#miniPlay"), miniStation: $("#miniStation"), miniTitle: $("#miniTitle"), sticky: $("#sticky"),
};

// ---------- Audio core ----------
let ctx = null, analyser = null, timeData = null, staticGain = null;
let audio = null, playing = false, everPlayed = false;
let source = null;   // { kind: "mood", i } or { kind: "globe", station }
let stationIndex = 0, metaTimer = 0, stallTimer = 0;
let listened = 0, limit = FADE_AT, extended = false, nudged = false, globeHeard = 0;
const VOL = 0.85;

function ensureContext() {
  if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 0.6;
  staticGain = ctx.createGain(); staticGain.gain.value = 0;
  src.connect(bp).connect(staticGain).connect(ctx.destination); src.start();
}
const setStatic = (v) => { if (staticGain && ctx) staticGain.gain.setTargetAtTime(v, ctx.currentTime, 0.04); };

function stopAudio() {
  clearTimeout(stallTimer); clearInterval(metaTimer);
  if (audio) { audio.pause(); audio.removeAttribute("src"); audio.load(); audio = null; }
  analyser = null; playing = false;
}
function setState(s) {
  const p = s === "playing";
  ui.radio.classList.toggle("playing", p && source?.kind === "mood");
  ui.radio.classList.toggle("loading", s === "loading" && source?.kind === "mood");
  ui.play.querySelector("b").textContent = p && source?.kind === "mood" ? "Pause" : "Play";
  ui.mini.classList.toggle("playing", p);
  ui.miniPlay.setAttribute("aria-label", p ? "Pause" : "Play");
}

// Plays a URL; `onPlaying` and `onFail` let moods and the globe handle what's next.
function playURL(url, { onPlaying, onFail }, withCors = !isIOS) {
  stopAudio();
  const a = new Audio();
  if (withCors) a.crossOrigin = "anonymous";
  a.preload = "none"; a.volume = VOL; a.src = url;
  audio = a;
  setState("loading");
  a.addEventListener("playing", () => {
    if (audio !== a) return;
    clearTimeout(stallTimer);
    playing = true; everPlayed = true; setState("playing"); setStatic(0); onScroll();
    if (withCors && ctx && !analyser) {
      try { const src = ctx.createMediaElementSource(a); analyser = ctx.createAnalyser(); analyser.fftSize = 1024; timeData = new Uint8Array(1024); src.connect(analyser).connect(ctx.destination); }
      catch { analyser = null; }
    }
    onPlaying?.();
  });
  a.addEventListener("error", () => { if (audio !== a) return; if (withCors) return playURL(url, { onPlaying, onFail }, false); onFail?.(); });
  stallTimer = setTimeout(() => { if (audio === a && !playing) onFail?.(); }, 12000);
  a.play().catch(() => { if (audio === a) onFail?.(); });
}

// ---------- Moods on the radio ----------
function playMood(i) {
  if (listened >= limit) return openSheet("ended");
  ensureContext();
  stopGlobe(false);
  source = { kind: "mood", i };
  const st = MOODS[i].st[stationIndex];
  ui.title.textContent = "Tuning in…"; ui.artist.textContent = st.by;
  setStatic(0.05);
  updateMini();
  playURL(st.u, {
    onPlaying: () => refreshMoodMeta(),
    onFail: () => {
      if (stationIndex < MOODS[i].st.length - 1) { stationIndex++; playMood(i); }
      else { setState("idle"); setStatic(0); ui.title.textContent = "No signal on this one"; ui.artist.textContent = "Turn the knob, or get the app"; }
    },
  });
}
async function refreshMoodMeta() {
  clearInterval(metaTimer);
  const update = async () => {
    if (source?.kind !== "mood") return;
    const st = MOODS[source.i].st[stationIndex], np = await nowPlaying(st);
    if (!playing || source?.kind !== "mood") return;
    ui.title.textContent = np?.title || st.n;
    ui.artist.textContent = np?.title ? `${np.artist || ""} · ${st.n}` : `Live · ${st.by}`;
    updateMini();
  };
  await update(); metaTimer = setInterval(update, 20000);
}
function togglePlay() {
  if (source?.kind === "mood" && (playing || ui.radio.classList.contains("loading"))) { stopAudio(); setStatic(0); setState("idle"); onScroll(); return; }
  stationIndex = 0;
  playMood(nearest().i);
}
function updateMini() {
  if (source?.kind === "globe") { ui.miniStation.textContent = `🌍 ${source.station.country || "Somewhere"}`; ui.miniTitle.textContent = source.station.name; return; }
  if (source?.kind !== "mood") return;
  const m = MOODS[source.i];
  ui.miniStation.textContent = `${m.f.toFixed(1)} FM · ${m.name}`;
  ui.miniTitle.textContent = ui.title.textContent + (ui.artist.textContent && ui.title.textContent !== "Tuning in…" ? ` — ${ui.artist.textContent.split(" · ")[0]}` : "");
}

// ---------- The dial and the knob ----------
let freq = MOODS[moodForNow()].f, pxPerMHz = 80, glide = 0;
function buildScale() {
  pxPerMHz = innerWidth < 640 ? 56 : 80;
  ui.scale.innerHTML = "";
  ui.scale.style.width = `${(FMAX - FMIN) * pxPerMHz}px`;
  const ticks = document.createElement("div"); ticks.className = "ticks";
  ticks.style.setProperty("--tick", `${pxPerMHz / 5}px`);
  ticks.style.backgroundPosition = `${(88 - FMIN) * pxPerMHz}px 0, ${(88 - FMIN) * pxPerMHz}px 0`;
  ui.scale.appendChild(ticks);
  for (let f = 88; f <= 108; f += 2) { const n = document.createElement("span"); n.className = "num"; n.textContent = f; n.style.left = `${(f - FMIN) * pxPerMHz}px`; ui.scale.appendChild(n); }
  MOODS.forEach((m) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "mark"; b.textContent = m.name; b.tabIndex = -1;
    b.style.left = `${(m.f - FMIN) * pxPerMHz}px`;
    b.addEventListener("click", (e) => { e.stopPropagation(); glideTo(m.f); });
    ui.scale.appendChild(b);
  });
  render();
}
function nearest(f = freq) { let b = 0; MOODS.forEach((m, i) => { if (Math.abs(m.f - f) < Math.abs(MOODS[b].f - f)) b = i; }); return { i: b, d: Math.abs(MOODS[b].f - f) }; }
function render() {
  ui.scale.style.transform = `translate3d(${ui.band.clientWidth / 2 - (freq - FMIN) * pxPerMHz}px,0,0)`;
  ui.knob.style.setProperty("--knob", `${((freq - FMIN) / (FMAX - FMIN)) * 300 - 150}deg`);
  ui.freq.textContent = freq.toFixed(1);
  const { i, d } = nearest(), locked = d < 0.12;
  ui.radio.classList.toggle("searching", !locked);
  $$(".mark", ui.scale).forEach((b, k) => b.classList.toggle("on", locked && k === i));
  ui.radio.style.setProperty("--h", MOODS[i].h);
  ui.band.setAttribute("aria-valuenow", freq.toFixed(1));
  ui.band.setAttribute("aria-valuetext", locked ? `${MOODS[i].name}, ${freq.toFixed(1)} megahertz` : `${freq.toFixed(1)} megahertz, between stations`);
  ui.station.textContent = locked ? MOODS[i].name : "searching…";
  const tuned = source?.kind === "mood" && (playing || ui.radio.classList.contains("loading"));
  if (!tuned) return;
  setStatic(locked ? 0 : clamp(d / 0.7, 0.15, 1) * 0.16);
  if (audio) audio.volume = i === source.i ? VOL * (1 - clamp((d - 0.12) / 0.5, 0, 1)) : 0;
}
function glideTo(target) {
  cancelAnimationFrame(glide);
  const from = freq, t0 = performance.now(), dur = reduceMotion ? 1 : clamp(Math.abs(target - from) * 90, 260, 900);
  const step = (t) => {
    const k = clamp((t - t0) / dur, 0, 1); freq = from + (target - from) * (1 - Math.pow(1 - k, 3)); render();
    if (k < 1) glide = requestAnimationFrame(step); else landed();
  };
  glide = requestAnimationFrame(step);
}
function landed() {
  const { i } = nearest();
  const tuned = source?.kind === "mood" && (playing || ui.radio.classList.contains("loading"));
  if (tuned && i !== source.i) { stationIndex = 0; playMood(i); }
  else if (tuned && audio) audio.volume = VOL;
}
const snap = () => glideTo(MOODS[nearest().i].f);
const stepMood = (dir) => glideTo(MOODS[(nearest().i + dir + MOODS.length) % MOODS.length].f);

let drag = null;
ui.band.addEventListener("pointerdown", (e) => { if (e.target.classList.contains("mark")) return; cancelAnimationFrame(glide); drag = { x: e.clientX, f: freq }; ui.band.setPointerCapture(e.pointerId); });
ui.band.addEventListener("pointermove", (e) => { if (!drag) return; freq = clamp(drag.f - (e.clientX - drag.x) / pxPerMHz, FMIN, FMAX); render(); });
const endDrag = () => { if (drag) { drag = null; snap(); } };
ui.band.addEventListener("pointerup", endDrag); ui.band.addEventListener("pointercancel", endDrag);
// The knob: drag round (or up and down) to tune; a tap goes to the next mood.
let kdrag = null;
ui.knob.addEventListener("pointerdown", (e) => {
  cancelAnimationFrame(glide);
  const r = ui.knob.getBoundingClientRect();
  kdrag = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, a: Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)), y: e.clientY, f: freq, moved: false };
  ui.knob.setPointerCapture(e.pointerId);
});
ui.knob.addEventListener("pointermove", (e) => {
  if (!kdrag) return;
  let a = Math.atan2(e.clientY - kdrag.cy, e.clientX - kdrag.cx), da = a - kdrag.a;
  if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
  kdrag.a = a;
  const dy = kdrag.y - e.clientY; kdrag.y = e.clientY;
  const delta = (da * 180 / Math.PI) / 300 * (FMAX - FMIN) + dy * 0.02;
  if (Math.abs(delta) > 0.001) kdrag.moved = true;
  freq = clamp(freq + delta, FMIN, FMAX); render();
});
ui.knob.addEventListener("pointerup", () => { if (!kdrag) return; const moved = kdrag.moved; kdrag = null; moved ? snap() : stepMood(1); });
ui.knob.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); stepMood(1); } if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); stepMood(-1); } });
ui.band.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); stepMood(e.key === "ArrowRight" ? 1 : -1); } if (e.key === " " || e.key === "Enter") { e.preventDefault(); togglePlay(); } });
let wheelT = 0;
ui.band.addEventListener("wheel", (e) => { const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0); if (!dx) return; e.preventDefault(); cancelAnimationFrame(glide); freq = clamp(freq + dx / pxPerMHz, FMIN, FMAX); render(); clearTimeout(wheelT); wheelT = setTimeout(snap, 160); }, { passive: false });
ui.play.addEventListener("click", togglePlay);
ui.miniPlay.addEventListener("click", () => { if (source?.kind === "globe") return playing ? stopGlobe(true) : spin(); togglePlay(); });
addEventListener("resize", () => { clearTimeout(buildScale.t); buildScale.t = setTimeout(buildScale, 120); });

// The taste: a nudge, then a gentle ending for moods; a minute per globe station.
setInterval(() => {
  if (!playing) return;
  if (source?.kind === "globe") {
    globeHeard++;
    $("#stags").dataset.left = Math.max(0, GLOBE_PREVIEW - globeHeard);
    if (globeHeard >= GLOBE_PREVIEW) fadeOut(() => { stopGlobe(true); openSheet("globe", source?.station?.name); });
    return;
  }
  listened++;
  if (!nudged && listened >= NUDGE_AT) { nudged = true; openSheet("nudge"); }
  if (listened >= limit) fadeOut(() => { stopAudio(); setState("idle"); onScroll(); openSheet("ended"); });
}, 1000);
function fadeOut(done) {
  if (!audio) return done();
  const a = audio; playing = false;
  const step = () => { a.volume = Math.max(0, a.volume - 0.05); a.volume > 0.01 ? setTimeout(step, 70) : done(); };
  step();
}

// ---------- Visualizer in the speaker grille ----------
const sctx = ui.scope.getContext("2d");
function fit(c) { const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return dpr; }
let level = 0;
function drawScope(t) {
  const dpr = fit(ui.scope), W = ui.scope.width, H = ui.scope.height;
  sctx.clearRect(0, 0, W, H);
  const moodOn = source?.kind === "mood" && playing, searching = source?.kind === "mood" && nearest().d >= 0.12 && (playing || ui.radio.classList.contains("loading"));
  level += ((moodOn ? 1 : searching ? 0.6 : 0.1) - level) * 0.06;
  const hue = +getComputedStyle(ui.radio).getPropertyValue("--h") || 290;
  // Concentric rings that pulse with the sound, like a speaker cone.
  let amp = 0;
  if (analyser && moodOn && !searching) { analyser.getByteTimeDomainData(timeData); for (let k = 0; k < timeData.length; k += 8) amp = Math.max(amp, Math.abs(timeData[k] - 128) / 128); }
  else amp = searching ? Math.random() * 0.8 : (0.35 + 0.25 * Math.sin(t / 240) * Math.sin(t / 610)) * level;
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.42;
  for (let r = 0; r < 5; r++) {
    const rr = R * (0.35 + r * 0.17) * (1 + amp * 0.14 * (1 - r * 0.15));
    sctx.beginPath(); sctx.arc(cx, cy, rr, 0, Math.PI * 2);
    sctx.strokeStyle = `hsla(${hue + r * 12}, 90%, 65%, ${0.15 + level * 0.55 * (1 - r * 0.15)})`;
    sctx.lineWidth = (2 + amp * 6) * dpr; sctx.stroke();
  }
  sctx.beginPath(); sctx.arc(cx, cy, R * 0.22 * (1 + amp * 0.3), 0, Math.PI * 2);
  sctx.fillStyle = `hsla(${hue}, 90%, 62%, ${0.25 + level * 0.6})`; sctx.fill();
}

// ---------- The 3D globe (d3-geo orthographic, Natural Earth countries) ----------
const G = (() => {
  const canvas = $("#globe"), g = canvas.getContext("2d");
  const has = typeof d3 !== "undefined" && d3.geoOrthographic && typeof topojson !== "undefined";
  const proj = has ? d3.geoOrthographic().clipAngle(90).precision(0.6) : null;
  const path = has ? d3.geoPath(proj, g) : null;
  const grat = has ? d3.geoGraticule10() : null;
  let land = null, borders = null, rot = [-8, -22], fly = null, visible = false, drag = null, t0 = 0;
  const api = { spinning: false, pin: null };
  if (has) fetch("assets/vendor/countries-110m.json").then((r) => r.json()).then((w) => {
    land = topojson.feature(w, w.objects.land);
    borders = topojson.mesh(w, w.objects.countries, (a, b) => a !== b);
  }).catch(() => {});
  api.flyTo = (lon, lat) => {
    api.pin = [lon, lat]; t0 = performance.now();
    const target = [-lon, clamp(-lat, -70, 70)];
    let d = ((target[0] - rot[0]) % 360 + 540) % 360 - 180;   // the short way round
    fly = { from: rot.slice(), to: [rot[0] + d - 360, target[1]], start: performance.now() };   // plus one extra lap, for fun
  };
  function draw(now) {
    const dpr = fit(canvas), W = canvas.width, H = canvas.height, r = Math.min(W, H) / 2 - 10 * dpr;
    g.clearRect(0, 0, W, H);
    if (fly) {
      const k = clamp((now - fly.start) / 1600, 0, 1), e = 1 - Math.pow(1 - k, 4);
      rot = [fly.from[0] + (fly.to[0] - fly.from[0]) * e, fly.from[1] + (fly.to[1] - fly.from[1]) * e];
      if (k >= 1) fly = null;
    } else if (api.spinning) rot[0] += 9;
    else if (!drag && !api.pin) rot[0] += 0.12;
    const cx = W / 2, cy = H / 2;
    // Atmosphere.
    const glow = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.12);
    glow.addColorStop(0, "rgba(212,255,79,0.35)"); glow.addColorStop(1, "rgba(212,255,79,0)");
    g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, r * 1.12, 0, Math.PI * 2); g.fill();
    // Ocean.
    const sea = g.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
    sea.addColorStop(0, "#4b8df0"); sea.addColorStop(1, "#173c8f");
    g.fillStyle = sea; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    if (has) {
      proj.scale(r).translate([cx, cy]).rotate(rot);
      g.beginPath(); path(grat); g.strokeStyle = "rgba(255,255,255,0.10)"; g.lineWidth = 1 * dpr; g.stroke();
      if (land) { g.beginPath(); path(land); g.fillStyle = "#8ee27a"; g.fill(); }
      if (borders) { g.beginPath(); path(borders); g.strokeStyle = "rgba(23,11,46,0.35)"; g.lineWidth = 0.8 * dpr; g.stroke(); }
      // The station: a pulsing pin, when it's on this side of the world.
      if (api.pin && d3.geoDistance(api.pin, [-rot[0], -rot[1]]) < Math.PI / 2 - 0.05) {
        const [px, py] = proj(api.pin), pulse = ((now - t0) % 1400) / 1400;
        g.beginPath(); g.arc(px, py, (6 + pulse * 22) * dpr, 0, Math.PI * 2); g.fillStyle = `rgba(255,61,127,${0.5 * (1 - pulse)})`; g.fill();
        g.beginPath(); g.arc(px, py, 6 * dpr, 0, Math.PI * 2); g.fillStyle = "#ff3d7f"; g.fill();
        g.lineWidth = 2.5 * dpr; g.strokeStyle = "#fff3e3"; g.stroke();
      }
    }
    // Light from the top left, night on the far side.
    const shade = g.createRadialGradient(cx - r * 0.45, cy - r * 0.5, r * 0.2, cx, cy, r * 1.05);
    shade.addColorStop(0, "rgba(255,255,255,0.18)"); shade.addColorStop(0.55, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(10,4,30,0.55)");
    g.fillStyle = shade; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  }
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; fly = null; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    rot = [rot[0] + dx * 0.45, clamp(rot[1] - dy * 0.45, -75, 75)]; drag.x = e.clientX; drag.y = e.clientY;
  });
  canvas.addEventListener("pointerup", () => { const tap = drag && !drag.moved; drag = null; if (tap) spin(); });
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  api.frame = (now) => { if (visible) draw(now); };
  return api;
})();

// ---------- Spin the globe ----------
let globePool = [];
const spinBtn = $("#spinBtn"), card = $("#globeCard"), place = $("#place"), sname = $("#sname"), stags = $("#stags"), actions = $("#landedActions");
const regionNames = (() => { try { return new Intl.DisplayNames(["en"], { type: "region" }); } catch { return null; } })();
const flag = (cc) => (cc && cc.length === 2 ? cc.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0))) : "🌍");
async function directory(path) {
  for (const m of ["de1", "de2"]) { try { return await getJSON(`https://${m}.api.radio-browser.info${path}`, 8000); } catch { /* next */ } }
  return null;
}
async function loadPool() {
  if (globePool.length) return;
  const list = await directory("/json/stations/search?order=votes&reverse=true&limit=400&hidebroken=true&is_https=true&codec=MP3&lastcheckok=1&has_geo_info=true");
  // Never the one broadcaster we don't name in marketing; nothing marked explicit.
  globePool = (list || []).filter((s) => s.url_resolved?.startsWith("https://") && Number.isFinite(s.geo_lat) && Number.isFinite(s.geo_long) && !/\bbbc\b/i.test(s.name) && !/explicit|adult|xxx/i.test(s.tags || ""));
}
let spinning = false;
async function spin() {
  if (spinning) return;
  spinning = true; G.spinning = true; G.pin = null; spinBtn.disabled = true;
  place.textContent = "Spinning…"; sname.textContent = "🌍 🌎 🌏"; stags.textContent = ""; actions.hidden = true;
  ensureContext(); setStatic(0.08);
  stopAudio(); setState("idle");
  await loadPool();
  if (!globePool.length) { stopSpin(); place.textContent = "Hmm"; sname.textContent = "The world isn’t answering."; stags.textContent = "Try again in a moment, or find them all in the app."; return; }
  tryStation(0);
}
function tryStation(attempt) {
  const s = globePool.splice((Math.random() * globePool.length) | 0, 1)[0];
  if (!s || attempt > 5) { stopSpin(); place.textContent = "Static"; sname.textContent = "No signal there."; stags.textContent = "Spin again!"; return; }
  source = { kind: "globe", station: { name: s.name.trim(), country: regionNames?.of(s.countrycode) || s.country, cc: s.countrycode } };
  playURL(s.url_resolved, {
    onPlaying: () => {
      stopSpin(); globeHeard = 0; G.flyTo(s.geo_long, s.geo_lat);
      const country = regionNames?.of(s.countrycode) || s.country || "Somewhere";
      place.textContent = `${flag(s.countrycode)} ${s.state ? s.state + ", " : ""}${country}`;
      sname.textContent = s.name.trim();
      stags.textContent = (s.tags || "").split(",").filter(Boolean).slice(0, 3).join(" · ") || s.language || "live radio";
      actions.hidden = false; spinBtn.textContent = "🌍 Spin again"; updateMini();
    },
    onFail: () => tryStation(attempt + 1),
  });
}
function stopSpin() { spinning = false; G.spinning = false; spinBtn.disabled = false; setStatic(0); }
function stopGlobe(reset) { if (source?.kind === "globe") { stopAudio(); setState("idle"); if (reset) { actions.hidden = true; place.textContent = "Where next?"; } onScroll(); } }
spinBtn.addEventListener("click", spin);
$("#spinStop").addEventListener("click", () => stopGlobe(true));
new IntersectionObserver(([e]) => { if (e.isIntersecting) { loadPool(); directory("/json/stats").then((s) => { if (s?.stations) $("#count").textContent = `${(Math.floor(s.stations / 1000) * 1000).toLocaleString("en")}+`; }); } }, { rootMargin: "400px" }).observe($("#spin"));

// ---------- Marquee and the receipt ----------
const marquee = $("#marquee"), receipt = $("#receipt"), printed = new Set();
async function refreshSongs() {
  const rows = (await Promise.all(MOODS.map(async (m) => ({ m, np: await nowPlaying(m.st.find((s) => s.meta)) })))).filter((r) => r.np?.title);
  if (!rows.length) return;
  const html = rows.map((r) => `<span>${esc(r.np.title)} <i>by</i> ${esc(r.np.artist || "")} · ${esc(r.m.name)}</span>`).join("");
  marquee.innerHTML = html + html;
  marquee.style.setProperty("--dur", `${Math.max(30, rows.length * 10)}s`);
  receipt.querySelector('.wait')?.remove();
  rows.forEach((r) => {
    const key = `${r.np.title}|${r.np.artist}`; if (printed.has(key)) return; printed.add(key);
    const li = document.createElement("li");
    li.innerHTML = `<span>${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}</span><div><b>${esc(r.np.title)}</b><span>${esc(r.np.artist || "")} · ${esc(r.m.name)}</span></div>`;
    receipt.prepend(li);
  });
  while (receipt.children.length > 6) receipt.lastElementChild.remove();
}
// Until the first names arrive, the receipt says it's listening, and asks again sooner.
receipt.innerHTML = '<li class="wait">listening to the moods…</li>';
refreshSongs();
let songTimer = setInterval(() => { if (!document.hidden) refreshSongs(); }, 8000);
setTimeout(() => { clearInterval(songTimer); setInterval(() => { if (!document.hidden) refreshSongs(); }, 30000); }, 40000);

// ---------- Skins ----------
const skinPhone = $("#skinPhone"), skinImg = $("#skinImg");
const SKIN_ALT = { turntable: "The Turntable skin", cassette: "The Cassette skin", desk: "The Mixing Desk skin", player: "The classic player" };
$$(".skinpick button").forEach((b) => b.addEventListener("click", () => {
  $$(".skinpick button").forEach((x) => x.setAttribute("aria-selected", x === b));
  skinPhone.classList.add("swap");
  setTimeout(() => { skinImg.src = `assets/screens/${b.dataset.skin}.webp`; skinImg.alt = SKIN_ALT[b.dataset.skin]; skinImg.onload = () => skinPhone.classList.remove("swap"); }, 220);
  skinPhone.querySelector(".vinyl").style.display = b.dataset.skin === "turntable" ? "" : "none";
}));

// ---------- Break timeline ----------
const tl = { el: $("#timeline"), head: $("#playhead"), route: $("#route"), caption: $("#caption"), lanes: $$("#timeline .lane"), on: false, t0: 0, len: 0 };
const STORY = [[0, "Your station is playing a song. 🎶", "a"], [0.3, "Uh oh, ads. Faders hears them…", "a"], [0.35, "…and hops to a favourite that’s playing a song. 🔀", "b"], [0.74, "Your station’s music is back…", "b"], [0.765, "…so Faders takes you home. Break missed, music kept. 🙌", "a"]];
function drawTimeline(now) {
  if (!tl.len) { tl.len = tl.route.getTotalLength(); tl.route.style.strokeDasharray = tl.len; }
  const p = clamp(((now - tl.t0) % 13200) / 11000, 0, 1), body = tl.lanes[0].querySelector(".lb");
  tl.head.style.left = `${body.offsetLeft + p * body.clientWidth}px`;
  tl.route.style.strokeDashoffset = tl.len * (1 - p);
  let s = STORY[0]; for (const r of STORY) if (p >= r[0]) s = r;
  if (tl.caption.textContent !== s[1]) tl.caption.textContent = s[1];
  tl.lanes.forEach((l) => l.classList.toggle("live", l.dataset.lane === s[2]));
}
new IntersectionObserver(([e]) => { if (e.isIntersecting && !tl.on) tl.t0 = performance.now(); tl.on = e.isIntersecting; }, { threshold: 0.35 }).observe(tl.el);
if (reduceMotion) { tl.route.style.strokeDasharray = "none"; tl.head.style.display = "none"; tl.caption.textContent = STORY[4][1]; }

// ---------- One animation loop ----------
let radioOn = true;
new IntersectionObserver(([e]) => (radioOn = e.isIntersecting)).observe(ui.radio);
function frame(t) { if (radioOn) drawScope(t); if (tl.on && !reduceMotion) drawTimeline(t); G.frame(t); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

// ---------- Tilt ----------
if (finePointer && !reduceMotion) {
  $$(".tilt").forEach((el) => {
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateY(${x * 12}deg) rotateX(${-y * 10}deg) scale(1.02)`;
    });
    el.addEventListener("mouseleave", () => { el.style.transform = ""; });
  });
}

// ---------- Sheet ----------
const sheet = $("#sheet"), sheetMore = $("#sheetMore");
let lastFocus = null;
function openSheet(kind, name) {
  const T = {
    nudge: ["Still here? 😄", "Good taste. In the app it keeps going with your phone locked, names songs even when the station doesn’t, and has 50,000+ stations."],
    ended: ["That was the taster 🎧", "Keep listening in Faders. It’s free, and it’s the real thing."],
    globe: [`Liked ${name || "that one"}?`, "Keep it in Faders, with song names, plus 50,000+ stations to spin through."],
  }[kind];
  $("#sheetTitle").textContent = T[0]; $("#sheetText").textContent = T[1];
  sheetMore.hidden = !(kind === "ended" && !extended);
  lastFocus = document.activeElement; sheet.hidden = false; $(".store", sheet).focus();
}
function closeSheet() { sheet.hidden = true; lastFocus?.focus?.(); }
sheet.addEventListener("click", (e) => { if (e.target === sheet || e.target.closest("[data-close]")) closeSheet(); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });
sheetMore.addEventListener("click", () => { extended = true; limit = listened + EXTRA; closeSheet(); stationIndex = 0; playMood(nearest().i); });

// ---------- Chrome ----------
const nav = $("#nav");
function onScroll() {
  nav.classList.toggle("scrolled", scrollY > 10);
  const past = scrollY > innerHeight * 0.7;
  ui.sticky.classList.toggle("show", past && !everPlayed);
  ui.mini.classList.toggle("show", past && everPlayed);
}
onScroll(); addEventListener("scroll", onScroll, { passive: true });

const rv = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); rv.unobserve(e.target); } }), { threshold: 0.12 });
$$(".block h2, .block .lede, .card, .ticket, .receipt, .globe-card, .timeline, .chips li, .ipad, .duo").forEach((el, i) => { el.classList.add("rv"); el.style.setProperty("--r", `${(i % 2 ? 1 : -1) * 2}deg`); el.style.transitionDelay = el.matches(".card, .chips li") ? `${(i % 6) * 60}ms` : "0ms"; rv.observe(el); });

const film = $(".duo video");
new IntersectionObserver(([e]) => { if (e.isIntersecting && !reduceMotion) film.play().catch(() => {}); else film.pause(); }, { threshold: 0.3 }).observe(film);
if (new Date() >= PLUS_PRICE_RISES) { $("#plusPrice").textContent = "€9.99"; $("#plusNote").textContent = "One payment. No subscription, ever."; }

buildScale();
