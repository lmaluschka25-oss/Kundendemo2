# Arin's Kebap & Pizza Haus – Website

Mehrseitige Website für **Arin's Kebap & Pizza Haus**, Ringstraße 22, 92339 Beilngries (gegenüber der Polizeiinspektion) – nach dem Besitzerwechsel.
Reines HTML/CSS/JS ohne Frameworks, ohne Cookies, ohne Tracking, ohne eingebettete Fremddienste.

## Seiten

| Seite | Datei | Highlights |
|---|---|---|
| Start | `index.html` | 3D-Schriftring, der sich wie ein Dönerspieß ums Hero-Bild dreht (beschleunigt beim Scrollen) · „Neues Kapitel“ zum Besitzerwechsel · Klassiker-Kacheln · Scroll-Geschichte „Vom Feuer auf die Hand“ · Pizza-Banner · Bewertung · Glut-Uhr + Lagekarte · Anruf-Band |
| Speisekarte | `speisekarte.html` | Inhaltsregister · Suche (findet „doner“ auch ohne Umlaut) · Veggie-Filter · **Bestellzettel**: Gerichte antippen, Summe sehen, anrufen und vorlesen, teilen/kopieren für Sammelbestellungen · Druckversion der Karte |
| Über uns | `ueber-uns.html` | „Ein Haus. Zwei Feuer.“ · Neustart mit Leuchtschrift · Spieß & Ofen · vier Versprechen · Beilngries/Altmühltal |
| Zeiten & Anfahrt | `besuch.html` | Live-Status mit Uhrzeit · Glut-Uhr (24-Stunden-Ziffernblatt mit glühendem Öffnungsbogen) · Öffnungszeiten · OSM-Lagekarte · Anfahrt · FAQ |
| Impressum · Datenschutz · AGB | `impressum.html` · `datenschutz.html` · `agb.html` | Ziehen alle Angaben aus `content/betrieb.json`; fehlende Pflichtangaben erscheinen gelb markiert |
| 404 | `404.html` | Eigene Fehlerseite (Netlify verwendet sie automatisch) |

## Ansehen

Im Projektordner `python -m http.server 8000` starten und `http://localhost:8000` öffnen.
(Doppelklick auf `index.html` geht auch, Seitenübergänge und Bestellzettel-Speicher funktionieren aber erst über einen Server.)

## Inhalte ändern

**Wichtig:** Die `.html`-Dateien im Hauptordner werden erzeugt – nicht direkt bearbeiten. Stattdessen:

| Was | Wo |
|---|---|
| Inhaber, E-Mail, USt-IdNr., Telefon, Adresse, Öffnungszeiten, Bewertung, Domain | `content/betrieb.json` |
| Speisekarte & Preise | `content/speisekarte.json` (Tags: `beliebt`, `haus`, `scharf`, `vegetarisch`, `vegan`) |
| Texte der einzelnen Seiten | `src/seiten/*.html` |
| Header, Footer, Mobilmenü, Icons, Anruf-Band, Bewertung | `src/teile/*.html` |
| Design | `assets/css/style.css` |
| Interaktionen | `assets/js/main.js` |
| Lagekarte | `node tools/karte-generieren.mjs <osm.json>` (Overpass-Export mit `out geom`) |
| Vorschaubild (WhatsApp & Co.) | Vorlage `tools/og.html`, Screenshot 1200×630 → `assets/img/og-image.jpg` |

Danach im Projektordner: **`node tools/build.mjs`**
Der Generator baut alle Seiten, prüft sämtliche internen Links und Anker, meldet fehlende Pflichtangaben und erzeugt `sitemap.xml`, `robots.txt`, `site.webmanifest` und `_headers`.

Platzhalter in den Vorlagen: `{{telefon.anzeige}}` (Wert aus betrieb.json), `{{> footer}}` (Teil einfügen), `{{preis:Döner}}`, `{{anzahl:pizza}}`, `{{stat.vegetarisch}}`, `{{todo:inhaber|Text}}`, `{{#if feld}}…{{else}}…{{/if}}`.
Zahlen wie „73 Gerichte“, „22 Pizzen“ oder „25 vegetarisch“ und alle Preise auf der Startseite werden automatisch aus der Speisekarte berechnet.

## Technik & Qualität

