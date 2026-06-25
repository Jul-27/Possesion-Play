# Honours komplett aus Wikidata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Feld `t` (Titel/Honours) für alle Spieler in `src/players.js` einheitlich aus Wikidata setzen — Saison-Sieger je Wettbewerb × Spieler-Vereinszeitraum.

**Architecture:** Node-Skript `data-pipeline/wikidata_honours.mjs` (Internet) fragt pro Wettbewerb (CL, 5 Ligen, 4 Pokale, WM) Wikidata ab: Saison-Sieger (`P1346`) mit Zeitraum (`P580/P582`), gejoint mit den Spielern, die per `P54` im Saison-Zeitraum beim Sieger waren. Match auf den Pool über Name+Geburtsjahr, `t` wird neu gesetzt. Spiel-Logik unverändert.

**Tech Stack:** Node 20 (global `fetch`), ESM. Wikidata SPARQL. Tests: `node:test`.

**Hinweis:** Datengetriebener Controller-Schritt (Netzwerk); Hauptverifikation über Datenvalidität + Stichproben. Läuft NACH dem Roster (`src/players.js` muss existieren).

---

## File Structure

- `data-pipeline/wikidata_honours.mjs` — **create**: Honours-Builder (verifizierte `COMP_QID`, Fetch, Merge, Schreiben).
- `data-pipeline/wikidata_honours.test.mjs` — **create**: Datenvalidität (`t` ⊆ HONOURS, Stichproben).
- `data-pipeline/README.md` — **modify**: Doku.
- `src/players.js` — **regenerate**: Feld `t` neu gesetzt.

---

## Task 1: Honours-Builder erstellen

**Files:**
- Create: `data-pipeline/wikidata_honours.mjs`

- [ ] **Step 1: Datei anlegen** mit verifizierten QIDs, Fetch, Merge, Schreiben:

```js
#!/usr/bin/env node
/*
 * wikidata_honours.mjs — Setzt das Feld `t` (Honours) je Spieler in src/players.js
 * komplett aus Wikidata: Saison-Sieger je Wettbewerb (P1346) × Spieler-Vereins-
 * zeitraum (P54 mit P580/P582). Internet nötig. Idempotent. Läuft NACH dem Roster.
 *   node data-pipeline/wikidata_honours.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";

// Honour-Key -> Wikidata-Wettbewerb (verifiziert: Label + vorhandene Saison-Sieger)
const COMP_QID = {
  CL:"Q18756", WM:"Q19317",
  MBL:"Q82595", MPL:"Q9448", MLL:"Q324867", MSA:"Q15804", ML1:"Q13394",
  DFB:"Q150880", FAC:"Q11151", CDR:"Q483794", CIT:"Q169918",
};

export function norm(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } });
    if (res.status === 429) { await sleep(8000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    return (await res.json()).results.bindings;
  }
  throw new Error("429 wiederholt");
}

// Spieler, die im Titel-Saison-Zeitraum beim Sieger des Wettbewerbs waren.
async function fetchHonourPlayers(qid) {
  const q = `SELECT DISTINCT ?pLabel ?by WHERE {
    ?season wdt:P3450 wd:${qid} ; wdt:P1346 ?winner ; wdt:P580 ?ss .
    OPTIONAL { ?season wdt:P582 ?se. }
    ?p p:P54 ?st . ?st ps:P54 ?winner ; pq:P580 ?cs .
    OPTIONAL { ?st pq:P582 ?ce. }
    ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d . BIND(YEAR(?d) AS ?by)
    FILTER( YEAR(?cs) <= YEAR(COALESCE(?se, ?ss)) && (!BOUND(?ce) || YEAR(?ce) >= YEAR(?ss)) )
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  return (await sparql(q)).map((b) => ({ name: b.pLabel?.value, by: b.by?.value ? parseInt(b.by.value) : null }));
}

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  return s + "}";
}

