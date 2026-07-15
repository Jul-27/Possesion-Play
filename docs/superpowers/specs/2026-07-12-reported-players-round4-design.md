# Design: Gemeldete Spieler-Fehler (Runde 4)

**Datum:** 2026-07-12
**Status:** Genehmigt (User-Report). Alle kuratiert lösbar, ohne Wikidata.

## Diagnose (im Datenbestand geprüft)

| # | Spieler | Befund | Fix |
|---|---|---|---|
| 1a | Lamine Yamal (2007) | hat EM/MLL, **CDR fehlt** (Copa del Rey 2025 mit Barça) | GAP_WINNERS CDR BAR 2024 |
| 1b | Antonio Rüdiger (1993) | RMA seit 2022, **CDR fehlt** (Copa del Rey 2023) | GAP_WINNERS CDR RMA 2022 |
| 2 | Oscar Gloukh (2004) | clubs=[RBS], **AJA fehlt** (Ajax seit 2025) | EXTRA clubs+=AJA |
| 3 | Diego (1985) | clubs=[ATM,WOB], **SVW fehlt** (Werder 2006–09) | EXTRA clubs+=SVW |
| 4 | Arturo Vidal (1987) | **B04 fehlt** (Leverkusen 2007–11) | EXTRA clubs+=B04 |
| 5 | Odilon Kossounou (2001) | hat B04 (Leverkusen) ✓ — **kein Fehler**; Atalanta ist kein Spiel-Verein | keiner |
| 6 | Adam Daghim (2005) | clubs=[WOB], **RBS fehlt** (Salzburg) | EXTRA clubs+=RBS |
| 7 | Sergio Agüero (1988) | clubs=[MCI], **ATM fehlt** (Atlético 2006–11) | EXTRA clubs+=ATM |
| 8 | Matthijs de Ligt (1999) | FCB 2022–24, **MBL fehlt** (Meister 2023) | GAP_WINNERS MBL FCB 2022 |

Vereins-Lücken sind Wikidata-P54-Lücken (bzw. sehr aktuelle Transfers); Titel-Lücken
sind Membership-Overlap-Kanten. Beide über die vorhandenen kuratierten Tabellen
lösbar — squad-weit bei den Titeln (cp-Überlappung), punktuell bei den Vereinen.

## Fixes

### A. `GAP_WINNERS` (`wikidata_honours.mjs`) — Titel squad-weit

```js
CDR: [[2024, "BAR"], [2022, "RMA"]], // Copa del Rey 2024/25 (Barça), 2022/23 (Real)
MBL: [[2022, "FCB"]],                // Bundesliga 2022/23 (Bayern)
```

Vergibt via cp-Überlappung an den jeweiligen Kader; fängt Yamal/Rüdiger/de Ligt
plus deren Mitspieler. Anwendung mit `apply_gap_winners.mjs`.

### B. `EXTRA_PLAYERS` (`apply_extra_players.mjs`) — Vereins-Lücken

Bestehende Spieler bekommen den fehlenden Verein (+ cp, wo Zeitraum sicher):

```js
{ n: "Oscar Gloukh",   by: 2004, clubs: ["AJA"], cp: [["AJA", 2025, 0]] },
{ n: "Diego",          by: 1985, clubs: ["SVW"], cp: [["SVW", 2006, 2009]] },
{ n: "Arturo Vidal",   by: 1987, clubs: ["B04"], cp: [["B04", 2007, 2011]] },
{ n: "Adam Daghim",    by: 2005, clubs: ["RBS"], cp: [["RBS", 2023, 2024]] },
{ n: "Sergio Agüero",  by: 1988, clubs: ["ATM"], cp: [["ATM", 2006, 2011]] },
```

`apply_extra_players` merged clubs (Union) + cp (ersetzt Einträge desselben
Verein-Keys) für bestehende Spieler; nat/pos/sl bleiben unverändert (nur gesetzt
falls leer/fehlend).

## Nicht-Ziele (YAGNI)

- Atalanta wird NICHT als Verein aufgenommen (separater Wunsch, falls gewünscht).
- Kein Wikidata-Lauf (alles lokal/kuratiert, WDQS gerade instabil).

## Tests / Verifikation

- Nach den Läufen: Yamal/Rüdiger `t` enthält CDR; de Ligt `t` enthält MBL;
  Gloukh→AJA, Diego→SVW, Vidal→B04, Daghim→RBS, Agüero→ATM in `clubs`.
- CDR/MBL-Gesamtzahlen leicht gestiegen (Squad-Effekt).
- `npm test` (43) + `npm run build` grün.

## Betroffene Dateien

- `data-pipeline/wikidata_honours.mjs` (GAP_WINNERS)
- `data-pipeline/apply_extra_players.mjs` (EXTRA_PLAYERS)
- `src/players.js` (generiert)
