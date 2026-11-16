// =============================================================
// Arin's Kebap & Pizza Haus – Seitengenerator (ohne Abhängigkeiten)
//
// Aufruf im Projektordner:   node tools/build.mjs
//
// Quellen:
//   src/layout.html          Grundgerüst jeder Seite
//   src/teile/*.html         wiederverwendbare Teile (Header, Footer, …)
//   src/seiten/*.html        die einzelnen Seiten (mit Kopfdaten zwischen ---)
//   content/betrieb.json     Betriebsdaten (Inhaber, Telefon, Öffnungszeiten, …)
//   content/speisekarte.json Speisekarte
//   content/karte.svg        Lagekarte
//
// Ergebnis (bitte NICHT direkt bearbeiten, wird überschrieben):
//   *.html im Hauptordner, sitemap.xml, robots.txt, _headers, site.webmanifest
//
// Platzhalter in den Vorlagen:
//   {{telefon.anzeige}}          Wert aus betrieb.json (HTML-maskiert)
//   {{> footer}}                 Teil aus src/teile/footer.html
//   {{#if feld}}…{{else}}…{{/if}} Bedingung (nicht verschachteln)
//   {{preis:Döner}}              Preis eines Gerichts aus der Speisekarte
//   {{anzahl:pizza}}             Anzahl Gerichte einer Kategorie
//   {{todo:inhaber|Text}}        Wert oder gelb markierter Platzhalter
// =============================================================

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const write = (p, s) => writeFileSync(join(root, p), s);

const site = JSON.parse(read('content/betrieb.json'));
const menu = JSON.parse(read('content/speisekarte.json'));
const karte = read('content/karte.svg').trim();

const warnings = [];

// ---------- Hilfen ----------
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const raw = (s) => ({ raw: String(s) });
const euro = (p) => p.toFixed(2).replace('.', ',') + '&nbsp;€';
const typo = (s) => String(s).replace(/'/g, '’');
const slug = (s) =>
  s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hash = (s, len = 10) => createHash('sha256').update(s).digest('hex').slice(0, len);
const lookup = (path, ctx) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), ctx);
const basis = site.website.replace(/\/$/, '');

// ---------- Öffnungszeiten ----------
const TAGE = [
  { key: 'mo', name: 'Montag', kurz: 'Mo', js: 1, schema: 'Monday' },
  { key: 'di', name: 'Dienstag', kurz: 'Di', js: 2, schema: 'Tuesday' },
  { key: 'mi', name: 'Mittwoch', kurz: 'Mi', js: 3, schema: 'Wednesday' },
  { key: 'do', name: 'Donnerstag', kurz: 'Do', js: 4, schema: 'Thursday' },
  { key: 'fr', name: 'Freitag', kurz: 'Fr', js: 5, schema: 'Friday' },
  { key: 'sa', name: 'Samstag', kurz: 'Sa', js: 6, schema: 'Saturday' },
  { key: 'so', name: 'Sonntag', kurz: 'So', js: 0, schema: 'Sunday' },
];
const toMin = (t) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) throw new Error(`Ungültige Uhrzeit "${t}" in betrieb.json (Format HH:MM)`);
  return Number(m[1]) * 60 + Number(m[2]);
};
const intervals = (d) => site.oeffnungszeiten[d.key] || [];
const ivText = (iv, sep = ' – ') => (iv.length ? iv.map(([a, b]) => `${a}${sep}${b}`).join(', ') : 'Ruhetag');

const gruppen = [];
for (const d of TAGE) {
  const t = ivText(intervals(d));
  const last = gruppen.at(-1);
  if (last && last.t === t) last.tage.push(d);
  else gruppen.push({ t, tage: [d] });
}
const taeglich = gruppen.length === 1 && intervals(TAGE[0]).length > 0;
const gruppeName = (g) => (g.tage.length > 1 ? `${g.tage[0].kurz}–${g.tage.at(-1).kurz}` : g.tage[0].kurz);
// Gedankenstrich mit Wortverbindern, damit „10:30–20:30“ nie umbricht
const BIS = '⁠–⁠';
const zeiten = {
  taeglich,
  kurz: taeglich
    ? `Täglich ${ivText(intervals(TAGE[0]), BIS)} Uhr`
    : gruppen.map((g) => `${gruppeName(g)} ${ivText(g.tage.length ? intervals(g.tage[0]) : [], BIS)}`).join(' · '),
  von_bis: taeglich ? ivText(intervals(TAGE[0])) : '',
  tage_text: taeglich ? 'Montag – Sonntag' : '',
};
const zeitenJs = Object.fromEntries(TAGE.map((d) => [d.js, intervals(d).map(([a, b]) => {
  let s = toMin(a);
  let e = toMin(b);
  if (e <= s) e += 1440; // über Mitternacht
  return [s, e];
})]));

