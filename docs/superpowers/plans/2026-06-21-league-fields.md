# Liga-Hexfelder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fünf neue „Liga"-Hexfelder (Bundesliga, Premier League, La Liga, Serie A, Ligue 1) ins Spiel bringen, erfüllt, wenn ein Spieler einen Verein dieser Liga hat.

**Architecture:** Neuer Hexfeld-Typ `league` analog zu `club`/`nat`/`spec`. Liga-Zugehörigkeit wird zur Laufzeit aus `player.clubs` + `CLUBS[].lg` abgeleitet (keine Daten-/Pipeline-Änderung). Board-Generierung wählt 1–3 Liga-Felder pro Brett; Gesamt bleibt 31.

**Tech Stack:** Vite + React 18 (ESM, `"type":"module"`). Tests via Node-eingebautem `node:test` (keine neue Dependency).

---

## File Structure

- `src/gameData.js` — **modify**: `LEAGUES`-Export, `CLUB_LG`-Lookup, `playerMatchesHex`-Zweig, `DEF_BY_KEY.league`, `buildBoardSerial`.
- `src/Emblems.jsx` — **modify**: `Emblem`-Zweig für `league`, `Cell`-Label zeigt für `league` den vollen Namen.
- `src/styles.css` — **modify**: `.emblem.league`-Regel.
- `src/gameData.test.js` — **create**: Logik-Tests (Liga-Definitionen, Matching, Board-Invariante).
- `package.json` — **modify**: `"test"`-Script.

---

## Task 1: Liga-Definitionen, Matching & Lookup (TDD)

**Files:**
- Create: `src/gameData.test.js`
- Modify: `src/gameData.js`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Test-Script in package.json ergänzen**

In `package.json` den `scripts`-Block so ändern:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test"
  },
```

- [ ] **Step 2: Failing test schreiben**

Create `src/gameData.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { LEAGUES, playerMatchesHex, lookupDef } from "./gameData.js";

test("LEAGUES enthält die 5 Top-Ligen als type 'league'", () => {
  assert.equal(LEAGUES.length, 5);
  assert.deepEqual(LEAGUES.map((l) => l.key).sort(), ["BL", "L1", "LL", "PL", "SA"]);
  for (const l of LEAGUES) {
    assert.equal(l.type, "league");
    assert.ok(l.name && l.label && l.c1 && l.c2);
  }
});

test("lookupDef löst Liga-Keys auf", () => {
  assert.equal(lookupDef("league", "BL").name, "Bundesliga");
  assert.equal(lookupDef("league", "SA").name, "Serie A");
});

test("playerMatchesHex: league matcht über die Liga der Vereine", () => {
  const bl = lookupDef("league", "BL");
  const pl = lookupDef("league", "PL");
  const ll = lookupDef("league", "LL");
  assert.equal(playerMatchesHex({ clubs: ["FCB"] }, bl), true);   // Bayern -> BL
  assert.equal(playerMatchesHex({ clubs: ["FCB"] }, pl), false);  // Bayern nicht PL
  assert.equal(playerMatchesHex({ clubs: ["BAR"] }, ll), true);   // Barça -> LL
  assert.equal(playerMatchesHex({ clubs: [] }, bl), false);
  assert.equal(playerMatchesHex({ clubs: ["UNBEKANNT"] }, bl), false);
});
```

- [ ] **Step 3: Test ausführen, Fehlschlag prüfen**

Run: `npm test`
Expected: FAIL — `LEAGUES` ist nicht exportiert (Import-/AssertionError).

- [ ] **Step 4: `LEAGUES` + `CLUB_LG` in `src/gameData.js` ergänzen**

Direkt **nach** dem `SPECIALS`-Block (nach der Zeile `].map((s) => ({ ...s, type: "spec" }));`) einfügen:

```js
// Liga-Felder: erfüllt, wenn der Spieler einen Verein dieser Liga hat.
export const LEAGUES = [
  { key: "BL", label: "BL", name: "Bundesliga",     c1: "#D3010C", c2: "#1a1a1a" },
  { key: "PL", label: "PL", name: "Premier League", c1: "#3D195B", c2: "#1f0e36" },
  { key: "LL", label: "LL", name: "La Liga",        c1: "#E03A3E", c2: "#1f1f3c" },
  { key: "SA", label: "SA", name: "Serie A",        c1: "#0A66B0", c2: "#0a2a4a" },
  { key: "L1", label: "L1", name: "Ligue 1",        c1: "#091C3E", c2: "#1d6f6f" },
].map((l) => ({ ...l, type: "league" }));

