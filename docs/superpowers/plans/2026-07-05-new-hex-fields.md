# Neue Hex-Felder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Liga Portugal + Eredivisie als Liga-Felder (5→7), Spezial-Feld „In 3+ Top-5-Ligen gespielt" und drei Geburts-Dekaden (SPECIALS 6→10).

**Architecture:** Reine Def-Erweiterung in `gameData.js`; Matching-Infrastruktur (CLUB_LG, playerMatchesHex, Board-Builder) existiert und ist mengen-agnostisch. TDD über `gameData.test.js`.

**Tech Stack:** Vite/React unverändert, Tests `node:test`.

---

## File Structure

- `src/gameData.js` — **modify**: 2 LEAGUES-Defs, `TOP5`-Konstante, 4 SPECIALS-Defs.
- `src/gameData.test.js` — **modify**: Tests.

---

## Task 1: Ligen PT/NL (TDD)

**Files:**
- Modify: `src/gameData.js`, `src/gameData.test.js`

- [ ] **Step 1: Tests anpassen.** In `src/gameData.test.js` den Test `"LEAGUES enthält die 5 Top-Ligen als type 'league'"` ersetzen durch:

```js
test("LEAGUES enthält 7 Ligen als type 'league'", () => {
  assert.equal(LEAGUES.length, 7);
  assert.deepEqual(LEAGUES.map((l) => l.key).sort(), ["BL", "L1", "LL", "NL", "PL", "PT", "SA"]);
  for (const l of LEAGUES) {
    assert.equal(l.type, "league");
    assert.ok(l.name && l.label && l.c1 && l.c2);
  }
});
```

Und im Test `"playerMatchesHex: league matcht über die Liga der Vereine"` vor der letzten schließenden Klammer ergänzen:

```js
  const pt = lookupDef("league", "PT");
  const nl = lookupDef("league", "NL");
  assert.equal(playerMatchesHex({ clubs: ["POR"] }, pt), true);
  assert.equal(playerMatchesHex({ clubs: ["AJA"] }, nl), true);
  assert.equal(playerMatchesHex({ clubs: ["FCB"] }, pt), false);
```

- [ ] **Step 2: Tests ausführen** — Run: `npm test` — Expected: FAIL (LEAGUES.length ist 5).

- [ ] **Step 3: Defs ergänzen.** In `src/gameData.js` im `LEAGUES`-Array nach der `L1`-Zeile:

```js
  { key: "PT", label: "PT", name: "Liga Portugal", c1: "#046A38", c2: "#DA291C" },
  { key: "NL", label: "NL", name: "Eredivisie",    c1: "#FF7900", c2: "#21468B" },
```

- [ ] **Step 4: Tests ausführen** — Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/gameData.js src/gameData.test.js
git commit -m "feat: Liga Portugal + Eredivisie als Liga-Felder"
```

---

## Task 2: SPECIALS — T5L + Dekaden (TDD)

**Files:**
- Modify: `src/gameData.js`, `src/gameData.test.js`

- [ ] **Step 1: Tests anpassen.** Den Test `"SPECIALS: 6 Felder inkl. Ära, Ära-Tests greifen über cp"` ersetzen durch:

```js
test("SPECIALS: 10 Felder inkl. Ära/Dekaden/T5L", () => {
  assert.equal(SPECIALS.length, 10);
  assert.deepEqual(SPECIALS.map((s) => s.key).sort(),
    ["A00", "A10", "A90", "B00", "B70", "B80", "N90", "OLD", "T5L", "Y2K"]);
  const a90 = lookupDef("spec", "A90"), a00 = lookupDef("spec", "A00");
  assert.equal(playerMatchesHex(XAVI, a90), true);
  assert.equal(playerMatchesHex(XAVI, a00), true);
  assert.equal(playerMatchesHex({ by: 1995 }, a90), false);      // ohne cp kein Match
});

