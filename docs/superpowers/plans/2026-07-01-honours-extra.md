# Neue Honours (BdO/EM/CA/EL) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vier neue Honours (Ballon d'Or, Europameister, Copa-América-Sieger, Europa-League-Sieger) als Spiel-Felder + Wikidata-Anreicherung des `t`-Felds in `players.js` (additiv, `pos`-erhaltend).

**Architecture:** HONOURS-Defs in `gameData.js` erweitern (11 → 15, alle Spielformen ziehen automatisch nach); neues selbstständiges Pipeline-Skript `wikidata_honours_extra.mjs` mit QID-Verifikation, Turnier-Sieger-Fensterlogik (EM/CA/EL) bzw. P166-Award-Query (BDO) und Union-Merge in bestehende `t`-Arrays; `recToString`-Fix (`pos`) auch im alten Honours-Skript.

**Tech Stack:** Node (ESM, fetch/SPARQL gegen query.wikidata.org), Vite/React unverändert, Tests `node:test`.

---

## File Structure

- `src/gameData.js` — **modify**: 4 neue HONOURS-Defs.
- `src/gameData.test.js` — **modify**: 15er-Checks.
- `data-pipeline/wikidata_honours_extra.mjs` — **create**: additive Anreicherung.
- `data-pipeline/wikidata_honours.mjs` — **modify**: `recToString` + `pos`.
- `src/players.js` — **generiert** durch Skriptlauf.

---

## Task 1: HONOURS-Defs (TDD)

**Files:**
- Modify: `src/gameData.js`
- Modify: `src/gameData.test.js`

- [ ] **Step 1: Tests anpassen.** In `src/gameData.test.js` den Test `"HONOURS enthält 11 Honours als type 'honour'"` ersetzen durch:

```js
test("HONOURS enthält 15 Honours als type 'honour'", () => {
  assert.equal(HONOURS.length, 15);
  assert.deepEqual(
    HONOURS.map((h) => h.key).sort(),
    ["BDO", "CA", "CDR", "CIT", "CL", "DFB", "EL", "EM", "FAC", "MBL", "ML1", "MLL", "MPL", "MSA", "WM"]
  );
  for (const h of HONOURS) {
    assert.equal(h.type, "honour");
    assert.ok(h.name && h.label && h.icon && h.c1 && h.c2);
  }
});
```

Und im Test `"lookupDef löst Honour-Keys auf"` zwei Zeilen ergänzen:

```js
  assert.equal(lookupDef("honour", "BDO").name, "Ballon-d'Or-Sieger");
  assert.equal(lookupDef("honour", "EM").name, "Europameister");
```

- [ ] **Step 2: Tests ausführen, Fehlschlag prüfen**

Run: `npm test`
Expected: FAIL (HONOURS.length ist 11).

- [ ] **Step 3: Defs ergänzen.** In `src/gameData.js` im `HONOURS`-Array nach der `CIT`-Zeile einfügen:

```js
  { key: "BDO", label: "BdO", name: "Ballon-d'Or-Sieger",   icon: "👑", c1: "#C9A227", c2: "#3d2f00" },
  { key: "EM",  label: "EM",  name: "Europameister",        icon: "🇪🇺", c1: "#123B8F", c2: "#C9A227" },
  { key: "CA",  label: "CA",  name: "Copa-América-Sieger",  icon: "🌎", c1: "#2DD4BF", c2: "#0e4d44" },
  { key: "EL",  label: "EL",  name: "Europa-League-Sieger", icon: "🏆", c1: "#F26F21", c2: "#5c2500" },
```

- [ ] **Step 4: Tests ausführen**

Run: `npm test`
Expected: PASS (32 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/gameData.js src/gameData.test.js
git commit -m "feat: 4 neue Honours-Defs (BdO, EM, Copa América, Europa League)"
```

---

## Task 2: `recToString`-Fix im alten Honours-Skript

**Files:**
- Modify: `data-pipeline/wikidata_honours.mjs`

- [ ] **Step 1:** In `data-pipeline/wikidata_honours.mjs` die Funktion

```js
function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  return s + "}";
}
```

ersetzen durch:

```js
function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`; // pos erhalten (kam nach diesem Skript dazu)
  return s + "}";
}
```

- [ ] **Step 2: Commit**

```bash
git add data-pipeline/wikidata_honours.mjs
git commit -m "fix: wikidata_honours.mjs erhält pos-Feld beim Rerun"
```

---