// Vereins-Key -> Liga-Code (für das Liga-Matching)
const CLUB_LG = Object.fromEntries(CLUBS.map((c) => [c.key, c.lg]));
```

- [ ] **Step 5: `playerMatchesHex` um Liga-Zweig erweitern**

In `src/gameData.js` die Funktion `playerMatchesHex` so ergänzen (neue Zeile vor `return false;`):

```js
export function playerMatchesHex(player, def) {
  if (!player || !def) return false;
  if (def.type === "club") return (player.clubs || []).includes(def.key);
  if (def.type === "nat") return (player.nat || []).includes(def.key);
  if (def.type === "spec") return def.test ? def.test(player) : false;
  if (def.type === "league") return (player.clubs || []).some((ck) => CLUB_LG[ck] === def.key);
  return false;
}
```

- [ ] **Step 6: `DEF_BY_KEY` um `league` erweitern**

In `src/gameData.js` das Objekt `DEF_BY_KEY` so ändern:

```js
const DEF_BY_KEY = {
  club: Object.fromEntries(CLUBS.map((c) => [c.key, c])),
  nat: Object.fromEntries(NATIONS.map((n) => [n.key, n])),
  spec: Object.fromEntries(SPECIALS.map((s) => [s.key, s])),
  league: Object.fromEntries(LEAGUES.map((l) => [l.key, l])),
};
```

- [ ] **Step 7: Test ausführen, Erfolg prüfen**

Run: `npm test`
Expected: PASS (3 Tests grün).

- [ ] **Step 8: Commit**

```bash
git add package.json src/gameData.js src/gameData.test.js
git commit -m "feat: Liga-Felder Definitionen + Matching + Lookup"
```

---

## Task 2: Board-Generierung mit 1–3 Liga-Feldern (TDD)

**Files:**
- Modify: `src/gameData.js` (`buildBoardSerial`)
- Modify: `src/gameData.test.js`

- [ ] **Step 1: Failing test ergänzen**

Ans Ende von `src/gameData.test.js` anhängen:

```js
import { buildBoardSerial, hydrateBoard } from "./gameData.js";

