# Design: „Wer passt nicht?" (Solo)

**Datum:** 2026-07-15
**Status:** Genehmigt (Spiel 2 von 4)

## Spielprinzip

Vier Spieler werden gezeigt. **Drei teilen eine Eigenschaft, einer nicht** —
finde den Außenseiter. Nach dem Tipp wird die Regel aufgelöst („Die anderen drei
spielten alle für Bayern München"). Endlos-Runden mit Serie/Statistik.

## Kernproblem: Eindeutigkeit

Bei vier zufälligen Spielern gibt es oft *mehrere* 3:1-Gruppierungen (z. B. drei
Bayern-Spieler, aber gleichzeitig drei Deutsche mit einem anderen Außenseiter).
Dann hätte die Frage zwei richtige Antworten. Deshalb wird **jede erzeugte Runde
gegen alle 83 Attribute geprüft**: Ergibt ein anderes Attribut ebenfalls einen
3:1-Split mit einem *anderen* Außenseiter, wird die Runde verworfen und neu
erzeugt. Nur eindeutige Rätsel kommen ins Spiel.

## Architektur

### A. `src/oddOneOut.js` (neu, rein & testbar)

```js
export const ODD_SL_MIN = 40;                       // nur bekannte Spieler (2195)
export const ODD_DEFS = [...CLUBS, ...NATIONS, ...LEAGUES, ...HONOURS]; // 83
export function oddCandidates(players)              // Pool-Indizes
export function oddRuleLabel(def)                   // „spielten alle für …" / „sind alle …"
export function ambiguousWith(four, oddIndex, rule) // andere 3:1-Regel? -> Def oder null
export function buildOddRound(players, rnd, tries)  // { def, options[4], oddIndex } | null
```

Attribute bewusst nur club/nat/league/honour — das sind die Merkmale, die man
beim Vergleichen tatsächlich bemerkt (Ära/Jahrgang würde die Eindeutigkeits-
prüfung dominieren, ohne dass Spieler so denken).

### B. `src/OddOne.jsx` (neu)

Vier Spieler-Karten (Name + Position/Alter als Meta) zum Anklicken. Nach der Wahl:
richtig/falsch, Auflösung der Regel, Markierung der Karten. Serie + Statistik in
localStorage `pp:oddStats` (`{played, solved, streak, best}`), Sounds, Regeln-Modal.

### C. Anbindung

`?solo=odd` in `App.jsx`, neue Kachel im Solo-Grid der Lobby („🧩 Wer passt
nicht?"). Beides dank des Umbaus aus Spiel 1 je eine Zeile.

## Fehlerfälle / Edge Cases

- Generator findet nach `tries` Versuchen nichts → `null`, UI zeigt „Neue Runde"
  (praktisch ausgeschlossen, wird empirisch geprüft).
- Spielerliste lädt noch → Ladehinweis.
- Alle 83 Attribute haben ≥3 Spieler im Pool (geprüft) — kein leeres Attribut.

## Tests (node:test, `src/oddOneOut.test.js`)

- `oddRuleLabel` je Typ (club/league/nat/honour).
- `ambiguousWith`: erkennt eine zweite 3:1-Regel mit anderem Außenseiter;
  gibt `null`, wenn nur die eigene Regel passt.
- **Eigenschaftstest über Echtdaten (50 Runden):** genau 3 der 4 erfüllen die
  Regel, der markierte Außenseiter nicht, und keine Runde ist mehrdeutig.

## Nicht-Ziele (YAGNI)

- Keine Zeitbegrenzung, kein Multiplayer, kein Share, keine Schwierigkeitsgrade.

## Betroffene Dateien

- `src/oddOneOut.js`, `src/oddOneOut.test.js`, `src/OddOne.jsx` (neu)
- `src/App.jsx`, `src/Lobby.jsx`, `src/styles.css`
