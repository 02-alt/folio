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

// ---- Live preview: hovering a card with a `preview` (data.js) plays its real
// recordings inside the phone of the card image, a few seconds each, with a
// capsule naming the clip. Pointer devices only; off for reduced motion and
// Save-Data. Leaving pauses it; coming back resumes where it stopped.
(function () {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (navigator.connection && navigator.connection.saveData) return;
  const SEG = 6000;
  window.PROJECTS.forEach((p) => {
    const pv = p.preview;
    const card = pv && list.querySelector('.project[data-id="' + p.id + '"]');
    const box = card && card.querySelector(".project__image");
    if (!box) return;
    let screen, video, label, bars, i = 0, on = false, wait = 0, timer = 0, startT = 0, left = SEG;

    function build() {
      screen = document.createElement("div");
      screen.className = "preview";
      const [l, t, w, h] = pv.screen;
      Object.assign(screen.style, { left: l + "%", top: t + "%", width: w + "%", height: h + "%" });
      video = document.createElement("video");
      video.muted = true; video.playsInline = true; video.preload = "auto";
      video.setAttribute("aria-hidden", "true");
      screen.appendChild(video);
      const cap = document.createElement("div");
      cap.className = "preview__cap";
      cap.setAttribute("aria-hidden", "true");
      cap.style.setProperty("--seg", SEG + "ms");
      cap.innerHTML = '<span></span><span class="preview__clip"></span><span class="preview__bars">' + pv.clips.map(() => "<i></i>").join("") + "</span>";
      cap.firstChild.textContent = pv.name;
      label = cap.querySelector(".preview__clip");
      bars = [...cap.querySelectorAll(".preview__bars i")];
      box.append(screen, cap);
      video.addEventListener("playing", () => { if (on) { box.classList.add("is-previewing"); screen.classList.remove("is-switching"); } });
      load(0);
    }
    function load(k) {
      i = k;
      const c = pv.clips[i];
      video.innerHTML = '<source src="' + c.src + '.hevc.mp4" type=\'video/mp4; codecs="hvc1"\'><source src="' + c.src + '.mp4" type="video/mp4">';
      video.load();
      label.textContent = c.label;
      bars.forEach((b, j) => { b.className = j < i ? "done" : ""; });
      void bars[i].offsetWidth;                     // restart the fill
      bars[i].className = "cur";
      left = SEG;
    }
    function run() { clearTimeout(timer); startT = performance.now(); timer = setTimeout(next, left); }
    function next() {
      screen.classList.add("is-switching");
      setTimeout(() => { load((i + 1) % pv.clips.length); if (on) video.play().then(run, () => {}); }, 150);
    }
    function start() {
      if (!video) build();
      video.play().then(run, () => {});
    }
    function stop() {
      on = false;
      clearTimeout(wait);
      if (!video) return;
      if (!video.paused) { video.pause(); clearTimeout(timer); left = Math.max(400, left - (performance.now() - startT)); }
      box.classList.remove("is-previewing");
    }
    card.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      on = true;
      clearTimeout(wait);
      wait = setTimeout(start, 300);                // a beat, so passing over a card doesn't start it
    });
    card.addEventListener("pointerleave", stop);
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
    addEventListener("pagehide", stop);
  });
})();

// ---- Entrance: one page-load sequence, no scroll reveals ----
// What's in view at load rises in top to bottom; anything below the fold is
// simply visible once scrolled to. The signature keeps its own observer (below)
// so it draws when it comes into view.
(function () {
  let i = 0;
  const vh = innerHeight;
  document.querySelectorAll(".reveal, .project").forEach((el) => {
    if (el.classList.contains("signature")) return;
    const inView = el.getBoundingClientRect().top < vh;   // also flushes the hidden state, so the rise animates
    if (inView) el.style.setProperty("--d", (i++ * 70) + "ms");
    el.classList.add("in");
    if (!inView) el.classList.add("is-static");
  });
})();

// ---- Signature: a stroke that draws itself when it scrolls into view ----
// (click it to replay). The .in class from the reveal observer triggers the CSS.
(function () {
  const sig = document.querySelector(".signature");
  const path = sig && sig.querySelector(".signature__path");
  if (!path || typeof path.getTotalLength !== "function") { if (sig) sig.classList.add("in"); return; }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { sig.classList.add("in"); return; }
  path.style.setProperty("--len", Math.ceil(path.getTotalLength()));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { sig.classList.add("in"); io.unobserve(sig); } });
  }, { threshold: 0.12 });
  io.observe(sig);
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