test("buildBoardSerial: 31 Felder mit 1–3 Liga-Feldern", () => {
  for (let i = 0; i < 200; i++) {
    const board = buildBoardSerial();
    assert.equal(board.length, 31);
    const leagues = board.filter((c) => c.t === "league").length;
    assert.ok(leagues >= 1 && leagues <= 3, `unerwartete Liga-Anzahl: ${leagues}`);
    // jedes Feld muss auflösbar sein
    for (const c of board) assert.ok(lookupDef(c.t, c.k), `kein def für ${c.t}/${c.k}`);
  }
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag prüfen**

Run: `npm test`
Expected: FAIL — aktuell enthält ein Brett 0 Liga-Felder (`leagues >= 1` schlägt fehl).

- [ ] **Step 3: `buildBoardSerial` anpassen**

In `src/gameData.js` die Funktion `buildBoardSerial` vollständig ersetzen durch:

```js
export function buildBoardSerial() {
  const nLeague = 1 + Math.floor(Math.random() * 3); // 1, 2 oder 3
  const leagues = pick(LEAGUES, nLeague);
  const specials = pick(SPECIALS, 3);
  const blClubs = pick(CLUBS.filter((c) => c.lg === "BL"), 4);
  const nations = pick(NATIONS, 6);
  const rest = pick(CLUBS.filter((c) => !blClubs.includes(c)), 31 - 3 - 4 - 6 - nLeague);
  const chosen = shuffle([...specials, ...blClubs, ...nations, ...rest, ...leagues]);
  return chosen.map((d) => ({ t: d.type, k: d.key }));
}
```

- [ ] **Step 4: Test ausführen, Erfolg prüfen**

Run: `npm test`
Expected: PASS (alle Tests grün).

- [ ] **Step 5: Commit**

```bash
git add src/gameData.js src/gameData.test.js
git commit -m "feat: 1-3 Liga-Felder pro Brett in buildBoardSerial"
```

---

## Task 3: Rendering der Liga-Felder (Emblem, Label, CSS)

**Files:**
- Modify: `src/Emblems.jsx` (`Emblem`, `Cell`)
- Modify: `src/styles.css`

Kein Unit-Test (kein DOM-Test-Setup im Projekt); Verifikation via `npm run build` + Sichtcheck.

- [ ] **Step 1: `Emblem` um Liga-Zweig erweitern**

In `src/Emblems.jsx` die Funktion `Emblem` so ändern (Liga-Zweig vor dem abschließenden Club-`return`):

```jsx
export function Emblem({ def }) {
  if (def.type === "nat") return <span className="emblem flag"><Flag spec={def.flag} /></span>;
  if (def.type === "spec") return <span className="emblem icon" style={{ background: `linear-gradient(150deg,${def.c1},${def.c2})` }}>{def.icon}</span>;
  if (def.type === "league") return <span className="emblem league" style={{ background: `linear-gradient(150deg,${def.c1},${def.c2})` }}>{def.label}</span>;
  return <span className="emblem badge"><ClubBadge c1={def.c1} c2={def.c2} pat={def.pat} /></span>;
}
```

- [ ] **Step 2: `Cell` zeigt für Liga-Felder den vollen Namen**

In `src/Emblems.jsx` in der `Cell`-Komponente die Label-Zeile ändern von:

```jsx
        <span className="hexLabel">{def.label}</span>
```

zu:

```jsx
        <span className="hexLabel">{def.type === "league" ? def.name : def.label}</span>
```

(Die darauffolgende `hexCountry`-Zeile mit `def.type === "club"` bleibt unverändert.)

- [ ] **Step 3: CSS-Regel `.emblem.league` ergänzen**

In `src/styles.css` direkt nach der `.emblem.icon`-Regel (Zeile 56) einfügen:

```css
.emblem.league { width: 60%; aspect-ratio: 1.35; border-radius: 22%; color: #fff; font-weight: 800; letter-spacing: .5px; font-size: clamp(10px, 3.2vw, 15px); box-shadow: inset 0 1px 0 rgba(255,255,255,.3), 0 1px 3px rgba(0,0,0,.4); }
```

- [ ] **Step 4: Build prüfen**

Run: `npm run build`
Expected: `✓ built in …` ohne Fehler.

- [ ] **Step 5: Sichtcheck im Dev-Server**

Run: `npm run dev` und die angezeigte URL öffnen. Ein Spiel erstellen und das Brett ansehen.
Expected: Pro Brett 1–3 Liga-Felder mit farbigem Badge (z. B. „BL") und vollem Namen darunter (z. B. „Bundesliga"). Dev-Server danach mit Strg+C beenden.

- [ ] **Step 6: Commit**

```bash
git add src/Emblems.jsx src/styles.css
git commit -m "feat: Rendering der Liga-Hexfelder"
```

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** LEAGUES (5 Ligen) → Task 1; Ableitung aus clubs → Task 1 (`CLUB_LG` + `playerMatchesHex`); 1–3 pro Brett → Task 2; Optik Badge+Kürzel & voller Name → Task 3; `DEF_BY_KEY`/`hydrateBoard` → Task 1. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** `LEAGUES`, `CLUB_LG`, Typ-String `"league"`, Keys `BL/PL/LL/SA/L1` durchgängig identisch in Tests und Implementierung.
- **Scope:** fokussiert auf Teil A; Titel/Honours/Weltmeister bewusst ausgeschlossen.
