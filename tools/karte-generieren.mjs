// Erzeugt aus OpenStreetMap-Daten (Overpass-JSON mit "out geom") eine
// stilisierte SVG-Lagekarte im Look der Website.
//
// Aufruf:  node tools/karte-generieren.mjs <osm.json> content/karte.svg
// Danach:  node tools/build.mjs   (fügt die Karte in index.html ein)
//
// Kartendaten © OpenStreetMap-Mitwirkende, ODbL.

import { readFileSync, writeFileSync } from 'node:fs';

const [, , inFile, outFile = 'content/karte.svg'] = process.argv;
if (!inFile) {
  console.error('Aufruf: node tools/karte-generieren.mjs <osm.json> [ausgabe.svg]');
  process.exit(1);
}

// Mittelpunkt = Ladengeschäft Ringstraße 22 (OSM way 165899306)
const SHOP = { lat: 49.035659, lon: 11.470867 };
// Sichtbarer Ausschnitt in Metern relativ zum Laden
const VIEW = { x: -330, y: -270, w: 720, h: 540 };
const MARGIN = 80;

const COS = Math.cos((SHOP.lat * Math.PI) / 180);
const project = (lat, lon) => [
  (lon - SHOP.lon) * COS * 111320,
  (SHOP.lat - lat) * 110574,
];

const data = JSON.parse(readFileSync(inFile, 'utf8'));
const els = data.elements.filter((e) => e.type === 'way' && e.geometry);
const tags = (e) => e.tags || {};

const inView = (pts) =>
  pts.some(
    ([x, y]) =>
      x > VIEW.x - MARGIN &&
      x < VIEW.x + VIEW.w + MARGIN &&
      y > VIEW.y - MARGIN &&
      y < VIEW.y + VIEW.h + MARGIN,
  );

const toPts = (e) => e.geometry.map((p) => project(p.lat, p.lon));

// Punkte runden und sehr kurze Segmente weglassen
const simplify = (pts) => {
  const out = [];
  for (const [x, y] of pts) {
    const r = [Math.round(x), Math.round(y)];
    const last = out[out.length - 1];
    if (!last || Math.hypot(r[0] - last[0], r[1] - last[1]) >= 2) out.push(r);
  }
  const lastRaw = pts[pts.length - 1];
  const lastOut = out[out.length - 1];
  const end = [Math.round(lastRaw[0]), Math.round(lastRaw[1])];
  if (lastOut[0] !== end[0] || lastOut[1] !== end[1]) out.push(end);
  return out;
};

const d = (pts, close = false) =>
  'M' + pts.map(([x, y]) => `${x} ${y}`).join(' ') + (close ? 'Z' : '');

const centroid = (pts) => {
  const s = pts.reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
  return [s[0] / pts.length, s[1] / pts.length];
};

const length = (pts) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++)
    l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
};

// ---------- Ebenen sammeln ----------
const layers = {
  water: [],
  waterway: [],
  green: [],
  buildings: [],
  path: [],
  service: [],
  minor: [],
  major: [],
};
let shopPoly = null;
let policePoly = null;
let townhall = null;
const streets = new Map(); // name -> [{pts, len}]

const ROAD_CLASS = {
  primary: 'major', secondary: 'major', tertiary: 'major', trunk: 'major',
  primary_link: 'major', secondary_link: 'major', tertiary_link: 'major',
  residential: 'minor', unclassified: 'minor', living_street: 'minor',
  pedestrian: 'minor', road: 'minor',
  service: 'service',
  footway: 'path', path: 'path', cycleway: 'path', steps: 'path', track: 'path',
};

