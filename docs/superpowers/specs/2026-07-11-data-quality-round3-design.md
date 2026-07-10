# Design: Datenqualität Runde 3 (6 User-Befunde)

**Datum:** 2026-07-11
**Status:** Genehmigt (User-Report), im Browser/Wikidata diagnostiziert

## Diagnose je Befund

1. **Sporting-Logo falsch** — Namenssuche traf beim Fetch einen falschen Klub.
   Korrekte TheSportsDB-ID **135708** (Sporting CP, Portugal, Soccer, verifiziert).
2. **Michael Owen (ENG) matcht England nicht** — Owen hat `nat: []`. Root Cause:
   Die Roster-Query liest Nationalität über `P298` (ISO-3166-alpha-3) und filtert
   gegen **Spiel-Codes**. England hat **keinen** ISO-Code (Q21 → kein P298).
3. **Spanische Meister (MLL) fehlen komplett (0)** — Regression aus dem Refresh
   (vorher 1317). Der P585-Query-Umbau machte die Honours-Query so langsam
   (23,6 s / 5-Jahres-Fenster), dass die großen Ligen die 60-s-Grenze rissen →
   Timeout → 0.
4. **FA-Cup-Sieger fehlen** — **kein Datenfehler:** FAC = 1560, funktioniert
   (Grealish/Saka haben FAC). Wird dem User als „in Ordnung" zurückgemeldet;
   der Einzelfall lag vermutlich an einem Spieler mit unvollständiger Honour.
5. **Italienische Meister (MSA) fehlen komplett (0)** — gleiche Timeout-Regression
   wie MLL (vorher 2246).
6. **Patrick Helmes (GER) matcht Deutschland nicht** — `nat: []`. Root Cause wie
   #2: `P298` liefert **DEU** für Deutschland (Spiel-Code ist **GER**); ebenso
   **NLD**≠NED und **HRV**≠CRO. Alle per Wikidata neu hinzugefügten Spieler aus
   GER/ENG/NED/CRO bekamen leeres `nat` (14.192 Spieler betroffen, lange bestehend).

## Fixes

### A. Honours-Query beschleunigen (Befund 3+5) — `wikidata_honours.mjs`

Die zwei OPTIONAL-Joins + `BIND(COALESCE(P580,P585))` durch eine **Property-Path-
Alternation** ersetzen: `; (wdt:P580|wdt:P585) ?ss .` (live gemessen: 15-Jahres-
Fenster in 9 s statt 5 Jahre in 23,6 s → kein Timeout mehr). P585-Fall (Pokale)
bleibt abgedeckt. Query im `fetchHonourPlayers`:

```sparql
?season wdt:P3450 wd:${qid} ; wdt:P1346 ?winner ; (wdt:P580|wdt:P585) ?ss .
FILTER( YEAR(?ss) >= ${from} && YEAR(?ss) < ${to} )
OPTIONAL { ?season wdt:P582 ?se. }
... (Rest unverändert)
```

### B. Nationalität über Länder-QID mappen (Befund 2+6) — `wikidata_roster.mjs`

- Neue Tabelle `NATION_QID` (Spiel-Code → Wikidata-Länder-QID, 18 Einträge) +
  Reverse-Map `GAME_BY_QID`.
- Roster-Query holt statt ISO die **Länder-QIDs**:
  `OPTIONAL { ?p wdt:P1532 ?snat. }` (sportliche Nation, bevorzugt),
  `OPTIONAL { ?p wdt:P27 ?cnat. }` (Staatsbürgerschaft, Fallback).
  Ausgabe: nackte QID (`?snat`/`?cnat` → `wd:Q…` → QID-String).
- Aggregation mappt QID→Spiel-Code via `GAME_BY_QID`; bevorzugt sportliche Nation.
- **Backfill:** Beim Merge bekommen auch **bestehende** Spieler mit leerem `nat`
  den gemappten Code (bisher nur neue). Nicht-leeres `nat` bleibt unangetastet
  (respektiert frühere Kuratierung).

`NATION_QID`: FRA Q142, GER Q183, ESP Q29, ITA Q38, NED Q55, BEL Q31, CRO Q224,
ENG Q21, PRT Q45, JPN Q17, BRA Q155, ARG Q414, MEX Q96, NGA Q1033, CIV Q1008,
SEN Q1041, COL Q739, USA Q30.

### C. Sporting-Logo (Befund 1) — `fetch_logos.mjs`

`TEAM_ID`-Override erweitern: `SCP: [135708, "Sporting"]` (verifizierter
ID-Lookup wie PSG). Falsches PNG löschen, neu laden.

### D. Daten-Refresh

Nach den Skript-Fixes ein voller Lauf (`npm run data:refresh` bzw. GitHub-Action):
roster (nat-Fix + Backfill) → honours (MLL/MSA-Fix, schnelle Query) →
honours_extra → positions → careers. Ergebnis-`players.js` als eigener Daten-PR.

## Nicht-Ziele (YAGNI)

- Kein FAC-„Fix" (nicht defekt).
- Keine Nationen außerhalb der 18 Spiel-Nationen (Wales/Schottland/… bleiben leer).
- Keine Änderung der Spiellogik.

## Tests / Verifikation

- Skripte: `node --check`; Query-Speed bereits live gemessen.
- Nach Refresh: MLL/MSA wieder ~1300/~2200; leere-nat deutlich < 14.000;
  Owen → nat ENG, Helmes → nat GER; MBL/FAC/CDR stabil; Diff-Kontrolle.
- Sporting-PNG neu (512² per ID).
- `npm test` (42) + `npm run build` grün (reine Daten/Pipeline; App unberührt).

## Betroffene Dateien

- `data-pipeline/wikidata_honours.mjs` (Query), `data-pipeline/wikidata_roster.mjs`
  (NATION_QID + Query + Backfill), `data-pipeline/fetch_logos.mjs` (SCP),
  `public/logos/club/SCP.png`, `src/players.js` (generiert, eigener Daten-PR).