- **Sicherheit:** `_headers` setzt eine strenge Content-Security-Policy (Inline-Skripte per SHA-256-Hash freigegeben), HSTS, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`. `_redirects` blendet `src/`, `tools/`, `content/` und diese README auf Netlify aus.
- **Modern:** Seitenübergänge (View Transitions), sofortiges Laden beim Überfahren von Links (Speculation Rules, Chrome/Edge), Glut-Uhr und Schriftring als eigene Grafiken, PWA-Manifest mit Icons, Druck-Layout für die Karte, „reduzierte Bewegung“ wird respektiert.
- **Datenschutz:** keine Cookies, kein Tracking, Schriften und Karte lokal. Der Bestellzettel liegt nur im `sessionStorage` des Browser-Tabs und wird nie übertragen.
- **Gemessen** (lokal mit Brotli wie bei Netlify, Lighthouse 12): Mobil Performance 94–100, Barrierefreiheit 100, Best Practices 100, SEO 100 (Rechtsseiten bewusst `noindex`). Desktop durchgehend 100. HTML valide (html-validate), keine CSP-Verstöße, keine Konsolenfehler.

## Vor dem Livegang

**Rechtliches** – die Texte sind ein sorgfältiger Entwurf, aber keine Rechtsberatung. Bitte anwaltlich prüfen lassen.

- [ ] In `content/betrieb.json` eintragen: `inhaber`, `email`, `ust_id` (ohne USt-IdNr.: `"keine"`), ggf. `wirtschafts_id`; `handelsregister` nur bei Eintragung (e. K.); `aufsichtsbehoerde` nur, wenn eine Erlaubnis nötig ist (z. B. Gaststättenerlaubnis bei Alkoholausschank)
- [ ] Log-Speicherdauer bei Netlify erfragen (im Trust Center „auf Anfrage“) und als `hosting.log_speicherdauer` eintragen, z. B. `"30 Tagen"`
- [ ] AGB im Laden gut sichtbar aushängen – sonst gelten sie für Vor-Ort-Bestellungen nicht (§ 305 Abs. 2 BGB). Kulanzregel zur kostenlosen Stornierung (§ 5 Abs. 2 AGB) mit dem Inhaber abstimmen. Falls es einen Lieferservice gibt: AGB ergänzen
- [ ] Allergen-Dokumentation im Laden bereithalten (AGB § 7, § 4 LMIDV)
- [ ] Getränkemengen für alle Getränke in die Karte aufnehmen (z. B. „0,33 l“, Preisangabenverordnung)
- [ ] Datenschutz: tatsächliche Löschpraxis bei Bestellungen bestätigen; falls E-Mails über einen Anbieter laufen, diesen ergänzen
- [ ] Bewertung: Zitat und Gesamtwert auf Tripadvisor prüfen und `bewertung.stand` aktualisieren (Transparenzhinweis nach § 5b Abs. 3 UWG ist eingebaut)
- [ ] „Döner“ mit Geflügelfleisch: Nach den Leitsätzen für Fleisch sollte Geflügel-Döner als solcher erkennbar benannt sein (z. B. „Hähnchen-Döner“) – mit dem Inhaber klären

**Inhalt**

- [ ] Speisekarte und Preise mit dem Inhaber abgleichen (Basis war die Online-Karte eines anderen Betriebs). „Pizza Beilngries“ ist ein Namensvorschlag
- [ ] Öffnungszeiten bestätigen (laut Online-Einträgen täglich 10:30–20:30 Uhr)
- [ ] Eigene Fotos von Laden, Team und Gerichten statt der Unsplash-Platzhalter
- [ ] Domain festlegen und in `content/betrieb.json` → `website` eintragen. Canonical-Links, Vorschaubild, strukturierte Daten und Sitemap passen sich beim nächsten Build automatisch an
- [ ] Website im Google-Unternehmensprofil eintragen; in OpenStreetMap steht unter Ringstraße 22 noch der alte Name „Arin“

## Bildnachweise & Lizenzen

Fotos von Unsplash (Unsplash-Lizenz, kommerzielle Nutzung erlaubt): engin akyurt (Dönerspieß), Yoad Shejtman (Döner),
Ruyan Ayten (Dürüm), Husien Bisky (Lahmacun), mahsa shamshiri fard (Pide), P S (Pizza-Stück), Sahal Hameed (Pizza auf Brett),
SHOT (Pizza vor dem Ofen), Anton (Falafel), Alexander Mils (Dönerteller), Klara Kulikova (Feuer), Francis Ledger (Spieß-Schnitt).
Kartendaten © OpenStreetMap-Mitwirkende (ODbL). Schriften: Bricolage Grotesque, Instrument Serif, DM Sans (SIL Open Font License, `assets/fonts/LICENSE-OFL.txt`).
Icons teils nach Lucide (ISC-Lizenz, `assets/LICENSE-LUCIDE.txt`).