// ---------- Speisekarte ----------
const TAGS = {
  beliebt: { cls: 'pop', label: 'Beliebt', icon: 'i-flame' },
  haus: { cls: 'house', label: 'Haus-Tipp', icon: 'i-star' },
  scharf: { cls: 'hot', label: 'Scharf', icon: 'i-chili' },
  vegetarisch: { cls: 'veg', label: 'Veggie', icon: 'i-leaf' },
  vegan: { cls: 'vegan', label: 'Vegan', icon: 'i-leaf' },
};
const alle = menu.kategorien.flatMap((k) => k.gerichte.map((g) => ({ ...g, kat: k })));
const istVeg = (g) => g.tags.includes('vegetarisch') || g.tags.includes('vegan');
const gericht = (name) => {
  const g = alle.find((x) => x.name === name);
  if (!g) throw new Error(`Gericht "${name}" steht nicht in content/speisekarte.json`);
  return g;
};
const kategorie = (id) => {
  const k = menu.kategorien.find((x) => x.id === id);
  if (!k) throw new Error(`Kategorie "${id}" steht nicht in content/speisekarte.json`);
  return k;
};
const essen = alle.filter((g) => g.kat.id !== 'getraenke');
const stat = {
  gerichte: alle.length,
  kategorien: menu.kategorien.length,
  pizzen: menu.kategorien.find((k) => k.id === 'pizza')?.gerichte.filter((g) => !/brot/i.test(g.name)).length ?? 0,
  vegetarisch: essen.filter(istVeg).length,
  vegan: alle.filter((g) => g.tags.includes('vegan')).length,
};

const tagHtml = (t) => {
  const def = TAGS[t];
  if (!def) throw new Error(`Unbekannter Tag "${t}" – erlaubt: ${Object.keys(TAGS).join(', ')}`);
  return `<span class="tag tag--${def.cls}"><svg class="icon" aria-hidden="true"><use href="#${def.icon}"/></svg>${def.label}</span>`;
};
const nr = (i) => String(i + 1).padStart(2, '0');

const menuChips = () =>
  menu.kategorien.map((k) => `<a class="chip" href="#kat-${k.id}" data-chip="${k.id}">${esc(k.name)}</a>`).join('\n          ');

const menuIndex = () =>
  `<ol class="menu-index-list">\n${menu.kategorien
    .map((k, i) => `          <li><a href="#kat-${k.id}"><span class="mi-no">${nr(i)}</span><span class="mi-name">${esc(k.name)}</span><span class="mi-dots" aria-hidden="true"></span><span class="mi-count">${k.gerichte.length}<span class="sr-only"> Gerichte</span></span></a></li>`)
    .join('\n')}\n        </ol>`;

