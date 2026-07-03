# Datenstand & Auto-Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sichtbarer Datenstand (`DATA_ASOF`) in Lobby und Regel-Modals; Ein-Kommando-Refresh (`npm run data:refresh`); monatliche GitHub Action mit Auto-PR.

**Architecture:** `data-pipeline/stamp.mjs` schreibt `src/dataInfo.js` (winzig, statisch importierbar); alle 5 Pipeline-Skripte stempeln nach dem players.js-Write; `refresh_all.mjs` erzwingt die korrekte Skript-Reihenfolge; Action läuft Kette + Tests und öffnet einen PR (kein Auto-Merge).

**Tech Stack:** Node ESM, GitHub Actions (`peter-evans/create-pull-request@v6`), React/Vite unverändert.

---

## File Structure

- `data-pipeline/stamp.mjs` — **create**: `stampDataInfo()`.
- `src/dataInfo.js` — **create (generiert)**: `DATA_ASOF`.
- `src/dataInfo.test.js` — **create**: Formattest.
- `data-pipeline/wikidata_{roster,honours,honours_extra,positions,careers}.mjs` — **modify**: Stamp-Aufruf.
- `data-pipeline/refresh_all.mjs` — **create**; `package.json` — **modify**: Script.
- `.github/workflows/data-refresh.yml` — **create**.
- `src/Lobby.jsx`, `src/Game.jsx`, `src/Grid.jsx`, `src/Guess.jsx`, `src/Daily.jsx`, `src/styles.css` — **modify**: Anzeige.

---

## Task 1: Stamp-Helfer + dataInfo + Test (TDD)

**Files:**
- Create: `data-pipeline/stamp.mjs`, `src/dataInfo.js`, `src/dataInfo.test.js`
- Modify: die 5 `wikidata_*.mjs`

- [ ] **Step 1: Test schreiben.** `src/dataInfo.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { DATA_ASOF } from "./dataInfo.js";

test("DATA_ASOF ist gültiges YYYY-MM-DD", () => {
  assert.match(DATA_ASOF, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!Number.isNaN(Date.parse(DATA_ASOF)));
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag prüfen**

Run: `npm test`
Expected: FAIL — `./dataInfo.js` nicht gefunden.

- [ ] **Step 3: `data-pipeline/stamp.mjs` anlegen:**

```js
/* Schreibt src/dataInfo.js mit dem Datum des letzten Pipeline-Laufs.
   Wird von JEDEM Skript nach dem players.js-Write aufgerufen. */
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));

export function stampDataInfo() {
  const d = new Date();
  const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  writeFileSync(join(HERE, "..", "src", "dataInfo.js"),
    `// GENERIERT von data-pipeline/stamp.mjs — Datum des letzten Wikidata-Laufs. Nicht von Hand editieren.\nexport const DATA_ASOF = "${s}";\n`);
  return s;
}
```

- [ ] **Step 4: `src/dataInfo.js` initial erzeugen**

Run: `node -e 'import("./data-pipeline/stamp.mjs").then(m => console.log("gestempelt:", m.stampDataInfo()))'`
Expected: `gestempelt: <heutiges Datum>`; Datei existiert.

- [ ] **Step 5: Test ausführen**

Run: `npm test`
Expected: PASS (38 Tests).

- [ ] **Step 6: Stamp-Aufruf in alle 5 Skripte.** In jedem der Skripte `wikidata_roster.mjs`, `wikidata_honours.mjs`, `wikidata_honours_extra.mjs`, `wikidata_positions.mjs`, `wikidata_careers.mjs`:
  - Import ergänzen (zu den bestehenden Imports): `import { stampDataInfo } from "./stamp.mjs";`
  - Direkt NACH der Zeile `writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + body + "\n];\n");` einfügen: `stampDataInfo();`

- [ ] **Step 7: Commit**

```bash
git add data-pipeline/stamp.mjs src/dataInfo.js src/dataInfo.test.js data-pipeline/wikidata_*.mjs
git commit -m "feat: DATA_ASOF-Stempel (dataInfo.js), von allen Pipeline-Skripten geschrieben"
```

---

## Task 2: Anzeige in Lobby + Regel-Modals

**Files:**
- Modify: `src/Lobby.jsx`, `src/Game.jsx`, `src/Grid.jsx`, `src/Guess.jsx`, `src/Daily.jsx`, `src/styles.css`

- [ ] **Step 1: Lobby.** Import (nach dem `dailyLogic`-Import): `import { DATA_ASOF } from "./dataInfo.js";`
Nach der Zeile `<p className="lobHint">Erstelle ein Spiel, …</p>` einfügen:

```jsx
      <p className="dataStamp">Datenstand: {DATA_ASOF.split("-").reverse().join(".")} · Quelle: Wikidata</p>
