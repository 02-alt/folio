/* ============================================================
   Shared-element morph for the case-study page.
   - Forward: hero grows from the feed card's rect (passed via #m= hash).
   - Back: the case page pulls away as the feed settles in (native
     cross-document view transition, see styles.css).
   The forward morph works without the View Transitions API.
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

  /* ---------- Back: the case page pulls away as the feed settles in ----------
     Native cross-document view transition (styles.css "Return from a case
     page"). The page opts in only here, so forward links and the browser's own
     Back stay as they are. Without support, the page fades out and the feed
     fades up. */
  var back = document.querySelector(".case-back");
  if (!back) return;
  var nativeVT = "CSSViewTransitionRule" in window;

  back.addEventListener("click", function (e) {
    if (reduce) return; // let the link navigate normally
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    var href = back.getAttribute("href") || "/";
    try { sessionStorage.setItem("back", "1"); } catch (e2) {}

    var go = function () {
      var fromFeed = false;
      try { fromFeed = new URL(document.referrer).origin === location.origin; } catch (e3) {}
      if (fromFeed && history.length > 1) history.back();
      else window.location.href = href;
    };

    if (nativeVT) {
      var opt = document.createElement("style");
      opt.id = "vt-opt-in";
      opt.textContent = "@view-transition { navigation: auto; }";
      document.head.appendChild(opt);
      go();
    } else {
      wrap.style.transition = "opacity .2s cubic-bezier(.4,0,1,1)";
      wrap.style.opacity = "0";
      setTimeout(go, 200);
    }
  });

  // A skipped transition rejects its promises; nothing to report.
  window.addEventListener("pageswap", function (e) {
    var t = e.viewTransition;
    if (t) [t.ready, t.finished, t.updateCallbackDone].forEach(function (p) { if (p) p.catch(function () {}); });
  });

  // Coming forward again through the back/forward cache: undo the opt-in / fade.
  window.addEventListener("pageshow", function (e) {
    if (!e.persisted) return;
    var opt = document.getElementById("vt-opt-in");
    if (opt) opt.remove();
    wrap.style.transition = ""; wrap.style.opacity = "";
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
    // A clip holds one video, or two (Mac + iPhone) that play and pause together.
    var videos = [].slice.call(clip.querySelectorAll("video"));
    var card = clip.querySelector(".clip__card");
    if (!videos.length || !card) return;
    clip._videos = videos;
    videos.forEach(function (video) {
      video.muted = true;
      // Keep the poster painted behind the video: Safari hides the poster as soon as
      // play() is called and shows black until the first frame has buffered.
      if (video.poster) {
        video.style.background = "#000 url(\"" + video.poster + "\") center / cover no-repeat";
      }
    });
    clip._userPaused = reduce;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "clip__btn";
    btn.innerHTML = ICONS;
    card.appendChild(btn);

    function sync() {
      var paused = videos.every(function (v) { return v.paused; });
      clip.classList.toggle("is-paused", paused);
      btn.setAttribute("aria-label", (paused ? "Play" : "Pause") + (videos.length > 1 ? " videos" : " video"));
    }
    videos.forEach(function (v) { v.addEventListener("play", sync); v.addEventListener("pause", sync); });
    sync();

    btn.addEventListener("click", function () {
      if (videos.every(function (v) { return v.paused; })) { clip._userPaused = false; playAll(clip); }
      else { clip._userPaused = true; pauseAll(clip); }
    });
  });

  // A video is "off" when its device is hidden by the view switch (Mac only / iPhone only).
  function isOff(v) {
    // the view lives on the card, or on the zoom layer while the mockup is enlarged
    var scope = v.closest("[data-view]"), view = scope && scope.dataset.view;
    if (!view || view === "both" || !v.closest(".clip__stage")) return false;
    return !v.closest(".device--" + view);
  }
  function playAll(clip) {
    clip._videos.forEach(function (v) {
      if (isOff(v)) { if (!v.paused) v.pause(); }
      else v.play().catch(function () {});
    });
  }
  function pauseAll(clip) { clip._videos.forEach(function (v) { if (!v.paused) v.pause(); }); }

  // View switch: a segmented control for cards that declare data-views.
  var LABELS = { both: "Both", mac: "Mac", iphone: "iPhone", device: "MacBook", window: "Window" };
  clips.forEach(function (clip) {
    var card = clip.querySelector(".clip__card[data-views]");
    if (!card) return;
    var views = card.dataset.views.split(",");
    card.dataset.view = views[0];
    var seg = document.createElement("div");
    seg.className = "seg";
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", "Show");
    seg.innerHTML = '<span class="seg__thumb" aria-hidden="true"></span>' + views.map(function (v) {
      return '<button type="button" class="seg__btn" data-v="' + v + '">' + LABELS[v] + "</button>";
    }).join("");
    card.appendChild(seg);
    var thumb = seg.querySelector(".seg__thumb");
    var btns = [].slice.call(seg.querySelectorAll(".seg__btn"));
    function place() {
      var on = btns.filter(function (b) { return b.dataset.v === card.dataset.view; })[0];
      btns.forEach(function (b) { b.setAttribute("aria-pressed", String(b === on)); });
      thumb.style.width = on.offsetWidth + "px";
      thumb.style.transform = "translateX(" + on.offsetLeft + "px)";
    }
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        card.dataset.view = b.dataset.v;
        place();
        if (!clip._userPaused) playAll(clip); else pauseAll(clip);
      });
    });
    place();
    addEventListener("resize", place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  });

  if (!("IntersectionObserver" in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var clip = e.target;
      if (!clip._videos) return;
      if (e.isIntersecting && !clip._userPaused) playAll(clip);
      else if (!e.isIntersecting) pauseAll(clip);
    });
  }, { threshold: 0.35 });
  clips.forEach(function (clip) { io.observe(clip); });
})();

