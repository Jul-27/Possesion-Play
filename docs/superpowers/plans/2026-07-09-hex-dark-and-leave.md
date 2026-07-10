# Dunkle Hex-Felder + Spielende beim Schließen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Untere Hex-Felder aufhellen (Cell-Gradient + Flutlicht, wirkt in Hex + Solo). (2) Multiplayer-Spiel beenden, wenn ein Spieler das Fenster schließt (Karenz ~15 s, Reload beendet nicht).

**Architecture:** Visueller Fix zentral in `Emblems.jsx`/`styles.css`. Verlassen-Logik: `beaconUpdate` (keepalive-fetch) in `supabaseClient.js` + gemeinsamer Hook `usePresence.js`; jede der drei Duell-Komponenten liefert ein modus-spezifisches `finalize(leaver)` und zeigt ein Forfeit-Overlay.

**Tech Stack:** React, Supabase REST (keepalive fetch). Keine neuen Dependencies/CSS-Klassen.

---

## Task 1: Visueller Fix (Hex + Solo)

**Files:**
- Modify: `src/Emblems.jsx`, `src/styles.css`

- [ ] **Step 1: Neutraler Zell-Gradient.** In `src/Emblems.jsx` (Cell) die Zeile

```jsx
    bg = "linear-gradient(155deg, rgba(20,40,33,.72), rgba(8,20,15,.85))";
```

ersetzen durch:

```jsx
    bg = "linear-gradient(155deg, rgba(34,60,50,.92), rgba(22,42,34,.96))";
```

- [ ] **Step 2: Flutlicht flacher/gleichmäßiger.** In `src/styles.css` den Block `.board::before` (aktuell `radial-gradient(65% 58% at 50% 46%, rgba(244,201,93,.12), transparent 78%)`) ersetzen durch:

```css
.board::before { /* Flutlicht-Pool hinter dem Brett — gleichmäßig über alle Reihen */
  content: ""; position: absolute; inset: -12% -8% -14%; z-index: 0; pointer-events: none;
  background: radial-gradient(85% 72% at 50% 50%, rgba(244,201,93,.10), transparent 95%);
}
```

- [ ] **Step 3: Build + Commit**

Run: `npm run build` (Expected `✓`).

```bash
git add src/Emblems.jsx src/styles.css
git commit -m "fix: hellere Hex-Zellen + gleichmäßiges Flutlicht (untere Reihe nicht mehr dunkel)"
```

---

## Task 2: `beaconUpdate` + Presence-Hook

**Files:**
- Modify: `src/supabaseClient.js`
- Create: `src/usePresence.js`

- [ ] **Step 1: `beaconUpdate` in `supabaseClient.js`** (nach `export const supabase = …`):

```js
// Update, das das Entladen der Seite überlebt (normaler supabase-js-Client wird
// beim Schließen abgebrochen). Direkt gegen die REST-API mit keepalive.
export function beaconUpdate(code, patch) {
  try {
    fetch(`${url}/rest/v1/games?code=eq.${encodeURIComponent(code)}`, {
      method: "PATCH", keepalive: true,
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
  } catch { /* nie kritisch */ }
}
```

- [ ] **Step 2: `src/usePresence.js` anlegen:**

```jsx
import { useEffect, useRef, useState } from "react";
import { supabase, beaconUpdate } from "./supabaseClient.js";

const GRACE_MS = 15000;

// Beendet ein Multiplayer-Spiel, wenn der Gegner das Fenster schließt (Karenz).
// finalize(leaver) schreibt das modus-spezifische Forfeit-Ende.
// lastMove = row?.last_move. Gibt opponentLeaving (bool) fürs Overlay zurück.
export function useLeaveEndsGame({ code, myPlayer, status, lastMove, finalize }) {
  const [opponentLeaving, setOpponentLeaving] = useState(false);
  const lmRef = useRef(lastMove);
  lmRef.current = lastMove;
  const finRef = useRef(finalize);
  finRef.current = finalize;

  // 1) Beim echten Entladen weichen Marker senden (keepalive überlebt das)
  useEffect(() => {
    const onHide = (e) => {
      if (e.persisted) return;                 // Mobile-Hintergrund/bfcache ignorieren
      if (status !== "playing" || !myPlayer) return;
      beaconUpdate(code, {
        last_move: { ...(lmRef.current || {}), leftBy: myPlayer, leftAt: Date.now() },
        updated_at: new Date().toISOString(),
      });
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [code, myPlayer, status]);

  // 2) Rückkehr (z. B. nach Reload) räumt den eigenen Marker ab
  useEffect(() => {
    if (myPlayer && lastMove?.leftBy === myPlayer) {
      const { leftBy, leftAt, ...rest } = lastMove;
      supabase.from("games").update({ last_move: rest, updated_at: new Date().toISOString() })
        .eq("code", code).then(() => {});
    }
  }, [lastMove?.leftBy, myPlayer, code]); // eslint-disable-line

  // 3) Gegner offline -> Karenz -> finalisieren
  useEffect(() => {
    const leaver = lastMove?.leftBy;
    if (status !== "playing" || !myPlayer || !leaver || leaver === myPlayer) { setOpponentLeaving(false); return; }
    setOpponentLeaving(true);
    let fired = false;
    const id = setTimeout(() => { if (!fired) { fired = true; finRef.current(leaver); } }, GRACE_MS);
    return () => clearTimeout(id);
  }, [lastMove?.leftBy, lastMove?.leftAt, status, myPlayer]); // eslint-disable-line

  return opponentLeaving;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/supabaseClient.js src/usePresence.js
git commit -m "feat: beaconUpdate + useLeaveEndsGame (Verlassen-Karenz)"
```

