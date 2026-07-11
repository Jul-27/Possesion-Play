# Nationalteam-Kader + Österreich Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Österreich als 19. Nation; Nationalteam-Kader (P54, letzte ~30 Jahre) aller 19 Nationen importieren, um Länder-Felder vollständig zu machen; Trauner & künftige Einzelfälle über kuratierte EXTRA_PLAYERS.

**Architecture:** gameData NATIONS += AUT; roster NATION_QID += AUT; neues `wikidata_national.mjs` (19 Team-QIDs, additiver Merge) in `refresh_all` verankert; `apply_extra_players.mjs` (Wikidata-unabhängig) für kuratierte Spieler.

**Tech Stack:** Node/Wikidata, React/Vite, Tests `node:test`.

---

## Task 1: Österreich als Nation (TDD)

**Files:**
- Modify: `src/gameData.js`, `src/gameData.test.js`, `data-pipeline/wikidata_roster.mjs`

- [ ] **Step 1: Test.** In `src/gameData.test.js` den Test `"LEAGUES enthält 7 Ligen…"` NICHT anfassen; stattdessen einen neuen Test nach dem NATIONS-freien Bereich ergänzen (ans Ende der Datei):

```js
import { NATIONS } from "./gameData.js";
test("NATIONS enthält Österreich (19 Nationen)", () => {
  assert.equal(NATIONS.length, 19);
  assert.equal(lookupDef("nat", "AUT").name, "Österreich");
});
```

- [ ] **Step 2:** Run `npm test` — Expected: FAIL (18 Nationen).

- [ ] **Step 3: NATIONS-Eintrag.** In `src/gameData.js` im `NATIONS`-Array nach dem `USA`-Eintrag ergänzen:

```js
  { key: "AUT", label: "AUT", name: "Österreich",       flag: { kind: "h",  colors: ["#ED2939", "#ffffff", "#ED2939"] } },
```

- [ ] **Step 4:** Run `npm test` — Expected: PASS.

- [ ] **Step 5: NATION_QID.** In `data-pipeline/wikidata_roster.mjs` im `NATION_QID`-Objekt `AUT: "Q40",` ergänzen (Österreich).

- [ ] **Step 6: Build + Commit**

```bash
npm run build && git add src/gameData.js src/gameData.test.js data-pipeline/wikidata_roster.mjs
git commit -m "feat: Österreich als 19. Nation (AUT, Rot-Weiß-Rot) + NATION_QID"
```

---

## Task 2: `wikidata_national.mjs`

**Files:**
- Create: `data-pipeline/wikidata_national.mjs`
- Modify: `data-pipeline/refresh_all.mjs`

- [ ] **Step 1: Skript anlegen:**