```

- [ ] **Step 2: Game.jsx (Hex — mit Transfer-Hinweis).** Import: `import { DATA_ASOF } from "./dataInfo.js";`
Im Regeln-Modal nach der letzten `<p className="ruleP">…`-Zeile (vor `<div className="closeline">`):

```jsx
            <p className="dataStamp">Datenstand: {DATA_ASOF.split("-").reverse().join(".")} · Quelle: Wikidata — ganz frische Transfers können noch fehlen.</p>
```

- [ ] **Step 3: Grid.jsx, Guess.jsx, Daily.jsx.** Jeweils Import `import { DATA_ASOF } from "./dataInfo.js";` und im Regeln-Modal vor `<div className="closeline">`:

```jsx
            <p className="dataStamp">Datenstand: {DATA_ASOF.split("-").reverse().join(".")} · Quelle: Wikidata</p>
```

- [ ] **Step 4: CSS** (Ende von `src/styles.css`):

```css
.dataStamp { color: #7fa093; font-size: 12px; text-align: center; margin-top: 10px; }
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: `✓`; `dataInfo.js` landet im Haupt-Bundle (winzig), players-Chunk unverändert lazy.

- [ ] **Step 6: Commit**

```bash
git add src/Lobby.jsx src/Game.jsx src/Grid.jsx src/Guess.jsx src/Daily.jsx src/styles.css
git commit -m "feat: Datenstand-Anzeige in Lobby und Regel-Modals"
```

---

## Task 3: Refresh-Kette

**Files:**
- Create: `data-pipeline/refresh_all.mjs`
- Modify: `package.json`

- [ ] **Step 1: `data-pipeline/refresh_all.mjs` anlegen:**

```js
#!/usr/bin/env node
/*
 * refresh_all.mjs — kompletter Wikidata-Refresh in der EINZIG korrekten
 * Reihenfolge (honours setzt t neu, honours_extra ergänzt danach BDO/EM/CA/EL).
 * Bricht beim ersten Fehler ab. Dauer: ~15–40 min (Rate-Limits).
 *   npm run data:refresh
 */
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHAIN = [
  "wikidata_roster.mjs",        // 1) Spieler/Vereine/sl
  "wikidata_honours.mjs",       // 2) t: 11 Basis-Wettbewerbe (setzt neu)
  "wikidata_honours_extra.mjs", // 3) t += BDO/EM/CA/EL (additiv, NACH 2!)
  "wikidata_positions.mjs",     // 4) pos
  "wikidata_careers.mjs",       // 5) cp
];

for (const script of CHAIN) {
  console.log(`\n════════ ${script} ════════`);
  const r = spawnSync(process.execPath, [join(HERE, script)], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\nAbbruch: ${script} endete mit Exit-Code ${r.status}`);
    process.exit(r.status || 1);
  }
}
console.log("\nRefresh komplett — players.js + dataInfo.js aktualisiert.");
```

- [ ] **Step 2: npm-Script.** In `package.json` im `"scripts"`-Block ergänzen:

```json
    "data:refresh": "node data-pipeline/refresh_all.mjs",
