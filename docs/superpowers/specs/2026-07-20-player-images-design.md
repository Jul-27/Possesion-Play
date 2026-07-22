# Spielerbilder aus Wikidata — Design

**Ziel:** Spielerfotos (Wikidata P18) überall dort anzeigen, wo das Spiel einen Spieler namentlich
zeigt — zuerst in „Wer passt nicht?", ebenso in Autocomplete, Karriere-Pfad, Errate den Star,
Daily-Star, Fußball-Kette und Elf des Tages. Fehlt ein Bild, tritt ein Initialen-Avatar an seine Stelle.

## Umfang

Bilder werden für Spieler mit **sl ≥ 40** vorgehalten (2.195 Spieler). Das deckt alle Pools ab, die
die Spiele gezielt anzeigen (Guess/Daily/Karriere/Elf = sl≥40; Wer passt nicht?/Kette = sl≥60).
Erreichte Abdeckung: 97 % (sl≥60), 91 % (sl≥40). Wer in Autocomplete/Freitext einen
unbekannteren Spieler nennt, erhält den Initialen-Avatar — kein kaputtes Bild.

## Hybrid statt Voll-Download (Korrektur nach Messung)

Ursprünglich sollten alle Bilder ins Repo. Der Lauf zeigte, dass Wikimedia Massenabrufe per
Token-Bucket drosselt — gemessen:

| Vorgehen | Ergebnis |
|---|---|
| 6 parallele Worker | ~90 % HTTP 429 |
| 1 Worker ohne Pause | 4 von 40 erfolgreich |
| 1 Worker, 3 s Abstand | im Dauerbetrieb ~3,6 Dateien/min |

Für alle ~2.100 Bilder wären das ~9 Stunden. Deshalb **hybrid**: Die 348 bereits geladenen
Thumbnails liegen lokal unter `public/players/` und haben Vorrang; alle übrigen lädt der Browser
des Spielers direkt vom Commons-CDN. Verteilte Einzelabrufe aus Spieler-Browsern sind normale
Nutzung und fallen nicht unter das Bulk-Limit. Der Index ist dadurch sofort vollständig
(1.997 Einträge), und das Repo wächst nur um ~3,5 MB statt ~20 MB.

Weitere Bilder lassen sich jederzeit mit `IMAGES_DOWNLOAD=1 node data-pipeline/wikidata_images.mjs`
nachziehen — der Lauf ist idempotent und verschiebt Einträge von „Commons" nach „lokal".

## Kein QID im Record → Index über Name+Geburtsjahr

Die Records (`{n, ln, by, nat, clubs, sl, pos, cp, t}`) speichern **keine Wikidata-QID**. Der
Abgleich läuft daher über `norm(name)|geburtsjahr`:

1. Die Pipeline lädt `PLAYERS`, bildet die Menge der vorhandenen Schlüssel `norm(n)|by` für sl≥40.
   Schlüssel, die auf **mehr als einen** Record zeigen (gleicher Name + Jahrgang), sind mehrdeutig
   und werden ausgeschlossen → Fallback statt falschem Foto.
2. Aus Wikidata kommen `{qid, label, by, p18}`. Der Schlüssel `norm(label)|by` wird nur übernommen,
   wenn er in der eindeutigen Wanted-Menge liegt.

So enthält der Index nur Schlüssel, die realen Records entsprechen. Label-Drift (z. B. „Xavi" ↔
„Xavi Hernández") führt höchstens dazu, dass ein einzelner Spieler den Fallback bekommt.

## Datenpipeline

Neues `data-pipeline/wikidata_images.mjs` (Muster wie `wikidata_roster.mjs` + `fetch_logos.mjs`):

- Fragt je Vereins-QID (`CLUB_QID`) und Nations-QID (`NATION_QID`) Spieler mit `sitelinks ≥ 40`
  und `wdt:P18` ab: QID, Label, Geburtsjahr, Bild-Dateiname. Dedupe über QID.
- Lädt (nur mit `IMAGES_DOWNLOAD=1`) 120px-Thumbnails direkt vom CDN
  `upload.wikimedia.org/.../thumb/<md5-pfad>/120px-<datei>` nach `public/players/<qid>.<ext>`,
  mit Rückfall auf `Special:FilePath`. Idempotent, 429-Retry, ordentlicher User-Agent.
  SVG wird übersprungen (keine Fotos). Commons rastet Breiten auf feste Stufen ein:
  `?width=100` trifft 120px (~8 KB), `?width=160` schon 250px (~29 KB).
- Schreibt `src/playerImages.js` — zwei Karten:
  ```js
  export const PLAYER_IMG_LOCAL   = { "lionel messi|1987": "Q615.jpg", … };      // liegt lokal
  export const PLAYER_IMG_COMMONS = { "jordi alba|1989": "a/ab/Jordi_Alba.jpg", … }; // vom CDN
  ```
  Der Commons-Pfad ist `<md5[0]>/<md5[0..1]>/<Dateiname>`; die volle Thumbnail-URL baut
  `commonsUrl()` in der App (der Dateiname steckt zweimal darin, einmal mit `120px-`-Präfix).

`npm run data:refresh` bekommt `wikidata_images.mjs` ans Ende der Kette angehängt.

## App

- `src/playerImage.js` — `imageUrlFor(player)` → URL oder `null` (lokal vor Commons),
  plus `imageFor`, `commonsUrl`, `initialsOf`, `avatarHue`. Reine Funktionen, testbar.
- `Avatar`-Komponente in `Emblems.jsx` — rendert `<img src="/players/<datei>">` mit `onError`-
  Fallback auf einen Initialen-Kreis (erste Buchstaben von Vor-/Nachname, Farbe deterministisch aus
  dem Namen). Auch ohne Index-Treffer sofort Initialen.
- Eingebaut in: `OddOne.jsx` (Karten), Autocomplete-Dropdown (`Career`, `Chain`, `Eleven` teilen
  dasselbe `.sug`-Markup), `Career.jsx` (Auflösung), `Guess.jsx`/`Daily.jsx` (Ziel-Enthüllung),
  `Chain.jsx` (Kettenglieder), `Eleven.jsx` (besetzte Slots).

## Recht

Wie bei den Vereinslogos: Commons-Bilder tragen Lizenzen (meist CC-BY-SA). Grundlage ist die
Entscheidung des Owners, das Spiel privat im Freundeskreis zu betreiben.

## Tests

`src/playerImage.test.js` — Schlüsselbildung inkl. Sonderzeichen, Vorrang lokal vor Commons,
URL-Bau mit Kodierung, kein Schlüssel in beiden Karten, und der Echtdaten-Test, dass **kein
Index-Eintrag verwaist** ist (jeder gehört zu einem realen Record). Bewusst **keine**
Abdeckungsschwelle: Wie viele Bilder lokal liegen, ist eine Daten-, keine Code-Eigenschaft.