/* ============================================================
   Zoom: click (or Enter on) a device mockup and it grows out of its
   card to fill the screen, re-laid out at full size so the recording
   and a 2× bezel render sharp. Click anywhere, Esc or × to send it
   back to its spot. Interruptible: each move starts from where the
   mockup is on screen. Reduced motion: a short fade instead.
   ============================================================ */
(function () {
  var cards = document.querySelectorAll(".clip__card");
  if (!cards.length || !Element.prototype.animate) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var EASE = "cubic-bezier(.2, .8, .25, 1)";

  var zoom = document.createElement("div");
  zoom.className = "zoom";
  zoom.setAttribute("role", "dialog");
  zoom.setAttribute("aria-modal", "true");
  zoom.setAttribute("aria-label", "Enlarged view");
  zoom.innerHTML =
    '<div class="zoom__scrim"></div>' +
    '<div class="zoom__layer"></div>' +
    '<button type="button" class="zoom__close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  document.body.appendChild(zoom);
  var layer = zoom.querySelector(".zoom__layer");
  var closeBtn = zoom.querySelector(".zoom__close");

  // 2× bezels: fetched once the page is idle, swapped in when a mockup is enlarged
  var HI = /bezel-(iphone16|mbp14)\.webp(\?.*)?$/, hiLoads = {};
  function hiSrc(src) { return HI.test(src) ? src.replace(HI, "bezel-$1@2x.webp") : null; }
  function load(hi) {
    if (!hiLoads[hi]) {
      var img = new Image();
      img.src = hi;
      hiLoads[hi] = img.decode ? img.decode() : new Promise(function (ok) { img.onload = ok; });
    }
    return hiLoads[hi];
  }
  function frames(root, fn) {
    [].forEach.call(root.querySelectorAll(".device__frame"), function (f) {
      var hi = hiSrc(f.getAttribute("src"));
      if (hi) fn(f, hi);
    });
  }
  addEventListener("load", function () {
    setTimeout(function () { frames(document, function (f, hi) { load(hi); }); }, 1500);
  });
  function sharpen(el) {
    frames(el, function (f, hi) { load(hi).then(function () { f.src = hi; }, function () {}); });
  }

  var el = null, card = null, ph = null, anim = null, fit = null, saved = "", lastFocus = null, isOpen = false;

  function target(c) { return c.querySelector(".clip__stage") || c.querySelector(".device"); }

  // The largest rect with the mockup's proportions that fits the viewport
  function fitTo(w, h) {
    var m = innerWidth < 600 ? 16 : 56;
    var k = Math.min((innerWidth - m * 2) / w, (innerHeight - m * 2) / h, 3);
    var fw = w * k, fh = h * k;
    return { left: (innerWidth - fw) / 2, top: (innerHeight - fh) / 2, w: fw };
  }
  function lay() {
    el.style.left = fit.left + "px";
    el.style.top = fit.top + "px";
    el.style.width = fit.w + "px";
  }
  // transform that makes the full-size mockup look like it sits at rect r
  function at(r) {
    return "translate(" + (r.left - fit.left) + "px," + (r.top - fit.top) + "px) scale(" + r.width / fit.w + ")";
  }
  // Move the mockup between the page and the overlay without interrupting its videos
  function move(parent, before) {
    var playing = [].filter.call(el.querySelectorAll("video"), function (v) { return !v.paused; });
    parent.insertBefore(el, before || null);
    playing.forEach(function (v) { if (v.paused) v.play().catch(function () {}); });
  }
  // Start from wherever the mockup is on screen right now (mid-flight included)
  function run(to, dur) {
    var from = "none";
    if (anim) { from = getComputedStyle(el).transform; anim.cancel(); }
    anim = el.animate([{ transform: from }, { transform: to }], { duration: dur, easing: EASE, fill: "forwards" });
    return anim;
  }

  function open(c) {
    if (isOpen) return;
    if (el && card !== c) return;            // another mockup is still flying home
    isOpen = true;
    if (!el) {
      card = c; el = target(c);
      lastFocus = document.activeElement;
      var r = el.getBoundingClientRect();
      ph = document.createElement("div");
      ph.className = el.className + " zoom-ph";
      ph.style.aspectRatio = r.width + " / " + r.height;
      ph.setAttribute("aria-hidden", "true");
      saved = el.getAttribute("style") || "";
      if (c.dataset.view) layer.dataset.view = c.dataset.view; else delete layer.dataset.view;
      fit = fitTo(r.width, r.height);
      sharpen(el);
      el.parentNode.insertBefore(ph, el);
      move(layer);
      el.style.position = "absolute";
      el.style.margin = "0";
      el.style.maxWidth = "none";
      el.style.transformOrigin = "0 0";
      lay();
      document.documentElement.classList.add("zoom-lock");
      zoom.classList.add("is-on");
      if (reduce) {
        anim = el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease" });
      } else {
        anim = el.animate([{ transform: at(r) }, { transform: "none" }], { duration: 560, easing: EASE, fill: "forwards" });
      }
    } else {
      run("none", 480);                      // caught on its way back: turn around
    }
    anim.onfinish = null;
    requestAnimationFrame(function () { zoom.classList.add("is-open"); });
    closeBtn.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    zoom.classList.remove("is-open");
    var a;
    if (reduce) {
      if (anim) anim.cancel();
      a = anim = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease", fill: "forwards" });
    } else {
      a = run(at(ph.getBoundingClientRect()), 440);
    }
    a.onfinish = function () {
      move(ph.parentNode, ph);
      ph.remove();
      el.setAttribute("style", saved);
      if (!saved) el.removeAttribute("style");
      a.cancel();
      zoom.classList.remove("is-on");
      document.documentElement.classList.remove("zoom-lock");
      var f = lastFocus;
      el = card = ph = anim = null;
      if (f && f.focus) f.focus({ preventScroll: true });
    };
  }

  [].forEach.call(cards, function (c) {
    var t = target(c);
    if (!t) return;
    var v = c.querySelector("video");
    t.setAttribute("role", "button");
    t.setAttribute("tabindex", "0");
    t.setAttribute("aria-label", "Enlarge" + (v && v.getAttribute("aria-label") ? ": " + v.getAttribute("aria-label") : ""));
    c.classList.add("is-zoomable");
    c.addEventListener("click", function (e) {
      if (e.target.closest(".seg, .clip__btn")) return;
      open(c);
    });
    t.addEventListener("keydown", function (e) {
      if (isOpen || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      open(c);
    });
  });

  zoom.addEventListener("click", function (e) { e.stopPropagation(); close(); });
  document.addEventListener("keydown", function (e) {
    if (!isOpen) return;
    if (e.key === "Escape" || ((e.key === "Enter" || e.key === " ") && document.activeElement !== closeBtn)) { e.preventDefault(); close(); }
    else if (e.key === "Tab") { e.preventDefault(); closeBtn.focus(); }   // the close button is the only stop
  });
  addEventListener("resize", function () {
    if (!el || !isOpen) return;
    var r = ph.getBoundingClientRect();
    fit = fitTo(r.width, r.height);
    lay();
  });
})();

/* ============================================================
   Side menu: a compact table of contents in the left gutter on wide
   screens. Built from the page's section titles (or, for a section made
   of feature rows, from the feature titles). Highlights the section in
   view, shows "n / N", appears once the hero has scrolled past.
   ============================================================ */
(function () {
  var wrap = document.querySelector(".case-wrap");
  if (!wrap) return;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var targets = [], groups = {};
  var featSections = [].filter.call(wrap.querySelectorAll(".section"), function (s) { return s.querySelector(".feature__title"); });
  [].forEach.call(wrap.querySelectorAll(".section"), function (sec) {
    var feats = sec.querySelectorAll(".feature__title");
    if (feats.length) {
      // several apps on one page: label each group with its section title
      var st = sec.querySelector(".section-title");
      if (featSections.length > 1 && st) groups[targets.length] = st.textContent;
      [].push.apply(targets, feats);
    } else {
      var h = sec.querySelector(".section-title");
      if (h && !h.classList.contains("visually-hidden")) targets.push(h);
    }
  });
  if (targets.length < 2) return;

  function slug(s) { return s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
  var nav = document.createElement("nav");
  nav.className = "toc";
  nav.setAttribute("aria-label", "On this page");
  var count = document.createElement("div");
  count.className = "toc__count";
  count.setAttribute("aria-hidden", "true");
  var list = document.createElement("ol");
  list.className = "toc__list";
  var links = targets.map(function (t, i) {
    if (!t.id) t.id = slug(t.textContent);
    var li = document.createElement("li");
    var a = document.createElement("a");
    a.className = "toc__link";
    a.href = "#" + t.id;
    a.innerHTML = '<span class="toc__num">' + (i + 1) + '</span><span class="toc__label"></span><span class="toc__dash" aria-hidden="true"></span>';
    a.querySelector(".toc__label").textContent = t.textContent;
    a.title = t.textContent;
    a.addEventListener("click", function (e) {
      e.preventDefault();
      // land on the whole row/section (title + its figure), not just the heading
      var block = t.closest(".feature") || t.closest(".section") || t;
      var y = block.getBoundingClientRect().top + scrollY - 48;
      window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
      try { history.replaceState(null, "", "#" + t.id); } catch (e2) {}
      t.setAttribute("tabindex", "-1");
      t.focus({ preventScroll: true });
    });
    li.appendChild(a);
    if (groups[i] != null) {
      var g = document.createElement("li");
      g.className = "toc__group";
      g.setAttribute("aria-hidden", "true");
      g.textContent = groups[i];
      list.appendChild(g);
    }
    list.appendChild(li);
    return a;
  });
  nav.appendChild(count);
  nav.appendChild(list);
  document.body.appendChild(nav);

  var hero = document.querySelector(".case-hero");
  var current = -1, ticking = false;
  function update() {
    ticking = false;
    // shown once the hero has mostly scrolled away
    var heroBottom = hero ? hero.getBoundingClientRect().bottom : 0;
    nav.classList.toggle("is-on", heroBottom < innerHeight * 0.35);
    // active = last section whose block starts above 40% of the viewport
    var line = innerHeight * 0.4, idx = 0;
    targets.forEach(function (t, i) {
      var block = t.closest(".feature") || t.closest(".section") || t;
      if (block.getBoundingClientRect().top <= line) idx = i;
    });
    if (idx !== current) {
      current = idx;
      links.forEach(function (a, i) {
        a.classList.toggle("is-active", i === idx);
        if (i === idx) a.setAttribute("aria-current", "location"); else a.removeAttribute("aria-current");
      });
      count.textContent = (idx + 1) + " / " + targets.length;
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  update();
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
