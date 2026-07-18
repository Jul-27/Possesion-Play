# Design: „Die 5 stärksten Züge" im Hex-Training

**Datum:** 2026-07-15
**Status:** Genehmigt (User-Wunsch)
**Scope:** Nach gelöstem Board im Trainingsmodus die 5 Spieler zeigen, die mit
einem einzigen Zug die meisten Felder erobert hätten.

## Entscheidungen (aus dem Brainstorming)

- **Bezug: leeres Board** — theoretisch beste Eröffnungszüge, unabhängig vom
  tatsächlichen Spielverlauf.
- **Kein Bekanntheitsfilter** — objektiv beste Züge. Bekanntheit (`sl`) dient nur
  als Tiebreaker bei gleicher Feldanzahl.
- Nur im Solo-Training (kein Multiplayer).

## Architektur

### A. Engine — `bestOpeningMoves(players, board, limit = 5)` in `src/gameData.js`

Rein, ohne React. `board` = hydratisierte Zellen (`hydrateBoard`-Ergebnis, je
Element mit `.def`). Pro Spieler:

1. Getroffene Feldindizes sammeln (`playerMatchesHex` gegen alle 31 Felder).
2. Für jedes getroffene Feld `i`: `count = 1 + Anzahl Nachbarn aus ADJP[i]`,
   die der Spieler ebenfalls trifft — exakt die Eroberungsmechanik des Spiels
   (gewähltes Feld + passende Nachbarn).
3. Bestes Feld je Spieler merken (`idx`), inklusive der eroberten Indizes
   (`fields`) für die Anzeige.

Rückgabe: `[{ player, count, idx, fields }]`, sortiert nach
`count` desc → `sl` desc → Name. Spieler ohne Treffer werden übersprungen.

### B. UI — `src/Solo.jsx`

- Berechnung in einem Effect, sobald `done` true wird (einmalig, ~0,3 s über
  ~30.000 Spieler). Solange `bestMoves === null`: „Berechne beste Züge…".
- Anzeige im Abschluss-Panel unter `.dailyStats`: Liste mit Rang, Spielername,
  Feldanzahl und den eroberten Feld-Labels (`def.label`), damit sichtbar wird,
  *warum* der Zug stark war.
- Bei „Neues Board" wird `bestMoves` zurückgesetzt.
- Neue CSS-Klassen `.bestList`, `.bestRow`, `.bestRank`, `.bestName`,
  `.bestCount`, `.bestFields` (an vorhandene Optik angelehnt).

## Fehlerfälle / Edge Cases

- Spielerliste noch nicht geladen (`players === null`) → Berechnung erst danach.
- Kein Spieler trifft ein Feld → leere Liste, Abschnitt wird ausgeblendet.
- Weniger als 5 Treffer → zeigt so viele wie vorhanden.

## Tests (node:test, `gameData.test.js`)

- Nachbar-Kombination: Spieler, der Feld + 2 Nachbarn trifft, bekommt `count 3`
  und das richtige `idx`.
- Sortierung: höhere Feldanzahl zuerst; bei Gleichstand höhere `sl` zuerst.
- `limit` wird eingehalten; Spieler ohne Treffer fehlen im Ergebnis.

## Betroffene Dateien

- `src/gameData.js`, `src/gameData.test.js`, `src/Solo.jsx`, `src/styles.css`
