# Nationen-Anzahl, RB Salzburg, Ronaldo/FA-Cup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Board zieht 3–4 (statt 6) Nationen; FC Red Bull Salzburg als Vereins-Feld mit Logo + Kaderdaten; Ronaldo & 2004er-United-Kader bekommen FA Cup.

**Architecture:** `gameData.js`-Defs (Nationen-Anzahl, RBS-Verein); Pipeline: CLUB_QID + Logo-ID + GAP_WINNERS.FAC; gezielte Datenläufe `add_salzburg.mjs` (Wikidata, robust) und `apply_gap_winners.mjs` (lokal).

**Tech Stack:** Vite/React + Node/Wikidata. Tests `node:test`.

---

## Task 1: Nationen-Anzahl 3–4 (TDD)

**Files:**
- Modify: `src/gameData.js`, `src/gameData.test.js`

- [ ] **Step 1: Test.** In `src/gameData.test.js` den Test `"buildBoardSerial: 31 Felder mit 1–3 Liga- und 2–4 Honour-Feldern"` um eine Nationen-Prüfung erweitern — nach der `honours`-Zeile im Schleifenkörper einfügen:

```js
    const nats = board.filter((c) => c.t === "nat").length;
    assert.ok(nats >= 3 && nats <= 4, `Nationen-Anzahl: ${nats}`);
```

- [ ] **Step 2:** Run `npm test` — Expected: FAIL (aktuell 6 Nationen).

- [ ] **Step 3: Implementieren.** In `src/gameData.js` in `buildBoardSerial` die Zeilen

```js
  const nations = pick(NATIONS, 6);
  const rest = pick(CLUBS.filter((c) => !blClubs.includes(c)), 31 - 3 - 4 - 6 - nLeague - nHonour);
```

ersetzen durch:

```js
  const nNat = 3 + Math.floor(Math.random() * 2); // 3–4 Nationen
  const nations = pick(NATIONS, nNat);
  const rest = pick(CLUBS.filter((c) => !blClubs.includes(c)), 31 - 3 - 4 - nNat - nLeague - nHonour);
```

- [ ] **Step 4:** Run `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/gameData.js src/gameData.test.js
git commit -m "feat: Board zieht 3–4 Nationen-Felder (statt fix 6)"
```

---

## Task 2: RB Salzburg — Defs + QID + Logo-Konfig

**Files:**
- Modify: `src/gameData.js`, `data-pipeline/wikidata_roster.mjs`, `data-pipeline/fetch_logos.mjs`

- [ ] **Step 1: LG_COUNTRY.** In `src/gameData.js` die Zeile

```js
const LG_COUNTRY = { BL: "GER", PL: "ENG", LL: "ESP", SA: "ITA", L1: "FRA", PT: "POR", NL: "NED" };
```

ersetzen durch:

```js
const LG_COUNTRY = { BL: "GER", PL: "ENG", LL: "ESP", SA: "ITA", L1: "FRA", PT: "POR", NL: "NED", AT: "AUT" };
```

- [ ] **Step 2: CLUBS-Eintrag.** In `src/gameData.js` die letzte Vereins-Zeile

```js
  { key: "FEY", lg: "NL", label: "FEY", name: "Feyenoord Rotterdam",      c1: "#fff",    c2: "#E30613",  pat: "halvesV" },
].map((c) => ({ ...c, type: "club", country: LG_COUNTRY[c.lg] }));
```

ersetzen durch:

```js
  { key: "FEY", lg: "NL", label: "FEY", name: "Feyenoord Rotterdam",      c1: "#fff",    c2: "#E30613",  pat: "halvesV" },
  { key: "RBS", lg: "AT", label: "RBS", name: "FC Red Bull Salzburg",     c1: "#C8102E", c2: "#001E5A",  pat: "solid"   },
].map((c) => ({ ...c, type: "club", country: LG_COUNTRY[c.lg] }));
```

- [ ] **Step 3: CLUB_QID.** In `data-pipeline/wikidata_roster.mjs` im `CLUB_QID`-Objekt nach dem `FEY`-Eintrag `RBS:"Q994811",` ergänzen (in der letzten Zeile mit AJA/PSV/FEY):

```js
  POR:"Q128446", SLB:"Q131499", SCP:"Q75729", AJA:"Q81888", PSV:"Q11938", FEY:"Q134241", RBS:"Q994811",
```

- [ ] **Step 4: Logo-ID.** In `data-pipeline/fetch_logos.mjs` die Zeile