const menuListe = () =>
  menu.kategorien
    .map((k, i) => {
      const items = k.gerichte
        .map((g) => {
          const id = `${k.id}-${slug(g.name)}`;
          const veg = istVeg(g);
          const search = `${g.name} ${g.beschreibung} ${k.name}${veg ? ' vegetarisch veggie' : ''}${g.tags.includes('vegan') ? ' vegan' : ''}`.toLowerCase();
          const tags = g.tags.length ? `<span class="menu-item-tags">${g.tags.map(tagHtml).join('')}</span> ` : '';
          return `
              <li class="menu-item" data-id="${id}" data-name="${esc(g.name)}" data-price="${g.preis}" data-veg="${veg ? 1 : 0}" data-search="${esc(search)}">
                <div class="menu-item-row">
                  <h3 class="menu-item-name">${esc(g.name)}</h3>
                  <span class="menu-item-dots" aria-hidden="true"></span>
                  <span class="menu-item-price">${euro(g.preis)}</span>
                  <button class="menu-add" type="button" data-add aria-label="${esc(g.name)} auf den Bestellzettel"><svg class="icon" aria-hidden="true"><use href="#i-plus"/></svg><span class="menu-add-count" aria-hidden="true"></span></button>
                </div>
                <p class="menu-item-desc">${tags}${esc(g.beschreibung)}</p>
              </li>`;
        })
        .join('');
      return `
          <section class="menu-cat" id="kat-${k.id}" data-cat="${k.id}" aria-labelledby="kat-${k.id}-t">
            <header class="menu-cat-head">
              <span class="menu-cat-no" aria-hidden="true">N°&#8239;${nr(i)}</span>
              <h2 class="menu-cat-title" id="kat-${k.id}-t">${esc(k.name)}</h2>
              <p class="menu-cat-sub">${esc(k.untertitel)}</p>
            </header>
            <ul class="menu-items">${items}
            </ul>
          </section>`;
    })
    .join('\n');

// ---------- Öffnungszeiten-Liste ----------
const zeitenListe = () =>
  TAGE.map((d) => `<li data-day="${d.js}"><span>${d.name}</span><span>${ivText(intervals(d))}</span></li>`).join('\n            ');

const zeitenFakt = () =>
  taeglich
    ? `<strong>Täglich</strong><span>${ivText(intervals(TAGE[0]))} Uhr</span>`
    : `<strong>Geöffnet</strong><span>${esc(zeiten.kurz)}</span>`;

// ---------- Koordinaten ----------
const dms = (v, pos, neg) => {
  const a = Math.abs(v);
  const d = Math.floor(a);
  const mFloat = (a - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.round((mFloat - m) * 60);
  return `${d}°&#8239;${String(m).padStart(2, '0')}′&#8239;${String(s).padStart(2, '0')}″&#8239;${v >= 0 ? pos : neg}`;
};

// ---------- Routen ----------
const adresse = `${site.strasse}, ${site.plz} ${site.ort}`;
const route = {
  google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`,
  apple: `https://maps.apple.com/?daddr=${encodeURIComponent(adresse).replace(/%20/g, '+')}&dirflg=d`,
};

// ---------- Strukturierte Daten (JSON-LD) ----------
const ldScript = (obj) => `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2).replace(/</g, '\\u003c')}\n  </script>`;
const oeffnungLd = () => {
  const map = new Map();
  for (const d of TAGE) for (const [a, b] of intervals(d)) {
    const key = `${a}-${b}`;
    if (!map.has(key)) map.set(key, { opens: a, closes: b, days: [] });
    map.get(key).days.push(d.schema);
  }
  return [...map.values()].map((v) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: v.days, opens: v.opens, closes: v.closes }));
};
const restaurantLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  '@id': `${basis}/#restaurant`,
  name: site.name,
  description: 'Döner, Dürüm, Lahmacun, Pide, Pizza und Falafel in Beilngries – frisch vom Spieß, heiß aus dem Ofen.',
  url: `${basis}/`,
  image: `${basis}/assets/img/og-image.jpg`,
  logo: `${basis}/apple-touch-icon.png`,
  telephone: site.telefon.international,
  ...(site.email ? { email: site.email } : {}),
  servesCuisine: ['Döner', 'Kebap', 'Pizza', 'Türkisch', 'Vegetarisch'],
  priceRange: '€',
  acceptsReservations: false,
  hasMenu: `${basis}/speisekarte.html`,
  address: {
    '@type': 'PostalAddress',
    streetAddress: site.strasse,
    postalCode: site.plz,
    addressLocality: site.ort,
    addressRegion: site.region,
    addressCountry: site.land,
  },
  geo: { '@type': 'GeoCoordinates', latitude: site.geo.lat, longitude: site.geo.lon },
  openingHoursSpecification: oeffnungLd(),
});
const menuLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Menu',
  name: `Speisekarte – ${site.name}`,
  url: `${basis}/speisekarte.html`,
  inLanguage: 'de',
  hasMenuSection: menu.kategorien.map((k) => ({
    '@type': 'MenuSection',
    name: k.name,
    description: k.untertitel,
    hasMenuItem: k.gerichte.map((g) => ({
      '@type': 'MenuItem',
      name: g.name,
      description: g.beschreibung,
      offers: { '@type': 'Offer', price: g.preis.toFixed(2), priceCurrency: 'EUR' },
      ...(g.tags.includes('vegan')
        ? { suitableForDiet: 'https://schema.org/VeganDiet' }
        : g.tags.includes('vegetarisch') ? { suitableForDiet: 'https://schema.org/VegetarianDiet' } : {}),
    })),
  })),
});
const breadcrumbLd = (titel, pfad) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Startseite', item: `${basis}/` },
    { '@type': 'ListItem', position: 2, name: titel, item: `${basis}/${pfad}` },
  ],
});