```

- [ ] **Step 3: Kettenstart-Smoke-Test** (nur Start prüfen, dann abbrechen — voller Lauf ist Sache der Action):

Run: `node -e 'import("./data-pipeline/refresh_all.mjs").catch(()=>{})' & sleep 3; kill %1 2>/dev/null; echo ok`
Expected: Ausgabe `════════ wikidata_roster.mjs ════════` erscheint (Kette startet korrekt), dann `ok`. Alternativ genügt `node --check data-pipeline/refresh_all.mjs`.

- [ ] **Step 4: Commit**

```bash
git add data-pipeline/refresh_all.mjs package.json
git commit -m "feat: npm run data:refresh — Pipeline-Kette in erzwungener Reihenfolge"
```

---

## Task 4: GitHub Action

**Files:**
- Create: `.github/workflows/data-refresh.yml`

- [ ] **Step 1: Workflow anlegen:**

```yaml
name: Wikidata Daten-Refresh

on:
  schedule:
    - cron: "0 3 1 * *"   # monatlich am 1., 03:00 UTC (deckt Transferschluss 1.9./1.2. ab)
  workflow_dispatch: {}

permissions:
  contents: write
  pull-requests: write

jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 120
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Wikidata-Refresh (roster → honours → honours_extra → positions → careers)
        run: npm run data:refresh

      - name: Daten-Sanity (Tests)
        run: npm test

      - id: datum
        run: echo "heute=$(date +%F)" >> "$GITHUB_OUTPUT"

      - name: PR erstellen
        uses: peter-evans/create-pull-request@v6
        with:
          branch: data/refresh-${{ steps.datum.outputs.heute }}
          commit-message: "data: Wikidata-Refresh ${{ steps.datum.outputs.heute }}"
          title: "data: Wikidata-Refresh ${{ steps.datum.outputs.heute }}"
          body: |
            Automatischer Wikidata-Refresh (roster → honours → honours_extra → positions → careers).

            - Erwarteter Diff: nur `src/players.js` + `src/dataInfo.js`
            - Tests liefen im Workflow bereits grün
            - Bitte Diff kurz prüfen und mergen — Vercel deployt danach automatisch
          delete-branch: true
```

- [ ] **Step 2: YAML-Syntax prüfen**

Run: `node -e 'const fs=require("fs"); const y=fs.readFileSync(".github/workflows/data-refresh.yml","utf8"); console.log(y.includes("workflow_dispatch") && y.includes("create-pull-request") ? "ok" : "fehlt was")'`
Expected: `ok`. (Echte Validierung: manueller `workflow_dispatch`-Probelauf nach dem Merge.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/data-refresh.yml
git commit -m "ci: monatlicher Wikidata-Refresh mit Auto-PR"
```

---

## Task 5: Verifikation & Abschluss

- [ ] **Step 1:** `npm test` (38 grün) + `npm run build` (`✓`).
- [ ] **Step 2:** `superpowers:finishing-a-development-branch` — Push + PR via GitHub-API, mergen auf Zuruf. Danach: User startet einmal `workflow_dispatch` als Probelauf.

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** stamp.mjs + dataInfo.js + Stamp in allen 5 Skripten (A) → Task 1; Anzeige Lobby + 4 Modals + Hex-Transferhinweis + CSS (B) → Task 2; refresh_all.mjs + npm-Script mit erzwungener Reihenfolge (C) → Task 3; Action mit cron 1. des Monats, dispatch, Kette+Tests+Auto-PR, kein Auto-Merge (D) → Task 4; Formattest + Build (Tests-Sektion) → Task 1/5. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** `DATA_ASOF` (Export), `stampDataInfo()` (Aufruf in 5 Skripten), `data:refresh` (package.json ↔ Action), Formatierung `split("-").reverse().join(".")` in allen 5 UI-Stellen identisch.
