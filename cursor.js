/* ============================================================
   Pointer layer, loaded on every page (styles in cursor.css).
   - Email links: hover names the address, a click copies it (⌘/⌥-click still opens Mail).
   - Project cards: right-click opens a context menu (Open, New Tab, Copy Link, Share).
   - Case pages: the screen edges reveal Back to the feed and the next project; Esc goes back.
   Pointer devices only: on touch screens links and long-press stay native.
   ============================================================ */
(function () {
  var fine = matchMedia("(hover: hover) and (pointer: fine)");
  var CHECK = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2.5 7.5 3 3 6-7"/></svg>';

  // Screen-reader echo for silent actions (a copy has no visible page change)
  var live = document.createElement("div");
  live.className = "visually-hidden";
  live.setAttribute("aria-live", "polite");
  document.body.appendChild(live);
  function announce(t) { live.textContent = ""; setTimeout(function () { live.textContent = t; }, 30); }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, fail) {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta); ta.select();
      var done = false; try { done = document.execCommand("copy"); } catch (e) {}
      ta.remove(); done ? ok() : fail();
    });
  }

  // ---- Capsule: one floating label, placed against a rect or a point ----
  var cap = document.createElement("div");
  cap.className = "cx-cap";
  cap.setAttribute("aria-hidden", "true");
  document.body.appendChild(cap);
  var capOwner = null;
  // side: "above" (centred over r), "right"/"left" (beside r, vertically centred)
  function showCap(owner, html, r, side) {
    capOwner = owner;
    if (html != null) cap.innerHTML = html;
    var w = cap.offsetWidth, h = cap.offsetHeight, vw = document.documentElement.clientWidth, x, y;
    if (side === "right") { x = r.right + 10; y = r.top + r.height / 2 - h / 2; }
    else if (side === "left") { x = r.left - 10 - w; y = r.top + r.height / 2 - h / 2; }
    else {
      x = r.left + r.width / 2 - w / 2; y = r.top - h - 10;
      if (y < 8) y = r.bottom + 10;                       // no room above: below
    }
    cap.style.left = Math.round(Math.max(8, Math.min(vw - w - 8, x))) + "px";
    cap.style.top = Math.round(Math.max(8, y)) + "px";
    cap.classList.add("is-on");
  }
  function hideCap(owner) { if (owner && owner !== capOwner) return; capOwner = null; cap.classList.remove("is-on"); }
  addEventListener("scroll", function () { if (capOwner && capOwner.scrollHides) hideCap(); }, { passive: true });

  /* ---------- Email links: name the address, copy on click ---------- */
  [].forEach.call(document.querySelectorAll('a[href^="mailto:"]'), function (a) {
    var addr = decodeURIComponent(a.getAttribute("href").slice(7).split("?")[0]);
    var owner = { scrollHides: true }, hovering = false, resetT = 0;
    var idle = '<span>' + addr + '</span><span class="cx-div"></span><span class="cx-mute">Click to copy</span>';
    function show() { if (fine.matches) showCap(owner, idle, a.getBoundingClientRect(), "above"); }
    a.addEventListener("pointerenter", function (e) { if (e.pointerType !== "mouse") return; hovering = true; clearTimeout(resetT); show(); });
    a.addEventListener("pointerleave", function () { hovering = false; clearTimeout(resetT); hideCap(owner); });
    a.addEventListener("focus", function () { if (a.matches(":focus-visible")) show(); });
    a.addEventListener("blur", function () { if (!hovering) hideCap(owner); });
    a.addEventListener("click", function (e) {
      if (!fine.matches || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;  // modified click: open Mail
      e.preventDefault();
      copyText(addr).then(function () {
        showCap(owner, CHECK + "<span>Email copied</span>", a.getBoundingClientRect(), "above");
        announce("Email address copied: " + addr);
        clearTimeout(resetT);
        resetT = setTimeout(function () { if (hovering || document.activeElement === a) show(); else hideCap(owner); }, 1600);
      }, function () { location.href = a.href; });           // no clipboard: fall back to Mail
    });
  });

  /* ---------- External links: where they lead, and that they open a new tab ----------
     The capsule names the destination (host + path, like the email capsule names
     the address); while it shows, ⌘C copies the link instead of opening it. */
  var OUT = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 7.5l5-5M3.5 2.5h4v4"/></svg>';
  var hovered = null;                                        // { a, owner, show } of the link under the pointer / focus
  function esc(t) { return t.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  [].forEach.call(document.querySelectorAll('a[target="_blank"][href^="http"]'), function (a) {
    var u; try { u = new URL(a.href); } catch (e) { return; }
    var path = u.pathname.replace(/\/$/, "").replace(/-(?=[a-z0-9]*\d)[a-z0-9]{6,}$/i, "");   // drop LinkedIn's id suffix
    var where = u.hostname.replace(/^www\./, "") + path;
    var owner = { scrollHides: true }, hovering = false, resetT = 0;
    var idle = "<span>" + esc(where) + '</span><span class="cx-div"></span><span class="cx-mute">New tab</span>' + OUT +
      '<span class="cx-key">⌘C</span>';
    var me = { a: a, owner: owner, show: show };
    function show() { if (fine.matches) showCap(owner, idle, a.getBoundingClientRect(), "above"); }
    a.addEventListener("pointerenter", function (e) { if (e.pointerType !== "mouse") return; hovering = true; hovered = me; clearTimeout(resetT); show(); });
    a.addEventListener("pointerleave", function () { hovering = false; if (hovered === me && document.activeElement !== a) hovered = null; clearTimeout(resetT); hideCap(owner); });
    a.addEventListener("focus", function () { if (a.matches(":focus-visible")) { hovered = me; show(); } });
    a.addEventListener("blur", function () { if (!hovering) { if (hovered === me) hovered = null; hideCap(owner); } });
    me.copied = function () {
      showCap(owner, CHECK + "<span>Link copied</span>", a.getBoundingClientRect(), "above");
      announce("Link copied");
      clearTimeout(resetT);
      resetT = setTimeout(function () { if (hovering || document.activeElement === a) show(); else hideCap(owner); }, 1400);
    };
  });
  document.addEventListener("keydown", function (e) {
    if (!hovered || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "c" || String(getSelection())) return;
    e.preventDefault();
    var h = hovered;
    copyText(h.a.href).then(h.copied, function () {});
  });

  /* ---------- Appearance toggle: a help tag, macOS style (after a short rest) ---------- */
  var tog = document.querySelector(".theme-toggle");
  if (tog) {
    var tOwner = { scrollHides: true }, tWait = 0, tOn = false;
    var tShow = function () {
      var dark = document.documentElement.dataset.theme === "dark";
      showCap(tOwner, "<span>" + (dark ? "Light mode" : "Dark mode") + "</span>", tog.getBoundingClientRect(), "left");
    };
    tog.addEventListener("pointerenter", function (e) { if (e.pointerType !== "mouse") return; tOn = true; clearTimeout(tWait); tWait = setTimeout(tShow, 500); });
    tog.addEventListener("pointerleave", function () { tOn = false; clearTimeout(tWait); hideCap(tOwner); });
    tog.addEventListener("click", function () { if (tOn) setTimeout(tShow, 0); });    // name the next switch
  }

  /* ---------- Context menu on project cards ---------- */
  var ICON = {
    open: '<path d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V10M9 2h5v5M14 2 7.5 8.5"/>',
    tab: '<rect x="1.5" y="3" width="13" height="10.5" rx="2"/><path d="M1.5 6.5h13M5.5 3v3.5"/>',
    link: '<path d="M6.8 9.2a3 3 0 0 0 4.3 0l2.2-2.2a3 3 0 0 0-4.3-4.3l-.8.8M9.2 6.8a3 3 0 0 0-4.3 0L2.7 9a3 3 0 0 0 4.3 4.3l.8-.8"/>',
    share: '<path d="M8 10V1.5M5 4.5l3-3 3 3M5.5 6.5h-2v8h9v-8h-2"/>'
  };
  function icon(k) { return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + "</svg>"; }

  var menu = document.createElement("div");
  menu.className = "cx-menu";
  menu.setAttribute("role", "menu");
  menu.tabIndex = -1;
  document.body.appendChild(menu);
  var menuFor = null;

  function item(k, label, run) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "cx-item"; b.tabIndex = -1;
    b.setAttribute("role", "menuitem");
    b.innerHTML = icon(k) + "<span>" + label + "</span>";
    b.addEventListener("click", function () { var a = menuFor; closeMenu(false); run(a); });
    b.addEventListener("pointerenter", function () { b.focus({ preventScroll: true }); });
    return b;
  }
  function nameOf(a) { var n = a.querySelector(".project__name, .pmore__name"); return n ? n.textContent.trim() : document.title; }

  function openMenu(a, x, y, byKeyboard) {
    menuFor = a;
    menu.setAttribute("aria-label", nameOf(a));
    menu.innerHTML = "";
    menu.appendChild(item("open", "Open", function (t) { t.click(); }));
    menu.appendChild(item("tab", "Open in New Tab", function (t) { window.open(t.href, "_blank", "noopener"); }));
    menu.appendChild(document.createElement("hr"));
    menu.appendChild(item("link", "Copy Link", function (t) {
      copyText(t.href).then(function () {
        var p = { left: x, right: x, top: y, bottom: y, width: 0, height: 0 };
        var owner = { scrollHides: true };
        showCap(owner, CHECK + "<span>Link copied</span>", p, "above");
        announce("Link copied");
        setTimeout(function () { hideCap(owner); }, 1400);
      });
    }));
    if (navigator.share) menu.appendChild(item("share", "Share…", function (t) { navigator.share({ title: nameOf(t), url: t.href }).catch(function () {}); }));

    var vw = document.documentElement.clientWidth, vh = innerHeight;
    var w = menu.offsetWidth, h = menu.offsetHeight;
    var left = x + w > vw - 8 ? x - w : x, top = y + h > vh - 8 ? y - h : y;
    menu.style.left = Math.max(8, left) + "px";
    menu.style.top = Math.max(8, top) + "px";
    menu.style.transformOrigin = (left < x ? "100%" : "0") + " " + (top < y ? "100%" : "0");
    hideCap();
    menu.classList.add("is-on");
    // keyboard: first item focused; pointer: the menu itself, so ↑ ↓ still work
    (byKeyboard ? menu.querySelector(".cx-item") : menu).focus({ preventScroll: true });
  }
  function closeMenu(restore) {
    if (!menuFor) return;
    var a = menuFor; menuFor = null;
    menu.classList.remove("is-on");
    if (restore) a.focus({ preventScroll: true });
  }

  document.addEventListener("contextmenu", function (e) {
    if (e.shiftKey) return;                                   // ⇧-right-click: the browser's own menu
    var a = e.target.closest && e.target.closest("a.project[href], a.pmore__row[href]");
    if (!a) { closeMenu(false); return; }
    e.preventDefault();
    var kb = e.button !== 2 && e.clientX === 0 && e.clientY === 0;   // context-menu key / ⇧F10
    if (kb) { var r = a.getBoundingClientRect(); openMenu(a, r.left + 24, Math.max(24, r.top + 24), true); }
    else openMenu(a, e.clientX, e.clientY, false);
  });
  document.addEventListener("pointerdown", function (e) { if (menuFor && !menu.contains(e.target)) closeMenu(false); }, true);
  addEventListener("scroll", function () { closeMenu(false); }, { passive: true });
  addEventListener("resize", function () { closeMenu(false); });
  addEventListener("blur", function () { closeMenu(false); });
  menu.addEventListener("keydown", function (e) {
    var items = [].slice.call(menu.querySelectorAll(".cx-item")), i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      var n = e.key === "ArrowDown" ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
      items[n].focus({ preventScroll: true });
    } else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
    else if (e.key === "Tab") { e.preventDefault(); closeMenu(true); }
  });

  /* ---------- Case pages: edges and Esc ---------- */
  var back = document.querySelector(".case-back");
  if (!back) return;
  var next = document.querySelector(".pmore__row");   // the next project leads the list

  function overlayOpen() {
    if (document.querySelector(".lightbox.open") || document.fullscreenElement) return true;
    var z = document.querySelector(".zoom");
    return !!(z && getComputedStyle(z).display !== "none");
  }
  function goBack() { (document.querySelector(".case-back--float") || back).click(); }

  // Esc leaves the page — but only when nothing else on the page would take it.
  // Capture phase, so an open lightbox/zoom is still seen as open here.
  addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (menuFor || overlayOpen()) return;
    var t = document.activeElement;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    goBack();
  }, true);

  function chevron(d) { return '<svg viewBox="0 0 12 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; }
  function tab(side, d, run) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "cx-edge cx-edge--" + side; b.tabIndex = -1;
    b.setAttribute("aria-hidden", "true");                  // keyboard has the Back link, Esc and the Next card
    b.innerHTML = chevron(d);
    b.addEventListener("click", run);
    document.body.appendChild(b);
    return b;
  }
  var L = tab("l", "M10 2 2 10l8 8", goBack);
  var R = next && tab("r", "M2 2l8 8-8 8", function () { next.click(); });
  var nextName = next ? nameOf(next) : "";
  var nextImg = next && next.querySelector("img");
  var ownL = {}, ownR = {}, side = null, py = 0, raf = 0;

  var ZONE = 28, KEEP = 72;                                // reveal within 28px of the edge, keep within 72px
  function setSide(s) {
    if (s === side) { if (s) place(); return; }
    side = s;
    L.classList.toggle("is-on", s === "l");
    if (R) R.classList.toggle("is-on", s === "r");
    if (!s) { hideCap(ownL); hideCap(ownR); return; }
    place();
  }
  function place() {
    var y = Math.max(96, Math.min(innerHeight - 112, py - 44));
    var t = side === "l" ? L : R;
    t.style.setProperty("--y", y + "px");
    var vw = document.documentElement.clientWidth;
    var r = side === "l"
      ? { left: 10, right: 50, top: y, bottom: y + 88, width: 40, height: 88 }
      : { left: vw - 50, right: vw - 10, top: y, bottom: y + 88, width: 40, height: 88 };
    if (side === "l") showCap(ownL, '<span>Feed</span><span class="cx-div"></span><span class="cx-key">Esc</span>', r, "right");
    else showCap(ownR, (nextImg && nextImg.currentSrc ? '<img class="cx-thumb" alt="" src="' + nextImg.currentSrc + '">' : "") + '<span class="cx-mute">Next</span><span>' + nextName + "</span>", r, "left");
  }
  function onMove(e) {
    py = e.clientY;
    var x = e.clientX, vw = document.documentElement.clientWidth;
    if (raf) return;
    raf = requestAnimationFrame(function () {
      raf = 0;
      if (!fine.matches || innerWidth < 1024 || menuFor || overlayOpen() || (capOwner && capOwner !== ownL && capOwner !== ownR)) { setSide(null); return; }
      var s = null;
      if (x <= (side === "l" ? KEEP : ZONE)) s = "l";
      else if (R && x >= vw - (side === "r" ? KEEP : ZONE)) s = "r";
      setSide(s);
    });
  }
  document.addEventListener("pointermove", function (e) { if (e.pointerType === "mouse") onMove(e); }, { passive: true });
  document.documentElement.addEventListener("mouseleave", function () { setSide(null); });
  addEventListener("blur", function () { setSide(null); });
})();
