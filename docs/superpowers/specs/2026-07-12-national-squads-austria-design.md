# Design: Nationalteam-Kader + Österreich als Nation

**Datum:** 2026-07-12
**Status:** Genehmigt (User-Report + Feature)

## Problem

Der Spielerpool ist rein vereinsbasiert (~42 Vereine). Wer nie bei einem davon
gespielt hat, fehlt und kann kein Länder-Feld erfüllen. Beispiel: Trauner
(Feyenoord ist erfasst, aber Wikidata kennt seine Feyenoord-Mitgliedschaft nicht;
seine P54-Liste endet 2012). Zudem fehlt Österreich als Nation ganz.

## Fixes

### A. Österreich als 19. Nation

- `src/gameData.js` `NATIONS` += `{ key:"AUT", label:"AUT", name:"Österreich",
  flag:{ kind:"h", colors:["#ED2939","#ffffff","#ED2939"] } }` (Rot-Weiß-Rot).
- `data-pipeline/wikidata_roster.mjs` `NATION_QID.AUT = "Q40"` → Österreicher aus
  Vereinskadern (v. a. die 359 Salzburger) bekommen künftig AUT.
- Test: `NATIONS.length === 19`, AUT auflösbar.

### B. Nationalteam-Import `data-pipeline/wikidata_national.mjs` (neu)

Pro Nation die **Senior-Nationalteam-Mitglieder** (P54 → Nationalteam-QID),
Geburtsjahr ≥ 1970 (Proxy „letzte ~30 Jahre"), mit `wikibase:sitelinks` (sl).
Verifizierte Team-QIDs:

```
FRA Q47774, GER Q43310, ESP Q42267, ITA Q676899, NED Q47050, BEL Q166776,
CRO Q134479, ENG Q47762, PRT Q267245, JPN Q170566, BRA Q83459, ARG Q79800,
MEX Q164089, NGA Q181930, CIV Q175145, SEN Q207441, COL Q212564, USA Q164134,
AUT Q163534
```

Merge auf `src/players.js`: bestehender Spieler (`norm(name)|by`) mit leerem
`nat` → gemappte Nation setzen; fehlender Spieler → neu anlegen
(`{n, ln, by, nat:[code], clubs:[], sl}`). Bestehende nicht-leere `nat` bleiben.
Robuste Retries (WDQS-Störung), pro Nation ein Request. Wird in `refresh_all.mjs`
**nach roster** eingehängt (künftige Voll-Läufe automatisch).

Grenze: Fängt nur Spieler, deren Länderspiele Wikidata als P54 führt (die große
Mehrheit). Lückenhaft gepflegte Einzelfälle → C.

### C. Kuratierte `EXTRA_PLAYERS` — `data-pipeline/apply_extra_players.mjs` (neu)

Tabelle bestätigter Spieler, die Wikidata nicht/kaum kennt. Merge additiv
(anlegen oder Felder ergänzen), kein Netz. Starteintrag:

```
{ n:"Gernot Trauner", by:1992, nat:["AUT"], clubs:["FEY"], sl:35, pos:"ABW", cp:[["FEY",2021,0]] }
```

Erweiterbar für künftige Meldungen.

### D. Datenläufe

- `apply_extra_players.mjs` sofort (Trauner rein, ohne Netz).
- `wikidata_national.mjs` sobald WDQS stabil ist (mit Retries versucht);
  füllt alle Länder inkl. Österreich.

## Nicht-Ziele (YAGNI)

- Keine Jugend-Nationalteams; kein Voll-Refresh nötig (gezielte Läufe);
  keine Überschreibung bestehender nicht-leerer `nat`.

## Tests / Verifikation

- `gameData.test.js`: 19 Nationen inkl. AUT.
- Nach Läufen: AUT-Spieler > 0 (Alaba, Sabitzer, Salzburger, Trauner …);
  Trauner in DB mit FEY; Nation-Counts der bestehenden Länder gestiegen.
- `npm test` (42+) + `npm run build` grün (players.js bleibt lazy).

## Betroffene Dateien

- `src/gameData.js`, `src/gameData.test.js`
- `data-pipeline/wikidata_roster.mjs` (NATION_QID.AUT)
- `data-pipeline/wikidata_national.mjs` (neu), `data-pipeline/refresh_all.mjs` (Kette)
- `data-pipeline/apply_extra_players.mjs` (neu)
- `src/players.js` (generiert)
