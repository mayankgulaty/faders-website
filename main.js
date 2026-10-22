// Faders website: reveals, sticky story, iPhone Duo unfold, ambient colour, film.

// Flip to true (and set the link) the day Faders is live on the App Store.
const LIVE = false;
const APP_STORE_URL = "https://apps.apple.com/app/id6825091695";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Store buttons
document.querySelectorAll(".cta-store").forEach((a) => {
  if (LIVE) {
    a.href = APP_STORE_URL;
    a.rel = "noopener";
  } else {
    a.textContent = a.classList.contains("pill-light") ? "Coming soon to the App Store" : "Coming soon";
    a.addEventListener("click", (e) => { e.preventDefault(); document.getElementById("get").scrollIntoView({ behavior: "smooth" }); });
  }
});
document.querySelectorAll(".availability").forEach((p) => {
  p.textContent = LIVE
    ? "Free on the App Store. Faders Plus €4.99 launch price, going up to €9.99 on 1 December."
    : "In App Review now. Requires iOS 27.";
});

// Nav border once scrolled
const nav = document.getElementById("nav");
const onScrollNav = () => nav.classList.toggle("scrolled", window.scrollY > 8);
onScrollNav();
addEventListener("scroll", onScrollNav, { passive: true });

// Reveal on scroll
const revealer = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); revealer.unobserve(e.target); } });
}, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
document.querySelectorAll(".reveal").forEach((el) => revealer.observe(el));

// Ambient colour follows the section in view
const tints = { film: 285, song: 300, moods: 150, duo: 35, everywhere: 220, privacy: 255, plus: 320, get: 300 };
const tintObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const t = tints[e.target.id] ?? 270;
    document.documentElement.style.setProperty("--tint", t);
  });
}, { threshold: 0.35 });
document.querySelectorAll("main > section[id]").forEach((s) => tintObserver.observe(s));

// Sticky story: swap the phone screen with the step in view
const shots = [...document.querySelectorAll(".story-shot")];
const steps = [...document.querySelectorAll(".step")];
const stepObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const i = e.target.dataset.step;
    steps.forEach((s) => s.classList.toggle("is-active", s === e.target));
    shots.forEach((s) => s.classList.toggle("is-active", s.dataset.step === i));
  });
}, { rootMargin: "-45% 0px -45% 0px" });
steps.forEach((s) => stepObserver.observe(s));

// Lyrics demo: highlight one line at a time
const lyricLines = [...document.querySelectorAll(".lyrics-demo p")];
if (lyricLines.length) {
  let line = 0;
  const tick = () => { lyricLines.forEach((p, i) => p.classList.toggle("on", i === line)); line = (line + 1) % lyricLines.length; };
  tick();
  if (!reduceMotion) setInterval(tick, 1600);
}

// iPhone Duo: unfold with scroll
const duoScroll = document.querySelector(".duo-scroll");
const duoDevice = document.querySelector(".duo-device");
const updateDuo = () => {
  if (!duoScroll) return;
  const r = duoScroll.getBoundingClientRect();
  const total = r.height - innerHeight;
  let p = total > 0 ? (-r.top) / total : 1;
  p = Math.min(Math.max((p - 0.15) / 0.6, 0), 1);
  const eased = reduceMotion ? (p > 0.5 ? 1 : 0) : 1 - Math.pow(1 - p, 3);
  duoDevice.style.setProperty("--p", eased.toFixed(4));
  duoDevice.classList.toggle("is-open", eased > 0.6);
};
let ticking = false;
addEventListener("scroll", () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { updateDuo(); ticking = false; });
}, { passive: true });
addEventListener("resize", updateDuo);
updateDuo();

// Film: play with sound off when visible; tap to play from the start
const film = document.querySelector(".film");
const video = film.querySelector("video");
const playButton = film.querySelector(".film-play");
const startFilm = () => { video.currentTime = 0; video.play().catch(() => {}); film.classList.add("playing"); };
playButton.addEventListener("click", startFilm);
video.addEventListener("click", () => { if (video.paused) startFilm(); else { video.pause(); film.classList.remove("playing"); } });
if (!reduceMotion) {
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { video.play().then(() => film.classList.add("playing")).catch(() => {}); }
    else { video.pause(); film.classList.remove("playing"); }
  }, { threshold: 0.6 }).observe(video);
}
