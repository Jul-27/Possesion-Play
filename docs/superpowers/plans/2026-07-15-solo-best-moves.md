# „Die 5 stärksten Züge" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Nach gelöstem Trainings-Board die 5 Spieler zeigen, die mit einem Zug die meisten Felder erobert hätten.

**Architecture:** Reine Engine-Funktion `bestOpeningMoves` in `gameData.js` (TDD); `Solo.jsx` berechnet sie einmalig beim Lösen und zeigt sie im Abschluss-Panel.

**Tech Stack:** React/Vite, Tests `node:test`. Keine neuen Dependencies.

---

## Task 1: Engine `bestOpeningMoves` (TDD)

**Files:**
- Modify: `src/gameData.js`, `src/gameData.test.js`

- [ ] **Step 1: Test schreiben.** Am Ende von `src/gameData.test.js` anhängen:

```js
import { bestOpeningMoves, POSITIONS, ADJP as ADJ } from "./gameData.js";

test("bestOpeningMoves: Feld + passende Nachbarn, Sortierung, Limit", () => {
  // Board: alle 31 Felder; Feld 0 = FCB, seine Nachbarn = GER bzw. CL, Rest = JPN
  const fcb = lookupDef("club", "FCB"), ger = lookupDef("nat", "GER");
  const cl = lookupDef("honour", "CL"), jpn = lookupDef("nat", "JPN");
  const nb = ADJ[0];
  const board = POSITIONS.map((p, i) => ({
    idx: i,
    def: i === 0 ? fcb : i === nb[0] ? ger : i === nb[1] ? cl : jpn,
  }));

  const combo = { n: "Kombi Spieler", ln: "Spieler", by: 1990, nat: ["GER"], clubs: ["FCB"], t: ["CL"], sl: 10 };
  const soloOnly = { n: "Nur Verein", ln: "Verein", by: 1990, nat: [], clubs: ["FCB"], t: [], sl: 99 };
  const nothing = { n: "Ohne Treffer", ln: "Treffer", by: 1990, nat: ["ESP"], clubs: ["BAR"], t: [], sl: 50 };

  const res = bestOpeningMoves([nothing, soloOnly, combo], board, 5);
  assert.equal(res.length, 2, "Spieler ohne Treffer fehlt");
  assert.equal(res[0].player.n, "Kombi Spieler");
  assert.equal(res[0].count, 3);            // Feld 0 + 2 passende Nachbarn
  assert.equal(res[0].idx, 0);
  assert.equal(res[1].player.n, "Nur Verein");
  assert.equal(res[1].count, 1);
  assert.equal(bestOpeningMoves([nothing, soloOnly, combo], board, 1).length, 1); // Limit
});

test("bestOpeningMoves: Gleichstand -> bekanntere Spieler (sl) zuerst", () => {
  const jpn = lookupDef("nat", "JPN");
  const board = POSITIONS.map((p, i) => ({ idx: i, def: jpn })); // alle Felder JPN
  const leise = { n: "Leise", ln: "Leise", by: 1990, nat: ["JPN"], clubs: [], t: [], sl: 5 };
  const laut = { n: "Laut", ln: "Laut", by: 1990, nat: ["JPN"], clubs: [], t: [], sl: 90 };
  const res = bestOpeningMoves([leise, laut], board, 5);
  assert.equal(res[0].player.n, "Laut");
  assert.equal(res[0].count, res[1].count); // gleiche Feldanzahl
});
```

- [ ] **Step 2:** Run `npm test` — Expected: FAIL (`bestOpeningMoves` nicht exportiert).

- [ ] **Step 3: Implementieren.** In `src/gameData.js` nach `hydrateBoard` einfügen:

```js
// Stärkste Einzelzüge auf einem leeren Board: gewähltes Feld + passende Nachbarn
// (exakt die Eroberungsmechanik). Liefert Top-Spieler nach eroberten Feldern,
// bei Gleichstand die bekannteren (sl) zuerst. board = hydratisierte Zellen.
export function bestOpeningMoves(players, board, limit = 5) {
  const out = [];
  for (const p of players) {
    const hit = [];
    for (let i = 0; i < board.length; i++) if (playerMatchesHex(p, board[i].def)) hit.push(i);
    if (!hit.length) continue;
    const set = new Set(hit);
    let best = 0, bestIdx = -1, bestFields = null;
    for (const i of hit) {
      const fields = [i];
      for (const n of ADJP[i]) if (set.has(n)) fields.push(n);
      if (fields.length > best) { best = fields.length; bestIdx = i; bestFields = fields; }
    }
    out.push({ player: p, count: best, idx: bestIdx, fields: bestFields });
  }
  out.sort((a, b) => b.count - a.count || (b.player.sl || 0) - (a.player.sl || 0) || a.player.n.localeCompare(b.player.n, "de"));
  return out.slice(0, limit);
}
```

