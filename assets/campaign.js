// Tags every App Store link with where it was tapped, for App Store Connect › App Analytics › Campaigns.
// Apple counts these without cookies or anything personal: just "a download came from campaign X".
"use strict";
(() => {
  const PT = "128269939";   // App Store Connect provider token (App Analytics › Campaigns); campaigns need it
  const path = location.pathname;
  const kind = path === "/" || path === "/index.html" ? "home" : (path.split("/")[1] || "page").replace(".html", "");
  // A shared link can say where it was posted: faders.app/?ref=x#tv tags downloads "x-home-tv"
  // instead of "web-home-tv" (letters and digits only, up to 12).
  const params = new URLSearchParams(location.search);
  const ref = (params.get("ref") || params.get("utm_source") || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  const source = ref || "web";
  const tag = (a) => {
    const where = a.closest("[id]")?.id || a.closest("header, footer, aside, .sheet, .mini, .sticky")?.className.split(" ")[0] || "page";
    const url = new URL(a.href);
    url.searchParams.set("ct", `${source}-${kind}-${where}`.slice(0, 40));
    if (PT) url.searchParams.set("pt", PT);
    url.searchParams.set("mt", "8");
    a.href = url.toString();
  };
  document.querySelectorAll('a[href^="https://apps.apple.com/app/id6825091695"]').forEach(tag);
})();
