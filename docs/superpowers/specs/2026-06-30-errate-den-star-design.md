# Design: „Errate den Star" — Deduktions-Duell

**Datum:** 2026-06-30
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** Dritter Spielmodus für Possession Play. 1v1-Realtime-Deduktionsspiel:
Die Engine zieht einen geheimen, bekannten Spieler; beide Spieler jagen denselben,
indem sie abwechselnd deterministische Ja/Nein-Attributfragen stellen und schließlich
tippen.

## Ziel

Ein Fußball-Deduktionsspiel, das es so nicht gibt: kein „Verein+Karriere"-Raten,
sondern strukturierte Attribut-Deduktion über den vorhandenen Daten-Graph
(Nation, Verein, Liga, Position, Titel, Geburtsjahr). Nutzt die bestehende
Realtime- und Schachuhr-Infrastruktur.

## Entscheidungen (aus dem Brainstorming)

1. **Konzept:** „Errate den Star" — Deduktion über Attributfragen.
2. **Duell-Format:** Kopf-an-Kopf-Wettlauf — Engine zieht EINEN geheimen Star,
   beide jagen ihn; alle Fragen+Antworten für beide sichtbar; abwechselnd; finaler
   Tipp jederzeit statt einer Frage.
3. **Frage-Dimensionen (alle 6):** Nation, Verein, Liga, Position, Titel,
   Geburtsjahr-Schwelle.
4. **Fehltipp-Strafe:** Zug verloren + −30 s Schachuhr-Malus; Spiel läuft weiter.
5. **Anti-Cheat:** Vertrauensbasiert (client-seitig). Ziel-Referenz liegt leicht
   verschleiert in der `games`-Zeile; die Engine im Browser beantwortet Fragen und
   prüft Tipps. (Bewusst gewählt; Edge-Function wäre die unbetrügbare Alternative.)
6. **Combobox für Nation/Verein:** Tipp-Filter (Nutzer tippt, Treffer erscheinen).

## Nicht-Ziele (YAGNI)

- Keine serverseitige Validierung / Edge Function in v1.
- Keine Freitext-Fragen (nur strukturierte Attributfragen; wir haben keine KI-Antwort).
- Keine DB-Migration (vorhandene Spalten genügen).
- Keine neuen Datenfelder in `players.js`.

## Architektur

### A. Engine (`src/gameData.js`)

Neue, reine Funktionen (testbar, ohne UI/Netzwerk):

```js
// Frage: { dim, val }
//   dim "nat"   -> val ISO3-String       -> player.nat.includes(val)
//   dim "club"  -> val CLUB-KEY          -> player.clubs.includes(val)
//   dim "league"-> val LEAGUE-KEY        -> spielt ein clubs-Verein in der Liga?
//   dim "pos"   -> val "TW"|"ABW"|"MF"|"ST" -> player.pos === val
//   dim "title" -> val HONOUR-KEY        -> (player.t || []).includes(val)
//   dim "born"  -> val { cmp:"before"|"after", year } -> before: by < year, after: by >= year
export function answerGuessQuestion(player, q) { /* boolean */ }

// Klartext für die Protokollanzeige, z.B. "Spielte für FC Barcelona?",
// "Ist er Spanier?", "Geboren nach 2000?"
export function guessQuestionLabel(q) { /* string */ }

// Zielwahl + Encoding. Kandidaten: pos gesetzt, nat.length, clubs.length,
// sl >= GUESS_SL_MIN. Zufällige Auswahl. tgt = encodeTarget(index).
export function buildGuessSerial(players) { /* { kind:"guess", tgt } */ }

// Leichte Verschleierung der Spieler-Index-Referenz (kein echter Schutz, nur
// gegen beiläufiges Mitlesen). base64 von String(index).
export function encodeTarget(index) { /* string */ }
export function decodeTarget(tgt) { /* number */ }

// Tipp-Prüfung über Identität (Index-Gleichheit).
export function checkGuess(tgt, guessedIndex) { /* boolean */ }
```

