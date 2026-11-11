/* Stage layout (Ornikar): the step player and the highlighter. */
(function () {
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Step player: plays on its own while it's on screen; a tap on a step hands control to the visitor.
  var fig = document.getElementById("player");
  if (fig) {
    var scenes = [].slice.call(fig.querySelectorAll(".scene"));
    var seg = fig.querySelector(".stp");
    var tabs = [].slice.call(seg.querySelectorAll("button"));
    var cap = fig.querySelector("figcaption");
    var DUR = 3600, i = 0, timer = null, paused = reduce, visible = false;
    seg.style.setProperty("--dur", DUR + "ms");
    var go = function (n) {
      i = n;
      seg.style.setProperty("--i", n);
      scenes.forEach(function (s, k) { s.classList.toggle("on", k === n); s.setAttribute("aria-hidden", k !== n); });
      tabs.forEach(function (t, k) { t.classList.toggle("on", k === n); t.setAttribute("aria-selected", k === n); t.tabIndex = k === n ? 0 : -1; });
      cap.textContent = scenes[n].dataset.cap;
      restartFill();
    };
    var restartFill = function () { seg.classList.remove("playing"); if (timer) { void seg.offsetWidth; seg.classList.add("playing"); } };
    var play = function () { clearInterval(timer); timer = setInterval(function () { go((i + 1) % scenes.length); }, DUR); restartFill(); };
    var stop = function () { clearInterval(timer); timer = null; seg.classList.remove("playing"); };
    tabs.forEach(function (t, k) {
      t.addEventListener("click", function () { paused = true; stop(); go(k); });
      t.addEventListener("keydown", function (e) {           // arrow keys move between tabs, like a native tab list
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault(); paused = true; stop();
        var n = (i + d + tabs.length) % tabs.length; go(n); tabs[n].focus();
      });
    });
    go(0);
    if (!reduce) new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible && !paused) play(); else stop();
    }, { threshold: 0.6 }).observe(fig);
  }

  // Highlighter: drawn left to right the first time it comes into view
  if (!reduce) [].forEach.call(document.querySelectorAll(".mark"), function (m) {
    m.classList.add("is-waiting");
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { m.classList.remove("is-waiting"); io.disconnect(); }
    }, { threshold: 1 });
    io.observe(m);
  });
})();
