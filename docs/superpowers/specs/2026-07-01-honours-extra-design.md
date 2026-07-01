# Design: Neue Honours — Ballon d'Or, EM, Copa América, Europa League

**Datum:** 2026-07-01
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** Vier neue Honour-Felder (11 → 15) inkl. Wikidata-Anreicherung des
`t`-Felds in `src/players.js`. Alle vier Spielformen (Hex, Raster, Guess-Duell,
Daily-Star) nutzen sie automatisch.

## Entscheidungen (aus dem Brainstorming)

„Großer Wurf": **BDO** (Ballon-d'Or-Sieger), **EM** (Europameister),
**CA** (Copa-América-Sieger), **EL** (Europa-League-Sieger).

## Nicht-Ziele (YAGNI)

- Keine Turnier-Jahreszahlen, kein „n-facher Sieger", keine weiteren Awards
  (FIFA World Player o. ä.), keine UI-Änderungen über die Defs hinaus.

## Architektur

### A. `src/gameData.js` — HONOURS-Defs (11 → 15)

```js
{ key: "BDO", label: "BdO", name: "Ballon-d'Or-Sieger",     icon: "👑", c1: "#C9A227", c2: "#3d2f00" },
{ key: "EM",  label: "EM",  name: "Europameister",          icon: "🇪🇺", c1: "#123B8F", c2: "#C9A227" },
{ key: "CA",  label: "CA",  name: "Copa-América-Sieger",    icon: "🌎", c1: "#2DD4BF", c2: "#0e4d44" },
{ key: "EL",  label: "EL",  name: "Europa-League-Sieger",   icon: "🏆", c1: "#F26F21", c2: "#5c2500" },
```

Anpassung `src/gameData.test.js`: `HONOURS.length === 15`, Key-Liste
`[BDO, CA, CDR, CIT, CL, DFB, EL, EM, FAC, MBL, ML1, MLL, MPL, MSA, WM]`,
`lookupDef`-Checks für BDO/EM. Kein weiterer Code — `playerMatchesHex`
(`honour` → `player.t.includes(key)`), Board-Builder, Guess/Daily-Titel-Chips
funktionieren über die Def-Listen automatisch.

### B. Pipeline — `data-pipeline/wikidata_honours_extra.mjs` (neu)

Selbstständiges Node-Skript (eigene SPARQL-Helfer mit Retry/Rate-Limit wie in
den Geschwister-Skripten). Läuft **additiv/idempotent** auf `src/players.js`:

1. **QID-Verifikation vor dem Lauf** (Lehre aus RMA/SEV-Fehlresolutionen):
   je QID Label abfragen und gegen Erwartung prüfen, sonst Abbruch:
   - EM → `Q260858` (UEFA European Championship)
   - CA → `Q243493` (Copa América)
   - EL → `Q18760` (UEFA Europa League)
   - BDO → `Q166177` (Ballon d'Or)
2. **EM/CA/EL:** gefensterte Turnier-Sieger-Queries (P3450-Saison → P1346-Sieger
   × P54-Mitgliedschaft mit P580/P582-Zeitfenster) — identische Logik wie im
   bestehenden `wikidata_honours.mjs`; P54 deckt Nationalteams ab (WM-Beweis).
3. **BDO:** eine einfache Query `?p wdt:P166 wd:Q166177 ; wdt:P106 wd:Q937857 ;
   wdt:P569 ?d` (Award direkt am Spieler, keine Fensterung nötig).
4. **Merge statt Überschreiben:** pro Spieler `t = union(bestehendes t, neue
   Keys)` sortiert; Match über `norm(name)|Geburtsjahr`. `recToString`
   schreibt ALLE Felder inkl. `pos` (wie `wikidata_positions.mjs`).
5. Log: Zuordnungen pro Key + Stichproben zur Plausibilitätsprüfung.

### C. Bugfix im Bestand

`data-pipeline/wikidata_honours.mjs` → `recToString` um `pos` ergänzen
(heute würde ein Rerun alle 24.720 Positionen löschen).

## Datenfluss

Skript lokal ausführen (Internet/Wikidata) → `src/players.js` bekommt
erweiterte `t`-Arrays → Commit. App-Code konsumiert `t` unverändert.

## Fehlerfälle / Edge Cases

- WDQS-Timeouts/429 → Retry + Fensterung (bestehende Muster).
- QID falsch aufgelöst → Verifikationsschritt bricht ab (keine falschen Daten).
- Spieler nicht im Datensatz (z. B. BdO-Sieger vor unserer Roster-Abdeckung) →
  Zuordnung läuft ins Leere, kein Fehler (Missing ist besser als falsch).
- `pos`/`sl` bleiben unangetastet (Merge, Diff-Kontrolle nach dem Lauf).

## Tests / Verifikation

- `npm test`: HONOURS-Tests (15, Keys, lookupDef) grün; alle bestehenden grün.
- Pipeline-Log: plausible Counts je Key (BDO klein ~50–80; EM/CA/EL größer).
- Diff-Check von `src/players.js`: nur `t`-Änderungen.
- `npm run build` grün; players-Chunk bleibt lazy.

## Betroffene Dateien

- `src/gameData.js`, `src/gameData.test.js`
- `data-pipeline/wikidata_honours_extra.mjs` (neu)
- `data-pipeline/wikidata_honours.mjs` (recToString-Fix)
- `src/players.js` (generiert)