---

## Task 3: Game.jsx (Hex)

**Files:**
- Modify: `src/Game.jsx`

- [ ] **Step 1: Import** (nach den bestehenden Imports): `import { useLeaveEndsGame } from "./usePresence.js";`

- [ ] **Step 2: Hook + Forfeit-Var.** Nach der Zeile `const board = useMemo(() => (row?.board ? hydrateBoard(row.board) : []), [row?.board]);` (bzw. direkt nach der `names`-Definition) einfügen:

```jsx
  const forfeit = row?.last_move?.forfeit || 0;
  const opponentLeaving = useLeaveEndsGame({
    code, myPlayer, status, lastMove: row?.last_move,
    finalize: (leaver) => supabase.from("games").update({
      status: "finished",
      last_move: { forfeit: leaver, by: 0, text: `🚪 ${names[leaver]} hat das Spiel verlassen`, claimed: [], ts: Date.now() },
      updated_at: new Date().toISOString(),
    }).eq("code", code).then(() => {}),
  });
```

- [ ] **Step 3: winnerNo um Forfeit erweitern.** Zeile

```jsx
  const winnerNo = !gameOver ? 0 : clk.timeout ? (clk.timeout === 1 ? 2 : 1) : counts.a === counts.b ? 0 : counts.a > counts.b ? 1 : 2;
```

ersetzen durch:

```jsx
  const winnerNo = !gameOver ? 0 : forfeit ? (forfeit === 1 ? 2 : 1) : clk.timeout ? (clk.timeout === 1 ? 2 : 1) : counts.a === counts.b ? 0 : counts.a > counts.b ? 1 : 2;
```

- [ ] **Step 4: Karenz-Banner.** Direkt nach `{fb && (<div className={`fb ${fb.type}`}>…</div>)}` einfügen:

```jsx
      {opponentLeaving && !gameOver && (<div className="fb info">Gegner offline — das Spiel endet gleich, falls er nicht zurückkommt…</div>)}
```

- [ ] **Step 5: Abpfiff-Text um Forfeit.** Den Overlay-Block

```jsx
            <h2>Abpfiff</h2>
            {clk.timeout ? (
              <p className="winName" style={{ color: P[clk.timeout === 1 ? 2 : 1].c1 }}>{names[clk.timeout === 1 ? 2 : 1]} gewinnt</p>
            ) : counts.a === counts.b ? <p className="winName">Unentschieden!</p> : (
              <p className="winName" style={{ color: counts.a > counts.b ? P[1].c1 : P[2].c1 }}>{counts.a > counts.b ? names[1] : names[2]} gewinnt</p>
            )}
            <p>{clk.timeout ? `⏱ ${names[clk.timeout]} — Zeit abgelaufen` : `${names[1]} ${counts.a} : ${counts.b} ${names[2]}`}</p>
```

ersetzen durch:

```jsx
            <h2>Abpfiff</h2>
            {forfeit ? (
              <p className="winName" style={{ color: P[forfeit === 1 ? 2 : 1].c1 }}>{names[forfeit === 1 ? 2 : 1]} gewinnt</p>
            ) : clk.timeout ? (
              <p className="winName" style={{ color: P[clk.timeout === 1 ? 2 : 1].c1 }}>{names[clk.timeout === 1 ? 2 : 1]} gewinnt</p>
            ) : counts.a === counts.b ? <p className="winName">Unentschieden!</p> : (
              <p className="winName" style={{ color: counts.a > counts.b ? P[1].c1 : P[2].c1 }}>{counts.a > counts.b ? names[1] : names[2]} gewinnt</p>
            )}
            <p>{forfeit ? `🚪 ${names[forfeit]} hat das Spiel verlassen` : clk.timeout ? `⏱ ${names[clk.timeout]} — Zeit abgelaufen` : `${names[1]} ${counts.a} : ${counts.b} ${names[2]}`}</p>
```

- [ ] **Step 6: Build + Commit**

Run: `npm run build` (`✓`).

```bash
git add src/Game.jsx
git commit -m "feat: Hex — Spielende bei Fenster-Schließen (Forfeit mit Karenz)"
```

---

## Task 4: Grid.jsx (Raster)

**Files:**
- Modify: `src/Grid.jsx`

- [ ] **Step 1: Import** `import { useLeaveEndsGame } from "./usePresence.js";`

- [ ] **Step 2: Hook + Forfeit.** Nach der `names`-Definition (nach `const names = row?.names || …;`) einfügen:

