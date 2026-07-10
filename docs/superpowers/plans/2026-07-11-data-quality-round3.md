# Datenqualität Runde 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nationalität über Länder-QID (fixt GER/ENG/NED/CRO), Honours-Query beschleunigen (fixt MLL/MSA-Timeout), Sporting-Logo korrigieren; anschließend Voll-Refresh der Daten.

**Architecture:** `wikidata_roster.mjs` bekommt `NATION_QID`-Mapping + QID-basierte nat-Erfassung + Backfill leerer nat; `wikidata_honours.mjs` nutzt Property-Path `(P580|P585)` statt zwei OPTIONALs; `fetch_logos.mjs` holt Sporting per verifizierter ID. Danach `npm run data:refresh` → neues `players.js`.

**Tech Stack:** Node ESM + Wikidata SPARQL; App unberührt.

---

## Task 1: Honours-Query beschleunigen

**Files:**
- Modify: `data-pipeline/wikidata_honours.mjs`

- [ ] **Step 1:** In `fetchHonourPlayers` den Block

```js
      ?season wdt:P3450 wd:${qid} ; wdt:P1346 ?winner .
      OPTIONAL { ?season wdt:P580 ?st580. }
      OPTIONAL { ?season wdt:P585 ?st585. }
      BIND(COALESCE(?st580, ?st585) AS ?ss)
      FILTER( BOUND(?ss) && YEAR(?ss) >= ${from} && YEAR(?ss) < ${to} )
      OPTIONAL { ?season wdt:P582 ?se. }
```

ersetzen durch:

```js
      ?season wdt:P3450 wd:${qid} ; wdt:P1346 ?winner ; (wdt:P580|wdt:P585) ?ss .
      FILTER( YEAR(?ss) >= ${from} && YEAR(?ss) < ${to} )
      OPTIONAL { ?season wdt:P582 ?se. }
```

- [ ] **Step 2:** `node --check data-pipeline/wikidata_honours.mjs` (Expected: kein Fehler). Commit:

```bash
git add data-pipeline/wikidata_honours.mjs
git commit -m "fix: Honours-Query via Property-Path (P580|P585) — kein Timeout mehr (MLL/MSA)"
```

---

## Task 2: Nationalität über Länder-QID + Backfill

**Files:**
- Modify: `data-pipeline/wikidata_roster.mjs`

- [ ] **Step 1: NATION_QID-Mapping.** Nach `NATION_KEYS` (Zeile 41) einfügen:

```js
// Spiel-Code -> Wikidata-Länder-QID (ISO-3 taugt nicht: DEU≠GER, NLD≠NED, England ohne ISO).
export const NATION_QID = {
  FRA: "Q142", GER: "Q183", ESP: "Q29", ITA: "Q38", NED: "Q55", BEL: "Q31",
  CRO: "Q224", ENG: "Q21", PRT: "Q45", JPN: "Q17", BRA: "Q155", ARG: "Q414",
  MEX: "Q96", NGA: "Q1033", CIV: "Q1008", SEN: "Q1041", COL: "Q739", USA: "Q30",
};
const GAME_BY_QID = Object.fromEntries(Object.entries(NATION_QID).map(([g, q]) => [q, g]));
const qidOf = (uri) => (uri ? uri.split("/").pop() : null);
```

- [ ] **Step 2: Query auf QID umstellen.** In `fetchClubRoster` die Zeilen