for (const e of els) {
  const t = tags(e);
  const raw = toPts(e);
  if (!inView(raw)) continue;
  const pts = simplify(raw);
  if (pts.length < 2) continue;

  if (e.id === 165899306) { shopPoly = pts; continue; }
  if (t.amenity === 'police') { policePoly = pts; continue; }
  if (t.amenity === 'townhall') { townhall = centroid(pts); }

  if (t.natural === 'water') layers.water.push(d(pts, true));
  else if (t.waterway) layers.waterway.push({ d: d(pts), kind: t.waterway });
  else if (t.leisure || t.landuse) layers.green.push(d(pts, true));
  else if (t.building) layers.buildings.push(d(pts, true));
  else if (t.highway && ROAD_CLASS[t.highway]) {
    if (t.highway === 'proposed') continue;
    layers[ROAD_CLASS[t.highway]].push(d(pts));
    if (t.name && ROAD_CLASS[t.highway] !== 'path' && ROAD_CLASS[t.highway] !== 'service') {
      const visible = pts.filter(
        ([x, y]) => x > VIEW.x + 95 && x < VIEW.x + VIEW.w - 95 && y > VIEW.y + 45 && y < VIEW.y + VIEW.h - 45,
      );
      if (visible.length >= 2) {
        if (!streets.has(t.name)) streets.set(t.name, []);
        streets.get(t.name).push({ pts: visible, len: length(visible) });
      }
    }
  }
}

// ---------- Straßennamen ----------
const LABEL_STREETS = [
  'Ringstraße', 'Eichstätter Straße', 'Hauptstraße', 'Neumarkter Straße',
  'Hirschberger Straße', 'Kelheimer Straße', 'Stadtgraben', 'Innerer Graben',
  'Maria-Hilf-Straße', 'Ingolstädter Straße', 'Utzmühlstraße',
];
const labels = [];
let labelId = 0;
for (const name of LABEL_STREETS) {
  const cands = streets.get(name);
  if (!cands) continue;
  const best = cands.sort((a, b) => b.len - a.len)[0];
  if (best.len < 110) continue;
  let pts = best.pts;
  // Text immer lesbar von links nach rechts
  if (pts[0][0] > pts[pts.length - 1][0]) pts = [...pts].reverse();
  labels.push({ id: `str-${labelId++}`, name, d: d(pts) });
}

// ---------- SVG ----------
const vb = `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`;
const join = (arr) => arr.join('');

const policeC = policePoly ? centroid(policePoly) : null;
const shopC = shopPoly ? centroid(shopPoly) : [0, 0];

