/* ============================================================
   Renders the project list, phone mockups, and the case-study modal.
   ============================================================ */

// Real project screenshot (extracted from the site's webarchive).
function projectImage(p) {
  return `<img src="${p.image}" alt="${p.name}: ${p.tagline}" loading="lazy" />`;
}

// ---- Build the project list ----
const list = document.getElementById("projects");
list.innerHTML = window.PROJECTS.map(
  (p) => `
  <article class="project" data-id="${p.id}" role="button" tabindex="0" aria-label="${p.name}: ${p.page ? "open case study" : "open details"}">
    <div class="project__head">
      <h2 class="project__name">${p.name}</h2>
      ${p.page ? `<span class="project__badge">${p.badge || "Case study"}</span>` : ""}
    </div>
    <div class="project__year">${p.year}</div>
    <div class="project__tagline">${p.tagline}</div>
    <p class="project__desc">${p.description}</p>
    ${p.image ? `<div class="project__image">${projectImage(p)}</div>` : ""}
  </article>`
).join("");

// ---- Modal ----
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modalBody");

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
  if (!p) return;
  if (p.page) { navigateWithTransition(p); return; }
  modalBody.innerHTML = `
    ${p.image ? `<div class="modal__hero">${projectImage(p)}</div>` : ""}
    <h3 class="modal__title" id="modalTitle">${p.name}</h3>
    <div class="modal__year">${p.year}</div>
    <div class="modal__grid">
      <div>
        <div class="modal__label">My Role</div>
        <p class="modal__text"><b>${p.role.split(":")[0].trim()}</b>${p.role.includes(":") ? ": " + p.role.split(":").slice(1).join(":").trim() : ""}</p>
        <div class="modal__label">Team</div>
        <p class="modal__text">${p.team}</p>
      </div>
      <div>
        <div class="modal__label">Overview</div>
        <p class="modal__text">${p.overview}</p>
      </div>
    </div>`;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

list.addEventListener("click", (e) => {
  const card = e.target.closest(".project");
  if (card) openProject(card.dataset.id);
});
list.addEventListener("keydown", (e) => {
  const card = e.target.closest(".project");
  if (card && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    openProject(card.dataset.id);
  }
});
modal.addEventListener("click", (e) => {
  if (e.target.hasAttribute("data-close")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
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
  sig.addEventListener("click", () => {
    sig.classList.remove("in");     // reset to hidden (no transition off .in)
    void sig.getBoundingClientRect(); // force reflow so the reset lands instantly
    sig.classList.add("in");        // draw again
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
  const ease = "cubic-bezier(.4,0,.2,1)";
  const clone = document.createElement("div");
  clone.style.cssText =
    "position:fixed;z-index:9999;overflow:hidden;border-radius:16px;border:1px solid rgba(0,0,0,.08);" +
    "left:" + info.left + "px;top:" + info.top + "px;width:" + info.width + "px;height:" + info.height + "px;" +
    "transition:left .5s " + ease + ",top .5s " + ease + ",width .5s " + ease + ",height .5s " + ease + ";";
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
  setTimeout(end, 620);
}
window.addEventListener("pageshow", playReverseMorph);
