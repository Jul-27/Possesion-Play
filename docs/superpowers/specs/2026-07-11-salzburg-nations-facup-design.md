# Design: Nationen-Anzahl, RB Salzburg, Ronaldo/FA-Cup

**Datum:** 2026-07-11
**Status:** Genehmigt (User-Report + 2 Wünsche)

## 1. Nationen pro Board: 3–4 (statt fix 6)

`buildBoardSerial` in `src/gameData.js`: `const nNat = 3 + Math.floor(Math.random() * 2);`
statt der festen `6`; `nNat` in `pick(NATIONS, nNat)` und in der `rest`-Formel
(`31 - 3 - 4 - nNat - nLeague - nHonour`). Die 31-Feld-Summe bleibt; freigewordene
Plätze füllen Vereine. Test: Board enthält 3–4 Nationen-Felder.

## 2. FC Red Bull Salzburg (Key `RBS`)

- `gameData.js`:
  - `LG_COUNTRY.AT = "AUT"`.
  - `CLUBS` += `{ key:"RBS", lg:"AT", label:"RBS", name:"FC Red Bull Salzburg",
    c1:"#C8102E", c2:"#001E5A", pat:"solid" }`.
  - **Keine** neue LEAGUE. `lg:"AT"` liefert via `CLUB_LG` keinen Liga-Match
    (kein LEAGUE-Key „AT") und zählt nicht zu `TOP5` → Salzburg ist reines
    Vereins-Feld. Erscheint automatisch in Hex-`rest`-Pool, Raster-Pool und
    Vereins-Combobox.
- `data-pipeline/wikidata_roster.mjs`: `CLUB_QID.RBS = "Q994811"` (verifiziert:
  „FC Red Bull Salzburg"). `wikidata_careers.mjs` importiert `CLUB_QID` → cp
  kommt bei künftigen Voll-Läufen automatisch.
- `data-pipeline/fetch_logos.mjs`: `TEAM_ID.RBS = [133970, "Salzburg"]`
  (verifiziert: Red Bull Salzburg, Austria, Soccer). Logo laden.
- **Sofort-Datenlauf** `data-pipeline/add_salzburg.mjs` (neu): eine robuste Query
  (P54-Zeiträume + P1532/P27-Nationalität + Sitelinks für sl, viele Retries wegen
  aktueller WDQS-Störung) gegen `Q994811`. Merge auf `src/players.js`:
  - bestehender Spieler (`norm(name)|by`): `RBS` in `clubs` (sortiert, dedup) +
    `[RBS, von, bis]` in `cp` (dedup, sortiert); leere `nat` per gemapptem Code
    nachtragen.
  - neuer Spieler: Datensatz `{n, ln, by, nat, clubs:["RBS"], sl, cp:[[RBS,…]]}`.
  Nutzt `NATION_QID`/`GAME_BY_QID`/`deriveLastName`/`norm` aus `wikidata_roster.mjs`.

## 3. Ronaldo / FA Cup 2004 (ManUtd)

`data-pipeline/wikidata_honours.mjs`: `GAP_WINNERS.FAC = [[2003, "MUN"]]`
(FA-Cup-Saison 2003/04). `apply_gap_winners.mjs` (bestehend) vergibt FAC via
`cp`-Überlappung an den kompletten 2004er-United-Kader (CR7 hat MUN 2003–2009 →
Treffer). Rein lokal.

## Nicht-Ziele (YAGNI)

- Keine österreichische Liga-Kachel; kein Voll-Refresh (gezielte Läufe genügen);
  keine weiteren GAP-Einträge ohne Anlass.

## Tests / Verifikation

- `gameData.test.js`: Board hat 3–4 Nationen (neuer/erweiterter Test);
  bestehende Liga-/Honour-Tests bleiben grün.
- Nach Läufen: Salzburg-Spieler (Haaland/Mané/Szoboszlai) haben `RBS` in `clubs`;
  CR7 hat `FAC`; Salzburg-PNG (512²). `npm test` (42+) + `npm run build` grün.

## Betroffene Dateien

- `src/gameData.js`, `src/gameData.test.js`
- `data-pipeline/wikidata_roster.mjs`, `wikidata_honours.mjs`, `fetch_logos.mjs`,
  `add_salzburg.mjs` (neu)
- `public/logos/club/RBS.png` (generiert), `src/players.js` (generiert)
