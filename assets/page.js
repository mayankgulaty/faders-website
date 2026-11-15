// Station, country and genre pages: a one-minute preview of the station, then "keep listening in Faders".
"use strict";
(() => {
  const sheet = document.getElementById("sheet");
  const open = (title, text) => { if (title) sheet.querySelector("h3").textContent = title; if (text) sheet.querySelector("p").textContent = text; sheet.hidden = false; sheet.querySelector(".store").focus(); };
  sheet?.addEventListener("click", (e) => { if (e.target === sheet || e.target.closest("[data-close]")) sheet.hidden = true; });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet) sheet.hidden = true; });
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
        if (left <= 0) { clearInterval(timer); audio.pause(); audio = null; b.textContent = "▶ Listen for a minute"; open(`Keep listening to ${b.dataset.name}`, "In Faders it plays on with your phone locked, in CarPlay and on your Watch, with every song named. Free on the App Store."); }
      }, 1000);
    });
    audio.addEventListener("error", () => { b.textContent = "This one plays in the app"; audio = null; open(`${b.dataset.name} plays in Faders`, "This station’s stream doesn’t play in a web browser, but it does in Faders. Free on the App Store."); });
    audio.play().catch(() => {});
  }));
})();
