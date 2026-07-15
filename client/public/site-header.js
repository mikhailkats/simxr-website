/* SIM XR — unified site header.
 * Single source of truth for the top navigation on ALL pages
 * (/, /about, /operator/, /packs/, /network/).
 *
 * Usage (static pages):
 *   <div id="sxr-header" data-cta-label="Request catalog" data-cta-href="#inquiry"></div>
 *   <script src="/site-header.js" defer></script>
 *
 * Usage (React Home): render the same placeholder div and load this script,
 * then call window.__sxrRenderHeader().
 *
 * Rules:
 *  - nav links are cross-page ONLY (no in-page anchors) and identical everywhere;
 *  - the right-side CTA is the page's primary action (configurable, default Contact);
 *  - active link is detected from location.pathname.
 */
(function () {
  var LINKS = [
    { label: "Asset Packs", href: "/packs/" },
    { label: "Hire Operators", href: "/network/" },
    { label: "For Operators", href: "/operator/" },
    { label: "About", href: "/about" },
  ];

  var CSS = [
    "#sxr-header{position:sticky;top:0;z-index:100;font-family:'Space Grotesk',Inter,system-ui,sans-serif}",
    ".sxr-nav{display:flex;align-items:center;justify-content:space-between;height:60px;padding:0 2.5rem;background:rgba(255,255,255,0.94);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid #E2E8F0}",
    ".sxr-wordmark{font-weight:700;font-size:1.15rem;color:#0B0F1A;letter-spacing:-0.02em;text-decoration:none}",
    ".sxr-wordmark span{color:#0057FF}",
    ".sxr-links{display:flex;gap:2rem;align-items:center}",
    ".sxr-links a{font-size:0.82rem;font-weight:500;color:#64748B;text-decoration:none;letter-spacing:0.01em;transition:color .15s}",
    ".sxr-links a:hover{color:#0B0F1A}",
    ".sxr-links a[aria-current='page']{color:#0B0F1A;font-weight:600}",
    ".sxr-cta{font-weight:600;font-size:0.82rem;color:#FFFFFF;background:#0B0F1A;padding:0.45rem 1.1rem;border-radius:6px;text-decoration:none;letter-spacing:0.02em}",
    ".sxr-cta:hover{opacity:0.9;text-decoration:none}",
    ".sxr-burger{display:none;background:none;border:0;padding:0.4rem;cursor:pointer}",
    ".sxr-burger svg{display:block}",
    ".sxr-mobile{display:none}",
    "@media (max-width:767px){",
    ".sxr-nav{padding:0 1.25rem}",
    ".sxr-links{display:none}",
    ".sxr-burger{display:block}",
    ".sxr-mobile{display:none;flex-direction:column;gap:0;background:rgba(255,255,255,0.98);border-bottom:1px solid #E2E8F0}",
    ".sxr-mobile.open{display:flex}",
    ".sxr-mobile a{padding:0.9rem 1.25rem;font-size:0.95rem;font-weight:500;color:#0B0F1A;text-decoration:none;border-top:1px solid #F1F5F9}",
    ".sxr-mobile a[aria-current='page']{color:#0057FF;font-weight:600}",
    "}",
  ].join("\n");

  function isActive(href) {
    var p = location.pathname;
    if (href === "/about") return p === "/about" || p === "/about.html";
    return p.indexOf(href.replace(/\/$/, "")) === 0 && href !== "/";
  }

  function linkHtml(cls) {
    return LINKS.map(function (l) {
      var cur = isActive(l.href) ? ' aria-current="page"' : "";
      return '<a href="' + l.href + '"' + cur + ">" + l.label + "</a>";
    }).join("");
  }

  function render() {
    var mount = document.getElementById("sxr-header");
    if (!mount || mount.getAttribute("data-rendered")) return;

    if (!document.getElementById("sxr-header-css")) {
      var style = document.createElement("style");
      style.id = "sxr-header-css";
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    var ctaLabel = mount.getAttribute("data-cta-label") || "Contact";
    var ctaHref = mount.getAttribute("data-cta-href") || "/#contact";

    mount.innerHTML =
      '<nav class="sxr-nav" aria-label="Site">' +
      '<a href="/" class="sxr-wordmark">SIM <span>XR.</span></a>' +
      '<div class="sxr-links">' + linkHtml() + "</div>" +
      '<div style="display:flex;align-items:center;gap:0.75rem">' +
      '<a href="' + ctaHref + '" class="sxr-cta">' + ctaLabel + "</a>" +
      '<button class="sxr-burger" aria-label="Menu" aria-expanded="false">' +
      '<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 6h16M3 11h16M3 16h16" stroke="#0B0F1A" stroke-width="1.8" stroke-linecap="round"/></svg>' +
      "</button></div></nav>" +
      '<div class="sxr-mobile">' + linkHtml() + "</div>";

    var burger = mount.querySelector(".sxr-burger");
    var mobile = mount.querySelector(".sxr-mobile");
    burger.addEventListener("click", function () {
      var open = mobile.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });

    mount.setAttribute("data-rendered", "1");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
  window.__sxrRenderHeader = render;
})();