```js
#!/usr/bin/env node
/* Importiert Senior-Nationalteam-Kader (P54, Geburtsjahr >= 1970) je Nation aus
   Wikidata und setzt/ergänzt `nat` in src/players.js — auch für Spieler ohne
   erfassten Vereins-Match (füllt Länder-Felder). Additiv, robuste Retries. */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { norm, deriveLastName } from "./wikidata_roster.mjs";
import { stampDataInfo } from "./stamp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Spiel-Code -> Senior-Nationalteam-QID (verifiziert)
const NAT_TEAM_QID = {
  FRA: "Q47774", GER: "Q43310", ESP: "Q42267", ITA: "Q676899", NED: "Q47050",
  BEL: "Q166776", CRO: "Q134479", ENG: "Q47762", PRT: "Q267245", JPN: "Q170566",
  BRA: "Q83459", ARG: "Q79800", MEX: "Q164089", NGA: "Q181930", CIV: "Q175145",
  SEN: "Q207441", COL: "Q212564", USA: "Q164134", AUT: "Q163534",
};

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

async function fetchSquad(qid) {
  const q = `SELECT DISTINCT ?pLabel ?by ?sl WHERE {
    ?p p:P54 ?st . ?st ps:P54 wd:${qid} .
    ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d ; wikibase:sitelinks ?sl .
    BIND(YEAR(?d) AS ?by)
    FILTER( ?by >= 1970 )
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  return (await sparql(q)).map((b) => ({
    name: b.pLabel?.value, by: b.by?.value ? parseInt(b.by.value) : null,
    sl: b.sl?.value ? parseInt(b.sl.value) : 0,
  }));
}

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`;
  if (r.cp && r.cp.length) s += `, "cp": ${JSON.stringify(r.cp)}`;
  return s + "}";
}

async function main() {
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  const byKey = new Map(players.map((p) => [norm(p.n) + "|" + p.by, p]));
  let added = 0, filled = 0;
  for (const [code, qid] of Object.entries(NAT_TEAM_QID)) {
    let squad;
    try { squad = await fetchSquad(qid); } catch (e) { console.log(`  ${code} FEHLER ${e.message}`); continue; }
    let a = 0, f = 0;
    for (const r of squad) {
      if (!r.name || !r.by) continue;
      const k = norm(r.name) + "|" + r.by;
      const cur = byKey.get(k);
      if (cur) { if (!cur.nat.length) { cur.nat = [code]; f++; } }
      else { const rec = { n: r.name, ln: deriveLastName(r.name), by: r.by, nat: [code], clubs: [], sl: r.sl }; players.push(rec); byKey.set(k, rec); a++; }
    }
    added += a; filled += f;
    console.log(`  ${code} (${qid}): ${squad.length} Kader, ${a} neu, ${f} nat ergänzt`);
    await sleep(1500);
  }
  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
  stampDataInfo();
  console.log(`\nFertig: ${added} neue Spieler, ${filled} nat ergänzt -> src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
```

- [ ] **Step 2: In `refresh_all.mjs` verankern.** Die `CHAIN` erweitern — nach `"wikidata_roster.mjs",` einfügen `"wikidata_national.mjs",` (Nationen direkt nach dem Roster, vor honours). `node --check data-pipeline/wikidata_national.mjs`.

- [ ] **Step 3: Commit**

```bash
git add data-pipeline/wikidata_national.mjs data-pipeline/refresh_all.mjs
git commit -m "feat: wikidata_national.mjs — Nationalteam-Kader importieren (in refresh-Kette)"
```

---

## Task 3: `apply_extra_players.mjs` + Trauner

**Files:**
- Create: `data-pipeline/apply_extra_players.mjs`

- [ ] **Step 1: Skript anlegen:**

```js
#!/usr/bin/env node
/* Kuratierte Spieler, die Wikidata nicht/kaum kennt, additiv in src/players.js.
   Anlegen oder Felder ergänzen (clubs/nat/cp union; sl/pos/by setzen falls leer).
   Kein Netz. */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { norm, deriveLastName } from "./wikidata_roster.mjs";
import { stampDataInfo } from "./stamp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");

// Bestätigte Fakten (vom Owner gemeldet), die Wikidata nicht sauber liefert.
export const EXTRA_PLAYERS = [
  { n: "Gernot Trauner", by: 1992, nat: ["AUT"], clubs: ["FEY"], sl: 35, pos: "ABW", cp: [["FEY", 2021, 0]] },
];

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`;
  if (r.cp && r.cp.length) s += `, "cp": ${JSON.stringify(r.cp)}`;
  return s + "}";
}

const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
const players = mod.PLAYERS.map((p) => ({ ...p }));
const byKey = new Map(players.map((p) => [norm(p.n) + "|" + p.by, p]));
let added = 0, merged = 0;
for (const x of EXTRA_PLAYERS) {
  const cur = byKey.get(norm(x.n) + "|" + x.by);
  if (cur) {
    if (x.nat && !(cur.nat || []).length) cur.nat = [...x.nat];
    if (x.clubs) cur.clubs = [...new Set([...(cur.clubs || []), ...x.clubs])].sort();
    if (x.cp) cur.cp = [...(cur.cp || []).filter((c) => !x.cp.some((y) => y[0] === c[0])), ...x.cp].sort((a, b) => a[1] - b[1]);
    if (x.pos && !cur.pos) cur.pos = x.pos;
    if (x.sl && !cur.sl) cur.sl = x.sl;
    merged++;
  } else {
    players.push({ n: x.n, ln: deriveLastName(x.n), by: x.by, nat: x.nat || [], clubs: x.clubs || [], sl: x.sl || 0, pos: x.pos, cp: x.cp });
    added++;
  }
}
players.sort((a, b) => a.n.localeCompare(b.n, "en"));
const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
stampDataInfo();
console.log(`Fertig: ${added} neu, ${merged} ergänzt.`);
```