// ---------- Versionen für Cache-Busting ----------
const v = { css: hash(read('assets/css/style.css'), 8), js: hash(read('assets/js/main.js'), 8) };

// ---------- Template-Engine ----------
const partials = Object.fromEntries(
  readdirSync(join(root, 'src/teile')).filter((f) => f.endsWith('.html')).map((f) => [basename(f, '.html'), read(`src/teile/${f}`)]),
);

const test = (expr, ctx) => {
  let e = expr.trim();
  const neg = e.startsWith('!');
  if (neg) e = e.slice(1).trim();
  let r;
  if (e.includes('=')) {
    const [k, val] = e.split('=').map((s) => s.trim());
    r = String(lookup(k, ctx) ?? '') === val;
  } else {
    const val = lookup(e, ctx);
    r = Array.isArray(val) ? val.length > 0 : Boolean(val);
  }
  return neg ? !r : r;
};

const todo = (feld, text, ctx) => {
  const val = lookup(feld, site);
  if (val) return esc(val);
  ctx._todos?.add(feld);
  return `<mark class="todo">[${esc(text)}]</mark>`;
};

const resolve = (expr, ctx) => {
  const i = expr.indexOf(':');
  if (i > 0) {
    const ns = expr.slice(0, i);
    const arg = expr.slice(i + 1).trim();
    switch (ns) {
      case 'aktiv': return ctx.nav === arg ? ' aria-current="page"' : '';
      case 'preis': return euro(gericht(arg).preis);
      case 'anzahl': return String(kategorie(arg).gerichte.length);
      case 'menu':
        if (arg === 'chips') return menuChips();
        if (arg === 'index') return menuIndex();
        if (arg === 'liste') return menuListe();
        if (arg === 'fussnote') return esc(menu.fussnote);
        break;
      case 'zeiten':
        if (arg === 'liste') return zeitenListe();
        if (arg === 'fakt') return zeitenFakt();
        break;
      case 'todo': {
        const [feld, text = feld] = arg.split('|');
        return todo(feld.trim(), text.trim(), ctx);
      }
      case 'mail': {
        if (site.email) return `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>`;
        ctx._todos?.add('email');
        return `<mark class="todo">[${esc(arg || 'E-Mail-Adresse')}]</mark>`;
      }
      case 'koord':
        if (arg === 'lat') return dms(site.geo.lat, 'N', 'S');
        if (arg === 'lon') return dms(site.geo.lon, 'O', 'W');
        break;
      default:
    }
    throw new Error(`Unbekannter Platzhalter {{${expr}}}`);
  }
  switch (expr) {
    case 'karte': return karte;
    case 'daten': return `<script type="application/json" id="arins-daten">${JSON.stringify({
      zeiten: zeitenJs,
      route,
      tel: site.telefon.link,
      telAnzeige: site.telefon.anzeige,
      name: site.name,
    }).replace(/</g, '\\u003c')}</script>`;
    case 'schema': {
      const out = [];
      const arten = String(ctx.schema || '').split(',').map((s) => s.trim()).filter(Boolean);
      if (arten.includes('restaurant')) out.push(ldScript(restaurantLd()));
      if (arten.includes('menu')) out.push(ldScript(menuLd()));
      if (ctx.krume) out.push(ldScript(breadcrumbLd(ctx.krume, ctx.pfad)));
      return out.join('\n  ');
    }
    default: {
      const val = lookup(expr, ctx);
      if (val === undefined || (typeof val === 'object' && val !== null)) throw new Error(`Unbekannter Platzhalter {{${expr}}} (${ctx.pfad || 'Teil'})`);
      return esc(val);
    }
  }
};

