# Gemeldete Spieler-Fehler Runde 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 7 der 8 gemeldeten Fehler kuratiert fixen (Titel via GAP_WINNERS, Vereine via EXTRA_PLAYERS); #5 Kossounou ist kein Fehler.

**Architecture:** Rein lokal (kein Wikidata). GAP_WINNERS um CDR/MBL erweitern, EXTRA_PLAYERS um 5 Vereins-Ergänzungen; per apply_gap_winners.mjs + apply_extra_players.mjs anwenden.

---

## Task 1: GAP_WINNERS (Titel)

**Files:** Modify `data-pipeline/wikidata_honours.mjs`

- [ ] **Step 1:** Das `GAP_WINNERS`-Objekt

```js
export const GAP_WINNERS = {
  DFB: [[2009, "FCB"], [2011, "BVB"], [2012, "FCB"], [2013, "FCB"],
        [2023, "B04"], [2024, "VFB"], [2025, "FCB"]],
  FAC: [[2003, "MUN"]], // FA Cup 2003/04 — Manchester United (Wikidata-Lücke)
};
```

ersetzen durch:

```js
export const GAP_WINNERS = {
  DFB: [[2009, "FCB"], [2011, "BVB"], [2012, "FCB"], [2013, "FCB"],
        [2023, "B04"], [2024, "VFB"], [2025, "FCB"]],
  FAC: [[2003, "MUN"]], // FA Cup 2003/04 — Manchester United (Wikidata-Lücke)
  CDR: [[2024, "BAR"], [2022, "RMA"]], // Copa del Rey 2024/25 (Barça), 2022/23 (Real)
  MBL: [[2022, "FCB"]],                // Bundesliga 2022/23 (Bayern)
};
```

- [ ] **Step 2:** `node --check data-pipeline/wikidata_honours.mjs`; Commit:

```bash
git add data-pipeline/wikidata_honours.mjs
git commit -m "data: GAP_WINNERS — Copa del Rey 2023/2025 + Bundesliga 2023 (Yamal/Rüdiger/de Ligt-Kader)"
```

---

## Task 2: EXTRA_PLAYERS (Vereine)

**Files:** Modify `data-pipeline/apply_extra_players.mjs`

- [ ] **Step 1:** Das `EXTRA_PLAYERS`-Array

```js
export const EXTRA_PLAYERS = [
  { n: "Gernot Trauner", by: 1992, nat: ["AUT"], clubs: ["FEY"], sl: 35, pos: "ABW", cp: [["FEY", 2021, 0]] },
];
```

ersetzen durch:

```js
export const EXTRA_PLAYERS = [
  { n: "Gernot Trauner", by: 1992, nat: ["AUT"], clubs: ["FEY"], sl: 35, pos: "ABW", cp: [["FEY", 2021, 0]] },
  { n: "Oscar Gloukh",   by: 2004, clubs: ["AJA"], cp: [["AJA", 2025, 0]] },     // Ajax seit 2025
  { n: "Diego",          by: 1985, clubs: ["SVW"], cp: [["SVW", 2006, 2009]] },  // Werder Bremen
  { n: "Arturo Vidal",   by: 1987, clubs: ["B04"], cp: [["B04", 2007, 2011]] },  // Bayer Leverkusen
  { n: "Adam Daghim",    by: 2005, clubs: ["RBS"], cp: [["RBS", 2023, 2024]] },  // RB Salzburg
  { n: "Sergio Agüero",  by: 1988, clubs: ["ATM"], cp: [["ATM", 2006, 2011]] },  // Atlético Madrid
];
```

- [ ] **Step 2:** `node --check data-pipeline/apply_extra_players.mjs`; Commit:

```bash
git add data-pipeline/apply_extra_players.mjs
git commit -m "data: EXTRA_PLAYERS — Gloukh/Diego/Vidal/Daghim/Agüero (fehlende Vereine)"
```

---

## Task 3: Anwenden + Verifikation

**Files:** `src/players.js` (generiert)

- [ ] **Step 1: Läufe**

```bash
node data-pipeline/apply_extra_players.mjs
node data-pipeline/apply_gap_winners.mjs
```

- [ ] **Step 2: Verifikation**

```bash
node -e 'import("./src/players.js").then(({PLAYERS})=>{
  const g=(n,by)=>PLAYERS.find(x=>x.n===n&&x.by===by);
  console.log("Yamal t:", JSON.stringify(g("Lamine Yamal",2007)?.t));
  console.log("Rüdiger t:", JSON.stringify(g("Antonio Rüdiger",1993)?.t));
  console.log("de Ligt t:", JSON.stringify(g("Matthijs de Ligt",1999)?.t));
  for(const [n,by,c] of [["Oscar Gloukh",2004,"AJA"],["Diego",1985,"SVW"],["Arturo Vidal",1987,"B04"],["Adam Daghim",2005,"RBS"],["Sergio Agüero",1988,"ATM"]]){
    const p=g(n,by); console.log(n, c, "->", (p?.clubs||[]).includes(c), JSON.stringify(p?.clubs));
  }
})'
```

Expected: Yamal/Rüdiger t enthält CDR; de Ligt t enthält MBL; alle 5 Vereins-Flags true.

- [ ] **Step 3: Tests + Build + Commit**

```bash
npm test && npm run build
git add src/players.js src/dataInfo.js
git commit -m "data: gemeldete Spieler-Fehler Runde 4 angewandt"
```

---

## Task 4: Abschluss

- [ ] `superpowers:finishing-a-development-branch` — Push + PR, mergen auf Zuruf. Dem User zu #5 zurückmelden: Kossounou matcht Leverkusen; Atalanta ist kein Spiel-Verein (separater Wunsch möglich).

---

## Self-Review

Spec-Abdeckung: 1a/1b/8 → Task 1; 2/3/4/6/7 → Task 2; 5 = kein Fix (Rückmeldung). GAP_WINNERS-cp-Überlappung durch cp-Check verifiziert. Keine Platzhalter. Keys konsistent (CDR/MBL/AJA/SVW/B04/RBS/ATM).
