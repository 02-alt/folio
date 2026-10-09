/* ============================================================
   Renders the project list (as links), scroll reveal, the signature draw,
   and the feed→case shared-element morph.
   ============================================================ */

// Real project screenshot (extracted from the site's webarchive).
function projectImage(p) {
  const dark = p.imageDark ? ` data-dark="${p.imageDark}"` : "";
  // width/height reserve the 16:9 box before the file loads, so the feed's layout
  // (and the card the Back morph lands on) is stable from the first frame.
  return `<img src="${p.image}"${dark} alt="${p.name}: ${p.tagline}" width="1024" height="576" loading="lazy" />`;
}

// ---- Build the project list ----
// Each card is a real link to its case-study page: keyboard-operable for free,
// works without JS, and supports ⌘/middle-click to open in a new tab.
const list = document.getElementById("projects");
list.innerHTML = window.PROJECTS.map(
  (p) => `
  <a class="project" data-id="${p.id}" href="${p.page}">
    <div class="project__head">
      <h2 class="project__name">${p.name}</h2>
      ${p.page ? `<span class="project__badge">${p.badge || "Case study"}</span>` : ""}
    </div>
    <div class="project__year">${p.year}</div>
    <div class="project__tagline">${p.tagline}</div>
    <p class="project__desc">${p.description}</p>
    ${p.image ? `<div class="project__image">${projectImage(p)}</div>` : ""}
  </a>`
).join("");

// Navigate to a case-study page, passing the card image's on-screen rect in the
// URL. The destination page (case.js) uses it to morph its hero in from exactly
// where the card was — a shared-element transition that works in every browser.
function navigateWithTransition(p) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = document.querySelector('.project[data-id="' + p.id + '"] .project__image');
  if (reduce || !el) { window.location.href = p.page; return; }
  const r = el.getBoundingClientRect();
  const rect = [r.left, r.top, r.width, r.height].map(Math.round).join(",");
  window.location.href = p.page + "#m=" + rect;
}

function openProject(id) {
  const p = window.PROJECTS.find((x) => x.id === id);
  if (p && p.page) navigateWithTransition(p);
}

// Intercept primary clicks to run the shared-element morph; let modified or
// middle clicks fall through so the link opens in a new tab as usual.
list.addEventListener("click", (e) => {
  const card = e.target.closest(".project");
  if (!card) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  openProject(card.dataset.id);
});

// ---- Reveal on scroll ----
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("in");
        io.unobserve(en.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal, .project").forEach((el) => io.observe(el));

// ---- Signature: a stroke that draws itself when it scrolls into view ----
// (click it to replay). The .in class from the reveal observer triggers the CSS.
(function () {
  const sig = document.querySelector(".signature");
  const path = sig && sig.querySelector(".signature__path");
  if (!path || typeof path.getTotalLength !== "function") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  path.style.setProperty("--len", Math.ceil(path.getTotalLength()));
  const replay = () => {
    sig.classList.remove("in");     // reset to hidden (no transition off .in)
    void sig.getBoundingClientRect(); // force reflow so the reset lands instantly
    sig.classList.add("in");        // draw again
  };
  sig.addEventListener("click", replay);
  // Keyboard operable (the element is role="button" tabindex="0" in the markup).
  sig.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); replay(); }
  });
})();

// ---- Theme-aware images: <img data-dark="…"> shows its dark variant in dark mode ----
function syncThemeImages() {
  const dark = document.documentElement.dataset.theme === "dark";
  document.querySelectorAll("img[data-dark]").forEach((img) => {
    if (!img.dataset.light) img.dataset.light = img.getAttribute("src");
    const want = dark ? img.dataset.dark : img.dataset.light;
    if (img.getAttribute("src") !== want) img.setAttribute("src", want);
  });
}
syncThemeImages();

// ---- Appearance toggle (light ⇄ dark), remembered across pages ----
(function () {
  const btn = document.querySelector(".theme-toggle");
  if (!btn) return;
  const root = document.documentElement;
  const sync = () => btn.setAttribute("aria-pressed", String(root.dataset.theme === "dark"));
  sync();
  btn.addEventListener("click", () => {
    const dark = root.dataset.theme !== "dark";
    if (dark) root.dataset.theme = "dark"; else delete root.dataset.theme;
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch (e) {}
    sync();
    syncThemeImages();
  });
})();
