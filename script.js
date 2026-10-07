/* ============================================================
   Renders the project list (as links), scroll reveal, the signature draw,
   and the feed→case shared-element morph.
   ============================================================ */

// Real project screenshot (extracted from the site's webarchive).
function projectImage(p) {
  const dark = p.imageDark ? ` data-dark="${p.imageDark}"` : "";
  return `<img src="${p.image}"${dark} alt="${p.name}: ${p.tagline}" loading="lazy" />`;
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

// ---- Reverse morph: shrink the case-study hero back onto its feed card ----
// Runs when returning from a case study (pageshow covers back/forward cache too).
function playReverseMorph() {
  let raw;
  try { raw = sessionStorage.getItem("reverse"); } catch (e) { return; }
  if (!raw) return;
  try { sessionStorage.removeItem("reverse"); } catch (e) {}
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const info = JSON.parse(raw);
  const card = document.querySelector('.project[data-id="' + (info.id || "") + '"] .project__image');
  if (!card) return;

  const to = card.getBoundingClientRect();
  // Mirror of the forward morph (.6s cubic-bezier(.2,.8,.25,1)) so the return
  // feels like a true reverse of the entrance.
  const ease = "cubic-bezier(.75,0,.8,.2)";
  const clone = document.createElement("div");
  clone.style.cssText =
    "position:fixed;z-index:9999;overflow:hidden;border-radius:16px;border:1px solid rgba(0,0,0,.08);" +
    "left:" + info.left + "px;top:" + info.top + "px;width:" + info.width + "px;height:" + info.height + "px;" +
    "transition:left .6s " + ease + ",top .6s " + ease + ",width .6s " + ease + ",height .6s " + ease + ";";
  const im = document.createElement("img");
  im.src = info.src;
  im.style.cssText = "display:block;width:100%;height:100%;object-fit:cover;object-position:top;";
  clone.appendChild(im);

  card.style.visibility = "hidden"; // hide the real card until the clone lands
  document.body.appendChild(clone);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    clone.style.left = to.left + "px";
    clone.style.top = to.top + "px";
    clone.style.width = to.width + "px";
    clone.style.height = to.height + "px";
  }));

  let done = false;
  const end = () => { if (done) return; done = true; card.style.visibility = ""; clone.remove(); };
  clone.addEventListener("transitionend", end, { once: true });
  setTimeout(end, 720);
}
window.addEventListener("pageshow", playReverseMorph);

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
