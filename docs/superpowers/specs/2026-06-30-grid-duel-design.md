# Design: Raster-Duell ("Fußball-Tic-Tac-Toe")

**Datum:** 2026-06-30
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** Zweiter Spielmodus auf bestehender Basis: 3×3-Raster, zwei Spieler,
3-in-Reihe gewinnt. Nutzt Engine, Realtime-Räume, Uhr, Autocomplete.

## Ziel

Ein neues Duell-Spiel auf derselben Infrastruktur: 3×3-Gitter mit je einer
Bedingung pro Zeile/Spalte. Abwechselnd nennt man für eine freie Zelle einen
Spieler, der **beide** Bedingungen erfüllt, und erobert sie. Wer zuerst drei in
einer Reihe hat, gewinnt.

## Entscheidungen (aus dem Brainstorming)

1. **Modus:** Duell (zwei Spieler, Realtime), kein Solo (vorerst).
2. **Sieg:** 3-in-Reihe/Spalte/Diagonale; alle 9 voll ohne Linie → mehr Zellen.
3. **Bedingungstypen:** alle 5 Def-Typen (`club`, `nat`, `league`, `honour`, `spec`).
4. **Falscher Tipp:** Zug verfällt (Zelle bleibt frei), Zeit ist verbraucht.
5. **Speicherung im vorhandenen `board`-Feld** (kein Schema-Wechsel).
6. **Jeder Spieler nur einmal pro Raster.**

## Nicht-Ziele (YAGNI)

- Kein Solo-/Tagesmodus (späteres Projekt).
- Keine neuen Hexfeld-Typen; keine Datenpipeline-Änderung.
- Keine Supabase-Migration (Raster passt in `board` jsonb).
- Keine neue Timer-Logik (4:00-Schachuhr wird wiederverwendet).

## Datenmodell

Das `board`-jsonb hält je nach Modus:
- **Hex (unverändert):** Array `[{t,k}, …]`.
- **Raster:** Objekt `{ kind: "grid", rows: [ {t,k},{t,k},{t,k} ], cols: [ {t,k},{t,k},{t,k} ] }`.

Modus-Erkennung: `Array.isArray(board)` → Hex, sonst Raster. `owners` mappt
`"0".."8"` → 1|2 (Zellindex `r*3+c`). `turn`, `status`, `clocks` wie gehabt.

**Eindeutigkeit (jeder Spieler nur 1×):** Die bereits benutzten Spielernamen
werden in der vorhandenen Spalte `last_move` als Map
`last_move.picksAll = { "<cellIdx>": "<player.n>" }` mitgeführt (über alle
eroberten Zellen, bei jedem Zug fortgeschrieben). Prüfung beim Tippen:
`norm(name)` nicht in den normalisierten Werten von `picksAll`. Kein neues
Schemafeld nötig (nutzt `last_move`-jsonb). Fehlt `picksAll` (Altzustand) → `{}`.

## Architektur

### A. Engine-Helfer (`src/gameData.js`, rein + testbar)

- `gridCellMatches(player, rowDef, colDef)` → `playerMatchesHex(player,rowDef) && playerMatchesHex(player,colDef)`.
- `gridWinner(owners)` → `1|2|null`: prüft 8 Linien (3 Reihen, 3 Spalten, 2 Diagonalen) auf gleiche Belegung.
- `buildGridSerial()` → lösbares Raster:
  - Kandidaten-Pool aus `[...CLUBS, ...NATIONS, ...LEAGUES, ...HONOURS, ...SPECIALS]`.
  - 6 verschiedene Defs ziehen (3 rows, 3 cols), keine Doppelung.
  - Lösbarkeit: für jede der 9 Zellen muss ein Spieler existieren, der beide
    erfüllt (`PLAYERS.some(p => gridCellMatches(p,row,col))`). Schlägt eine Zelle
    fehl → neuer Versuch (bis zu N Versuche). Gibt `{kind:"grid",rows,cols}` zurück.
  - Effizienz: pro Versuch ≤9 `some`-Scans über PLAYERS; N klein (z. B. 60).

### B. Routing (`src/App.jsx`)

