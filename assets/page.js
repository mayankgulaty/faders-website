// Station, country and genre pages: a one-minute preview of the station, then "keep listening in Faders".
"use strict";
(() => {
  const sheet = document.getElementById("sheet");
  const open = (title, text) => { if (title) sheet.querySelector("h3").textContent = title; if (text) sheet.querySelector("p").textContent = text; sheet.hidden = false; sheet.querySelector(".store").focus(); };
  sheet?.addEventListener("click", (e) => { if (e.target === sheet || e.target.closest("[data-close]")) sheet.hidden = true; });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet) sheet.hidden = true; });
  // Open in Faders landed here instead of in the app (iOS hadn't picked up the link yet): open the
  // app through its own address, and stay at the buttons rather than the top of the page.
  const id = new URLSearchParams(location.search).get("id");
  if (location.hostname === "open.faders.app" && id && /^[0-9a-f-]{36}$/i.test(id)) {
    const button = document.querySelector(".sp-open");
    if (button) {
      button.href = `faders://station/${id}`;
      const note = document.createElement("p");
      note.className = "sp-handoff";
      note.textContent = "Have Faders? Tap Open in Faders to play it in the app.";
      button.closest(".sp-cta")?.before(note);
      note.scrollIntoView({ block: "center" });
    }
  }
  let audio = null, timer = 0;
  document.querySelectorAll(".sp-play").forEach((b) => b.addEventListener("click", () => {
    if (audio) { audio.pause(); audio = null; clearInterval(timer); b.textContent = "▶ Listen for a minute"; return; }
    audio = new Audio(b.dataset.stream);
    b.textContent = "Tuning in…";
    let left = 60;
    audio.addEventListener("playing", () => {
      b.textContent = `■ Stop · ${left}s`;
      clearInterval(timer);
      timer = setInterval(() => {
        left--; b.textContent = `■ Stop · ${left}s`;
        if (left <= 0) { clearInterval(timer); audio.pause(); audio = null; b.textContent = "▶ Listen for a minute"; open(`Keep listening to ${b.dataset.name}`, "In Faders it plays on with your phone locked, in CarPlay and on your Watch, with song names. Free on the App Store."); }
      }, 1000);
    });
    audio.addEventListener("error", () => { b.textContent = "This one plays in the app"; audio = null; open(`${b.dataset.name} plays in Faders`, "This station’s stream doesn’t play in a web browser, but it does in Faders. Free on the App Store."); });
    audio.play().catch(() => {});
  }));
})();
