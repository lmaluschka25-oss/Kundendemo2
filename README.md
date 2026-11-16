# Ewin's Kebap & Pizza Haus – Website

One-Pager für **Ewin's Kebap & Pizza Haus**, Ringstraße 22, 92339 Beilngries (gegenüber der Polizeiinspektion).
Reines HTML/CSS/JS ohne Frameworks, ohne Cookies und ohne externe Dienste.

## Ansehen

- **Schnell:** `index.html` per Doppelklick im Browser öffnen.
- **Wie online (empfohlen zum Testen):** im Projektordner `python -m http.server 8000` starten und `http://localhost:8000` öffnen.

## Was drin ist

- Hero mit Live-Status („Jetzt geöffnet · bis 20:30“, automatisch nach deutscher Zeit), Glut-Funken-Animation und Anruf-Button
- Klassiker-Kacheln (Döner, Ewin's Pizza, Dürüm, Lahmacun, Pide, Falafel), auf dem Handy wischbar
- Komplette Speisekarte (73 Gerichte, 10 Kategorien) mit Suche (findet auch „doner“ ohne Umlaut), Veggie-Filter und mitlaufenden Kategorien
- Echte Gästebewertung (Tripadvisor, 5,0)
- Öffnungszeiten mit „Heute“-Markierung und Restzeit bis Ladenschluss
- Eigene, aus OpenStreetMap gezeichnete Lagekarte (Laden + Polizei), Klick öffnet die Route in Google Maps bzw. Apple Karten auf dem iPhone
- Mobile Aktionsleiste (Anrufen · Route · Karte), Vorschaubild für WhatsApp und Social Media, Favicon
- SEO: strukturierte Daten (Restaurant, Öffnungszeiten, Adresse, Geo-Koordinaten), Meta-Tags
- DSGVO-freundlich: Schriften lokal, keine Cookies, kein Tracking, Karte ohne Google-Einbettung

Lighthouse (lokal mit gzip gemessen): Desktop 100/100/100/100, Mobil Performance 93–95, Barrierefreiheit, Best Practices und SEO jeweils 100.

## Inhalte ändern

| Was | Wo |
|---|---|
| Speisekarte & Preise | `content/speisekarte.json` bearbeiten, danach `node tools/build.mjs` ausführen |
| Kennzeichnungen | im Feld `tags`: `beliebt`, `haus`, `scharf`, `vegetarisch`, `vegan` |
| Öffnungszeiten | `assets/js/main.js` (`OPEN`/`CLOSE`, `HOURS`), Liste in `index.html` (Abschnitt „Öffnungszeiten“), JSON-LD im `<head>` |
| Texte, Telefonnummer | direkt in `index.html` |
| Fotos | `assets/img/` (WebP, jeweils mehrere Breiten). Neue Fotos am besten in gleicher Benennung ablegen |
| Vorschaubild (WhatsApp) | Vorlage `tools/og.html`, Screenshot in 1200×630 → `assets/img/og-image.jpg` |
| Lagekarte | `node tools/karte-generieren.mjs <osm.json>` (Overpass-Export mit `out geom`), danach `node tools/build.mjs` |

## Vor dem Livegang

- [ ] **Speisekarte und Preise mit dem Inhaber abgleichen.** Basis ist die Online-Karte von Ewin's Kebabhaus in Greding. „Pizza Beilngries“ ist ein Namensvorschlag.
- [ ] **Öffnungszeiten bestätigen** (laut Online-Einträgen täglich 10:30–20:30 Uhr)
- [ ] **Eigene Fotos** vom Laden, Team und den Gerichten (aktuell lizenzfreie Unsplash-Fotos als Platzhalter)
- [ ] **Impressum & Datenschutz** ausfüllen (gelb markierte Platzhalter) und rechtlich prüfen lassen
- [ ] **Domain** festlegen. Dann `og:image` auf eine absolute URL umstellen (`https://…/assets/img/og-image.jpg`) und einen `canonical`-Link ergänzen
- [ ] Website im Google-Unternehmensprofil eintragen. In OpenStreetMap steht unter Ringstraße 22 noch der alte Name „Arin“, das sollte korrigiert werden

## Bildnachweise

Fotos von Unsplash (Unsplash-Lizenz, kommerzielle Nutzung erlaubt): engin akyurt (Dönerspieß), Yoad Shejtman (Döner),
Ruyan Ayten (Dürüm), Husien Bisky (Lahmacun), mahsa shamshiri fard (Pide), P S (Pizza-Stück), Sahal Hameed (Pizza auf Brett),
SHOT (Pizza vor dem Ofen), Anton (Falafel), Alexander Mils (Dönerteller), Klara Kulikova (Feuer), Francis Ledger (Spieß-Schnitt).
Kartendaten © OpenStreetMap-Mitwirkende (ODbL). Schriften: Bricolage Grotesque, Instrument Serif, DM Sans (SIL Open Font License).
