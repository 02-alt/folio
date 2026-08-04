/* ============================================================
   Shared-element morph for the case-study page.
   - Forward: hero grows from the feed card's rect (passed via #m= hash).
   - Reverse: on Back, hero shrinks into the stored feed card rect, then
     history.back() restores the feed (with its scroll) underneath.
   Works without the View Transitions API.
   ============================================================ */
(function () {
  var hero = document.querySelector(".case-hero");
  var wrap = document.querySelector(".case-wrap");
  if (!hero || !wrap) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var others = [].slice.call(wrap.children).filter(function (c) { return c !== hero; });

  /* ---------- Forward entrance ---------- */
  var match = location.hash.match(/#m=(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/);
  if (match) {
    var from = {
      left: parseFloat(match[1]), top: parseFloat(match[2]),
      width: parseFloat(match[3]), height: parseFloat(match[4]),
    };
    try { history.replaceState(null, "", location.pathname); } catch (e) { location.hash = ""; }

    if (!reduce) {
      var img = hero.querySelector("img");
      var enter = function () {
        var to = hero.getBoundingClientRect();
        if (!to.width || !to.height) { requestAnimationFrame(enter); return; }
        var dx = from.left - to.left, dy = from.top - to.top;
        var sx = from.width / to.width, sy = from.height / to.height;
        hero.style.transformOrigin = "top left";
        hero.style.transform = "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")";
        hero.style.willChange = "transform";
        others.forEach(function (c) { c.style.opacity = "0"; c.style.transform = "translateY(14px)"; });
        requestAnimationFrame(function () {
          hero.style.transition = "transform .6s cubic-bezier(.2,.8,.25,1)";
          hero.style.transform = "none";
          others.forEach(function (c) {
            c.style.transition = "opacity .5s ease .06s, transform .5s ease .06s";
            c.style.opacity = ""; c.style.transform = "";
          });
          hero.addEventListener("transitionend", clearHero, { once: true });
        });
      };
      if (img && !img.complete) {
        img.addEventListener("load", function () { requestAnimationFrame(enter); }, { once: true });
        img.addEventListener("error", function () { requestAnimationFrame(enter); }, { once: true });
      } else {
        requestAnimationFrame(enter);
      }
    }
  }

  function clearHero() {
    hero.style.transition = ""; hero.style.transform = "";
    hero.style.transformOrigin = ""; hero.style.willChange = "";
    others.forEach(function (c) { c.style.transition = ""; });
  }

  /* ---------- Reverse (Back): hand off to the feed, which shrinks the ----------
     hero clone onto the card OVER the real feed (no blank-page flash). */
  var back = document.querySelector(".case-back");
  if (!back) return;

  back.addEventListener("click", function (e) {
    if (reduce) return; // let the link navigate normally
    e.preventDefault();
    var href = back.getAttribute("href") || "/";

    // Bring the hero to the top so we capture a sensible on-screen rect.
    window.scrollTo(0, 0);
    requestAnimationFrame(function () {
      var r = hero.getBoundingClientRect();
      var img = hero.querySelector("img");
      try {
        sessionStorage.setItem("reverse", JSON.stringify({
          id: document.body.dataset.project || "",
          left: r.left, top: r.top, width: r.width, height: r.height,
          src: img ? (img.currentSrc || img.src) : "",
        }));
      } catch (e2) {}
      if (document.referrer && history.length > 1) history.back();
      else window.location.href = href;
    });
  });
})();

/* ============================================================
   Lightbox: click a case-study image for a clearer view.
   Fit-to-screen with a FLIP zoom from the image's spot; click the
   enlarged image to toggle actual size (scrollable); Esc / ✕ / click to close.
   ============================================================ */