- **Liga-Mapping:** nutzt die bestehende Liga-Logik (`playerMatchesHex` mit einer
  Liga-Def bzw. das vorhandene Verein→Liga-Mapping aus `gameData.js`).
- **`GUESS_SL_MIN`:** Konstante, so gewählt, dass nur klar bekannte Spieler als Ziel
  in Frage kommen (im Plan auf Basis der `sl`-Verteilung konkret gesetzt, tunebar).
- **Geburtsjahr-Grenze:** `before` = `by < year`, `after` = `by >= year` (eindeutig,
  lückenlos um `year`).

### B. Daten / Supabase (keine Migration)

`games`-Zeile beim Erstellen im Guess-Modus:
- `board = { kind:"guess", tgt:"<encoded index>" }` (statisch, Zielreferenz).
- `last_move = { log: [], winner: null }` — laufendes Q&A-Protokoll:
  `log` = `[{ p:1|2, dim, val, a:boolean }]`; bei Fehltipp ein Eintrag
  `{ p, guess: <index>, wrong:true }`.
- Wiederverwendet: `turn` (Zugwechsel), `clocks` (`{1,2,started,timeout}`,
  4:00-Schachuhr), `status` ("waiting"→"active"→"finished"), `names`, `host_id`,
  `guest_id`.

Aktionen (optimistisches Update + Supabase-`update`, wie in Hex/Grid):
- **Frage:** Antwort `a = answerGuessQuestion(players[decodeTarget(tgt)], q)`
  (client-seitig berechnet); Eintrag an `log` anhängen; `turn` wechseln; Uhr umstellen.
- **Richtiger Tipp:** `last_move.winner = me`, `status = "finished"`, Ziel aufgedeckt.
- **Falscher Tipp:** Fehltipp-Eintrag an `log`; `clocks[me] = max(0, clocks[me] − 30)`;
  `turn` wechseln (Uhr umstellen).
- **Doppelfrage-Sperre:** exakt gleiche `{dim,val}` (bzw. `born` mit gleicher Grenze)
  wird im UI gesperrt — Antwort steht bereits im Protokoll.

### C. Routing & Lobby

- **`App.jsx` / `GameRouter`:** routet nach Board-Form. Ergänzung:
  Objekt mit `kind:"guess"` → neue Komponente `Guess.jsx`
  (Array = Hex, `{kind:"grid"}` = Raster, `{kind:"guess"}` = Errate-den-Star).
