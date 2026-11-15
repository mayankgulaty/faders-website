// Tags every App Store link with where it was tapped, for App Store Connect › App Analytics › Campaigns.
// Apple counts these without cookies or anything personal: just "a download came from campaign X".
"use strict";
(() => {
  const PT = "";   // App Store Connect provider token (App Analytics › Campaigns › Generate link); campaigns need it
  const path = location.pathname;
  const kind = path === "/" || path === "/index.html" ? "home" : (path.split("/")[1] || "page").replace(".html", "");
  const tag = (a) => {
    const where = a.closest("[id]")?.id || a.closest("header, footer, aside, .sheet, .mini, .sticky")?.className.split(" ")[0] || "page";
    const url = new URL(a.href);
    url.searchParams.set("ct", `web-${kind}-${where}`.slice(0, 40));
    if (PT) url.searchParams.set("pt", PT);
    url.searchParams.set("mt", "8");
    a.href = url.toString();
  };
  document.querySelectorAll('a[href^="https://apps.apple.com/app/id6825091695"]').forEach(tag);
})();