## Task 3: Neues Skript `wikidata_honours_extra.mjs`

**Files:**
- Create: `data-pipeline/wikidata_honours_extra.mjs`

- [ ] **Step 1: Skript anlegen** mit folgendem Inhalt:

```js
#!/usr/bin/env node
/*
 * wikidata_honours_extra.mjs — ergänzt das Feld `t` in src/players.js ADDITIV um:
 *   BDO Ballon d'Or (P166 direkt am Spieler)
 *   EM  Europameister, CA Copa-América-Sieger, EL Europa-League-Sieger
 *       (Turnier-/Saison-Sieger P1346 × P54-Mitgliedszeitraum, wie WM/CL im
 *        Basis-Skript wikidata_honours.mjs)
 * Merge: t = union(bestehend, neu); pos/sl bleiben erhalten. Internet nötig.
 *   node data-pipeline/wikidata_honours_extra.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";

// Erwartete QIDs + engl. Labels — werden VOR dem Lauf verifiziert (Abbruch bei Abweichung).
const EXPECT = {
  EM:  { qid: "Q260858", label: "UEFA European Championship" },
  CA:  { qid: "Q243493", label: "Copa América" },
  EL:  { qid: "Q18760",  label: "UEFA Europa League" },
  BDO: { qid: "Q166177", label: "Ballon d'Or" },
};

export function norm(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } });
    } catch (e) { await sleep(5000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(8000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    try { return JSON.parse(text).results.bindings; }
    catch (e) { await sleep(5000); continue; }
  }
  throw new Error("SPARQL fehlgeschlagen (Retries erschöpft)");
}

async function verifyQids() {
  console.log("QID-Verifikation:");
  for (const [key, { qid, label }] of Object.entries(EXPECT)) {
    const rows = await sparql(`SELECT ?l WHERE { wd:${qid} rdfs:label ?l . FILTER(LANG(?l)="en") }`);
    const got = rows[0]?.l?.value || "";
    console.log(`  ${key} ${qid}: "${got}"`);
    if (norm(got) !== norm(label)) throw new Error(`QID-Check ${key}: erwartet "${label}", bekommen "${got}"`);
    await sleep(500);
  }
}

// Zeitfenster (Saison-/Turnier-Startjahr) gegen zu große WDQS-Antworten.
const WINDOWS = [[1890, 1960], [1960, 1980], [1980, 1995], [1995, 2005], [2005, 2010],
                 [2010, 2014], [2014, 2018], [2018, 2022], [2022, 2025], [2025, 2031]];

// Spieler, die im Titel-Zeitraum beim Sieger des Wettbewerbs waren (gefenstert).
async function fetchHonourPlayers(qid) {
  const out = [];
  for (const [from, to] of WINDOWS) {
    const q = `SELECT DISTINCT ?pLabel ?by WHERE {
      ?season wdt:P3450 wd:${qid} ; wdt:P1346 ?winner ; wdt:P580 ?ss .
      FILTER( YEAR(?ss) >= ${from} && YEAR(?ss) < ${to} )
      OPTIONAL { ?season wdt:P582 ?se. }
      ?p p:P54 ?st . ?st ps:P54 ?winner ; pq:P580 ?cs .
      OPTIONAL { ?st pq:P582 ?ce. }
      ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d . BIND(YEAR(?d) AS ?by)
      FILTER( YEAR(?cs) <= YEAR(COALESCE(?se, ?ss)) && (!BOUND(?ce) || YEAR(?ce) >= YEAR(?ss)) )
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`;
    const rows = await sparql(q);
    for (const b of rows) out.push({ name: b.pLabel?.value, by: b.by?.value ? parseInt(b.by.value) : null });
    await sleep(700);
  }
  return out;
}

// Individueller Award (Ballon d'Or): P166 direkt am Spieler, keine Fensterung nötig.
async function fetchAwardPlayers(qid) {
  const q = `SELECT DISTINCT ?pLabel ?by WHERE {
    ?p wdt:P166 wd:${qid} ; wdt:P106 wd:Q937857 ; wdt:P569 ?d .
    BIND(YEAR(?d) AS ?by)
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  const rows = await sparql(q);
  return rows.map((b) => ({ name: b.pLabel?.value, by: b.by?.value ? parseInt(b.by.value) : null }));
}

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`;
  return s + "}";
}

async function main() {
  await verifyQids();

  // 1) Neue Honours je Spieler sammeln: "norm|by" -> Set(keys)
  const hon = new Map();
  const add = (rows, key) => {
    let c = 0;
    for (const r of rows) {
      if (!r.name || !r.by) continue;
      const k = norm(r.name) + "|" + r.by;
      if (!hon.has(k)) hon.set(k, new Set());
      hon.get(k).add(key); c++;
    }
    return c;
  };
  for (const key of ["EM", "CA", "EL"]) {
    const rows = await fetchHonourPlayers(EXPECT[key].qid);
    console.log(`  ${key}: ${rows.length} Zeilen, ${add(rows, key)} Zuordnungen`);
    await sleep(1300);
  }
  {
    const rows = await fetchAwardPlayers(EXPECT.BDO.qid);
    console.log(`  BDO: ${rows.length} Zeilen, ${add(rows, "BDO")} Zuordnungen`);
  }

  // 2) players.js laden, t ADDITIV mergen (pos/sl unangetastet)
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  const counts = { BDO: 0, EM: 0, CA: 0, EL: 0 };
  let touched = 0;
  for (const p of players) {
    const extra = hon.get(norm(p.n) + "|" + p.by);
    if (!extra || !extra.size) continue;
    const t = new Set(p.t || []);
    const before = t.size;
    for (const k of extra) { if (!t.has(k)) counts[k] = (counts[k] || 0) + 1; t.add(k); }
    if (t.size > before) touched++;
    p.t = [...t].sort();
  }

  // 3) Schreiben (Reihenfolge wie zuvor: nach Name)
  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  const body = players.map(recToString).join(",\n  ");
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + body + "\n];\n");
  console.log(`\nFertig: ${touched} Spieler ergänzt`, counts, "-> src/players.js");
  // Stichproben zur Plausibilität
  for (const key of ["BDO", "EM", "CA", "EL"]) {
    const sample = players.filter((p) => (p.t || []).includes(key)).sort((a, b) => (b.sl || 0) - (a.sl || 0)).slice(0, 5).map((p) => p.n);
    console.log(`  ${key}-Beispiele:`, sample.join(", "));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
```

- [ ] **Step 2: Commit**

```bash
git add data-pipeline/wikidata_honours_extra.mjs
git commit -m "feat: Pipeline-Skript für BdO/EM/CA/EL (additiv, QID-verifiziert)"
```

---

## Task 4: Pipeline-Lauf & Datenverifikation

**Files:**
- Modify (generiert): `src/players.js`

- [ ] **Step 1: Lauf**

Run: `node data-pipeline/wikidata_honours_extra.mjs` (dauert einige Minuten; Retry-Logik eingebaut)
Expected: QID-Verifikation zeigt die 4 erwarteten Labels; danach Zeilen-/Zuordnungs-Counts je Key; am Ende `Fertig: <n> Spieler ergänzt { BDO: …, EM: …, CA: …, EL: … }` + plausible Beispielnamen (BDO: absolute Weltstars; CA: viele Südamerikaner).

- [ ] **Step 2: Diff-Kontrolle**

Run: `git diff --stat src/players.js && git diff src/players.js | grep -c '^[+-]' | head -1`
Und stichprobenartig: `git diff src/players.js | grep '"pos"' | head -3` — geänderte Zeilen müssen `pos` weiterhin enthalten.
Expected: nur `t`-Erweiterungen, keine verlorenen Felder.

- [ ] **Step 3: Tests + Build**

Run: `npm test` (Expected: PASS) und `npm run build` (Expected: `✓`, players-Chunk separat).

- [ ] **Step 4: Commit**

```bash
git add src/players.js
git commit -m "data: Honours BdO/EM/CA/EL aus Wikidata gemergt"
```

---

## Task 5: Abschluss

- [ ] **Step 1:** `npm test` + `npm run build` final grün.
- [ ] **Step 2:** `superpowers:finishing-a-development-branch` — Push + PR via GitHub-API, mergen auf Zuruf.

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** Defs+Tests (A) → Task 1; Pipeline-Skript mit QID-Verifikation, Fenster-Logik, BDO-Award-Query, Union-Merge, pos-erhaltendem recToString (B) → Task 3+4; recToString-Fix im Bestand (C) → Task 2; Verifikation (Counts, Diff, Tests, Build) → Task 4/5. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** Keys BDO/EM/CA/EL identisch in Defs, Test-Sortierliste, EXPECT-Tabelle, counts-Objekt; `norm|by`-Matching identisch zum Basis-Skript.