test("T5L: 3+ verschiedene Top-5-Ligen über clubs", () => {
  const t5l = lookupDef("spec", "T5L");
  assert.equal(playerMatchesHex({ clubs: ["FCB", "MCI", "BAR"] }, t5l), true);   // BL+PL+LL
  assert.equal(playerMatchesHex({ clubs: ["FCB", "BVB", "MCI"] }, t5l), false);  // BL doppelt + PL = 2
  assert.equal(playerMatchesHex({ clubs: ["FCB", "MCI", "POR"] }, t5l), false);  // PT zählt nicht
  assert.equal(playerMatchesHex({ clubs: ["JUV", "PSG", "RMA", "MUN"] }, t5l), true); // SA+L1+LL+PL
  assert.equal(playerMatchesHex({}, t5l), false);
});

test("Geburts-Dekaden: Grenzjahre inklusiv", () => {
  const b70 = lookupDef("spec", "B70"), b80 = lookupDef("spec", "B80"), b00 = lookupDef("spec", "B00");
  assert.equal(playerMatchesHex({ by: 1970 }, b70), true);
  assert.equal(playerMatchesHex({ by: 1979 }, b70), true);
  assert.equal(playerMatchesHex({ by: 1980 }, b70), false);
  assert.equal(playerMatchesHex({ by: 1980 }, b80), true);
  assert.equal(playerMatchesHex({ by: 1989 }, b80), true);
  assert.equal(playerMatchesHex({ by: 1999 }, b00), false);
  assert.equal(playerMatchesHex({ by: 2000 }, b00), true);
  assert.equal(playerMatchesHex({ by: 2009 }, b00), true);
  assert.equal(playerMatchesHex({ by: 2010 }, b00), false);
});
```

- [ ] **Step 2: Tests ausführen** — Run: `npm test` — Expected: FAIL (SPECIALS.length ist 6).

- [ ] **Step 3: Defs ergänzen.** In `src/gameData.js` direkt VOR `export const SPECIALS = [` einfügen:

```js
const TOP5 = new Set(["BL", "PL", "LL", "SA", "L1"]);
```

Und im `SPECIALS`-Array nach der `A10`-Zeile:

```js
  { key: "B70", label: "70ER JG.",   icon: "📻", name: "Geboren 1970–1979", c1: "#D4A373", c2: "#6b4423", test: (p) => p.by >= 1970 && p.by <= 1979 },
  { key: "B80", label: "80ER JG.",   icon: "🎧", name: "Geboren 1980–1989", c1: "#C084FC", c2: "#581c87", test: (p) => p.by >= 1980 && p.by <= 1989 },
  { key: "B00", label: "2000ER JG.", icon: "🎮", name: "Geboren 2000–2009", c1: "#4ADE80", c2: "#14532d", test: (p) => p.by >= 2000 && p.by <= 2009 },
  { key: "T5L", label: "3+ TOP-LIGEN", icon: "🌐", name: "In 3+ Top-5-Ligen gespielt", c1: "#38BDF8", c2: "#0c4a6e",
    test: (p) => new Set((p.clubs || []).map((k) => CLUB_LG[k]).filter((lg) => TOP5.has(lg))).size >= 3 },
```

(`CLUB_LG` steht später in der Datei — unkritisch, die `test`-Closures laufen erst zur Spielzeit.)

- [ ] **Step 4: Tests + Build** — Run: `npm test` (Expected: PASS) und `npm run build` (Expected: `✓`).

- [ ] **Step 5: Commit**

```bash
git add src/gameData.js src/gameData.test.js
git commit -m "feat: SPECIALS — Top-5-Wanderer + Geburts-Dekaden 70er/80er/2000er"
```

---

## Task 3: Abschluss

- [ ] **Step 1:** `npm test` + `npm run build` final grün.
- [ ] **Step 2:** `superpowers:finishing-a-development-branch` — Push + PR via GitHub-API, mergen auf Zuruf.

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** LEAGUES 7 + PT/NL-Matching (A) → Task 1; TOP5/T5L + 3 Dekaden (B) → Task 2; Edge Cases (leere clubs, PT/NL zählen nicht, Grenzjahre) in den Tests abgebildet. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** Keys PT/NL/T5L/B70/B80/B00 identisch in Defs und Tests; `TOP5` nur in gameData.js verwendet.
