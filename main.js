/* Stockyard marketing site — progressive enhancement only.
   Without this file every section still reads in full; it adds the market-line
   draw, the fantasy story's screen changes, the settings toggles and the
   product stage's depth. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  /* Run fn once, the first time el's top passes `at` (a fraction of the
     viewport from the top). Scroll-driven rather than IntersectionObserver so it
     behaves the same in every embedding. */
  var pending = [];
  function onceInView(el, at, fn) { pending.push({ el: el, at: at, fn: fn }); checkPending(); }
  function checkPending() {
    var vh = window.innerHeight;
    pending = pending.filter(function (p) {
      if (p.el.getBoundingClientRect().top < vh * p.at) { p.fn(); return false; }
      return true;
    });
  }
  window.addEventListener('scroll', function () { if (pending.length) checkPending(); }, { passive: true });

  /* ---------- nav: hairline + blur once you leave the top ---------- */
  var nav = document.getElementById('nav');
  function onScrollNav() { nav.classList.toggle('is-scrolled', window.scrollY > 8); }
  onScrollNav();
  window.addEventListener('scroll', onScrollNav, { passive: true });

  /* ---------- the market line ----------
     The same climb the app draws on its intro screen
     (apps/mobile/src/components/IntroOverlay.tsx: CURVE, DRAW_MS 1250,
     ease-out cubic, the fill blooming in once the line is ~45% across). */
  var CURVE = [
    [0, .3], [.06, .26], [.12, .34], [.19, .31], [.26, .42], [.32, .38], [.38, .36],
    [.45, .48], [.52, .44], [.58, .56], [.64, .62], [.7, .55], [.76, .68], [.82, .64],
    [.88, .78], [.94, .86], [1, .94]
  ];
  var DRAW_MS = 1250;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var lineId = 0;

  function buildLine(svg) {
    var box = svg.getBoundingClientRect();
    var w = Math.max(1, box.width), h = Math.max(1, box.height);
    var pad = 3; // keep the round cap inside the box
    var pts = CURVE.map(function (p) { return [p[0] * w, pad + (1 - p[1]) * (h - pad * 2)]; });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var id = svg.dataset.gid || ('ml' + (++lineId));
    svg.dataset.gid = id;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.innerHTML =
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#22C55E" stop-opacity=".26"/>' +
      '<stop offset="1" stop-color="#22C55E" stop-opacity="0"/></linearGradient></defs>' +
      '<path class="ml-area" fill="url(#' + id + ')" d="' + d + ' L' + w + ',' + h + ' L0,' + h + ' Z"/>' +
      '<path class="ml-stroke" d="' + d + '"/>';
    return svg.querySelector('.ml-stroke');
  }

  function drawLine(svg, delay) {
    var stroke = buildLine(svg);
    if (reduce || !stroke.animate) { svg.classList.add('is-drawn'); return; }
    var len = stroke.getTotalLength();
    stroke.style.strokeDasharray = len;
    stroke.style.strokeDashoffset = len;
    var anim = stroke.animate(
      [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
      { duration: DRAW_MS, delay: delay, easing: 'cubic-bezier(.33, 1, .68, 1)', fill: 'forwards' }
    );
    setTimeout(function () { svg.classList.add('is-drawn'); }, delay + DRAW_MS * .45);
    anim.onfinish = function () { stroke.style.strokeDasharray = ''; stroke.style.strokeDashoffset = ''; anim.cancel(); };
    svg.dataset.drawn = '1';
  }

  var lines = Array.prototype.slice.call(document.querySelectorAll('.market-line'));
  lines.forEach(function (svg) {
    if (svg.hasAttribute('data-on-view') && !reduce) {
      onceInView(svg.parentNode, .8, function () { drawLine(svg, 100); });
    } else {
      drawLine(svg, Number(svg.dataset.delay || 0));
    }
  });

  // Rebuild at the new size once drawn; never re-animate on resize.
  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT);
    resizeT = setTimeout(function () {
      lines.forEach(function (svg) {
        if (!svg.dataset.drawn && !reduce && svg.hasAttribute('data-on-view')) return;
        buildLine(svg); svg.classList.add('is-drawn');
      });
    }, 150);
  });

  /* ---------- hero entrance ---------- */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { document.querySelector('.hero').classList.add('is-ready'); });
  });

  /* ---------- fantasy story + nav state: one rAF-throttled scroll handler ----------
     The step whose top has passed the trigger line is the active one. The line
     sits mid-screen on desktop and below the pinned phone on mobile. */
  var steps = Array.prototype.slice.call(document.querySelectorAll('.step'));
  var screens = Array.prototype.slice.call(document.querySelectorAll('.ui[data-screen]'));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
  var sections = ['fantasy', 'classic', 'solo'].map(function (id) { return document.getElementById(id); });
  var narrow = window.matchMedia('(max-width: 860px)');
  var current = -1;

  function setStep(i) {
    if (i === current) return;
    current = i;
    steps.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
    screens.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
  }

  // Phones: give every step its own copy of its screen (hidden on desktop).
  steps.forEach(function (s, k) {
    var src = screens[k]; if (!src) return;
    var card = document.createElement('div');
    card.className = 'step-shot'; card.setAttribute('aria-hidden', 'true');
    var ui = src.cloneNode(true);
    ui.classList.remove('is-active'); ui.removeAttribute('data-screen');
    card.appendChild(ui); s.appendChild(card);
  });

  var scheduled = false;
  function measure() {
    scheduled = false;
    var vh = window.innerHeight;
    if (steps.length) {
      var line = vh * .55;
      var active = 0;
      steps.forEach(function (s, k) { if (s.getBoundingClientRect().top < line) active = k; });
      setStep(active);
    }
    var mid = vh * .4, on = null;
    sections.forEach(function (sec) {
      if (!sec) return;
      var r = sec.getBoundingClientRect();
      if (r.top < mid && r.bottom > mid) on = '#' + sec.id;
    });
    navLinks.forEach(function (a) {
      if (a.getAttribute('href') === on) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(measure); } }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  measure();

  /* ---------- settings toggles (radio groups) ---------- */
  function Rule(el) {
    var seg = el.querySelector('.seg');
    var buttons = Array.prototype.slice.call(seg.querySelectorAll('button'));
    var touched = false;

    function select(i, fromUser) {
      if (fromUser) touched = true;
      var value = buttons[i].dataset.value;
      seg.dataset.index = i;
      el.dataset.state = value;
      buttons.forEach(function (b, k) {
        b.setAttribute('aria-checked', String(k === i));
        b.tabIndex = k === i ? 0 : -1;
      });
      el.querySelectorAll('.rule-copy').forEach(function (p) { p.hidden = p.dataset.for !== value; });
      // swap any element carrying a per-state value
      el.querySelectorAll('[data-' + value + ']').forEach(function (n) {
        var next = n.getAttribute('data-' + value);
        if (n.textContent === next) return;
        if (reduce || n.tagName !== 'B') { n.textContent = next; return; }
        n.classList.add('swap');
        setTimeout(function () { n.textContent = next; n.classList.remove('swap'); }, 160);
      });
    }

    buttons.forEach(function (b, i) {
      b.addEventListener('click', function () { select(i, true); });
      b.addEventListener('keydown', function (e) {
        var k = e.key, n = buttons.length, j = null;
        if (k === 'ArrowRight' || k === 'ArrowDown') j = (i + 1) % n;
        if (k === 'ArrowLeft' || k === 'ArrowUp') j = (i - 1 + n) % n;
        if (j === null) return;
        e.preventDefault(); select(j, true); buttons[j].focus();
      });
    });
    select(0, false);

    // Show the difference once, unprompted, then hand it over.
    if (!reduce) {
      onceInView(el, .55, function () {
        setTimeout(function () { if (!touched) select(1, false); }, 1300);
        setTimeout(function () { if (!touched) select(0, false); }, 3900);
      });
    }
  }
  document.querySelectorAll('.rule').forEach(function (el) { new Rule(el); });

  /* ---------- classic: the field fans out once ---------- */
  var fan = document.querySelector('.fan');
  if (fan) {
    if (!reduce) onceInView(fan, .7, function () { fan.classList.add('is-in'); });
    else fan.classList.add('is-in');
  }

  /* ---------- product stage: the side screens open out as you arrive ---------- */
  var stage = document.getElementById('stage');
  if (stage && !reduce) {
    var ticking = false;
    var update = function () {
      ticking = false;
      var r = stage.getBoundingClientRect(), vh = window.innerHeight;
      // 0 when the stage's top enters at the bottom, 1 once it reaches ~30% from the top
      var p = (vh - r.top) / (vh * .7);
      p = Math.min(1, Math.max(0, p));
      p = 1 - Math.pow(1 - p, 3);
      stage.style.setProperty('--p', p.toFixed(3));
    };
    var onScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }
})();
