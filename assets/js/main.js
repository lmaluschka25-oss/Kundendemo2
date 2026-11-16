/* Arin's Kebap & Pizza Haus – Interaktionen (ohne Frameworks, ohne Tracking, ohne Cookies) */
(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIO = 'IntersectionObserver' in window;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const euro = (n) => `${n.toFixed(2).replace('.', ',')} €`;

  const DATA = (() => {
    try { return JSON.parse($('#arins-daten').textContent); } catch { return {}; }
  })();

  /* ---------- Hinweis-Toast (zugleich Live-Region für Screenreader) ---------- */
  const toastEl = $('[data-toast]');
  let toastTimer = 0;
  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2600);
  };

  /* ---------- Öffnungszeiten (Minuten seit Mitternacht, 0 = Sonntag) ---------- */
  const HOURS = DATA.zeiten || {};
  const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const fmt = (m) => {
    const v = ((m % 1440) + 1440) % 1440;
    return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
  };
  const intervals = (d) => HOURS[d] || [];

  const berlinNow = () => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t).value;
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { day, min: (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10) };
  };

  const getStatus = () => {
    const { day, min } = berlinNow();
    const today = intervals(day);
    for (const [, b] of intervals((day + 6) % 7)) {
      if (b > 1440 && min < b - 1440) return { open: true, day, min, today, closes: b - 1440, left: b - 1440 - min };
    }
    for (const [a, b] of today) {
      if (min >= a && min < b) return { open: true, day, min, today, closes: b, left: b - min };
    }
    const later = today.find(([a]) => a > min);
    if (later) return { open: false, day, min, today, when: 'heute', opens: later[0] };
    for (let i = 1; i <= 7; i++) {
      const d = (day + i) % 7;
      if (intervals(d).length) return { open: false, day, min, today, when: i === 1 ? 'morgen' : `am ${DAY_NAMES[d]}`, opens: intervals(d)[0][0] };
    }
    return { open: false, day, min, today, when: null };
  };

  const duration = (m) => {
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h === 0) return `${r} Min.`;
    return r === 0 ? `${h} Std.` : `${h} Std. ${r} Min.`;
  };

  const statusListeners = [];
  const renderStatus = () => {
    if (!Object.keys(HOURS).length) return;
    const s = getStatus();
    $$('[data-status]').forEach((el) => {
      el.classList.toggle('is-open', s.open);
      el.classList.toggle('is-closed', !s.open);
    });
    const short = s.open ? `Geöffnet · bis ${fmt(s.closes)}` : s.when ? `Geschlossen · öffnet ${s.when} ${fmt(s.opens)}` : 'Geschlossen';
    const long = s.open
      ? `Jetzt geöffnet – heute bis ${fmt(s.closes)} Uhr`
      : s.when ? `Gerade geschlossen – wir öffnen ${s.when} um ${fmt(s.opens)} Uhr` : 'Gerade geschlossen';
    const title = s.open ? (s.left <= 45 ? 'Gleich ist Feierabend!' : 'Jetzt geöffnet') : 'Gerade geschlossen';
    const detail = s.open
      ? (s.left <= 45 ? `Nur noch ${duration(s.left)} – schnell anrufen!` : `Noch ${duration(s.left)} · bis ${fmt(s.closes)} Uhr`)
      : s.when ? `Wir öffnen ${s.when} um ${fmt(s.opens)} Uhr` : '';

    $$('[data-status-short]').forEach((el) => (el.textContent = short));
    $$('[data-status-long]').forEach((el) => (el.textContent = long));
    $$('[data-status-title]').forEach((el) => (el.textContent = title));
    $$('[data-status-detail]').forEach((el) => (el.textContent = detail));
    $$('[data-clock]').forEach((el) => (el.textContent = fmt(s.min)));
    $$('[data-hours] li').forEach((li) => li.classList.toggle('is-today', Number(li.dataset.day) === s.day));
    statusListeners.forEach((fn) => fn(s));
  };

  /* ---------- Glut-Uhr: 24 Stunden, Mittag oben, Öffnungszeit als glühender Bogen ---------- */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svgEl = (name, attrs = {}, parent) => {
    const n = document.createElementNS(SVGNS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  const initDial = (host, index) => {
    const uid = `dial${index}`;
    const C = 200;
    const RT = 148;
    const ang = (m) => (m / 1440) * 360 + 180;
    const pt = (a, r) => {
      const t = (a * Math.PI) / 180;
      return [C + r * Math.sin(t), C - r * Math.cos(t)];
    };
    const f2 = (n) => n.toFixed(2);

    const svg = svgEl('svg', { viewBox: '0 0 400 400', focusable: 'false', 'aria-hidden': 'true' });
    const defs = svgEl('defs', {}, svg);
    const grad = svgEl('linearGradient', { id: `${uid}-g`, x1: '0', y1: '0', x2: '1', y2: '1' }, defs);
    [['0', '#ffd27a'], ['.45', '#ff8a2a'], ['1', '#e8401c']].forEach(([o, c]) => svgEl('stop', { offset: o, 'stop-color': c }, grad));
    const blur = svgEl('filter', { id: `${uid}-b`, x: '-40%', y: '-40%', width: '180%', height: '180%' }, defs);
    svgEl('feGaussianBlur', { stdDeviation: '10' }, blur);

    svgEl('circle', { class: 'dial-face', cx: C, cy: C, r: 188 }, svg);
    svgEl('circle', { class: 'dial-track', cx: C, cy: C, r: RT, 'stroke-width': 22 }, svg);

    const ticks = svgEl('g', {}, svg);
    for (let q = 0; q < 96; q++) {
      const m = q * 15;
      const major = m % 360 === 0;
      const hour = m % 60 === 0;
      const [x1, y1] = pt(ang(m), 170);
      const [x2, y2] = pt(ang(m), major ? 184 : hour ? 179 : 174);
      svgEl('line', { class: `dial-tick${major ? ' dial-tick--major' : hour ? ' dial-tick--h' : ''}`, x1: f2(x1), y1: f2(y1), x2: f2(x2), y2: f2(y2) }, ticks);
    }
    [0, 6, 12, 18].forEach((h) => {
      const [x, y] = pt(ang(h * 60), 112);
      const t = svgEl('text', { class: 'dial-label', x: f2(x), y: f2(y) }, svg);
      t.textContent = String(h).padStart(2, '0');
    });

    const arcs = svgEl('g', {}, svg);
    const nowG = svgEl('g', {}, svg);
    svgEl('circle', { class: 'dial-now-pulse', r: 11, cx: 0, cy: 0 }, nowG);
    svgEl('circle', { class: 'dial-now-dot', r: 7, cx: 0, cy: 0 }, nowG);

    const state = svgEl('text', { class: 'dial-state', x: C, y: 150 }, svg);
    const time = svgEl('text', { class: 'dial-time', x: C, y: 222 }, svg);
    const sub = svgEl('text', { class: 'dial-sub', x: C, y: 256 }, svg);
    host.appendChild(svg);

    const arcPath = (m1, m2, r) => {
      const span = ((m2 - m1) / 1440) * 360;
      const [x1, y1] = pt(ang(m1), r);
      const [x2, y2] = pt(ang(m1) + span, r);
      return `M${f2(x1)} ${f2(y1)} A${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${f2(x2)} ${f2(y2)}`;
    };

    let drawn = false;
    let builtFor = -1;
    const buildArcs = (list) => {
      arcs.textContent = '';
      list.forEach(([a, b]) => {
        const full = b - a >= 1439;
        const shape = full ? 'circle' : 'path';
        const geo = full ? { cx: C, cy: C, r: RT } : { d: arcPath(a, b, RT) };
        svgEl(shape, { ...geo, class: 'dial-open dial-open-glow', stroke: `url(#${uid}-g)`, 'stroke-width': 26, filter: `url(#${uid}-b)` }, arcs);
        const main = svgEl(shape, { ...geo, class: 'dial-open dial-arc-draw', stroke: `url(#${uid}-g)`, 'stroke-width': 22, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': drawn || reduceMotion ? 0 : 1 }, arcs);
        main.dataset.arc = '1';
      });
    };

    const reveal = () => {
      drawn = true;
      $$('[data-arc]', arcs).forEach((p) => p.setAttribute('stroke-dashoffset', 0));
    };
    if (hasIO && !reduceMotion) {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { requestAnimationFrame(reveal); io.disconnect(); } }, { threshold: 0.35 });
      io.observe(host);
    } else drawn = true;

    statusListeners.push((s) => {
      if (builtFor !== s.day) { buildArcs(s.today); builtFor = s.day; }
      const [x, y] = pt(ang(s.min), RT);
      nowG.setAttribute('transform', `translate(${f2(x)} ${f2(y)})`);
      time.textContent = fmt(s.min);
      state.textContent = s.open ? 'GEÖFFNET' : 'GESCHLOSSEN';
      sub.textContent = s.open ? `bis ${fmt(s.closes)} Uhr` : s.when ? `öffnet ${s.when} ${fmt(s.opens)}` : '';
      host.classList.toggle('is-open', s.open);
      host.classList.toggle('is-closed', !s.open);
    });
  };
  $$('[data-dial]').forEach(initDial);

  renderStatus();
  setInterval(renderStatus, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderStatus(); });

  /* ---------- Header ---------- */
  const header = $('.site-header');
  const onScrollHeader = () => header && header.classList.toggle('is-scrolled', window.scrollY > 24 || root.classList.contains('menu-open'));
  onScrollHeader();
  window.addEventListener('scroll', onScrollHeader, { passive: true });

  /* ---------- Mobile-Menü ---------- */
  const toggle = $('.menu-toggle');
  const mobileMenu = $('#mobile-menu');
  if (toggle && mobileMenu) {
    mobileMenu.hidden = false;
    const setMenu = (open) => {
      root.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
      document.body.style.overflow = open ? 'hidden' : '';
      onScrollHeader();
    };
    toggle.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
    $$('a', mobileMenu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('menu-open')) { setMenu(false); toggle.focus(); } });
    window.matchMedia('(min-width: 1181px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  }

  /* ---------- Einblenden beim Scrollen ---------- */
  const revealEls = $$('[data-reveal]');
  if (hasIO && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Zahlen hochzählen ---------- */
  const counters = $$('[data-count-to]');
  if (hasIO && !reduceMotion) {
    const run = (el) => {
      const target = Number(el.dataset.countTo);
      const start = performance.now();
      const dur = 1400;
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      el.textContent = '0';
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.6 });
    counters.forEach((el) => io.observe(el));
  }

  const whenIdle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 600));
  const afterLoad = (fn) => (document.readyState === 'complete' ? fn() : window.addEventListener('load', fn, { once: true }));

  /* ---------- Glut-Funken (Canvas) ---------- */
  const makeSprite = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,236,190,1)');
    grad.addColorStop(0.18, 'rgba(255,190,90,.95)');
    grad.addColorStop(0.45, 'rgba(255,110,30,.35)');
    grad.addColorStop(1, 'rgba(255,80,20,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return c;
  };

  const initEmbers = (canvas) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const sprite = makeSprite();
    let w = 0, h = 0, dpr = 1, particles = [], running = false, raf = 0, last = 0;

    const spawn = (initial) => ({
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + 10 + Math.random() * 40,
      r: 0.8 + Math.random() * 2.2,
      vy: 18 + Math.random() * 42,
      sway: 6 + Math.random() * 22,
      freq: 0.6 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      life: 0,
      max: 4 + Math.random() * 6,
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(90, Math.max(24, w / 16)));
      particles = Array.from({ length: count }, () => spawn(true));
    };

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life += dt;
        p.y -= p.vy * dt;
        const x = p.x + Math.sin(p.life * p.freq + p.phase) * p.sway;
        const t = p.life / p.max;
        if (t >= 1 || p.y < -20) { particles[i] = spawn(false); continue; }
        const flicker = 0.75 + Math.sin(p.life * 9 + p.phase) * 0.25;
        ctx.globalAlpha = Math.sin(Math.PI * t) * flicker * 0.9;
        const s = p.r * 7;
        ctx.drawImage(sprite, x - s / 2, p.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      if (running) raf = requestAnimationFrame(frame);
    };

    const start = () => { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    resize();
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });

    let visible = false;
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      visible && !document.hidden ? start() : stop();
    }).observe(canvas);
    document.addEventListener('visibilitychange', () => (document.hidden || !visible ? stop() : start()));
  };

  if (!reduceMotion && hasIO) afterLoad(() => whenIdle(() => $$('[data-embers]').forEach(initEmbers)));

  /* ---------- Schriftring um den Dönerspieß ---------- */
  const initOrbit = (visual) => {
    const back = $('[data-orbit-back]', visual);
    const front = $('[data-orbit-front]', visual);
    const arch = $('.arch', visual);
    if (!back || !front || !arch) return;
    const bctx = back.getContext('2d');
    const fctx = front.getContext('2d');
    if (!bctx || !fctx) return;
    const words = (visual.dataset.orbit || '').split('·').map((w) => w.trim().toLocaleUpperCase('de-DE')).filter(Boolean);
    if (!words.length) return;

    const BASE = (Math.PI * 2) / 44;
    let glyphs = [];
    let dpr = 1, cx = 0, cy = 0, R = 0, Ry = 0, fs = 0;
    let rot = 0.6, boost = 0, raf = 0, running = false, last = 0, visible = false, gradFront = null;

    const setFont = (ctx) => {
      ctx.font = `800 ${fs}px "Bricolage Grotesque", "Arial Narrow", sans-serif`;
      if ('fontStretch' in ctx) ctx.fontStretch = 'condensed';
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
    };

    const layout = () => {
      const cr = back.getBoundingClientRect();
      const ar = arch.getBoundingClientRect();
      if (!cr.width || !ar.width) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      [back, front].forEach((c) => { c.width = Math.round(cr.width * dpr); c.height = Math.round(cr.height * dpr); });
      cx = ar.left + ar.width / 2 - cr.left;
      cy = ar.top + ar.height * 0.68 - cr.top;
      R = ar.width * 0.73;
      Ry = R * 0.19;
      fs = Math.max(15, Math.min(34, ar.width * 0.074));
      setFont(bctx);
      setFont(fctx);
      const unit = [];
      words.forEach((w) => {
        [...w].forEach((ch) => unit.push({ ch, w: fctx.measureText(ch).width }));
        unit.push({ sep: true, w: fs * 1.15 });
      });
      const track = fs * 0.06;
      const unitLen = unit.reduce((s, g) => s + g.w + track, 0);
      const circ = Math.PI * 2 * R;
      const reps = Math.max(1, Math.floor(circ / unitLen));
      const seq = Array.from({ length: reps }, () => unit).flat();
      const extra = Math.max(0, (circ - unitLen * reps) / seq.length);
      let acc = 0;
      glyphs = seq.map((g) => {
        const adv = g.w + track + extra;
        const a = ((acc + adv / 2) / circ) * Math.PI * 2;
        acc += adv;
        return { ch: g.ch, sep: g.sep, a };
      });
      gradFront = fctx.createLinearGradient(0, -fs * 0.5, 0, fs * 0.5);
      gradFront.addColorStop(0, '#ffe0a3');
      gradFront.addColorStop(0.5, '#ffa040');
      gradFront.addColorStop(1, '#ff5b1f');
      return true;
    };

    const draw = () => {
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.clearRect(0, 0, back.width, back.height);
      fctx.setTransform(1, 0, 0, 1, 0, 0);
      fctx.clearRect(0, 0, front.width, front.height);
      const k = Ry / R;
      for (let i = 0; i < glyphs.length; i++) {
        const g = glyphs[i];
        const th = g.a + rot;
        const s = Math.sin(th);
        const c = Math.cos(th);
        const isFront = c >= 0;
        const ctx = isFront ? fctx : bctx;
        const p = 1 + 0.13 * c;
        const ac = Math.abs(c);
        ctx.globalAlpha = isFront ? Math.min(1, 0.12 + ac * 1.15) : 0.05 + ac * 0.2;
        ctx.fillStyle = isFront ? gradFront : '#ffcf9a';
        ctx.setTransform(dpr * c * p, dpr * -k * s * p, 0, dpr * p, dpr * (cx + R * s), dpr * (cy + Ry * c));
        if (g.sep) {
          ctx.beginPath();
          ctx.arc(0, 0, fs * 0.11, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillText(g.ch, 0, 0);
        }
      }
      bctx.globalAlpha = 1;
      fctx.globalAlpha = 1;
    };

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      boost *= Math.pow(0.03, dt);
      rot -= (BASE + boost) * dt;
      draw();
      if (running) raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!running && !reduceMotion) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    let lastY = window.scrollY;
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      boost = Math.min(3.2, boost + Math.abs(y - lastY) * 0.0035);
      lastY = y;
    }, { passive: true });

    const ready = document.fonts && document.fonts.load ? document.fonts.load('800 40px "Bricolage Grotesque"') : Promise.resolve();
    ready.catch(() => {}).then(() => {
      if (layout()) draw();
      if (hasIO) {
        new IntersectionObserver(([e]) => {
          visible = e.isIntersecting;
          visible && !document.hidden ? start() : stop();
        }).observe(visual);
      }
      document.addEventListener('visibilitychange', () => (document.hidden || !visible ? stop() : start()));
      let rt;
      window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (layout()) draw(); }, 150); });
    });
  };
  $$('[data-orbit]').forEach(initOrbit);

  /* ---------- Parallax ---------- */
  const parallaxEls = $$('[data-parallax]');
  if (parallaxEls.length && !reduceMotion) {
    let ticking = false;
    const update = () => {
      const vh = window.innerHeight;
      parallaxEls.forEach((img) => {
        const rect = img.parentElement.getBoundingClientRect();
        if (rect.bottom < -100 || rect.top > vh + 100) return;
        const progress = (rect.top + rect.height / 2 - vh / 2) / (vh + rect.height);
        img.style.setProperty('--py', `${(-progress * 140).toFixed(1)}px`);
      });
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  /* ---------- Handwerk: Bilder wechseln mit den Schritten ---------- */
  const craft = $('.craft-grid');
  if (craft && hasIO) {
    const steps = $$('.craft-step', craft);
    const frames = $$('.craft-frame', craft);
    const cur = $('[data-craft-current]', craft);
    const bar = $('[data-craft-bar]', craft);
    const set = (n) => {
      steps.forEach((s) => s.classList.toggle('is-active', Number(s.dataset.step) === n));
      frames.forEach((f) => f.classList.toggle('is-shown', Number(f.dataset.frame) <= n));
      if (cur) cur.textContent = String(n).padStart(2, '0');
      if (bar) bar.style.width = `${(n / steps.length) * 100}%`;
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) set(Number(e.target.dataset.step)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach((s) => io.observe(s));
  }

  /* ---------- Speisekarte: Suche, Veggie-Filter, Kategorien ---------- */
  const norm = (s) => s.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const search = $('[data-menu-search]');
  const veg = $('[data-menu-veg]');
  const cats = $$('.menu-cat');
  const chips = $$('.chip');
  const empty = $('[data-menu-empty]');
  const chipBar = $('.menu-chips');
  const searchIndex = new Map($$('.menu-item').map((it) => [it, norm(it.dataset.search || '')]));

  const applyFilter = () => {
    const q = norm(search ? search.value.trim() : '');
    const vegOnly = veg ? veg.checked : false;
    let any = false;
    cats.forEach((cat) => {
      let count = 0;
      $$('.menu-item', cat).forEach((it) => {
        const ok = (!q || searchIndex.get(it).includes(q)) && (!vegOnly || it.dataset.veg === '1');
        it.hidden = !ok;
        if (ok) count++;
      });
      cat.hidden = count === 0;
      const chip = chips.find((c) => c.dataset.chip === cat.dataset.cat);
      if (chip) chip.hidden = count === 0;
      if (count) any = true;
    });
    if (empty) empty.hidden = any;
  };
  if (search) search.addEventListener('input', applyFilter);
  if (veg) veg.addEventListener('change', applyFilter);

  const setActiveChip = (id) => {
    chips.forEach((c) => c.classList.toggle('is-active', c.dataset.chip === id));
    const active = chips.find((c) => c.dataset.chip === id);
    if (active && chipBar) {
      chipBar.scrollTo({ left: active.offsetLeft - chipBar.offsetLeft - 12, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  };
  if (hasIO && cats.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActiveChip(e.target.dataset.cat); });
    }, { rootMargin: '-40% 0px -55% 0px' });
    cats.forEach((c) => spy.observe(c));
  }

  /* ---------- Bestellzettel (nur im Browser-Tab, keine Übertragung) ---------- */
  const ticketEl = $('[data-ticket]');
  if (ticketEl) {
    const KEY = 'arins-bestellzettel';
    const list = $('[data-ticket-list]', ticketEl);
    const emptyEl = $('[data-ticket-empty]', ticketEl);
    const totalEl = $('[data-ticket-total]', ticketEl);
    const sumEl = $('[data-ticket-sum]', ticketEl);
    const countEl = $('[data-ticket-items]', ticketEl);
    const tools = $('[data-ticket-tools]', ticketEl);
    const cta = $('[data-ticket-cta]', ticketEl);
    const dateEl = $('[data-ticket-date]', ticketEl);
    const shareBtn = $('[data-ticket-share]', ticketEl);
    const shareLabel = $('[data-ticket-share-label]', ticketEl);
    const clearBtn = $('[data-ticket-clear]', ticketEl);
    const wrap = $('[data-ticket-wrap]');
    const sheet = $('[data-ticket-sheet]');
    const openers = $$('[data-ticket-open]');
    const countBadges = $$('[data-ticket-count]');
    const menuItems = new Map($$('.menu-item[data-id]').map((li) => [li.dataset.id, li]));
    const items = new Map();
    const rows = new Map();
    const canShare = typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches;
    const shareDefault = canShare ? 'Teilen' : 'Kopieren';
    if (shareLabel) shareLabel.textContent = shareDefault;

    if (dateEl) {
      dateEl.textContent = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date());
    }

    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        JSON.parse(raw).forEach(([id, qty]) => {
          const n = Math.min(99, Math.floor(Number(qty)));
          if (menuItems.has(id) && n > 0) items.set(id, n);
        });
      }
    } catch { /* Speicher nicht verfügbar – Zettel funktioniert trotzdem */ }

    const save = () => {
      try {
        if (items.size) sessionStorage.setItem(KEY, JSON.stringify([...items]));
        else sessionStorage.removeItem(KEY);
      } catch { /* ignorieren */ }
    };

    const info = (id) => {
      const li = menuItems.get(id);
      return { name: li.dataset.name, price: Number(li.dataset.price) };
    };
    const totals = () => {
      let n = 0;
      let sum = 0;
      items.forEach((q, id) => { n += q; sum += q * info(id).price; });
      return { n, sum };
    };

    const makeRow = (id) => {
      const { name } = info(id);
      const li = document.createElement('li');
      li.className = 'ticket-row';
      li.dataset.id = id;
      li.innerHTML =
        `<span class="ticket-qty">` +
        `<button type="button" data-dec aria-label="${esc(name)}: Anzahl verringern"><svg class="icon" aria-hidden="true"><use href="#i-minus"/></svg></button>` +
        `<output aria-label="Anzahl ${esc(name)}"></output>` +
        `<button type="button" data-inc aria-label="${esc(name)}: Anzahl erhöhen"><svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg></button>` +
        `</span><span class="ticket-name">${esc(name)}</span><span class="ticket-price"></span>`;
      return li;
    };

    const render = () => {
      rows.forEach((row, id) => { if (!items.has(id)) { row.remove(); rows.delete(id); } });
      items.forEach((qty, id) => {
        let row = rows.get(id);
        if (!row) { row = makeRow(id); rows.set(id, row); list.appendChild(row); }
        $('output', row).textContent = qty;
        $('.ticket-price', row).textContent = euro(qty * info(id).price);
      });
      const { n, sum } = totals();
      const has = n > 0;
      emptyEl.hidden = has;
      totalEl.hidden = !has;
      tools.hidden = !has;
      sumEl.textContent = euro(sum);
      countEl.textContent = n;
      cta.textContent = has ? 'Anrufen & Zettel vorlesen' : 'Jetzt anrufen';
      countBadges.forEach((b) => (b.textContent = n));
      openers.forEach((o) => o.classList.toggle('has-items', has));
      menuItems.forEach((li, id) => {
        const q = items.get(id) || 0;
        const btn = $('[data-add]', li);
        li.classList.toggle('is-added', q > 0);
        btn.classList.toggle('is-added', q > 0);
        $('.menu-add-count', btn).textContent = q > 0 ? String(q) : '';
        btn.setAttribute('aria-label', q > 0
          ? `${li.dataset.name} noch einmal auf den Bestellzettel (bisher ${q})`
          : `${li.dataset.name} auf den Bestellzettel`);
      });
    };

    const change = (id, delta) => {
      const q = Math.max(0, Math.min(99, (items.get(id) || 0) + delta));
      if (q) items.set(id, q); else items.delete(id);
      save();
      render();
      return q;
    };

    const bump = (el) => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };

    menuItems.forEach((li, id) => {
      const btn = $('[data-add]', li);
      btn.addEventListener('click', () => {
        change(id, 1);
        bump(btn);
        openers.forEach(bump);
        const { n, sum } = totals();
        toast(`${li.dataset.name} notiert · ${n} Artikel · ${euro(sum)}`);
      });
    });

    list.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const row = btn.closest('.ticket-row');
      const id = row.dataset.id;
      const next = row.nextElementSibling || row.previousElementSibling;
      const q = change(id, btn.hasAttribute('data-inc') ? 1 : -1);
      if (!q) {
        toast(`${info(id).name} entfernt`);
        const target = next && $('button', next);
        (target || sheet).focus();
      }
    });

    clearBtn.addEventListener('click', () => {
      items.clear();
      save();
      render();
      toast('Bestellzettel geleert');
      sheet.focus();
    });

    const ticketText = () => {
      const lines = [];
      items.forEach((q, id) => {
        const { name, price } = info(id);
        lines.push(`${q} × ${name} – ${euro(q * price)}`);
      });
      return [
        `Bestellzettel – ${DATA.name || ''}`.trim(),
        '',
        ...lines,
        '',
        `Summe: ${euro(totals().sum)}`,
        `Bestellen: ${DATA.telAnzeige || ''}`.trim(),
      ].join('\n').replace(/ /g, ' ');
    };

    const legacyCopy = (text) => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
      return ok;
    };

    shareBtn.addEventListener('click', async () => {
      const text = ticketText();
      if (canShare) {
        try { await navigator.share({ title: 'Bestellzettel', text }); return; } catch (err) { if (err && err.name === 'AbortError') return; }
      }
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch { ok = legacyCopy(text); }
      if (ok) {
        shareLabel.textContent = 'Kopiert';
        toast('Bestellzettel kopiert – einfach einfügen und teilen');
        setTimeout(() => (shareLabel.textContent = shareDefault), 2400);
      } else {
        toast('Kopieren nicht möglich – bitte manuell abschreiben');
      }
    });

    /* Auf dem Handy: Zettel als Bottom-Sheet */
    const mq = window.matchMedia('(max-width: 1100px)');
    const outside = $$('.site-header, .page-hero, .menu-toolbar, .menu-list, .infos, .callband, .site-footer, .mobile-bar');
    let lastFocus = null;
    const setSheet = (open) => {
      if (!wrap || !sheet) return;
      if (open && !mq.matches) { sheet.focus(); return; }
      wrap.classList.toggle('is-open', open);
      openers.forEach((o) => o.setAttribute('aria-expanded', String(open)));
      document.body.style.overflow = open ? 'hidden' : '';
      document.body.classList.toggle('sheet-open', open);
      if (open) {
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-modal', 'true');
        sheet.setAttribute('aria-labelledby', 'ticket-title');
        outside.forEach((el) => el.setAttribute('inert', ''));
        lastFocus = document.activeElement;
        setTimeout(() => sheet.focus(), 60);
      } else {
        sheet.removeAttribute('role');
        sheet.removeAttribute('aria-modal');
        outside.forEach((el) => el.removeAttribute('inert'));
        if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
      }
    };
    openers.forEach((o) => o.addEventListener('click', () => setSheet(!wrap.classList.contains('is-open'))));
    $$('[data-ticket-close]').forEach((b) => b.addEventListener('click', () => setSheet(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && wrap && wrap.classList.contains('is-open')) setSheet(false); });
    mq.addEventListener('change', (e) => { if (!e.matches) setSheet(false); });

    render();
  }

  /* ---------- Rechtstexte: aktiver Abschnitt im Inhaltsverzeichnis ---------- */
  const tocLinks = $$('.legal-toc a[href^="#"]');
  if (tocLinks.length && hasIO) {
    const byId = new Map(tocLinks.map((a) => [a.getAttribute('href').slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        tocLinks.forEach((a) => a.classList.remove('is-active'));
        const a = byId.get(e.target.id);
        if (a) a.classList.add('is-active');
      });
    }, { rootMargin: '-15% 0px -75% 0px' });
    byId.forEach((a, id) => { const sec = document.getElementById(id); if (sec) io.observe(sec); });
  }

  /* ---------- Mobile Aktionsleiste ---------- */
  const bar = $('.mobile-bar');
  const firstHero = $('.hero, .split-hero, .page-hero, .notfound');
  if (bar) {
    if (firstHero && hasIO) {
      new IntersectionObserver(([e]) => bar.classList.toggle('is-visible', e.intersectionRatio < 0.2), { threshold: [0, 0.2, 0.4] }).observe(firstHero);
    } else {
      bar.classList.add('is-visible');
    }
  }

  /* ---------- Route: auf Apple-Geräten Apple Karten ---------- */
  const isApple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isApple && DATA.route && DATA.route.apple) {
    $$('[data-route]').forEach((a) => (a.href = DATA.route.apple));
  }

  /* ---------- Drucken ---------- */
  $$('[data-print]').forEach((b) => b.addEventListener('click', () => window.print()));

  /* ---------- Jahr im Footer ---------- */
  $$('[data-year]').forEach((el) => (el.textContent = String(new Date().getFullYear())));
})();