const svg = `<svg class="karte" viewBox="${vb}" preserveAspectRatio="xMidYMid slice" role="img" aria-labelledby="karte-titel" xmlns="http://www.w3.org/2000/svg">
<title id="karte-titel">Lageplan: Ewin's Kebap &amp; Pizza Haus, Ringstraße 22 in Beilngries, gegenüber der Polizeiinspektion</title>
<style>
.k-green{fill:#1c2417}
.k-water{fill:#143039}
.k-waterway{fill:none;stroke:#1a4352;stroke-width:8;stroke-linecap:round;stroke-linejoin:round}
.k-waterway--stream,.k-waterway--ditch,.k-waterway--drain{stroke-width:3}
.k-waterway--canal{stroke-width:16}
.k-building{fill:#2b2019}
.k-road{fill:none;stroke-linecap:round;stroke-linejoin:round}
.k-road--path{stroke:#4d3e32;stroke-width:1.6;stroke-dasharray:3 4}
.k-road--service{stroke:#4f4035;stroke-width:4}
.k-road--minor{stroke:#806c59;stroke-width:7}
.k-road--major{stroke:#cdb79c;stroke-width:10}
.k-labels{font-family:'DM Sans Variable','DM Sans',system-ui,sans-serif;font-weight:700;font-size:11px;letter-spacing:.16em;fill:#f6e7d3;fill-opacity:.72;paint-order:stroke;stroke:#17110d;stroke-width:3.5px;stroke-linejoin:round}
.k-police{fill:#35557e;stroke:#86acd9;stroke-width:1.5}
.k-police-label rect{fill:#1b283a;stroke:#86acd9;stroke-width:1.2}
.k-police-label text{font-family:'DM Sans Variable','DM Sans',system-ui,sans-serif;font-weight:700;font-size:11px;letter-spacing:.14em;fill:#d3e3f6}
.k-poi circle{fill:#cdb79c}
.k-poi text{font-family:'DM Sans Variable','DM Sans',system-ui,sans-serif;font-weight:600;font-size:12px;fill:#f6e7d3;fill-opacity:.78;paint-order:stroke;stroke:#17110d;stroke-width:3.5px}
.k-shop{fill:#ff5b1f}
.k-dot{fill:#ff5b1f;stroke:#fff3e4;stroke-width:3.5}
.k-pulse{fill:#ff5b1f;opacity:.5;transform-box:fill-box;transform-origin:center;animation:k-pulse 2.6s cubic-bezier(.2,.6,.3,1) infinite}
.k-pulse--2{animation-delay:1.3s}
@keyframes k-pulse{0%{transform:scale(.6);opacity:.7}100%{transform:scale(3.4);opacity:0}}
.k-shop-label rect{fill:#ff5b1f}
.k-shop-label text{font-family:'Bricolage Grotesque Variable','Bricolage Grotesque',system-ui,sans-serif;font-weight:800;font-size:18px;fill:#140f0c}
@media (prefers-reduced-motion:reduce){.k-pulse{animation:none;opacity:.25}}
@media (max-width:640px){.k-labels,.k-poi{display:none}}
</style>
<defs>
<radialGradient id="karte-glow"><stop offset="0" stop-color="#ff5b1f" stop-opacity=".55"/><stop offset="1" stop-color="#ff5b1f" stop-opacity="0"/></radialGradient>
<radialGradient id="karte-vignette" cx="50%" cy="50%" r="75%"><stop offset=".55" stop-color="#120d0a" stop-opacity="0"/><stop offset="1" stop-color="#120d0a" stop-opacity=".92"/></radialGradient>
${labels.map((l) => `<path id="${l.id}" d="${l.d}"/>`).join('')}
</defs>
<rect x="${VIEW.x - 50}" y="${VIEW.y - 50}" width="${VIEW.w + 100}" height="${VIEW.h + 100}" fill="#17110d"/>
<path class="k-green" d="${join(layers.green)}"/>
<path class="k-water" d="${join(layers.water)}"/>
${layers.waterway.map((w) => `<path class="k-waterway k-waterway--${w.kind}" d="${w.d}"/>`).join('')}
<path class="k-building" d="${join(layers.buildings)}"/>
<path class="k-road k-road--path" d="${join(layers.path)}"/>
<path class="k-road k-road--service" d="${join(layers.service)}"/>
<path class="k-road k-road--minor" d="${join(layers.minor)}"/>
<path class="k-road k-road--major" d="${join(layers.major)}"/>
<g class="k-labels">${labels
  .map((l) => `<text dy="4"><textPath href="#${l.id}" startOffset="50%" text-anchor="middle">${l.name.toUpperCase()}</textPath></text>`)
  .join('')}</g>
${policePoly ? `<path class="k-police" d="${d(policePoly, true)}"/>` : ''}
${townhall ? `<g class="k-poi" transform="translate(${Math.round(townhall[0])} ${Math.round(townhall[1])})"><circle r="4"/><text x="-9" y="4" text-anchor="end">Rathaus</text></g>` : ''}
${policeC ? `<g class="k-police-label" transform="translate(${Math.round(policeC[0])} ${Math.round(policeC[1]) - 30})"><rect x="-42" y="-14" width="84" height="26" rx="13"/><text y="4" text-anchor="middle">POLIZEI</text></g>` : ''}
<circle cx="${Math.round(shopC[0])}" cy="${Math.round(shopC[1])}" r="120" fill="url(#karte-glow)" class="k-glow"/>
${shopPoly ? `<path class="k-shop" d="${d(shopPoly, true)}"/>` : ''}
<g class="k-pin" transform="translate(${Math.round(shopC[0])} ${Math.round(shopC[1])})">
<circle class="k-pulse" r="14"/><circle class="k-pulse k-pulse--2" r="14"/>
<circle class="k-dot" r="9"/>
</g>
<g class="k-shop-label" transform="translate(${Math.round(shopC[0]) + 18} ${Math.round(shopC[1]) + 46})"><rect x="0" y="-19" width="128" height="34" rx="17"/><text x="64" y="4" text-anchor="middle">Ewin's</text></g>
<rect x="${VIEW.x - 50}" y="${VIEW.y - 50}" width="${VIEW.w + 100}" height="${VIEW.h + 100}" fill="url(#karte-vignette)" pointer-events="none"/>
</svg>`;

writeFileSync(outFile, svg);
console.log(`Karte geschrieben: ${outFile} (${(svg.length / 1024).toFixed(1)} KB)`);
console.log('Straßenlabels:', labels.map((l) => l.name).join(', '));
console.log('Laden:', shopC.map(Math.round), 'Polizei:', policeC && policeC.map(Math.round), 'Rathaus:', townhall && townhall.map(Math.round));
