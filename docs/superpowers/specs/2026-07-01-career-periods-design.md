# Design: Karrierezeiträume — Teamkollegen-Frage & Ära-Felder

**Datum:** 2026-07-01
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** Neues Datenfeld `cp` (Club-Perioden) via Wikidata + zwei direkte
Nutzungen: (1) Frage-Dimension „Teamkollege von …?" in Guess-Duell und
Daily-Star, (2) drei Ära-Spezialfelder „Aktiv in den 90ern/2000ern/2010ern"
für Hex-Board und Raster.

## Entscheidungen (aus dem Brainstorming)

„Beides": Teamkollegen-Frage + Ära-Felder in einem PR.

## Nicht-Ziele (YAGNI)

- Kein Karriere-Pfad-Quiz (Daten bereiten es nur vor).
- Keine Zeitraum-Anzeige im Autocomplete-Dropdown (Spoiler-Regel).
- Keine Monatsgenauigkeit (nur Jahre), keine Nationalteam-Perioden.

## Architektur

### A. Datenformat (`src/players.js`)

Optionales Feld `cp`: Array `[["FCB",1998,2004],["RMA",2004,2007]]`
(Club-Key, von-Jahr, bis-Jahr; **offenes Ende = `0`** = „bis heute";
mehrere Engagements beim selben Verein = mehrere Einträge). `clubs` bleibt
unverändert. Fehlendes `cp` ⇒ Features antworten konservativ „kein Match"
(missing is better than wrong).

### B. Pipeline — `data-pipeline/wikidata_careers.mjs` (neu)

- Importiert die **verifizierte** `CLUB_QID`-Tabelle und `norm` aus
  `wikidata_roster.mjs` (dort exportiert).
- Pro Verein: `?p p:P54 ?st . ?st ps:P54 wd:<QID> ; pq:P580 ?s .
  OPTIONAL { ?st pq:P582 ?e } ; P106=Fußballspieler; P569→by` →
  Perioden `{key, from: YEAR(s), to: YEAR(e) || 0}`.
- Match über `norm(name)|by`; übernommen werden nur Club-Keys, die bereits
  in `clubs` des Spielers stehen (Konsistenz mit Roster inkl. Overrides).
- Additiv/idempotent: setzt `cp` neu (aus frischer Wikidata-Antwort),
  alle anderen Felder unangetastet; Perioden sortiert (from, key).
- **`recToString` in allen vier Pipeline-Skripten** (`wikidata_roster.mjs`,
  `wikidata_honours.mjs`, `wikidata_honours_extra.mjs`,
  `wikidata_positions.mjs`) schreibt künftig auch `cp` (pos-Falle für
  immer geschlossen).

### C. Engine (`src/gameData.js`)

```js
// Perioden-Überlappung zweier Spieler bei gemeinsamem Verein.
// Ende 0 = offen (bis heute). Beide brauchen cp, sonst false.
export function wereTeammates(a, b) { /* max(f1,f2) <= min(t1||∞, t2||∞) je gemeinsamem Club-Key */ }

// Aktiv im Jahrzehnt [from, to]: irgendeine cp-Periode überlappt.
export function activeInRange(p, from, to) { /* false ohne cp */ }
```

- `answerGuessQuestion`: neue Dimension `mate` — `val = { n, cp }`
  (Snapshot des Referenzspielers) → `wereTeammates(player, val)`.
- `guessQuestionLabel`: `mate` → `„Teamkollege von <n>?"`.
- Drei neue `SPECIALS` (3 → 6, nutzen den vorhandenen `test:`-Mechanismus):

```js
{ key: "A90", label: "90ER AKTIV", icon: "📼", name: "Aktiv in den 90ern",   test: (p) => activeInRange(p, 1990, 1999) },
{ key: "A00", label: "00ER AKTIV", icon: "💿", name: "Aktiv in den 2000ern", test: (p) => activeInRange(p, 2000, 2009) },
{ key: "A10", label: "10ER AKTIV", icon: "📱", name: "Aktiv in den 2010ern", test: (p) => activeInRange(p, 2010, 2019) },
```

Hex-Board (`buildBoardSerial` wählt 3 aus jetzt 6 SPECIALS) und Raster-Pool
profitieren automatisch; `playerMatchesHex`/`gridCellMatches` unverändert.

### D. UI (`src/Guess.jsx`, `src/Daily.jsx`)

- Neuer Dimensions-Chip **„Teamkollege"** (`mate`): Autocomplete über
  `suggestPlayers` (wie Tipp-Eingabe) → Auswahl stellt die Frage mit
  `val = { n: ref.n, cp: ref.cp || [] }`.
- `sigOf`: `mate` → `mate:<norm(n)>` (Doppelfrage-Sperre pro Referenzspieler).
- Referenzspieler ohne `cp` sind wählbar (Antwort dann „Nein" —
  konservativ korrekt zur Datenlage).

## Datenfluss

Pipeline-Lauf → `cp` in players.js → Engine-Funktionen konsumieren `cp`
client-seitig (Duell: Antwort wird wie bisher in `last_move.log` geteilt;
Daily: localStorage).

## Fehlerfälle / Edge Cases

- Offenes Ende (`to = 0`) ⇒ als ∞ behandeln (aktiver Spieler).
- Spieler ohne `cp` (alte/unvollständige Wikidata-Daten) ⇒ `wereTeammates`
  und `activeInRange` liefern `false`.
- Mehrfach-Engagements ⇒ jede Periode einzeln geprüft.
- Grenzjahr zählt: Überlappung inklusiv (Wechsel im Sommer 2004 ⇒
  2004 zählt für beide Vereine).
- WDQS-Limits ⇒ Retry-Muster wie in den Geschwister-Skripten; pro Verein
  eine Query (keine Fensterung nötig).

## Tests / Verifikation

- `wereTeammates`: Überlappung, disjunkt, offenes Ende, Mehrfach-Engagement,
  fehlendes `cp`, Grenzjahr.
- `activeInRange`: innerhalb/außerhalb/übergreifend/ohne `cp`/offenes Ende.
- `answerGuessQuestion` mit `dim:"mate"`; `guessQuestionLabel` mate.
- `SPECIALS.length === 6` + Ära-`test`-Checks; bestehende Board-Tests bleiben
  grün (wählt 3 aus 6).
- Pipeline: Log-Counts, Diff-Kontrolle (nur `cp` neu, andere Felder identisch),
  Stichprobe (z. B. Xavi/Iniesta Teamkollegen = true).
- `npm test` + `npm run build` grün.

## Betroffene Dateien

- `data-pipeline/wikidata_careers.mjs` (neu)
- `data-pipeline/wikidata_roster.mjs`, `wikidata_honours.mjs`,
  `wikidata_honours_extra.mjs`, `wikidata_positions.mjs` (recToString + `cp`)
- `src/gameData.js`, `src/gameData.test.js`
- `src/Guess.jsx`, `src/Daily.jsx`
- `src/players.js` (generiert)
