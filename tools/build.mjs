// Baut die Speisekarte (content/speisekarte.json) und die Lagekarte
// (content/karte.svg) in index.html ein.
//
// Aufruf (im Projektordner):  node tools/build.mjs
//
// Ändern der Speisekarte: content/speisekarte.json bearbeiten, Skript ausführen, fertig.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const menu = JSON.parse(read('content/speisekarte.json'));
const karte = read('content/karte.svg');
let html = read('index.html');

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const price = (p) => p.toFixed(2).replace('.', ',') + '&nbsp;€';

const TAGS = {
  beliebt: { cls: 'pop', label: 'Beliebt', icon: 'i-flame' },
  haus: { cls: 'house', label: 'Haus-Tipp', icon: 'i-star' },
  scharf: { cls: 'hot', label: 'Scharf', icon: 'i-chili' },
  vegetarisch: { cls: 'veg', label: 'Veggie', icon: 'i-leaf' },
  vegan: { cls: 'vegan', label: 'Vegan', icon: 'i-leaf' },
};

const tagHtml = (t) => {
  const def = TAGS[t];
  if (!def) throw new Error(`Unbekannter Tag "${t}" – erlaubt: ${Object.keys(TAGS).join(', ')}`);
  return `<span class="tag tag--${def.cls}"><svg class="icon" aria-hidden="true"><use href="#${def.icon}"/></svg>${def.label}</span>`;
};

const chips = menu.kategorien
  .map((k) => `<a class="chip" href="#kat-${k.id}" data-chip="${k.id}">${esc(k.name)}</a>`)
  .join('\n            ');

const categories = menu.kategorien
  .map((k) => {
    const items = k.gerichte
      .map((g) => {
        const veg = g.tags.includes('vegetarisch') || g.tags.includes('vegan');
        const search = `${g.name} ${g.beschreibung} ${k.name}`.toLowerCase();
        const tags = g.tags.length ? `<span class="menu-item-tags">${g.tags.map(tagHtml).join('')}</span> ` : '';
        return `
            <li class="menu-item" data-veg="${veg ? 1 : 0}" data-search="${esc(search)}">
              <div class="menu-item-row">
                <h4 class="menu-item-name">${esc(g.name)}</h4>
                <span class="menu-item-dots" aria-hidden="true"></span>
                <span class="menu-item-price">${price(g.preis)}</span>
              </div>
              <p class="menu-item-desc">${tags}${esc(g.beschreibung)}</p>
            </li>`;
      })
      .join('');
    return `
          <section class="menu-cat" id="kat-${k.id}" data-cat="${k.id}" aria-labelledby="kat-${k.id}-t">
            <header class="menu-cat-head">
              <h3 class="menu-cat-title" id="kat-${k.id}-t">${esc(k.name)}</h3>
              <p class="menu-cat-sub">${esc(k.untertitel)}</p>
            </header>
            <ul class="menu-items">${items}
            </ul>
          </section>`;
  })
  .join('\n');

const replaceBetween = (src, name, content) => {
  const re = new RegExp(`(<!-- BUILD:${name}:START -->)[\\s\\S]*?(<!-- BUILD:${name}:END -->)`);
  if (!re.test(src)) throw new Error(`Marker BUILD:${name} nicht in index.html gefunden`);
  return src.replace(re, `$1\n${content}\n$2`);
};

html = replaceBetween(html, 'CHIPS', `            ${chips}`);
html = replaceBetween(html, 'MENU', `${categories}\n          <p class="menu-footnote">${esc(menu.fussnote)}</p>`);
html = replaceBetween(html, 'KARTE', karte);

const count = menu.kategorien.reduce((n, k) => n + k.gerichte.length, 0);
html = html.replace(/(id="stat-gerichte"[^>]*data-count-to=")\d+(")/, `$1${count}$2`);

writeFileSync(join(root, 'index.html'), html);
console.log(`index.html aktualisiert: ${menu.kategorien.length} Kategorien, ${count} Gerichte, Karte ${(karte.length / 1024).toFixed(1)} KB`);