- [ ] **Step 4:** Run `npm test` — Expected: PASS (45 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/gameData.js src/gameData.test.js
git commit -m "feat: bestOpeningMoves — stärkste Einzelzüge eines Boards (Engine)"
```

---

## Task 2: Anzeige in Solo.jsx

**Files:**
- Modify: `src/Solo.jsx`, `src/styles.css`

- [ ] **Step 1: Import erweitern.** In `src/Solo.jsx` die Import-Zeile

```jsx
  buildBoardSerial, BOARDH,
} from "./gameData.js";
```

ersetzen durch:

```jsx
  buildBoardSerial, BOARDH, bestOpeningMoves,
} from "./gameData.js";
```

- [ ] **Step 2: State + Berechnung.** Nach der Zeile `useEffect(() => { if (selected !== null && inputRef.current) inputRef.current.focus(); }, [selected]);` einfügen:

```jsx
  // Stärkste Züge erst nach dem Lösen berechnen (~0,3 s über den ganzen Kader)
  const [bestMoves, setBestMoves] = useState(null);
  useEffect(() => {
    if (!done || !players || bestMoves) return;
    const id = setTimeout(() => setBestMoves(bestOpeningMoves(players, board, 5)), 50);
    return () => clearTimeout(id);
  }, [done, players]); // eslint-disable-line
```

(`done` und `board` sind oberhalb definiert — `const captured`/`const done` stehen vor den Handlern, `board` als `useMemo`.)

- [ ] **Step 3: Reset bei „Neues Board".** In `newBoard()` nach `setSerial(buildBoardSerial()); setOwners({}); setMoves(0); setMisses(0);` ergänzen:

```jsx
    setBestMoves(null);
```

- [ ] **Step 4: Anzeige im Abschluss-Panel.** Im `{done && (…)}`-Block direkt nach dem `</div>` der `dailyStats` (vor `<div className="closeline">`) einfügen:

```jsx
          <div className="bestBlock">
            <div className="bestTitle">Die 5 stärksten Züge auf diesem Board</div>
            {!bestMoves ? <div className="qlogEmpty">Berechne beste Züge…</div> : (
              <div className="bestList">
                {bestMoves.map((m, i) => (
                  <div key={m.player.n + m.player.by} className="bestRow">
                    <span className="bestRank">{i + 1}</span>
                    <span className="bestName">{m.player.n}</span>
                    <span className="bestCount">{m.count} {m.count === 1 ? "Feld" : "Felder"}</span>
                    <span className="bestFields">{m.fields.map((f) => board[f].def.label).join(" · ")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
```

- [ ] **Step 5: CSS.** Am Ende von `src/styles.css` anhängen:

```css
/* ── Beste Züge (Hex-Training) ─────────────────────────────────── */
.bestBlock { margin: 14px 0 4px; text-align: left; }
.bestTitle { font-weight: 800; font-size: 13px; color: #d7ece3; margin-bottom: 8px; text-align: center; }
.bestList { display: flex; flex-direction: column; gap: 6px; }
.bestRow { display: grid; grid-template-columns: 22px 1fr auto; gap: 4px 8px; align-items: baseline; background: rgba(10,22,19,.55); border: 1px solid rgba(255,255,255,.06); border-radius: 10px; padding: 8px 12px; }
.bestRank { font-family: 'DM Mono', monospace; font-weight: 700; color: #FACC15; }
.bestName { font-weight: 700; color: #fff; font-size: 14px; }
.bestCount { font-weight: 800; color: #2DD4BF; font-size: 13px; white-space: nowrap; }
.bestFields { grid-column: 2 / -1; font-family: 'DM Mono', monospace; font-size: 11px; color: #7fa093; line-height: 1.35; }
```

- [ ] **Step 6: Build + Tests + Commit**

Run: `npm run build` (`✓`) und `npm test` (45 PASS).

```bash
git add src/Solo.jsx src/styles.css
git commit -m "feat: Hex-Training zeigt nach dem Lösen die 5 stärksten Züge"
```

---

## Task 3: Verifikation & Abschluss

- [ ] **Step 1:** Reale Gegenprobe im Node: `bestOpeningMoves` auf einem echten Board mit dem echten Kader laufen lassen, Laufzeit + Plausibilität prüfen (Top-Spieler sollten viele Felder abdecken).
- [ ] **Step 2:** `superpowers:finishing-a-development-branch` — Push + PR, mergen auf Zuruf.

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** Engine inkl. Sortierung/Tiebreaker/fields → Task 1; UI mit Lazy-Berechnung, Reset, Feld-Labels, CSS → Task 2; Performance-/Plausibilitätsprüfung → Task 3. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** Rückgabeform `{player, count, idx, fields}` identisch in Engine, Tests und UI; `board` in UI = `hydrateBoard`-Ergebnis wie von der Engine erwartet.
