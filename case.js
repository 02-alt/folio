/* ============================================================
   Shared-element morph for the case-study page.
   - Forward: hero grows from the feed card's rect (passed via #m= hash).
   - Reverse: on Back, hero shrinks into the stored feed card rect, then
     history.back() restores the feed (with its scroll) underneath.
   Works without the View Transitions API.
   ============================================================ */
/* Theme-aware images: <img data-dark="…"> shows its dark variant in dark mode.
   Runs first so the morph and lightbox see the right source. */
(function () {
  if (document.documentElement.dataset.theme !== "dark") return;
  [].forEach.call(document.querySelectorAll("img[data-dark]"), function (img) {
    img.setAttribute("src", img.getAttribute("data-dark"));
  });
})();

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
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "Image viewer");
  lb.innerHTML =
    '<div class="lightbox__backdrop"></div>' +
    '<button class="lightbox__close" aria-label="Close">×</button>' +
    '<div class="lightbox__stage"><img class="lightbox__img" alt="" role="button" tabindex="0" aria-label="Toggle actual size"></div>' +
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
    limg.style.transition = "transform .4s cubic-bezier(.75,0,.8,.2)";
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
    img.setAttribute("role", "button");
    img.setAttribute("tabindex", "0");
    if (!img.getAttribute("aria-label")) {
      img.setAttribute("aria-label", "Enlarge image" + (img.alt ? ": " + img.alt : ""));
    }
    img.addEventListener("click", function (e) { e.preventDefault(); open(img); });
    img.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(img); }
    });
  });
  limg.addEventListener("click", function (e) { e.stopPropagation(); toggleActual(); });
  limg.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleActual(); }
  });
  stage.addEventListener("click", function (e) { if (e.target === stage) close(); });
  lb.querySelector(".lightbox__backdrop").addEventListener("click", close);
  closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") { close(); return; }
    // Trap focus within the dialog (close button ⇄ image).
    if (e.key === "Tab") {
      var focusables = [closeBtn, limg];
      var first = focusables[0], last = focusables[focusables.length - 1];
      var active = document.activeElement;
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
      else if (focusables.indexOf(active) === -1) { e.preventDefault(); first.focus(); }
    }
  });
  addEventListener("resize", function () { if (source && !isActual) placeFit(); });
})();

/* ============================================================
   Screen-recording clips: silent loops that play only while on
   screen. A play/pause button per clip; with reduced motion they
   start paused on their poster and play only when asked.
   ============================================================ */
(function () {
  var clips = document.querySelectorAll(".clip");
  if (!clips.length) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ICONS =
    '<svg class="i-pause" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1.2"/><rect x="14" y="4.5" width="4" height="15" rx="1.2"/></svg>' +
    '<svg class="i-play" viewBox="0 0 24 24" fill="currentColor"><path d="M7.5 4.8v14.4c0 .8.9 1.3 1.6.9l11.3-7.2c.6-.4.6-1.4 0-1.8L9.1 3.9c-.7-.4-1.6.1-1.6.9z"/></svg>';

  clips.forEach(function (clip) {
    var video = clip.querySelector("video");
    var card = clip.querySelector(".clip__card");
    if (!video || !card) return;
    video.muted = true;
    // Keep the poster painted behind the video: Safari hides the poster as soon as
    // play() is called and shows black until the first frame has buffered.
    if (video.poster) {
      video.style.background = "#000 url(\"" + video.poster + "\") center / cover no-repeat";
    }
    clip._userPaused = reduce;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "clip__btn";
    btn.innerHTML = ICONS;
    card.appendChild(btn);

    function sync() {
      var paused = video.paused;
      clip.classList.toggle("is-paused", paused);
      btn.setAttribute("aria-label", (paused ? "Play" : "Pause") + " video");
    }
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    sync();

    btn.addEventListener("click", function () {
      if (video.paused) { clip._userPaused = false; video.play().catch(function () {}); }
      else { clip._userPaused = true; video.pause(); }
    });
  });

  if (!("IntersectionObserver" in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var clip = e.target, video = clip.querySelector("video");
      if (e.isIntersecting && !clip._userPaused) video.play().catch(function () {});
      else if (!e.isIntersecting && !video.paused) video.pause();
    });
  }, { threshold: 0.35 });
  clips.forEach(function (clip) { io.observe(clip); });
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
    '<span class="pnext__arrowbox"><svg class="pnext__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>';
  wrap.insertBefore(a, footer);

  // Replace the current project in history instead of pushing a new entry, so
  // chaining "Next project" never stacks up — Back always returns to the feed.
  a.addEventListener("click", function (e) {
    e.preventDefault();
    location.replace(a.href);
  });
})();