- **`Lobby.jsx`:** dritter Modus-Radio („Errate den Star"). `createGame` im
  Guess-Zweig: `board = buildGuessSerial(await loadPlayers())`,
  `last_move = { log:[], winner:null }`, `clocks` = Startwerte (wie Hex/Grid).
  Hex/Grid-Zweige unverändert. Prefetch (`loadPlayers()` beim Mount) deckt das Laden ab.

### D. UI — `src/Guess.jsx` (neue Komponente)

Struktur analog zu `Grid.jsx`/`Game.jsx` (Supabase-Subscription, `players`-State via
`loadPlayers()`, Schachuhr-Anzeige über `fmtClock`/`liveRemaining`).

- **Q&A-Protokoll:** Liste aller Einträge mit Fragetext (`guessQuestionLabel`) +
  Ja/Nein-Badge; Fehltipps markiert; wer gefragt hat erkennbar.
- **Aktionsbereich (nur am Zug, sonst deaktiviert):**
  - Umschalter „Frage stellen" / „Tippen".
  - **Frage:** Dimension wählen → Wertauswahl:
    - **Nation:** Tipp-Filter-Combobox über `NATIONS` (Eingabe → gefilterte Treffer via `norm()`).
    - **Verein:** Tipp-Filter-Combobox über `CLUBS` (gleiches Muster; Liste ist groß → Filter Pflicht).
    - **Liga:** 5 Buttons (BL/PL/LL/SA/L1).
    - **Position:** 4 Buttons (TW/ABW/MF/ST).
    - **Titel:** 11 Buttons/Icons (Honours).
    - **Geburtsjahr:** Zahleneingabe + Umschalter „vor/nach".
  - **Tippen:** Namens-Autocomplete (`suggestPlayers`, wie in Game/Grid).
  - Bereits gestellte exakte Fragen sind gesperrt.
- **Ladezustand:** bis `players` geladen ist, Aktionsbereich deaktiviert
  („Lade Spielerdaten…").
- **Ende:** Gewinner-Anzeige + Aufdeckung des Ziel-Stars.

Wiederverwendbarer **Combobox** (Tipp-Filter) als kleine interne Komponente in
`Guess.jsx` (oder ausgelagert), generisch über `options`, `labelFn`, `onPick`.

## Datenfluss

1. Lobby (Guess-Modus) → `buildGuessSerial(players)` zieht Ziel, schreibt `board`+`last_move`.
2. Beitritt → `status` "active", Schachuhr startet (bestehende Logik).
3. Am Zug: Frage → Engine antwortet client-seitig → Protokoll wächst, Zug wechselt.
4. Tipp → richtig: Ende+Sieg; falsch: Strafe (−30 s) + Zugwechsel.
5. Uhr eines Spielers auf 0 → dieser verliert (bestehende Timeout-Logik).

## Fehlerfälle / Edge Cases

- **Spielerliste noch nicht geladen:** Aktionsbereich deaktiviert + Hinweis.
- **Doppelte Frage:** im UI gesperrt (Antwort schon im Protokoll).
- **Ziel ohne `pos`/leere Sets:** durch Kandidatenfilter in `buildGuessSerial`
  ausgeschlossen → jede Dimension liefert sinnvolle Antworten.
- **Geburtsjahr-Grenze:** `before`/`after` lückenlos um `year` definiert.
- **Vertrauensbasiert:** Ziel ist im Payload (verschleiert) auslesbar — bewusst
  akzeptiert; Spiele „unter Freunden". Edge Function bleibt späteres Upgrade.
- **Schachuhr-Timeout:** vorhandene Timeout-Logik entscheidet (kein Sonderfall).

## Tests / Verifikation

- **node:test (`gameData.test.js`):**
  - `answerGuessQuestion` je Dimension: nat Treffer/Fehl, club Treffer/Fehl,
    league über Verein-Mapping, pos exakt, title Treffer/Fehl, born `before`/`after`
    inkl. Grenzjahr.
  - `buildGuessSerial(players)` → `kind:"guess"`; `decodeTarget(tgt)` liefert gültigen
    Kandidaten (pos gesetzt, nat/clubs nicht leer, sl ≥ GUESS_SL_MIN).
  - `encodeTarget`/`decodeTarget` Roundtrip.
  - `checkGuess` (richtig/falsch über Index).
  - `guessQuestionLabel` für 2–3 Dimensionen (Format).
- **Build:** `npm run build` grün; `players.js` bleibt lazy (eigener Chunk).
- **Manuell:** Lobby→Guess erstellen+beitreten; Fragen aller Dimensionen; Doppelfrage
  gesperrt; Fehltipp zieht 30 s ab und wechselt Zug; richtiger Tipp deckt auf+beendet.

## Betroffene Dateien

- `src/gameData.js` — Engine-Funktionen (answer/label/build/encode/decode/check), `GUESS_SL_MIN`.
- `src/gameData.test.js` — Tests der Engine-Funktionen.
- `src/Guess.jsx` (neu) — Spielkomponente inkl. Tipp-Filter-Combobox.
- `src/App.jsx` — Routing `{kind:"guess"}` → `Guess.jsx`.
- `src/Lobby.jsx` — dritter Modus + `createGame`-Guess-Zweig.
- `src/styles.css` — Stile für Protokoll, Combobox, Aktionsbereich (analog vorhandener Klassen).