(function () {
  var imgs = document.querySelectorAll(".case-hero img, .case-figure img");
  if (!imgs.length) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var lb = document.createElement("div");
  lb.className = "lightbox";
  lb.setAttribute("aria-hidden", "true");
  lb.innerHTML =
    '<div class="lightbox__backdrop"></div>' +
    '<button class="lightbox__close" aria-label="Close">×</button>' +
    '<div class="lightbox__stage"><img class="lightbox__img" alt=""></div>' +
    '<div class="lightbox__hint">Click image for actual size</div>';
  document.body.appendChild(lb);

  var stage = lb.querySelector(".lightbox__stage");
  var limg = lb.querySelector(".lightbox__img");
  var closeBtn = lb.querySelector(".lightbox__close");
  var source = null, lastFocus = null, isActual = false;

  function fitRect(nw, nh) {
    var pad = 28;
    var s = Math.min((innerWidth - pad * 2) / nw, (innerHeight - pad * 2) / nh);
    var w = nw * s, h = nh * s;
    return { w: w, h: h, left: (innerWidth - w) / 2, top: (innerHeight - h) / 2 };
  }

  function placeFit() {
    var nw = source.naturalWidth || source.width;
    var nh = source.naturalHeight || source.height;
    var to = fitRect(nw, nh);
    limg.style.position = "fixed";
    limg.style.margin = "0";
    limg.style.maxWidth = "none";
    limg.style.maxHeight = "none";
    limg.style.left = to.left + "px";
    limg.style.top = to.top + "px";
    limg.style.width = to.w + "px";
    limg.style.height = to.h + "px";
    return to;
  }

  function open(img) {
    source = img; isActual = false;
    lastFocus = document.activeElement;
    limg.src = img.currentSrc || img.src;
    limg.alt = img.alt || "";
    stage.classList.remove("actual");
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    closeBtn.focus();

    var to = placeFit();
    if (reduce) { lb.classList.add("show"); return; }

    var from = img.getBoundingClientRect();
    var dx = from.left - to.left, dy = from.top - to.top;
    var sx = from.width / to.w, sy = from.height / to.h;
    limg.style.transformOrigin = "top left";
    limg.style.transform = "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")";
    requestAnimationFrame(function () {
      lb.classList.add("show");
      limg.style.transition = "transform .4s cubic-bezier(.2,.8,.25,1)";
      limg.style.transform = "none";
    });
  }

  function close() {
    if (!source) return;
    var img = source;
    var cleanup = function () {
      lb.classList.remove("open", "show");
      lb.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      limg.style.cssText = "";
      stage.scrollTop = 0; stage.classList.remove("actual");
      source = null;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };
    if (reduce || isActual) { lb.classList.remove("show"); setTimeout(cleanup, 160); return; }

    var to = limg.getBoundingClientRect();
    var from = img.getBoundingClientRect();
    var dx = from.left - to.left, dy = from.top - to.top;
    var sx = from.width / to.width, sy = from.height / to.height;
    lb.classList.remove("show");
    limg.style.transformOrigin = "top left";
    limg.style.transition = "transform .4s cubic-bezier(.4,0,.2,1)";
    limg.style.transform = "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")";
    var done = false;
    var end = function () { if (done) return; done = true; cleanup(); };
    limg.addEventListener("transitionend", end, { once: true });
    setTimeout(end, 460);
  }

  function toggleActual() {
    if (!source) return;
    isActual = !isActual;
    limg.style.transition = "";
    if (isActual) {
      stage.classList.add("actual");
      limg.style.position = "static";
      limg.style.transform = "none";
      limg.style.left = ""; limg.style.top = "";
      limg.style.width = (source.naturalWidth || source.width) + "px";
      limg.style.height = "auto";
      limg.style.margin = "0 auto";
    } else {
      stage.classList.remove("actual");
      placeFit();
    }
  }

  imgs.forEach(function (img) {
    img.style.cursor = "zoom-in";
    img.addEventListener("click", function (e) { e.preventDefault(); open(img); });
  });
  limg.addEventListener("click", function (e) { e.stopPropagation(); toggleActual(); });
  stage.addEventListener("click", function (e) { if (e.target === stage) close(); });
  lb.querySelector(".lightbox__backdrop").addEventListener("click", close);
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && lb.classList.contains("open")) close();
  });
  addEventListener("resize", function () { if (source && !isActual) placeFit(); });
})();

/* ============================================================
   Next-project link at the foot of every case page.
   Data-driven from window.PROJECTS; cycles to the next project.
   ============================================================ */
(function () {
  var wrap = document.querySelector(".case-wrap");
  var footer = wrap && wrap.querySelector(".case-footer");
  var list = window.PROJECTS;
  if (!wrap || !footer || !list || !list.length) return;

  var id = document.body.dataset.project || "";
  var here = list.findIndex(function (p) { return p.id === id; });
  if (here < 0) return;

  var next = null;
  for (var k = 1; k <= list.length; k++) {
    var cand = list[(here + k) % list.length];
    if (cand.page && cand.id !== id) { next = cand; break; }
  }
  if (!next) return;

  var a = document.createElement("a");
  a.className = "pnext";
  a.href = next.page;
  if (next.accent) a.style.setProperty("--accent", next.accent);
  a.innerHTML =
    '<span class="pnext__label">Next project</span>' +
    '<span class="pnext__name">' + next.name + '</span>' +
    '<svg class="pnext__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  wrap.insertBefore(a, footer);

  // Entrance: fade + rise once it scrolls into view.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    a.classList.add("is-in");
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { a.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.4 });
    io.observe(a);
  }
})();