```js
  const q = `SELECT ?pLabel ?by ?sl ?siso ?ciso WHERE {
    ?p p:P54 ?st . ?st ps:P54 wd:${qid} .
    ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d ; wikibase:sitelinks ?sl .
    BIND(YEAR(?d) AS ?by)
    OPTIONAL { ?p wdt:P1532 ?sc . ?sc wdt:P298 ?siso . }
    OPTIONAL { ?p wdt:P27 ?c . ?c wdt:P298 ?ciso . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
```

ersetzen durch:

```js
  const q = `SELECT ?pLabel ?by ?sl ?snat ?cnat WHERE {
    ?p p:P54 ?st . ?st ps:P54 wd:${qid} .
    ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d ; wikibase:sitelinks ?sl .
    BIND(YEAR(?d) AS ?by)
    OPTIONAL { ?p wdt:P1532 ?snat. }
    OPTIONAL { ?p wdt:P27 ?cnat. }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
```

- [ ] **Step 3: Row-Mapping.** In `fetchClubRoster` die Rückgabe-Map (die `siso`/`ciso` liest) — der Block

```js
    siso: b.siso?.value || null, ciso: b.ciso?.value || null,
```

ersetzen durch (QID → Spiel-Code):

```js
    siso: GAME_BY_QID[qidOf(b.snat?.value)] || null, ciso: GAME_BY_QID[qidOf(b.cnat?.value)] || null,
```

(Die Feldnamen `siso`/`ciso` bleiben — jetzt tragen sie den Spiel-Code statt ISO.)

- [ ] **Step 4: Aggregation vereinfachen.** Die Zeilen

```js
      if (!e.siso && r.siso && NATION_KEYS.has(r.siso)) e.siso = r.siso; // sportliche Nation bevorzugt
      if (!e.ciso && r.ciso && NATION_KEYS.has(r.ciso)) e.ciso = r.ciso; // Staatsbürgerschaft Fallback
```

ersetzen durch (r.siso/r.ciso sind bereits gemappte Spiel-Codes oder null):

```js
      if (!e.siso && r.siso) e.siso = r.siso; // sportliche Nation bevorzugt
      if (!e.ciso && r.ciso) e.ciso = r.ciso; // Staatsbürgerschaft Fallback
```

- [ ] **Step 5: Backfill beim Merge.** Im `if (cur) { … }`-Zweig (bestehende Spieler) nach `cur.sl = Math.max(cur.sl || 0, e.sl);` einfügen:

```js
      if (!cur.nat.length) { const code = e.siso || e.ciso; if (code) cur.nat = [code]; } // leere Nationalität nachtragen
```

- [ ] **Step 6:** `node --check data-pipeline/wikidata_roster.mjs`. Commit:

```bash
git add data-pipeline/wikidata_roster.mjs
git commit -m "fix: Nationalität über Länder-QID (GER/ENG/NED/CRO) + Backfill leerer nat"
```

---

## Task 3: Sporting-Logo

**Files:**
- Modify: `data-pipeline/fetch_logos.mjs`
- Modify: `public/logos/club/SCP.png`

- [ ] **Step 1:** In `fetch_logos.mjs` die Zeile

```js
const TEAM_ID = { PSG: [133714, "Paris"] };
```

ersetzen durch:

```js
const TEAM_ID = { PSG: [133714, "Paris"], SCP: [135708, "Sporting"] };
```

- [ ] **Step 2: PNG neu laden**

```bash
rm public/logos/club/SCP.png && node data-pipeline/fetch_logos.mjs 2>&1 | grep -v übersprungen
```

Expected: `club SCP: Sporting CP (per ID) ✓`; `file public/logos/club/SCP.png` = PNG.

- [ ] **Step 3: Commit**

```bash
git add data-pipeline/fetch_logos.mjs public/logos/club/SCP.png
git commit -m "fix: Sporting-Logo — verifizierter ID-Lookup (135708)"
```

---

## Task 4: Voll-Refresh & Verifikation

**Files:**
- Modify (generiert): `src/players.js`, `src/dataInfo.js`

- [ ] **Step 1: Refresh** (lange, im Hintergrund):

Run: `npm run data:refresh`
Expected: roster (Backfill-Zahlen), honours (`MLL`/`MSA` mit vielen Zuordnungen, kein FEHLER), honours_extra, positions, careers laufen durch.

- [ ] **Step 2: Verifikation**

```bash
node -e 'import("./src/players.js").then(({PLAYERS})=>{
  const c={}; let e=0; for(const p of PLAYERS){for(const k of (p.t||[]))c[k]=(c[k]||0)+1; if(!(p.nat||[]).length)e++;}
  console.log("Spieler",PLAYERS.length,"| MLL",c.MLL,"MSA",c.MSA,"MBL",c.MBL,"FAC",c.FAC,"| leere nat",e);
  for(const n of ["Michael Owen","Patrick Helmes"]){const p=PLAYERS.find(x=>x.n===n);console.log(n,JSON.stringify(p?.nat))}
})'
```

Expected: MLL ~1300+, MSA ~2200+, leere nat deutlich < 14.000; Owen `["ENG"]`, Helmes `["GER"]`.

- [ ] **Step 3: Tests + Build + Commit**

```bash
npm test && npm run build
git add src/players.js src/dataInfo.js
git commit -m "data: Voll-Refresh — MLL/MSA wieder da, Nationalitäten nachgetragen"
```

---

## Task 5: Abschluss

- [ ] `superpowers:finishing-a-development-branch` — Push + PR via GitHub-API, mergen auf Zuruf. Dem User zurückmelden: FAC war nie defekt (1560 Einträge).

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** Befund 3+5 (Honours-Query) → Task 1; Befund 2+6 (nat QID + Backfill) → Task 2; Befund 1 (Sporting) → Task 3; Daten → Task 4; Befund 4 (FAC) = kein Fix, Rückmeldung → Task 5. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** `siso`/`ciso` behalten Namen, tragen jetzt Spiel-Codes; `NATION_QID`/`GAME_BY_QID`/`qidOf` konsistent; Property-Path-Query liefert `?ss` wie zuvor (Rest unverändert).