```jsx
  const forfeit = row?.last_move?.forfeit || 0;
  const opponentLeaving = useLeaveEndsGame({
    code, myPlayer, status, lastMove: row?.last_move,
    finalize: (leaver) => supabase.from("games").update({
      status: "finished",
      last_move: { ...(row?.last_move || {}), forfeit: leaver, by: 0, text: `🚪 ${names[leaver]} hat das Spiel verlassen`, ts: Date.now() },
      updated_at: new Date().toISOString(),
    }).eq("code", code).then(() => {}),
  });
```

- [ ] **Step 3: winner um Forfeit.** Zeile

```jsx
  const winner = clk.timeout ? (clk.timeout === 1 ? 2 : 1)
```

ersetzen durch:

```jsx
  const winner = forfeit ? (forfeit === 1 ? 2 : 1) : clk.timeout ? (clk.timeout === 1 ? 2 : 1)
```

- [ ] **Step 4: Karenz-Banner.** Direkt nach der `{fb && (…)}`-Zeile einfügen:

```jsx
      {opponentLeaving && !gameOver && (<div className="fb info">Gegner offline — das Spiel endet gleich, falls er nicht zurückkommt…</div>)}
```

- [ ] **Step 5: Abpfiff-Text um Forfeit.** Im gameOver-Overlay die Zeile

```jsx
          <p>{clk.timeout ? `⏱ ${names[clk.timeout]} — Zeit abgelaufen` : `${names[1]} ${counts.a} : ${counts.b} ${names[2]}`}</p>
```

ersetzen durch:

```jsx
          <p>{forfeit ? `🚪 ${names[forfeit]} hat das Spiel verlassen` : clk.timeout ? `⏱ ${names[clk.timeout]} — Zeit abgelaufen` : `${names[1]} ${counts.a} : ${counts.b} ${names[2]}`}</p>
```

- [ ] **Step 6: Build + Commit**

```bash
npm run build && git add src/Grid.jsx
git commit -m "feat: Raster — Spielende bei Fenster-Schließen (Forfeit mit Karenz)"
```

---

## Task 5: Guess.jsx (Errate den Star)

**Files:**
- Modify: `src/Guess.jsx`

- [ ] **Step 1: Import** `import { useLeaveEndsGame } from "./usePresence.js";`

- [ ] **Step 2: Hook + Forfeit.** Nach der `names`-Definition einfügen:

```jsx
  const forfeit = row?.last_move?.forfeit || 0;
  const opponentLeaving = useLeaveEndsGame({
    code, myPlayer, status, lastMove: row?.last_move,
    finalize: (leaver) => supabase.from("games").update({
      status: "finished",
      last_move: { ...(row?.last_move || {}), forfeit: leaver, winner: leaver === 1 ? 2 : 1 },
      updated_at: new Date().toISOString(),
    }).eq("code", code).then(() => {}),
  });
```

- [ ] **Step 3: winner um Forfeit.** Zeile

```jsx
  const winner = clk.timeout ? (clk.timeout === 1 ? 2 : 1) : (row.last_move?.winner || 0);
```

ersetzen durch:

```jsx
  const winner = forfeit ? (forfeit === 1 ? 2 : 1) : clk.timeout ? (clk.timeout === 1 ? 2 : 1) : (row.last_move?.winner || 0);
```

- [ ] **Step 4: Karenz-Banner.** Nach der `{fb && (…)}`-Zeile einfügen:

```jsx
      {opponentLeaving && !gameOver && (<div className="fb info">Gegner offline — das Spiel endet gleich, falls er nicht zurückkommt…</div>)}
```

- [ ] **Step 5: Abpfiff-Zeile um Forfeit.** Im gameOver-Overlay (nach `<h2>Aufgelöst</h2>`) vor `<p>Gesuchter Star: …` eine Zeile ergänzen:

```jsx
          {forfeit ? <p>🚪 {names[forfeit]} hat das Spiel verlassen</p> : null}
```

- [ ] **Step 6: Build + Tests + Commit**

```bash
npm run build && npm test && git add src/Guess.jsx
git commit -m "feat: Errate den Star — Spielende bei Fenster-Schließen (Forfeit mit Karenz)"
```

---

## Task 6: Verifikation & Abschluss

- [ ] **Step 1:** `npm test` (42 grün) + `npm run build` (`✓`).
- [ ] **Step 2:** `superpowers:finishing-a-development-branch` — Push + PR via GitHub-API, mergen auf Zuruf. Manuell (zwei Tabs): Fenster schließen → Gegner sieht Banner → nach 15 s Abpfiff „verlassen", der Verbliebene gewinnt; Reload während der Karenz → Spiel läuft weiter.

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** Befund 1 (Cell-Gradient + Flutlicht) → Task 1; Befund 2 (beaconUpdate + Hook + je Modus Forfeit-Overlay) → Tasks 2–5; Verifikation → Task 6. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** `last_move.leftBy`/`leftAt` (Marker) und `last_move.forfeit` (Endzustand) einheitlich; `useLeaveEndsGame`-Signatur identisch in allen drei Aufrufen; `beaconUpdate(code, patch)` konsistent; Grace = 15 s zentral im Hook.
