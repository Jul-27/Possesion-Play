# Saison-Sieger-Lücken Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wikidata-Sieger-Lücken (DFB 2009–2013, 2023 ff.) über kuratierte `GAP_WINNERS` × eigene `cp`-Daten schließen.

**Architecture:** `GAP_WINNERS`-Export + generische `applyGapWinners(players)`-Funktion in `wikidata_honours.mjs` (läuft bei jedem Voll-Lauf); `apply_gap_winners.mjs` wendet sie sofort ohne Netz auf players.js an.

**Tech Stack:** unverändert.

---

## Task 1: GAP_WINNERS + Anwendung

**Files:**
- Modify: `data-pipeline/wikidata_honours.mjs`
- Create: `data-pipeline/apply_gap_winners.mjs`

- [ ] **Step 1:** In `wikidata_honours.mjs` nach `HONOUR_OVERRIDES` einfügen:

```js
// Saison-Sieger, die Wikidata (noch) nicht als P1346 führt (Owner-bestätigt).
// Honour-Key -> [[Saisonstartjahr, Club-Key], ...]; angewandt über cp-Überlappung
// (gleiche Semantik wie die Wikidata-Query: from <= saison+1 && ende >= saison).
export const GAP_WINNERS = {
  DFB: [[2009, "FCB"], [2011, "BVB"], [2012, "FCB"], [2013, "FCB"],
        [2023, "B04"], [2024, "VFB"], [2025, "FCB"]],
};

const gapEnd = (to) => (to === 0 ? 9999 : to);
export function applyGapWinners(players) {
  let added = 0;
  for (const [key, seasons] of Object.entries(GAP_WINNERS)) {
    for (const [year, club] of seasons) {
      for (const p of players) {
        if (!(p.cp || []).some(([k, f, t]) => k === club && f <= year + 1 && gapEnd(t) >= year)) continue;
        const set = new Set(p.t || []);
        if (!set.has(key)) { set.add(key); p.t = [...set].sort(); added++; }
      }
    }
  }
  return added;
}
```

- [ ] **Step 2:** In `main()` von `wikidata_honours.mjs` VOR dem Override-Block einfügen:

```js
  // Wikidata-Sieger-Lücken über cp schließen
  console.log(`  GAP_WINNERS: ${applyGapWinners(players)} Zuordnungen`);
```

- [ ] **Step 3:** `data-pipeline/apply_gap_winners.mjs` erstellen (Struktur wie `apply_honour_overrides.mjs`, gleiche `recToString`-Vollversion mit pos+cp):

```js
#!/usr/bin/env node
/* Wendet GAP_WINNERS aus wikidata_honours.mjs sofort auf src/players.js an
   (cp-Überlappung, additiv). Kein Netz nötig. */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { applyGapWinners } from "./wikidata_honours.mjs";
import { stampDataInfo } from "./stamp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");

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
const added = applyGapWinners(players);
players.sort((a, b) => a.n.localeCompare(b.n, "en"));
const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + players.map(recToString).join(",\n  ") + "\n];\n");
stampDataInfo();
console.log(`Fertig: ${added} Titel-Zuordnungen ergänzt.`);
```

- [ ] **Step 4: Anwenden + verifizieren**

```bash
node data-pipeline/apply_gap_winners.mjs
node -e 'import("./src/players.js").then(({PLAYERS})=>{
  console.log("DFB:", PLAYERS.filter(p=>(p.t||[]).includes("DFB")).length);
  ["Mats Hummels","Marco Reus","Thomas Müller","Manuel Neuer","Florian Wirtz","Harry Kane"].forEach(n=>{
    const p=PLAYERS.find(x=>x.n===n); console.log(" ", n, JSON.stringify(p?.t))});
})'
```

Expected: DFB-Count deutlich über 1.038; Hummels/Reus (BVB 2011/12) und Müller/Neuer (FCB-Jahre) mit `DFB`.

- [ ] **Step 5:** `npm test` + `npm run build` grün; Commit; finishing (Push + PR, mergen auf Zuruf).

---

## Self-Review-Ergebnis

Spec-Abdeckung vollständig (Tabelle, generische Anwendung, Voll-Lauf-Integration, Sofort-Skript, Verifikation); keine Platzhalter; `gapEnd`-Semantik identisch zu `cpEnd` in gameData.