const render = (tpl, ctx, depth = 0) => {
  if (depth > 12) throw new Error('Zu tief verschachtelte Teile (Rekursion?)');
  let out = tpl.replace(/\{\{#if\s+([^}]+?)\s*\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
    (_, expr, a, b = '') => (test(expr, ctx) ? a : b));
  out = out.replace(/\{\{>\s*([\w-]+)([^}]*)\}\}/g, (_, name, args) => {
    if (!(name in partials)) throw new Error(`Teil "src/teile/${name}.html" fehlt`);
    const params = Object.fromEntries([...args.matchAll(/([\w-]+)=(?:"([^"]*)"|(\S+))/g)].map((m) => [m[1], m[2] ?? m[3]]));
    return render(partials[name], { ...ctx, ...params }, depth + 1);
  });
  return out.replace(/\{\{\s*([^#/>{}\s][^{}]*?)\s*\}\}/g, (_, expr) => {
    const r = resolve(expr.trim(), ctx);
    return typeof r === 'object' ? r.raw : r;
  });
};

const frontMatter = (src, file) => {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(src);
  if (!m) throw new Error(`${file}: Kopfdaten (--- … ---) fehlen`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = /^([\w-]+):\s*(.*)$/.exec(line.trim());
    if (mm) meta[mm[1]] = mm[2];
  }
  return { meta, body: src.slice(m[0].length) };
};

// ---------- Kontext ----------
const baseCtx = {
  ...site,
  // Telefonnummer nie umbrechen
  telefon: { ...site.telefon, anzeige: site.telefon.anzeige.replace(/ /g, ' ') },
  name_typo: typo(site.name),
  kurzname_typo: typo(site.kurzname),
  stat,
  zeiten,
  route,
  basis,
  v,
  adresse,
  jahr: new Date().getFullYear(),
  heute: new Date().toISOString().slice(0, 10),
};

// ---------- Seiten bauen ----------
const layout = read('src/layout.html');
const seiten = readdirSync(join(root, 'src/seiten')).filter((f) => f.endsWith('.html')).sort();
const built = [];

for (const file of seiten) {
  const { meta, body } = frontMatter(read(`src/seiten/${file}`), file);
  const pfad = file === 'index.html' ? '' : file;
  const ctx = { ...baseCtx, ...meta, pfad, datei: file, _todos: new Set() };
  // Kopfdaten dürfen selbst Platzhalter enthalten
  for (const k of ['titel', 'beschreibung', 'krume']) {
    if (ctx[k]) ctx[k] = render(ctx[k], ctx).replace(/&amp;/g, '&').replace(/⁠/g, '').replace(/ /g, ' ');
  }
  let inhalt = render(body, ctx);
  if (inhalt.includes('<!--TODO-HINWEIS-->')) {
    inhalt = inhalt.replace('<!--TODO-HINWEIS-->', ctx._todos.size
      ? `<div class="legal-alert" role="note"><strong>Vor der Veröffentlichung ergänzen:</strong> Gelb markierte Angaben fehlen noch. Sie werden in <code>content/betrieb.json</code> eingetragen (Felder: ${[...ctx._todos].map(esc).join(', ')}) und erscheinen danach automatisch auf allen Seiten.</div>`
      : '');
  }
  let html = render(layout, { ...ctx, inhalt: '' }).replace('<!--INHALT-->', inhalt);
  // Seiten, die unter beliebigen Pfaden ausgeliefert werden (404), brauchen absolute URLs
  if (meta.absolut === 'ja') {
    const abs = (u) => (/^(https?:|tel:|mailto:|data:|#|\/)/.test(u) ? u : `/${u}`);
    html = html
      .replace(/\s(href|src)="([^"]+)"/g, (_, a, u) => ` ${a}="${abs(u)}"`)
      .replace(/\s(srcset|imagesrcset)="([^"]+)"/g, (_, a, list) => ` ${a}="${list.split(',').map((p) => {
        const [u, ...rest] = p.trim().split(/\s+/);
        return [abs(u), ...rest].join(' ');
      }).join(', ')}"`);
  }
  write(file, html);
  built.push({ file, pfad, meta, html, todos: [...ctx._todos] });
}

// ---------- Sitemap, robots, Manifest ----------
const indexierbar = built.filter((b) => !/noindex/.test(b.meta.robots || '') && b.file !== '404.html');
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexierbar.map((b) => `  <url><loc>${basis}/${b.pfad}</loc><lastmod>${baseCtx.heute}</lastmod></url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *
Allow: /
Disallow: /tools/

Sitemap: ${basis}/sitemap.xml
`);
write('site.webmanifest', JSON.stringify({
  name: site.name,
  short_name: site.kurzname,
  description: 'Döner, Pizza, Lahmacun & Falafel in Beilngries',
  lang: 'de',
  start_url: './',
  scope: './',
  display: 'minimal-ui',
  background_color: '#0f0b09',
  theme_color: '#0f0b09',
  icons: [
    { src: 'assets/img/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'assets/img/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'assets/img/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
  ],
}, null, 2) + '\n');

// ---------- Interne Links prüfen ----------
const ids = new Map(built.map((b) => [b.file, new Set([...b.html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]));
for (const b of built) {
  for (const [, href] of b.html.matchAll(/\shref="([^"]+)"/g)) {
    if (/^(https?:|tel:|mailto:|data:)/.test(href)) continue;
    const [p, frag] = href.split('#');
    const target = p === '' ? b.file : p === './' || p === '/' ? 'index.html' : p.replace(/^\//, '');
    if (/\.(css|js|svg|png|jpg|webp|woff2|webmanifest|xml|txt)(\?.*)?$/.test(target)) {
      try { readFileSync(join(root, target.split('?')[0])); } catch { warnings.push(`${b.file}: Datei fehlt → ${href}`); }
      continue;
    }
    if (!ids.has(target)) { warnings.push(`${b.file}: Link auf unbekannte Seite → ${href}`); continue; }
    if (frag && !ids.get(target).has(frag)) warnings.push(`${b.file}: Anker fehlt → ${href}`);
  }
  for (const [, src] of b.html.matchAll(/\s(?:src|srcset)="([^"]+)"/g)) {
    for (const part of src.split(',')) {
      const url = part.trim().split(/\s+/)[0];
      if (!url || /^(https?:|data:)/.test(url)) continue;
      try { readFileSync(join(root, url.split('?')[0])); } catch { warnings.push(`${b.file}: Bild/Skript fehlt → ${url}`); }
    }
  }
}

// ---------- CSP-Hashes der Inline-Skripte ----------
const scriptHashes = new Set();
for (const b of built) {
  for (const m of b.html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/type="application\/(ld\+)?json"/.test(m[1])) continue;
    scriptHashes.add(`'sha256-${createHash('sha256').update(m[2]).digest('base64')}'`);
  }
}

// ---------- Netlify-Header ----------
const csp = [
  "default-src 'self'",
  `script-src 'self' ${[...scriptHashes].join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');
write('_headers', `# Generiert von tools/build.mjs – nicht direkt bearbeiten.
/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
  Strict-Transport-Security: max-age=31536000

/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/assets/css/*
  Cache-Control: public, max-age=31536000, immutable

/assets/js/*
  Cache-Control: public, max-age=31536000, immutable

/assets/img/*
  Cache-Control: public, max-age=604800

/tools/*
  X-Robots-Tag: noindex
`);

// ---------- Bericht ----------
const todos = [...new Set(built.flatMap((b) => b.todos))];
console.log(`✔ ${built.length} Seiten gebaut: ${built.map((b) => b.file).join(', ')}`);
console.log(`  Speisekarte: ${stat.kategorien} Kategorien, ${stat.gerichte} Gerichte (${stat.vegetarisch} vegetarisch/vegan), Öffnungszeiten: ${zeiten.kurz}`);
console.log(`  CSS ${v.css} · JS ${v.js} · ${scriptHashes.size} Inline-Skript-Hashes in _headers`);
if (todos.length) console.log(`! Noch offen in content/betrieb.json: ${todos.join(', ')}`);
if (warnings.length) {
  console.log(`! ${warnings.length} Warnungen:\n  - ${warnings.join('\n  - ')}`);
  process.exitCode = 1;
}
