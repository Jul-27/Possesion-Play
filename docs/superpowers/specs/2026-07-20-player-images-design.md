# Spielerbilder aus Wikidata — Design

**Ziel:** Spielerfotos (Wikidata P18) überall dort anzeigen, wo das Spiel einen Spieler namentlich
zeigt — zuerst in „Wer passt nicht?", ebenso in Autocomplete, Karriere-Pfad, Errate den Star,
Daily-Star, Fußball-Kette und Elf des Tages. Fehlt ein Bild, tritt ein Initialen-Avatar an seine Stelle.

## Umfang

Bilder werden für Spieler mit **sl ≥ 40** vorgehalten (2.195 Spieler). Das deckt alle Pools ab, die
die Spiele gezielt anzeigen (Guess/Daily/Karriere/Elf = sl≥40; Wer passt nicht?/Kette = sl≥60).
Gemessen: Abdeckung bei sl≥60 = 100 %, bei sl≥40 hoch. Wer in Autocomplete/Freitext einen
unbekannteren Spieler nennt, erhält den Initialen-Avatar — kein kaputtes Bild.

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
- Lädt 160px-Thumbnails über Commons `Special:FilePath/<datei>?width=160` nach
  `public/players/<qid>.<ext>`. Idempotent (überspringt vorhandene Dateien), 429-Retry, kleiner
  Sleep, ordentlicher User-Agent. SVG wird übersprungen (keine Fotos).
- Schreibt `src/playerImages.js` — den Index:
  ```js
  // GENERIERT von data-pipeline/wikidata_images.mjs. Nicht von Hand editieren.
  export const PLAYER_IMAGES = { "lionel messi|1987": "Q615.jpg", … };
  ```

`npm run data:refresh` bekommt `wikidata_images.mjs` ans Ende der Kette angehängt.

## App

- `src/playerImage.js` — `imageFor(player)` → Dateiname oder `null`, via
  `PLAYER_IMAGES[norm(p.n) + "|" + p.by]`. Reine Funktion, testbar.
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

`src/playerImage.test.js` — `imageFor` trifft/verfehlt korrekt, mehrdeutige Schlüssel liefern `null`,
Initialen-Ableitung. Der Pipeline-Lauf selbst ist Netzwerkarbeit und wird nicht im Testlauf ausgeführt.
