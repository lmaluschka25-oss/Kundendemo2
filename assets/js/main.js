/* Arin's Kebap & Pizza Haus – Interaktionen (ohne Frameworks, ohne Tracking) */
(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  /* ---------- Öffnungszeiten (Minuten seit Mitternacht, 0 = Sonntag) ---------- */
  const OPEN = 10 * 60 + 30;
  const CLOSE = 20 * 60 + 30;
  const HOURS = { 0: [OPEN, CLOSE], 1: [OPEN, CLOSE], 2: [OPEN, CLOSE], 3: [OPEN, CLOSE], 4: [OPEN, CLOSE], 5: [OPEN, CLOSE], 6: [OPEN, CLOSE] };
  const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

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
    const today = HOURS[day];
    if (today && min >= today[0] && min < today[1]) {
      return { open: true, day, closes: today[1], left: today[1] - min };
    }
    if (today && min < today[0]) return { open: false, day, when: 'heute', opens: today[0] };
    for (let i = 1; i <= 7; i++) {
      const d = (day + i) % 7;
      if (HOURS[d]) return { open: false, day, when: i === 1 ? 'morgen' : `am ${DAY_NAMES[d]}`, opens: HOURS[d][0] };
    }
    return { open: false, day, when: null };
  };

  const duration = (m) => {
    const h = Math.floor(m / 60);
    const r = m % 60;
    if (h === 0) return `${r} Min.`;
    return r === 0 ? `${h} Std.` : `${h} Std. ${r} Min.`;
  };

  const renderStatus = () => {
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
    $$('[data-hours] li').forEach((li) => li.classList.toggle('is-today', Number(li.dataset.day) === s.day));
  };
  renderStatus();
  setInterval(renderStatus, 30000);

  /* ---------- Header ---------- */
  const header = $('.site-header');
  const onScrollHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
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
      header.classList.toggle('is-scrolled', open || window.scrollY > 24);
    };
    toggle.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
    $$('a', mobileMenu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    window.matchMedia('(min-width: 1181px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  }

  /* ---------- Einblenden beim Scrollen ---------- */
  const revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduceMotion) {
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
  if ('IntersectionObserver' in window && !reduceMotion) {
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
      const count = Math.round(Math.min(90, Math.max(28, w / 16)));
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

  // Funken erst starten, wenn die Seite fertig geladen ist und der Browser Luft hat
  const whenIdle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 600));
  const startEmbers = () => whenIdle(() => $$('[data-embers]').forEach(initEmbers));
  if (!reduceMotion && 'IntersectionObserver' in window) {
    document.readyState === 'complete' ? startEmbers() : window.addEventListener('load', startEmbers, { once: true });
  }

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
      const left = active.offsetLeft - chipBar.offsetLeft - 12;
      chipBar.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  };
  if ('IntersectionObserver' in window && cats.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActiveChip(e.target.dataset.cat); });
    }, { rootMargin: '-40% 0px -55% 0px' });
    cats.forEach((c) => spy.observe(c));
  }

  /* ---------- Aktiver Navigationspunkt ---------- */
  const navLinks = $$('.nav a');
  if (navLinks.length && 'IntersectionObserver' in window) {
    const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
    const navSpy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${e.target.id}`));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => navSpy.observe(s));
  }

  /* ---------- Mobile Aktionsleiste ---------- */
  const bar = $('.mobile-bar');
  const hero = $('.hero');
  if (bar && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => bar.classList.toggle('is-visible', !e.isIntersecting), { threshold: 0.25 }).observe(hero);
  }

  /* ---------- Route: auf Apple-Geräten Apple Karten ---------- */
  const isApple = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isApple) {
    $$('[data-route]').forEach((a) => (a.href = 'https://maps.apple.com/?daddr=Ringstra%C3%9Fe+22,+92339+Beilngries&dirflg=d'));
  }

  /* ---------- Jahr im Footer ---------- */
  $$('[data-year]').forEach((el) => (el.textContent = String(new Date().getFullYear())));
})();