```js
const TEAM_ID = { PSG: [133714, "Paris"], SCP: [135708, "Sporting"] };
```

ersetzen durch:

```js
const TEAM_ID = { PSG: [133714, "Paris"], SCP: [135708, "Sporting"], RBS: [133970, "Salzburg"] };
```

Und im `CLUB_SEARCH`-Objekt einen Platzhalter für RBS ergänzen (damit die Schleife den Key kennt) — nach dem `FEY`-Eintrag:

```js
  RBS: ["Red Bull Salzburg", "Austria"],
```

- [ ] **Step 5: Logo laden**

```bash
node data-pipeline/fetch_logos.mjs 2>&1 | grep -v übersprungen
```

Expected: `club RBS: Red Bull Salzburg (per ID) ✓`; `file public/logos/club/RBS.png` = PNG.

- [ ] **Step 6: Build + Commit**

```bash
npm run build && git add src/gameData.js data-pipeline/wikidata_roster.mjs data-pipeline/fetch_logos.mjs public/logos/club/RBS.png
git commit -m "feat: FC Red Bull Salzburg (RBS) — Def, QID, Logo"
```

---

## Task 3: `add_salzburg.mjs` — Kaderdaten

**Files:**
- Create: `data-pipeline/add_salzburg.mjs`

- [ ] **Step 1: Skript anlegen:**

```js
#!/usr/bin/env node
/* Trägt FC Red Bull Salzburg (RBS, Q994811) in src/players.js ein: RBS in clubs,
   cp-Zeiträume, Nationalität (via NATION_QID), neue Spieler anlegen. Additiv.
   Robuste Retries (Wikidata-Störung). */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { NATION_QID, norm, deriveLastName } from "./wikidata_roster.mjs";
import { stampDataInfo } from "./stamp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
const QID = "Q994811";
const GAME_BY_QID = Object.fromEntries(Object.entries(NATION_QID).map(([g, q]) => [q, g]));
const qidOf = (uri) => (uri ? uri.split("/").pop() : null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 10; attempt++) {
    let res;
    try { res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } }); }
    catch (e) { await sleep(15000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(65000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    try { return JSON.parse(text).results.bindings; } catch (e) { await sleep(15000); continue; }
  }
  throw new Error("SPARQL fehlgeschlagen (Retries erschöpft)");
}

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`;
  if (r.cp && r.cp.length) s += `, "cp": ${JSON.stringify(r.cp)}`;
  return s + "}";
}

const q = `SELECT ?pLabel ?by ?sl ?snat ?cnat ?f ?t WHERE {
  ?p p:P54 ?st . ?st ps:P54 wd:${QID} ; pq:P580 ?s . OPTIONAL { ?st pq:P582 ?e. }
  ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d ; wikibase:sitelinks ?sl .
  BIND(YEAR(?d) AS ?by) BIND(YEAR(?s) AS ?f) BIND(IF(BOUND(?e), YEAR(?e), 0) AS ?t)
  OPTIONAL { ?p wdt:P1532 ?snat. }
  OPTIONAL { ?p wdt:P27 ?cnat. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

const rows = await sparql(q);
console.log(`Salzburg-Zeilen: ${rows.length}`);
// Aggregieren je Spieler: norm|by -> {name, by, sl, nat, periods:[[from,to]]}
const agg = new Map();
for (const b of rows) {
  const name = b.pLabel?.value, by = b.by?.value ? parseInt(b.by.value) : null;
  if (!name || !by) continue;
  const k = norm(name) + "|" + by;
  let e = agg.get(k);
  if (!e) { e = { name, by, sl: 0, nat: null, periods: [] }; agg.set(k, e); }
  e.sl = Math.max(e.sl, b.sl?.value ? parseInt(b.sl.value) : 0);
  const nat = GAME_BY_QID[qidOf(b.snat?.value)] || GAME_BY_QID[qidOf(b.cnat?.value)];
  if (!e.nat && nat) e.nat = nat;
  const f = b.f?.value ? parseInt(b.f.value) : null;
  const t = b.t?.value != null ? parseInt(b.t.value) : 0;
  if (f) e.periods.push([f, t]);
}

const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
const players = mod.PLAYERS.map((p) => ({ ...p }));
const byKey = new Map(players.map((p) => [norm(p.n) + "|" + p.by, p]));
let added = 0, enriched = 0;
for (const [k, e] of agg) {
  const seen = new Set();
  const cp = e.periods
    .filter(([f, t]) => { const s = `RBS|${f}|${t}`; if (seen.has(s)) return false; seen.add(s); return true; })
    .map(([f, t]) => ["RBS", f, t]).sort((a, b) => a[1] - b[1]);
  const cur = byKey.get(k);
  if (cur) {
    if (!cur.clubs.includes("RBS")) { cur.clubs = [...new Set([...cur.clubs, "RBS"])].sort(); enriched++; }
    cur.cp = [...(cur.cp || []).filter((x) => x[0] !== "RBS"), ...cp].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    if (!(cur.nat || []).length && e.nat) cur.nat = [e.nat];
  } else {
    players.push({ n: e.name, ln: deriveLastName(e.name), by: e.by, nat: e.nat ? [e.nat] : [], clubs: ["RBS"], sl: e.sl, cp });
    added++;
  }
}
players.sort((a, b) => a.n.localeCompare(b.n, "en"));
const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
stampDataInfo();
console.log(`Fertig: ${enriched} ergänzt, ${added} neu -> src/players.js`);
```