- Neuer Wrapper `GameRouter({ code, … })`: lädt einmalig die Zeile (`board`),
  mountet dann `Game` (Array-Board) oder `Grid` (Objekt-Board). Lobby bleibt für
  `code===null`.

### C. `src/Grid.jsx` (neu, analog zu `Game.jsx`)

- Laden + Realtime-Abo, `myPlayer`, `status`, `myTurn`, `clk/rem1/rem2`,
  Tick-/Timeout-Effekt (identisch zur Uhr-Logik aus `Game.jsx`).
- Anzeige: Header, Scoreboard mit zwei Uhren (wiederverwendete `.score`/`.clock`),
  3×3-Gitter mit Spaltenköpfen (oben) und Zeilenköpfen (links) als Bedingungs-
  „Chips" (rendern über `Emblem`/`cname`), Zellen als Buttons (leer/erobert in
  Spielerfarbe, anklickbar nur bei eigenem Zug).
- Zelle wählen → Eingabe-Panel (Autocomplete via `suggestPlayers`) → `handleSubmit`:
  Spieler muss `gridCellMatches(player, rows[r], cols[c])` erfüllen **und** noch
  nicht in `picksAll` sein. Erfolg → `owners[idx]=myPlayer`, `picksAll[idx]=name`,
  Sieg-/Tiebreak-Prüfung (`gridWinner`/voll), Zug wechseln, `clocks` abziehen
  (wie im Hex-Spiel). Falsch/benutzt → Feedback, Zug verfällt (Uhr lief).
- „Zug überspringen" + „Verlassen" + Regeln-Modal (Raster-Text) + Abpfiff-Modal
  (Sieger aus `gridWinner` bzw. Tiebreak bzw. Timeout `clk.timeout`).

### D. Lobby (`src/Lobby.jsx`)

- Modus-Umschalter „Hex-Duell / Raster-Duell" (State).
- `createGame`: `board = mode==="grid" ? buildGridSerial() : buildBoardSerial()`,
  `last_move = mode==="grid" ? { picksAll:{} } : null`. Rest (clocks etc.) gleich.

## Datenfluss

1. Lobby erstellt Raster-Spiel (`board` = grid-Objekt).
2. `GameRouter` erkennt Objekt-Board → `Grid`.
3. Züge schreiben `owners`, `last_move.picksAll`, `turn`, `clocks`, ggf. `status`.
4. `gridWinner`/voll/Timeout → `status:"finished"`; Modal zeigt Sieger.

## Fehlerfälle / Edge Cases

- Unlösbares Zufallsraster → Generator verwirft, neuer Versuch (Retry-Limit; bei
  Erschöpfung Fallback auf einfache, garantiert lösbare Default-Bedingungen).
- Spieler bereits benutzt → Ablehnung mit Hinweis.
- Falscher Tipp → Zug verfällt; Uhr lief (konsistent mit Schachuhr).
- Timeout/Disconnect → wie im Hex-Spiel (aktiver + defensiver Gegner-Write).
- Altes `last_move` ohne `picksAll` → als `{}` behandeln.

## Tests / Verifikation

- **node:test:** `gridWinner` (Reihe/Spalte/Diagonale/None/Tiebreak via Aufrufer),
  `gridCellMatches` (beide Bedingungen nötig), `buildGridSerial` (liefert
  `kind:"grid"`, 3+3 Defs, alle 9 Zellen lösbar — über echte PLAYERS geprüft).
- **Build:** `npm run build` grün; bestehende Tests grün.
- **Manuell (2 Browser):** Raster erstellen/beitreten, Zellen erobern, Eindeutig-
  keit, 3-in-Reihe-Sieg, Tiebreak, Uhr/Timeout.

## Betroffene Dateien

- `src/gameData.js` (`gridCellMatches`, `gridWinner`, `buildGridSerial`)
- `src/gameData.test.js` (Tests)
- `src/App.jsx` (GameRouter, Routing nach Board-Form)
- `src/Grid.jsx` (neu)
- `src/Lobby.jsx` (Modus-Auswahl, createGame-Variante)
- `src/styles.css` (Raster-Layout: Köpfe, Zellen)
