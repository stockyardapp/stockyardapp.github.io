/* Stockyard marketing site. Progressive enhancement only: without this file
   every section still reads in full. It draws the market line wherever it
   appears (hero, the fork, the classic field, the close), runs the fantasy
   week on its one app surface, and wires the two settings switches. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var narrowMQ = window.matchMedia('(max-width: 960px)');
  var SVGNS = 'http://www.w3.org/2000/svg';
  var MINUS = '−';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function el(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* Run fn once when el first reaches `ratio` visibility. */
  function onView(target, fn, ratio) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } });
    }, { threshold: ratio || 0.35 });
    io.observe(target);
  }

  /* One rAF-throttled scroll pass shared by every scrubbed element. Each
     scrubber only runs while its section is on screen (gated by IO). */
  var scrubbers = [];
  var ticking = false;
  function runScrub() { ticking = false; scrubbers.forEach(function (s) { if (s.live) s.fn(); }); }
  function requestScrub() { if (!ticking) { ticking = true; requestAnimationFrame(runScrub); } }
  function addScrubber(section, fn) {
    var s = { live: false, fn: fn };
    scrubbers.push(s);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { s.live = es[0].isIntersecting; if (s.live) fn(); }, { rootMargin: '10% 0px' }).observe(section);
    } else { s.live = true; }
    fn();
  }
  window.addEventListener('scroll', requestScrub, { passive: true });

  /* ---------- nav ---------- */
  var nav = $('#nav');
  var sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:0;left:0;height:8px;width:1px;pointer-events:none';
  document.body.prepend(sentinel);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { nav.classList.toggle('is-scrolled', !es[0].isIntersecting); }).observe(sentinel);
    var links = $$('.nav-links a');
    var spy = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) {
          if (a.getAttribute('href') === '#' + e.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['fantasy', 'classic', 'solo'].forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
    // the settings section belongs to fantasy in the nav
    new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) links.forEach(function (a) { a.toggleAttribute('aria-current', a.getAttribute('href') === '#fantasy'); });
    }, { rootMargin: '-45% 0px -50% 0px' }).observe($('#rules'));
    var clear = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) links.forEach(function (a) { a.removeAttribute('aria-current'); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['.hero', '.modes', '.app', '.closing'].forEach(function (q) { clear.observe($(q)); });
  }

  /* ---------- the market line ----------
     The climb the app draws on its intro screen
     (apps/mobile/src/components/IntroOverlay.tsx: CURVE, DRAW_MS 1250, an
     ease-out draw, the fill blooming in once the line is ~45% across).
     `data-end` is how far across the box the line runs before it lands. */
  var CURVE = [
    [0, .3], [.06, .26], [.12, .34], [.19, .31], [.26, .42], [.32, .38], [.38, .36],
    [.45, .48], [.52, .44], [.58, .56], [.64, .62], [.7, .55], [.76, .68], [.82, .64],
    [.88, .78], [.94, .86], [1, .94]
  ];
  var DRAW_MS = 1250;
  var lineId = 0;

  function linePoints(w, h, end) {
    var pad = 4;
    return CURVE.map(function (p) { return [p[0] * w * end, pad + (1 - p[1]) * (h - pad * 2)]; });
  }
  function pathOf(pts) {
    return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
  }

  function buildLine(svg) {
    var box = svg.getBoundingClientRect();
    var w = Math.max(1, box.width), h = Math.max(1, box.height);
    var end = Number(narrowMQ.matches ? (svg.dataset.endNarrow || svg.dataset.end) : svg.dataset.end) || 1;
    var pts = linePoints(w, h, end);
    var d = pathOf(pts);
    var last = pts[pts.length - 1];
    var id = svg.dataset.gid || ('ml' + (++lineId));
    svg.dataset.gid = id;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.innerHTML =
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#22C55E" stop-opacity=".22"/>' +
      '<stop offset="1" stop-color="#22C55E" stop-opacity="0"/></linearGradient></defs>' +
      '<path class="ml-area" fill="url(#' + id + ')" d="' + d + ' L' + last[0].toFixed(1) + ',' + h + ' L0,' + h + ' Z"/>' +
      '<path class="ml-stroke" d="' + d + '"/>';
    return { stroke: svg.querySelector('.ml-stroke'), pts: pts, w: w, h: h };
  }

  function drawLine(svg, delay, onLand) {
    var built = buildLine(svg);
    if (reduce || !built.stroke.animate) {
      svg.classList.add('is-drawn'); svg.dataset.drawn = '1';
      if (onLand) onLand();
      return built;
    }
    var len = built.stroke.getTotalLength();
    built.stroke.style.strokeDasharray = len;
    built.stroke.style.strokeDashoffset = len;
    var anim = built.stroke.animate(
      [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
      { duration: DRAW_MS, delay: delay, easing: 'cubic-bezier(.33, 1, .68, 1)', fill: 'forwards' }
    );
    setTimeout(function () { svg.classList.add('is-drawn'); }, delay + DRAW_MS * .45);
    anim.onfinish = function () {
      built.stroke.style.strokeDasharray = ''; built.stroke.style.strokeDashoffset = ''; anim.cancel();
      if (onLand) onLand();
    };
    svg.dataset.drawn = '1';
    return built;
  }

  /* ---------- hero: Mon..Fri, the trophy stands on Friday's close ---------- */
  var hero = $('.hero');
  var heroChart = $('.hero-chart');
  var heroSvg = $('.hero-chart .market-line');

  function placeHero(built) {
    var last = built.pts[built.pts.length - 1];
    heroChart.style.setProperty('--tx', last[0] + 'px');
    var off = heroSvg.getBoundingClientRect().top - heroChart.getBoundingClientRect().top;
    heroChart.style.setProperty('--ty', (off + last[1] + 3) + 'px');
    // Thursday's point carries the matchup tip
    var thu = built.pts[12];
    heroChart.style.setProperty('--px', thu[0] + 'px');
    heroChart.style.setProperty('--py', (off + thu[1]) + 'px');
    var span = last[0];
    var gutter = parseFloat(getComputedStyle($('.hero-copy')).paddingLeft) + $('.hero-copy').getBoundingClientRect().left;
    $$('.axis li', heroChart).forEach(function (li, i) { li.style.left = (gutter + (span - gutter) * i / 4) + 'px'; });
  }
  // Wait for the display face: it sets the hero's height, and so the chart's.
  var fontsReady = document.fonts && document.fonts.ready
    ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 900); })])
    : Promise.resolve();
  fontsReady.then(function () {
    placeHero(drawLine(heroSvg, reduce ? 0 : 150, function () { hero.classList.add('is-landed'); }));
  });

  /* ---------- closing: the line lands on the trophy again ---------- */
  var closing = $('.closing');
  var closeSvg = $('.closing .market-line');
  function placeClose(built) {
    var last = built.pts[built.pts.length - 1];
    var chart = $('.closing-chart');
    chart.style.setProperty('--tx', last[0] + 'px');
    var off = closeSvg.getBoundingClientRect().top - chart.getBoundingClientRect().top;
    chart.style.setProperty('--ty', (off + last[1] + 3) + 'px');
  }
  placeClose(buildLine(closeSvg));
  if (reduce) { closeSvg.classList.add('is-drawn'); closing.classList.add('is-landed'); }
  else onView(closing, function () {
    placeClose(drawLine(closeSvg, 100, function () { closing.classList.add('is-landed'); }));
  }, 0.3);

  /* ---------- the fork: one line, three ways to play ---------- */
  var fork = $('#fork');
  var forkSvg = $('.fork-lines');
  function buildFork() {
    var r = fork.getBoundingClientRect();
    var w = r.width, h = r.height;
    forkSvg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    forkSvg.innerHTML = '';
    var targets = $$('.branch', fork).map(function (b) {
      var t = $('.branch-title', b).getBoundingClientRect();
      return { x: b.getBoundingClientRect().left - r.left, y: t.top - r.top + Math.min(t.height, 40) / 2 };
    });
    var paths = [];
    if (narrowMQ.matches) {
      var x = 8;
      paths.push(el('path', { class: 'trunk', d: 'M' + x + ',0 V' + targets[0].y }));
      targets.forEach(function (t, i) {
        var d = i === 0
          ? 'M' + x + ',' + t.y + ' H' + (t.x + 8)
          : 'M' + x + ',' + targets[0].y + ' V' + (t.y - 12) + ' Q' + x + ',' + t.y + ' ' + (x + 12) + ',' + t.y + ' H' + (t.x + 8);
        paths.push(el('path', { class: 'b' + i, d: d }));
      });
    } else {
      var kx = targets[0].x * .58, ky = targets[0].y, R = 16;
      // the trunk is the intro curve again, climbing into the knot
      var seg = CURVE.map(function (p) { return [p[0] * kx, ky + 46 - p[1] * 46 / .94]; });
      paths.push(el('path', { class: 'trunk', d: pathOf(seg) }));
      // fantasy carries straight on; the other two drop off like a bracket
      var bx = kx + (targets[0].x - kx) * .45;
      targets.forEach(function (t, i) {
        var tx = t.x + 10;
        var d = i === 0
          ? 'M' + kx + ',' + ky + ' H' + tx
          : 'M' + bx + ',' + ky + ' V' + (t.y - R) + ' Q' + bx + ',' + t.y + ' ' + (bx + R) + ',' + t.y + ' H' + tx;
        paths.push(el('path', { class: 'b' + i, d: d }));
      });
      forkSvg.appendChild(el('circle', { class: 'knot', cx: kx, cy: ky, r: 5, stroke: '#22C55E' }));
    }
    paths.forEach(function (p) { forkSvg.insertBefore(p, forkSvg.firstChild); });
    return paths;
  }
  var forkPaths = buildFork();
  if (!reduce) {
    forkPaths.forEach(function (p) { var L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
    onView(fork, function () {
      forkPaths.forEach(function (p, i) {
        var L = p.getTotalLength();
        var a = p.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }],
          { duration: i === 0 ? 700 : 650, delay: i === 0 ? 0 : 600 + (i - 1) * 140, easing: 'cubic-bezier(.33,1,.68,1)', fill: 'forwards' });
        a.onfinish = function () { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; a.cancel(); };
      });
      fork.dataset.drawn = '1';
    }, 0.4);
  }

  /* ---------- the fantasy week ---------- */
  function fmt(v) { return (v < 0 ? MINUS : '') + Math.abs(v).toFixed(2); }

  function runDraft(stage) {
    if (reduce || stage.dataset.drafted) return;
    stage.dataset.drafted = '1';
    var cells = $$('.board span[data-p]', stage).sort(function (a, b) { return a.dataset.p - b.dataset.p; });
    var clock = $('.clock-t', stage);
    stage.classList.add('is-drafting');
    cells.forEach(function (c, i) {
      var isLast = i === cells.length - 1;
      setTimeout(function () {
        if (isLast) stage.classList.add('took');
        setTimeout(function () { c.classList.add('in'); }, isLast ? 260 : 0);
        clock.textContent = '0:' + String(45 - Math.round(i * 7 / (cells.length - 1))).padStart(2, '0');
      }, 180 + i * 170);
    });
  }

  function countUp(stage) {
    if (reduce) return;
    var nums = $$('.l-match [data-to]', stage);
    var t0 = null, dur = 1100;
    nums.forEach(function (n) { n.textContent = fmt(0); });
    function tick(t) {
      if (t0 === null) t0 = t;
      var k = clamp((t - t0 - 250) / dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
      nums.forEach(function (n) { n.textContent = fmt(Number(n.dataset.to) * e); });
      if (k < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function climb(stage) {
    if (reduce) return;
    var moving = $$('.st li[data-from]', stage);
    var rowH = moving[0].getBoundingClientRect().height || 44;
    moving.forEach(function (li) { li.style.transition = 'none'; li.style.transform = 'translateY(' + (li.dataset.from * rowH) + 'px)'; });
    void stage.offsetHeight;
    setTimeout(function () {
      moving.forEach(function (li) { li.style.transition = ''; li.style.transform = ''; });
    }, 650);
  }

  var hooks = [runDraft, null, countUp, climb];
  function setStageStep(stage, i) {
    var prev = Number(stage.dataset.step);
    if (prev === i && stage.dataset.live) return;
    stage.dataset.live = '1';
    stage.dataset.step = String(i);
    if (hooks[i] && (prev !== i || i === 0)) hooks[i](stage);
  }

  var pinStage = $('.fx-pin .stage');
  var rail = $('.rail');
  var railItems = $$('.rail li');
  var fxSteps = $$('.fx-step');

  // Phones: every step gets its own copy of the surface, staged one state
  // early so the change itself plays when it scrolls in.
  fxSteps.forEach(function (step, i) {
    var wrap = document.createElement('div');
    wrap.className = 'step-stage';
    wrap.setAttribute('aria-hidden', 'true');
    var copy = pinStage.cloneNode(true);
    copy.dataset.step = String(i === 2 ? 1 : i);
    wrap.appendChild(copy);
    step.appendChild(wrap);
    onView(wrap, function () { delete copy.dataset.live; setStageStep(copy, i); }, 0.5);
  });

  var active = -1;
  function activate(i) {
    if (i === active) return;
    active = i;
    fxSteps.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
    railItems.forEach(function (r, k) { r.classList.toggle('on', k <= i); });
    setStageStep(pinStage, i);
  }
  if ('IntersectionObserver' in window) {
    var stepIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) activate(Number(e.target.dataset.step)); });
    }, { rootMargin: '-48% 0px -48% 0px' });
    fxSteps.forEach(function (s) { stepIO.observe(s); });
  }
  activate(0);

  addScrubber($('#fantasy'), function () {
    if (narrowMQ.matches) return;
    var vh = window.innerHeight;
    var a = fxSteps[0].getBoundingClientRect(), b = fxSteps[fxSteps.length - 1].getBoundingClientRect();
    var c0 = a.top + a.height / 2, c1 = b.top + b.height / 2;
    var p = clamp((vh / 2 - c0) / (c1 - c0), 0, 1);
    rail.style.setProperty('--rp', p.toFixed(3));
  });

  /* ---------- settings: two switches, one roster ---------- */
  var roster = $('.roster');
  function Switch(ctl, key) {
    var seg = $('.seg', ctl);
    var buttons = $$('button', seg);
    var touched = false;
    function select(i, fromUser) {
      if (fromUser) touched = true;
      var value = buttons[i].dataset.value;
      seg.dataset.index = i;
      buttons.forEach(function (b, k) { b.setAttribute('aria-checked', String(k === i)); b.tabIndex = k === i ? 0 : -1; });
      $$('.ctl-copy', ctl).forEach(function (p) { p.hidden = p.dataset.for !== value; });
      roster.dataset[key] = value;
      $$('[data-' + value + ']', roster).forEach(function (n) {
        var next = n.getAttribute('data-' + value);
        if (n.textContent === next) return;
        if (reduce) { n.textContent = next; return; }
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
    return { select: select, touched: function () { return touched; } };
  }
  var draftSw = Switch($('[data-ctl="draft"]'), 'draft');
  var moneySw = Switch($('[data-ctl="money"]'), 'money');
  // Show each switch working once, unprompted, then hand it over.
  if (!reduce) onView(roster, function () {
    setTimeout(function () { if (!draftSw.touched()) draftSw.select(1, false); }, 900);
    setTimeout(function () { if (!moneySw.touched()) moneySw.select(1, false); }, 2300);
  }, 0.5);

  /* ---------- classic: everyone leaves $100,000 together ---------- */
  var field = $('#field');
  var fieldSvg = $('.field-svg');
  // Final returns match the showcase league's real standings screenshot.
  var RUNNERS = [
    { name: 'samrivera', v: 14.19, cls: 'lead', seed: 3 },
    { name: 'jordanmw', v: 11.12, cls: 'second', seed: 7 },
    { name: 'priyar', v: 5.14, seed: 11 },
    { name: 'lucasbr', v: 4.89, seed: 17 },
    { name: 'devkapoor', v: 3.99, seed: 23 },
    { name: 'ameliao', v: -5.9, cls: 'loss', seed: 29 }
  ];
  var runnerPaths = [];
  function walk(r, t) {
    var amp = 2.6 * Math.sqrt(t) * (1 - Math.pow(t, 6));
    var n = Math.sin(t * (9 + r.seed % 5) + r.seed) * .6 + Math.sin(t * (23 + r.seed % 7) + r.seed * 1.7) * .4 +
      Math.sin(t * (97 + r.seed) + r.seed * 2.3) * .16 + Math.sin(t * (151 + r.seed * 3)) * .1;
    return r.v * (t * .35 + .65 * t * t) + n * amp;
  }
  function buildField() {
    var box = field.getBoundingClientRect();
    var w = box.width, h = box.height;
    var head = $('.classic-head').getBoundingClientRect();
    var narrow = narrowMQ.matches;
    var x0 = head.left - box.left + parseFloat(getComputedStyle($('.classic-head')).paddingLeft);
    var tagW = narrow ? 104 : 170;
    var x1 = w - x0 - tagW + (narrow ? 8 : 0);
    var lo = -8, hi = 16;
    function Y(v) { return 18 + (hi - v) / (hi - lo) * (h - 36); }
    fieldSvg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    fieldSvg.innerHTML = '';
    var grid = el('g', { class: 'grid' });
    [-5, 0, 5, 10, 15].forEach(function (v) {
      grid.appendChild(el('line', { x1: x0, x2: w - (narrow ? 16 : x0 * .5), y1: Y(v), y2: Y(v) }));
      if (!narrow || v === 0) {
        var t = el('text', { x: narrow ? x0 : x0 - 12, y: Y(v) + (narrow ? 34 : 4), 'text-anchor': narrow ? 'start' : 'end' });
        t.textContent = v === 0 ? '$100,000' : (v > 0 ? '+' : MINUS) + Math.abs(v) + '%';
        grid.appendChild(t);
      }
    });
    fieldSvg.appendChild(grid);
    runnerPaths = [];
    var ends = [];
    RUNNERS.slice().reverse().forEach(function (r) {
      var N = 120, pts = [];
      for (var i = 0; i <= N; i++) { var t = i / N; pts.push([x0 + (x1 - x0) * t, Y(walk(r, t))]); }
      var p = el('path', { class: 'runner ' + (r.cls || ''), d: pathOf(pts), pathLength: 1 });
      fieldSvg.appendChild(p);
      runnerPaths.push(p);
      ends.push({ r: r, y: Y(r.v) });
    });
    // tags at the finish, nudged apart so close finishes stay legible
    ends.sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 20) ends[k].y = ends[k - 1].y + 20;
    ends.forEach(function (e) {
      if (narrow && !e.r.cls) return;
      var t = el('text', { class: 'tag ' + (e.r.cls || ''), x: x1 + 12, y: e.y + 5 });
      var v = (e.r.v >= 0 ? '+' : MINUS) + Math.abs(e.r.v).toFixed(2) + '%';
      t.innerHTML = (narrow ? '' : e.r.name + ' ') + '<tspan class="v ' + (e.r.v >= 0 ? 'up' : 'dn') + '" fill="' + (e.r.v >= 0 ? '#22C55E' : '#EF4444') + '">' + v + '</tspan>';
      fieldSvg.appendChild(t);
    });
    fieldSvg.appendChild(el('circle', { class: 'origin', cx: x0, cy: Y(0), r: 5 }));
    scrubField();
  }
  function scrubField() {
    var p = 1;
    if (!reduce) {
      var r = field.getBoundingClientRect(), vh = window.innerHeight;
      p = clamp((vh * .95 - r.top) / (r.height + vh * .1), 0, 1);
      p = 1 - Math.pow(1 - p, 2);
    }
    runnerPaths.forEach(function (path) { path.style.strokeDasharray = '1 1'; path.style.strokeDashoffset = String(1 - p); });
    field.classList.toggle('is-done', p > .97);
  }
  buildField();
  addScrubber($('#classic'), scrubField);

  /* ---------- solo: example balance ---------- */
  var bal = $('#bal');
  var chips = $$('.chips button');
  chips.forEach(function (b, i) {
    b.addEventListener('click', function () {
      chips.forEach(function (c) { c.setAttribute('aria-checked', String(c === b)); c.tabIndex = c === b ? 0 : -1; });
      bal.textContent = b.dataset.bal;
    });
    b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1;
    b.addEventListener('keydown', function (e) {
      var j = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % chips.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + chips.length) % chips.length;
      if (j === null) return;
      e.preventDefault(); chips[j].click(); chips[j].focus();
    });
  });

  /* ---------- the app gallery opens as it arrives ---------- */
  var gallery = $('#gallery');
  if (!reduce) addScrubber(gallery, function () {
    var r = gallery.getBoundingClientRect(), vh = window.innerHeight;
    var p = clamp((vh - r.top) / (vh * .75), 0, 1);
    gallery.style.setProperty('--p', (1 - Math.pow(1 - p, 3)).toFixed(3));
  });

  /* ---------- rebuild geometry on resize; never re-animate ---------- */
  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      placeHero(buildLine(heroSvg)); heroSvg.classList.add('is-drawn');
      if (closeSvg.dataset.drawn || reduce) { placeClose(buildLine(closeSvg)); closeSvg.classList.add('is-drawn'); }
      else placeClose(buildLine(closeSvg));
      buildFork(); buildField();
    }, 150);
  });
  // fonts change text metrics the fork measures
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () {
    if (!fork.dataset.drawn) forkPaths = buildFork().map(function (p) {
      if (!reduce) { var L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; }
      return p;
    });
    else buildFork();
    buildField();
  });
})();
