# Position + Alter im Dropdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Im Spieler-Autocomplete neben dem Namen Position (TW/ABW/MF/ST) und Alter anzeigen, damit gleichnamige Spieler unterscheidbar sind.

**Architecture:** Neues Skript `data-pipeline/wikidata_positions.mjs` ergänzt das optionale Feld `pos` in `src/players.js` aus Wikidata P413 (Stichwort-Mapping auf 4 Gruppen). Das Dropdown in `Game.jsx` zeigt `pos` + berechnetes Alter (`Jahr - by`); kein neuer Datenfeld fürs Alter.

**Tech Stack:** Node 20 (global `fetch`), ESM, Vite/React. Tests: `node:test`. Wikidata SPARQL.

**Hinweis:** Kernschritt (Task 2) ist ein Netzwerk-Lauf; läuft auf dem aktuellen `src/players.js` (27.451 Spieler) und lässt `clubs/nat/t/sl` unverändert.

---

## File Structure

- `data-pipeline/wikidata_positions.mjs` — **create**: `posBucket` + Fetch/Merge/Schreiben (nutzt `CLUB_QID`/`norm` aus `wikidata_roster.mjs`).
- `data-pipeline/wikidata_positions.test.mjs` — **create**: Test für `posBucket` + Datenvalidität.
- `data-pipeline/README.md` — **modify**: Doku.
- `src/players.js` — **regenerate**: Feld `pos`.
- `src/Game.jsx` — **modify**: Dropdown-Meta (Position + Alter).
- `src/styles.css` — **modify**: `.sugMeta`.

---

## Task 1: `posBucket`-Mapping + Skelett (TDD)

**Files:**
- Create: `data-pipeline/wikidata_positions.mjs`
- Create: `data-pipeline/wikidata_positions.test.mjs`