- [ ] **Step 2: Lauf + Verifikation**

```bash
node data-pipeline/apply_extra_players.mjs
node -e 'import("./src/players.js").then(({PLAYERS})=>{const p=PLAYERS.find(x=>x.n==="Gernot Trauner");console.log("Trauner:",JSON.stringify(p))})'
```

Expected: Trauner mit nat AUT + FEY.

- [ ] **Step 3: Commit**

```bash
git add data-pipeline/apply_extra_players.mjs src/players.js src/dataInfo.js
git commit -m "data: EXTRA_PLAYERS — Gernot Trauner (AUT, Feyenoord)"
```

---

## Task 4: Nationalteam-Import ausführen

**Files:**
- Modify (generiert): `src/players.js`, `src/dataInfo.js`

- [ ] **Step 1: Lauf** (Hintergrund, geduldig wg. WDQS-Störung):

Run: `node data-pipeline/wikidata_national.mjs`
Expected: pro Nation Kadergröße/neu/ergänzt; am Ende Gesamtzahlen. Bei anhaltender WDQS-Störung ggf. FEHLER je Nation → dann später erneut (Skript ist idempotent) oder via Monatsaktion.

- [ ] **Step 2: Verifikation**

```bash
node -e 'import("./src/players.js").then(({PLAYERS})=>{
  const nc={}; for(const p of PLAYERS) for(const k of (p.nat||[])) nc[k]=(nc[k]||0)+1;
  console.log("Spieler:",PLAYERS.length,"| AUT:",nc.AUT||0);
  console.log("Nation-Counts:",Object.entries(nc).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+":"+v).join("  "));
  for(const n of ["David Alaba","Marcel Sabitzer","Gernot Trauner"]){const p=PLAYERS.find(x=>x.n===n);console.log(n,JSON.stringify(p?.nat))}
})'
```

Expected: AUT > 0 (Alaba/Sabitzer/Trauner = AUT); bestehende Länder gestiegen.

- [ ] **Step 3: Tests + Build + Commit**

```bash
npm test && npm run build
git add src/players.js src/dataInfo.js
git commit -m "data: Nationalteam-Kader importiert (Länder-Abdeckung + Österreich)"
```

---

## Task 5: Abschluss

- [ ] `superpowers:finishing-a-development-branch` — Push + PR via GitHub-API, mergen auf Zuruf. Dem User die ehrliche Grenze nennen (Wikidata-Vollständigkeit; EXTRA_PLAYERS für Einzelfälle). Falls Task 4 an der WDQS-Störung scheitert: Code + Trauner mergen, Nationalimport per Folgelauf/Monatsaktion nachziehen.

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** A (Österreich) → Task 1; B (Import) → Task 2+4; C (EXTRA_PLAYERS/Trauner) → Task 3. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** `NAT_TEAM_QID`-Codes = NATIONS-Keys = NATION_QID-Keys; `recToString` identisch (pos+cp); `norm`/`deriveLastName` aus roster wiederverwendet; refresh-Kette: roster → national → honours → honours_extra → positions → careers.