- [ ] **Step 2: Lauf + Verifikation**

```bash
node data-pipeline/add_salzburg.mjs
node -e 'import("./src/players.js").then(({PLAYERS})=>{
  console.log("RBS-Spieler:", PLAYERS.filter(p=>(p.clubs||[]).includes("RBS")).length);
  ["Erling Haaland","Sadio Mané","Dominik Szoboszlai"].forEach(n=>{const p=PLAYERS.find(x=>x.n===n);console.log(n,p?JSON.stringify({clubs:p.clubs,cp:p.cp}):"?")});
})'
```

Expected: RBS-Spieler > 100; Haaland/Mané/Szoboszlai haben `RBS` in clubs.

- [ ] **Step 3: Commit**

```bash
git add data-pipeline/add_salzburg.mjs src/players.js src/dataInfo.js
git commit -m "data: RB-Salzburg-Kader (RBS in clubs + cp)"
```

---

## Task 4: Ronaldo / FA Cup 2004

**Files:**
- Modify: `data-pipeline/wikidata_honours.mjs`, `src/players.js`

- [ ] **Step 1: GAP_WINNERS.** In `data-pipeline/wikidata_honours.mjs` das `GAP_WINNERS`-Objekt

```js
export const GAP_WINNERS = {
  DFB: [[2009, "FCB"], [2011, "BVB"], [2012, "FCB"], [2013, "FCB"],
        [2023, "B04"], [2024, "VFB"], [2025, "FCB"]],
};
```

ersetzen durch:

```js
export const GAP_WINNERS = {
  DFB: [[2009, "FCB"], [2011, "BVB"], [2012, "FCB"], [2013, "FCB"],
        [2023, "B04"], [2024, "VFB"], [2025, "FCB"]],
  FAC: [[2003, "MUN"]], // FA Cup 2003/04 — Manchester United (Wikidata-Lücke)
};
```

- [ ] **Step 2: Anwenden + Verifikation**

```bash
node data-pipeline/apply_gap_winners.mjs
node -e 'import("./src/players.js").then(({PLAYERS})=>{
  const p=PLAYERS.find(x=>x.n==="Cristiano Ronaldo"); console.log("CR7 t:",JSON.stringify(p.t));
  console.log("FAC gesamt:", PLAYERS.filter(x=>(x.t||[]).includes("FAC")).length);
})'
```

Expected: CR7 `t` enthält `FAC`; FAC-Gesamt gestiegen.

- [ ] **Step 3: Tests + Build + Commit**

```bash
npm test && npm run build
git add data-pipeline/wikidata_honours.mjs src/players.js src/dataInfo.js
git commit -m "data: FA Cup 2004 (ManUtd) via GAP_WINNERS — CR7 & Kader"
```

---

## Task 5: Abschluss

- [ ] `superpowers:finishing-a-development-branch` — Push + PR via GitHub-API, mergen auf Zuruf.

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** Nationen 3–4 → Task 1; RBS Def/QID/Logo → Task 2, Kaderdaten → Task 3; FA-Cup → Task 4. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** Club-Key `RBS` in gameData/CLUB_QID/TEAM_ID/CLUB_SEARCH/add_salzburg identisch; `lg:"AT"`→`LG_COUNTRY.AT`; `GAP_WINNERS.FAC`-Format `[[jahr,clubKey]]` wie DFB; `recToString` mit pos+cp (Vollstand).