- [ ] **Step 1: Failing test** `data-pipeline/wikidata_positions.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { posBucket } from "./wikidata_positions.mjs";

test("posBucket mappt Positions-Labels auf Gruppen", () => {
  assert.equal(posBucket("goalkeeper"), "TW");
  assert.equal(posBucket("centre-back"), "ABW");
  assert.equal(posBucket("left-back"), "ABW");
  assert.equal(posBucket("defender"), "ABW");
  assert.equal(posBucket("central midfielder"), "MF");
  assert.equal(posBucket("attacking midfield"), "MF");
  assert.equal(posBucket("centre-forward"), "ST");
  assert.equal(posBucket("winger"), "ST");
  assert.equal(posBucket("striker"), "ST");
  assert.equal(posBucket("referee"), null);
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag prüfen**

Run: `node --test data-pipeline/wikidata_positions.test.mjs`
Expected: FAIL — Modul/Export fehlt.

- [ ] **Step 3: `data-pipeline/wikidata_positions.mjs` anlegen** (Skelett + `posBucket`; `main` per Guard, kein Netzwerk bei Import):

```js
#!/usr/bin/env node
/*
 * wikidata_positions.mjs — Ergänzt das Feld `pos` (TW/ABW/MF/ST) je Spieler in
 * src/players.js aus Wikidata P413. Lässt clubs/nat/t/sl unverändert. Internet
 * nötig. Idempotent.   node data-pipeline/wikidata_positions.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { CLUB_QID, norm } from "./wikidata_roster.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";

// Stichwort-Mapping eines englischen P413-Labels auf eine Gruppe.
export function posBucket(label) {
  const s = String(label).toLowerCase();
  if (s.includes("goalkeeper")) return "TW";
  if (s.includes("forward") || s.includes("striker") || s.includes("wing") || s.includes("attack")) return "ST";
  if (s.includes("midfield")) return "MF";
  if (s.includes("back") || s.includes("defender") || s.includes("defence") || s.includes("sweeper")) return "ABW";
  return null;
}

// Eindeutige Gruppe bei mehreren Positionen: Priorität TW > ST > MF > ABW.
export function pickBucket(buckets) {
  for (const b of ["TW", "ST", "MF", "ABW"]) if (buckets.has(b)) return b;
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // wird in Task 2 implementiert
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
```

- [ ] **Step 4: Test ausführen, Erfolg prüfen**

Run: `node --test data-pipeline/wikidata_positions.test.mjs`
Expected: PASS (10 Assertions).

- [ ] **Step 5: Commit**

```bash
git add data-pipeline/wikidata_positions.mjs data-pipeline/wikidata_positions.test.mjs
git commit -m "feat: posBucket-Mapping + Positions-Skript Skelett"
```

---

## Task 2: Positionen holen & `pos` in players.js setzen (Netzwerk)

**Files:**
- Modify: `data-pipeline/wikidata_positions.mjs` (`main` + Fetch)
- Regenerate: `src/players.js`

- [ ] **Step 1: `main` + Fetch implementieren** — die leere `async function main()` ersetzen durch:

```js
async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try { res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } }); }
    catch (e) { await sleep(5000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(8000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    try { return JSON.parse(text).results.bindings; } catch (e) { await sleep(5000); continue; }
  }
  throw new Error("SPARQL fehlgeschlagen (Retries erschöpft)");
}

async function fetchClubPositions(qid) {
  const q = `SELECT ?pLabel ?by ?posLabel WHERE {
    ?p p:P54 ?st . ?st ps:P54 wd:${qid} .
    ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d ; wdt:P413 ?pos .
    BIND(YEAR(?d) AS ?by)
    ?pos rdfs:label ?posLabel . FILTER(LANG(?posLabel) = "en")
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  return (await sparql(q)).map((b) => ({
    name: b.pLabel?.value, by: b.by?.value ? parseInt(b.by.value) : null, pos: b.posLabel?.value,
  }));
}

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`;
  return s + "}";
}

async function main() {
  // 1) Positionen aus Wikidata: key "norm|by" -> Set(buckets)
  const idx = new Map();
  for (const [key, qid] of Object.entries(CLUB_QID)) {
    let rows;
    try { rows = await fetchClubPositions(qid); } catch (e) { console.log(`  ${key} FEHLER ${e.message}`); continue; }
    let c = 0;
    for (const r of rows) {
      const bucket = posBucket(r.pos || "");
      if (!r.name || !r.by || !bucket) continue;
      const k = norm(r.name) + "|" + r.by;
      if (!idx.has(k)) idx.set(k, new Set());
      idx.get(k).add(bucket); c++;
    }
    console.log(`  ${key} (${qid}): ${rows.length} Zeilen, ${c} Positions-Treffer`);
    await sleep(1000);
  }

  // 2) players.js laden, pos setzen
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  let withPos = 0;
  for (const p of players) {
    const buckets = idx.get(norm(p.n) + "|" + p.by);
    const b = buckets ? pickBucket(buckets) : null;
    if (b) { p.pos = b; withPos++; } else delete p.pos;
  }

  // 3) Schreiben (Reihenfolge wie zuvor: nach Name)
  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  const body = players.map(recToString).join(",\n  ");
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + body + "\n];\n");
  console.log(`\nFertig: ${withPos} Spieler mit Position -> src/players.js`);
}
```

- [ ] **Step 2: Skript ausführen** (Internet, ~1–2 Min):

Run: `node data-pipeline/wikidata_positions.mjs`
Expected: 40 Vereinszeilen, dann `Fertig: <viele> Spieler mit Position -> src/players.js`.

- [ ] **Step 3: Validieren** (pos-Werte gültig, andere Felder erhalten, Stichproben):

```bash
node --input-type=module -e "
import('file://'+process.cwd()+'/src/players.js').then(m=>{
  const ok=new Set(['TW','ABW','MF','ST']); let bad=new Set(), withPos=0, withT=0;
  for(const p of m.PLAYERS){ if(p.pos){withPos++; if(!ok.has(p.pos))bad.add(p.pos);} if(p.t)withT++; }
  console.log('Spieler:',m.PLAYERS.length,'| mit pos:',withPos,'| ungültige pos:',[...bad],'| mit t (erhalten):',withT);
  for(const n of ['Manuel Neuer','Sergio Ramos','Andrés Iniesta','Lionel Messi']){const p=m.PLAYERS.find(x=>x.n===n);console.log(' ',n,'->',p?(p.pos||'(keine)')+' | t='+(p.t?p.t.join(','):'-'):'(fehlt)');}
});
"
```
Expected: ungültige pos `[]`; `mit t` weiterhin ~9149 (erhalten); Neuer→TW, Ramos→ABW, Iniesta→MF, Messi→ST.

- [ ] **Step 4: Commit**

```bash
git add data-pipeline/wikidata_positions.mjs src/players.js
git commit -m "feat: Spielerpositionen (pos) aus Wikidata P413 ergaenzt"
```

---

## Task 3: Dropdown-Anzeige (Position + Alter)

**Files:**
- Modify: `src/Game.jsx`
- Modify: `src/styles.css`
- Modify: `data-pipeline/wikidata_positions.test.mjs` (Datenvalidität)
- Modify: `data-pipeline/README.md`

- [ ] **Step 1: Dropdown-Eintrag in `src/Game.jsx` erweitern** — den Suggestions-Block (das `suggestions.map(...)`) ersetzen durch:

```jsx
                  {suggestions.map((s, i) => (
                    <div key={s.n} className={`sugItem ${i === sugActive ? "active" : ""}`}
                      onMouseDown={(e) => { e.preventDefault(); chooseSug(s); }}>
                      <span>{s.n}</span>
                      <span className="sugMeta">{[s.pos, new Date().getFullYear() - s.by].filter(Boolean).join(" · ")}</span>
                    </div>
                  ))}
```

- [ ] **Step 2: `.sugMeta`-Regel in `src/styles.css` ergänzen** — direkt nach der `.sugItem:hover, .sugItem.active`-Zeile einfügen:

```css
.sugMeta { font-family: 'DM Mono', monospace; font-size: 11px; color: var(--muted); letter-spacing: .02em; white-space: nowrap; }
```

- [ ] **Step 3: Build + bestehende Tests**

Run: `npm run build` (Expected: `✓ built in …`) und `npm test` (Expected: PASS).

- [ ] **Step 4: Datenvalidität-Test ergänzen** an `data-pipeline/wikidata_positions.test.mjs`:

```js
test("players.js: pos-Werte sind gültige Gruppen", async () => {
  const players = (await import("../src/players.js")).PLAYERS;
  const ok = new Set(["TW", "ABW", "MF", "ST"]);
  let withPos = 0;
  for (const p of players) {
    if (!p.pos) continue;
    withPos++;
    assert.ok(ok.has(p.pos), "ungültige pos " + p.pos);
  }
  assert.ok(withPos > 1000, "es sollten viele Spieler eine pos haben, sind: " + withPos);
});
```

- [ ] **Step 5: Test ausführen**

Run: `node --test data-pipeline/wikidata_positions.test.mjs`
Expected: PASS.

- [ ] **Step 6: `data-pipeline/README.md` ergänzen** — nach der `wikidata_honours.mjs`-Zeile einfügen:

```markdown
| `wikidata_positions.mjs` | Ergänzt das Feld `pos` (Gruppen TW/ABW/MF/ST) je Spieler aus Wikidata P413, fürs Autocomplete (Name · Position · Alter). Lauf: `node data-pipeline/wikidata_positions.mjs` (Internet nötig). Idempotent; lässt clubs/nat/t/sl unverändert. |
```

- [ ] **Step 7: Commit**

```bash
git add src/Game.jsx src/styles.css data-pipeline/wikidata_positions.test.mjs data-pipeline/README.md
git commit -m "feat: Dropdown zeigt Position + Alter; test+docs"
```

- [ ] **Step 8: Abschluss** — `superpowers:finishing-a-development-branch` (Push + PR).

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** `pos` aus P413, 4 Gruppen → Task 1/2 (`posBucket`, `fetchClubPositions`); Priorität bei mehreren → Task 1 (`pickBucket`, TW>ST>MF>ABW); `pos` ergänzen ohne andere Felder zu ändern → Task 2 (`recToString` behält t/sl, lädt bestehende players.js); Dropdown „Name · Pos · Alter", keine Vereine → Task 3; Alter aus `by` zur Laufzeit → Task 3; `.sugMeta` → Task 3; Tests → Task 1/3. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** `posBucket`, `pickBucket`, `fetchClubPositions`, `recToString`, Feld `pos`, Gruppen TW/ABW/MF/ST konsistent. `CLUB_QID`/`norm` aus `wikidata_roster.mjs` (dort exportiert, `main` ist guard-geschützt → kein Netzwerk bei Import).