async function main() {
  // 1) Honours pro Spieler aus Wikidata: key "norm|by" -> Set(honourKeys)
  const hon = new Map();
  for (const [key, qid] of Object.entries(COMP_QID)) {
    let rows;
    try { rows = await fetchHonourPlayers(qid); } catch (e) { console.log(`  ${key} FEHLER ${e.message}`); continue; }
    let c = 0;
    for (const r of rows) {
      if (!r.name || !r.by) continue;
      const k = norm(r.name) + "|" + r.by;
      if (!hon.has(k)) hon.set(k, new Set());
      hon.get(k).add(key); c++;
    }
    console.log(`  ${key} (${qid}): ${rows.length} Zeilen, ${c} Zuordnungen`);
    await sleep(1300);
  }

  // 2) players.js laden, t neu setzen
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  let withT = 0;
  for (const p of players) {
    const keys = hon.get(norm(p.n) + "|" + p.by);
    if (keys && keys.size) { p.t = [...keys].sort(); withT++; }
    else delete p.t;
  }

  // 3) Schreiben (Reihenfolge wie zuvor: nach Name)
  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  const body = players.map(recToString).join(",\n  ");
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + body + "\n];\n");
  console.log(`\nFertig: ${withT} Spieler mit Honours -> src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
```

- [ ] **Step 2: Syntax prüfen** (kein Lauf, nur Parsen):

Run: `node --check data-pipeline/wikidata_honours.mjs`
Expected: kein Output (Syntax ok).

- [ ] **Step 3: Commit**

```bash
git add data-pipeline/wikidata_honours.mjs
git commit -m "feat: Honours-Builder aus Wikidata (Saison-Sieger x Vereinszeitraum)"
```

---

## Task 2: Honours-Builder ausführen & validieren (Netzwerk)

**Files:**
- Regenerate: `src/players.js`

- [ ] **Step 1: Builder ausführen** (Internet, ~1–3 Min):

Run: `node data-pipeline/wikidata_honours.mjs`
Expected: 11 Wettbewerbszeilen, dann `Fertig: <viele> Spieler mit Honours -> src/players.js`.
(Falls eine Liga-Query mit Timeout/HTTP 500 fehlschlägt: erneut ausführen — `sparql` hat Retry; bei wiederholtem Timeout in der Ausführung melden.)

- [ ] **Step 2: Validieren** (t-Keys gültig, Stichproben, Anzahl):

```bash
node --input-type=module -e "
import('file://'+process.cwd()+'/src/players.js').then(async m=>{
  const g=await import('file://'+process.cwd()+'/src/gameData.js');
  const H=new Set(g.HONOURS.map(h=>h.key));
  let bad=new Set(), withT=0;
  for(const p of m.PLAYERS){ if(p.t){withT++; p.t.forEach(k=>{if(!H.has(k))bad.add(k)});} }
  console.log('Spieler:',m.PLAYERS.length,'| mit t:',withT,'| ungültige Honour-Keys:',[...bad]);
  const f=n=>{const p=m.PLAYERS.find(x=>x.n===n);return n+' -> '+(p&&p.t?p.t.join(','):'(keine)');};
  ['Zinedine Zidane','Andrea Pirlo','Andrés Iniesta','Paolo Maldini','Toni Kroos','Cristiano Ronaldo','Lionel Messi'].forEach(n=>console.log('  '+f(n)));
});
"
```
Expected: keine ungültigen Keys; `mit t` deutlich > 1266; Stichproben plausibel (Zidane: CL+WM; Pirlo: MSA+CL+WM; Iniesta: MLL+CL+WM; Maldini: MSA+CL).

- [ ] **Step 3: Build + bestehende Tests**

Run: `npm run build` (Expected: `✓ built in …`) und `npm test` (Expected: PASS, 11 Tests).

- [ ] **Step 4: Commit**

```bash
git add src/players.js
git commit -m "feat: Honours fuer alle Spieler aus Wikidata gesetzt (Feld t)"
```

---

## Task 3: Datenvalidität-Test & Doku

**Files:**
- Create: `data-pipeline/wikidata_honours.test.mjs`
- Modify: `data-pipeline/README.md`

- [ ] **Step 1: Test erstellen** `data-pipeline/wikidata_honours.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";

test("players.js: t-Honours sind gültige Keys + Stichproben", async () => {
  const players = (await import("../src/players.js")).PLAYERS;
  const game = await import("../src/gameData.js");
  const H = new Set(game.HONOURS.map((h) => h.key));
  let withT = 0;
  for (const p of players) {
    if (!p.t) continue;
    withT++;
    for (const k of p.t) assert.ok(H.has(k), "ungültiger Honour-Key " + k);
  }
  assert.ok(withT > 1266, "mehr Spieler mit Honours erwartet, ist: " + withT);
  const has = (name, key) => {
    const p = players.find((x) => x.n === name);
    return p && p.t && p.t.includes(key);
  };
  assert.ok(has("Andrés Iniesta", "CL"), "Iniesta sollte CL haben");
  assert.ok(has("Andrés Iniesta", "WM"), "Iniesta sollte WM haben");
});
```

- [ ] **Step 2: Test ausführen**

Run: `node --test data-pipeline/wikidata_honours.test.mjs`
Expected: PASS.

- [ ] **Step 3: `data-pipeline/README.md` ergänzen** — nach der `wikidata_roster.mjs`-Zeile einfügen:

```markdown
| `wikidata_honours.mjs` | Setzt das Feld `t` (Honours: CL, 5 Meister, 4 Pokale, WM) je Spieler komplett aus Wikidata (Saison-Sieger × Vereinszeitraum). Lauf NACH dem Roster: `node data-pipeline/wikidata_honours.mjs` (Internet nötig). Idempotent. |
```

- [ ] **Step 4: Commit**

```bash
git add data-pipeline/wikidata_honours.test.mjs data-pipeline/README.md
git commit -m "test+docs: Honours-Validität + README"
```

- [ ] **Step 5: Abschluss** — `superpowers:finishing-a-development-branch` (Push + PR).

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** komplett aus Wikidata → Task 1/2 (`fetchHonourPlayers`); 11 Honours (verifizierte `COMP_QID`) → Task 1; „war im Saison-Zeitraum beim Sieger" (Überlappungs-Filter) → Task 1; WM = FIFA-WM-QID, generische Join-Query deckt Nationalteam-Sieger ab → Task 1; `t` ersetzen, leer→weglassen → Task 1 (`main`); Match per Name+Geburtsjahr → Task 1; Reproduzierbarkeit → Skript; Tests → Task 3. Keine Lücke.
- **Platzhalter:** keine; alle QIDs verifiziert.
- **Typ-/Namenskonsistenz:** `COMP_QID`, `norm`, `fetchHonourPlayers`, `recToString`, Feld `t`, Honour-Keys konsistent mit `HONOURS` in `gameData.js`.
- **Hinweis:** `recToString` schreibt `t` und `sl` — Reihenfolge n, ln, by, nat, clubs, t, sl (konsistent mit Roster-Ausgabe).
