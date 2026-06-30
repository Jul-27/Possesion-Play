# Gesamt-Zeitbudget (Schachuhr) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pro-Zug-Timer (45 s) durch ein Gesamt-Zeitbudget von 4:00 Min pro Spieler ersetzen (Schachuhr); bei 0 verliert der Spieler, dessen Zeit abläuft.

**Architecture:** Restzeiten liegen als geteilter Zustand in Supabase (`games.clocks` jsonb). Reine Uhr-Helfer in `gameData.js`; `Game.jsx` tickt lokal, zieht bei Zug/Skip die verstrichene Zeit ab und erkennt Timeout (aktiver Spieler + defensiv der Gegner). Zwei mm:ss-Uhren im Scoreboard.

**Tech Stack:** Vite + React 18, Supabase (jsonb-Spalte), Tests: `node:test`.

**Voraussetzung:** Eine SQL-Migration auf der Supabase-DB (Task 2, Schritt vom Nutzer).

---

## File Structure

- `src/gameData.js` — **modify**: `START_SECONDS`, `liveRemaining`, `fmtClock`.
- `src/gameData.test.js` — **modify**: Tests dafür.
- `supabase/schema.sql` — **modify**: Spalte `clocks`.
- `src/Lobby.jsx` — **modify**: `clocks` beim Erstellen/Beitreten.
- `src/Game.jsx` — **modify**: Uhr-Logik (Tick/Zug/Skip/Timeout/Anzeige), alten Timer entfernen.
- `src/styles.css` — **modify**: `.clock`/`.scoreMid`.

---

## Task 1: Uhr-Helfer + Tests (TDD)

**Files:**
- Modify: `src/gameData.js`
- Modify: `src/gameData.test.js`

- [ ] **Step 1: Failing tests** ans Ende von `src/gameData.test.js` anhängen:

```js
import { START_SECONDS, fmtClock, liveRemaining } from "./gameData.js";

test("fmtClock formatiert m:ss", () => {
  assert.equal(START_SECONDS, 240);
  assert.equal(fmtClock(240), "4:00");
  assert.equal(fmtClock(65), "1:05");
  assert.equal(fmtClock(5), "0:05");
  assert.equal(fmtClock(-3), "0:00");
});

test("liveRemaining zieht verstrichene Zeit ab, min 0", () => {
  const T = Date.parse("2026-01-01T00:00:00Z");
  const iso = new Date(T).toISOString();
  assert.equal(liveRemaining({ 1: 240, 2: 240, started: null }, 1, T + 99000), 240); // nicht gestartet
  assert.equal(liveRemaining({ 1: 240, 2: 240, started: iso }, 1, T + 65000), 175);  // 65s vergangen
  assert.equal(liveRemaining({ 1: 5, 2: 240, started: iso }, 1, T + 10000), 0);       // unter 0 -> 0
  assert.equal(liveRemaining({ 1: 240, 2: 100, started: iso }, 2, T + 10000), 90);     // anderer Spieler aktiv
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag prüfen**

Run: `npm test`
Expected: FAIL — Exports fehlen.

- [ ] **Step 3: Helfer in `src/gameData.js` ergänzen** (direkt nach der `suggestPlayers`-Funktion):

```js
// ── Uhr (Gesamt-Zeitbudget pro Spieler) ──────────────────────────────────────
export const START_SECONDS = 240; // 4:00 pro Spieler

export function fmtClock(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Restsekunden des aktiven Spielers (turn): gespeichertes Budget minus verstrichene
// Zeit seit clocks.started. Ohne started -> volles Budget.
export function liveRemaining(clocks, turn, nowMs) {
  const base = clocks?.[turn] ?? START_SECONDS;
  const st = clocks?.started;
  if (st == null) return base;
  const startedMs = typeof st === "number" ? st : Date.parse(st);
  return Math.max(0, base - Math.floor((nowMs - startedMs) / 1000));
}
```

- [ ] **Step 4: Test ausführen, Erfolg prüfen**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/gameData.js src/gameData.test.js
git commit -m "feat: Uhr-Helfer (START_SECONDS, fmtClock, liveRemaining)"
```

---

## Task 2: Supabase-Schema + Lobby-Init

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `src/Lobby.jsx`

- [ ] **Step 1: `supabase/schema.sql` — Spalte ergänzen.** In der `create table`-Definition nach der `last_move`-Zeile einfügen:

```sql
    clocks      jsonb,                        -- { "1":sek, "2":sek, started:iso|null, timeout:1|2|null }
```

Und darunter (nach dem `create table ... );`-Block, vor `replica identity`) für bestehende DBs:

```sql
-- Für bestehende Tabellen (Migration):
alter table public.games add column if not exists clocks jsonb;
```

- [ ] **Step 2: `src/Lobby.jsx` — `START_SECONDS` importieren.** Die Importzeile

```js
import { buildBoardSerial, genCode } from "./gameData.js";
```

ersetzen durch:

```js
import { buildBoardSerial, genCode, START_SECONDS } from "./gameData.js";
```

- [ ] **Step 3: `createGame` — `clocks` ins Insert.** Im `supabase.from("games").insert({ ... })` nach der Zeile `last_move: null,` einfügen:

```js
        clocks: { 1: START_SECONDS, 2: START_SECONDS, started: null, timeout: null },
```

- [ ] **Step 4: `joinGame` — Uhr beim Beitritt starten.** Im Update-Objekt von `joinGame` (`.update({ guest_id: me, status: "playing", names: {...}, updated_at: ... })`) ergänzen:

```js
          clocks: { ...(row.clocks || { 1: START_SECONDS, 2: START_SECONDS, timeout: null }), started: new Date().toISOString() },
```

- [ ] **Step 5: Build prüfen**

Run: `npm run build`
Expected: `✓ built in …`.

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql src/Lobby.jsx
git commit -m "feat: clocks-Spalte + Lobby-Init der Uhren"
```

---

## Task 3: Game.jsx — Schachuhr-Logik & Anzeige

**Files:**
- Modify: `src/Game.jsx`

- [ ] **Step 1: Import erweitern.** In `src/Game.jsx` den `gameData.js`-Import um die Uhr-Helfer ergänzen:

```jsx
import {
  P, cname, norm, PLAYERS, suggestPlayers, ADJP, hydrateBoard, playerMatchesHex,
  buildBoardSerial, BOARDH, HEXH, START_SECONDS, fmtClock, liveRemaining,
} from "./gameData.js";
```

- [ ] **Step 2: Timer-State ersetzen.** Die zwei Zeilen

```jsx
  const [timerMode, setTimerMode] = useState(45);
  const [timeLeft, setTimeLeft] = useState(45);
```

ersetzen durch:

```jsx
  const [now, setNow] = useState(Date.now());
  const timeoutFired = useRef(false);
```

- [ ] **Step 3: Abgeleitete Uhr-Werte einführen.** Direkt nach der Zeile `const board = useMemo(...)` (≈ Zeile 49) einfügen:

```jsx
  const clk = row?.clocks || { 1: START_SECONDS, 2: START_SECONDS, started: null, timeout: null };
  const rem1 = status === "playing" && row?.turn === 1 && clk.started ? liveRemaining(clk, 1, now) : (clk[1] ?? START_SECONDS);
  const rem2 = status === "playing" && row?.turn === 2 && clk.started ? liveRemaining(clk, 2, now) : (clk[2] ?? START_SECONDS);
```

- [ ] **Step 4: Tick- und Timeout-Effekt; alten Timer entfernen.** Den Block

```jsx
  // Timer (nur lokal für den Spieler am Zug)
  useEffect(() => { setTimeLeft(timerMode || 0); }, [row?.turn, timerMode]);
  useEffect(() => {
    if (!myTurn || timerMode === 0 || status !== "playing") return;
    if (timeLeft <= 0) { skipTurn(); return; }
    const id = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, myTurn, timerMode, status]); // eslint-disable-line
```

ersetzen durch:

```jsx
  // Sekündlicher Tick fürs Herunterzählen (nur während des Spiels)
  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Timeout-Erkennung: aktiver Spieler verliert; Gegner schreibt defensiv mit
  useEffect(() => { timeoutFired.current = false; }, [status, row?.turn]);
  useEffect(() => {
    if (status !== "playing" || !clk.started || timeoutFired.current) return;
    if (liveRemaining(clk, row.turn, now) > 0) return;
    timeoutFired.current = true;
    const finish = {
      status: "finished",
      clocks: { ...clk, [row.turn]: 0, started: null, timeout: row.turn },
      last_move: { by: 0, text: `⏱ ${names[row.turn]} — Zeit abgelaufen`, claimed: [], ts: Date.now() },
      updated_at: new Date().toISOString(),
    };
    if (myTurn) {
      supabase.from("games").update(finish).eq("code", code).eq("turn", myPlayer).eq("status", "playing");
    } else if (myPlayer !== 0) {
      supabase.from("games").update(finish).eq("code", code).eq("status", "playing"); // Gegner offline -> defensiv
    }
  }, [now, status, row?.turn, myTurn, myPlayer, code]); // eslint-disable-line
```

- [ ] **Step 5: `handleSubmit` — Uhr abziehen.** Die letzte Zeile von `handleSubmit`

```jsx
    writeMove({ owners: newOwners, turn: myPlayer === 1 ? 2 : 1, status: neutralLeft === 0 ? "finished" : "playing", last_move: move });
```

ersetzen durch:

```jsx
    const rem = liveRemaining(clk, myPlayer, Date.now());
    const nextClocks = { ...clk, [myPlayer]: rem, started: new Date().toISOString() };
    writeMove({ owners: newOwners, turn: myPlayer === 1 ? 2 : 1, status: neutralLeft === 0 ? "finished" : "playing", last_move: move, clocks: nextClocks });
```

- [ ] **Step 6: `skipTurn` — Uhr abziehen.** Die `writeMove`-Zeile in `skipTurn`

```jsx
    writeMove({ turn: myPlayer === 1 ? 2 : 1, last_move: { by: myPlayer, text: `${names[myPlayer]} überspringt den Zug.`, claimed: [], ts: Date.now() } });
```

ersetzen durch:

```jsx
    const rem = liveRemaining(clk, myPlayer, Date.now());
    const nextClocks = { ...clk, [myPlayer]: rem, started: new Date().toISOString() };
    writeMove({ turn: myPlayer === 1 ? 2 : 1, last_move: { by: myPlayer, text: `${names[myPlayer]} überspringt den Zug.`, claimed: [], ts: Date.now() }, clocks: nextClocks });
```

- [ ] **Step 7: `newGame` — Uhren zurücksetzen.** Im `newGame`-Update das Objekt

```jsx
      board: buildBoardSerial(), owners: {}, turn: 1, status: "playing", last_move: null, updated_at: new Date().toISOString(),
```

ersetzen durch:

```jsx
      board: buildBoardSerial(), owners: {}, turn: 1, status: "playing", last_move: null,
      clocks: { 1: START_SECONDS, 2: START_SECONDS, started: new Date().toISOString(), timeout: null },
      updated_at: new Date().toISOString(),
```

- [ ] **Step 8: `lowTime`/`centerTimer` entfernen.** Die Zeilen

```jsx
  const lowTime = myTurn && timerMode > 0 && timeLeft <= 10;
```

und

```jsx
  const centerTimer = status !== "playing" ? "—" : myTurn ? (timerMode === 0 ? "∞" : `0:${String(timeLeft).padStart(2, "0")}`) : "·· ··";
```

ersatzlos löschen.

- [ ] **Step 9: Scoreboard auf zwei Uhren umbauen.** Den `score`-Block

```jsx
      <div className="score">
        <div className="team" style={{ opacity: row.turn === 1 ? 1 : 0.6 }}>
          <span className={`teamName ${row.turn === 1 ? "activeName" : ""}`}><span className="dot" style={{ background: P[1].c1 }} />{names[1]}{myPlayer === 1 ? " (du)" : ""}</span>
          <span className="teamScore" style={{ color: P[1].c1 }}>{counts.a}</span>
        </div>
        <div className={`timer ${lowTime ? "low" : ""}`}>{centerTimer}</div>
        <div className="team right" style={{ opacity: row.turn === 2 ? 1 : 0.6 }}>
          <span className={`teamName ${row.turn === 2 ? "activeName" : ""}`}>{names[2]}{myPlayer === 2 ? " (du)" : ""}<span className="dot" style={{ background: P[2].c1 }} /></span>
          <span className="teamScore" style={{ color: P[2].c1 }}>{counts.b}</span>
        </div>
      </div>
```

ersetzen durch:

```jsx
      <div className="score">
        <div className="team" style={{ opacity: row.turn === 1 ? 1 : 0.6 }}>
          <span className={`teamName ${row.turn === 1 ? "activeName" : ""}`}><span className="dot" style={{ background: P[1].c1 }} />{names[1]}{myPlayer === 1 ? " (du)" : ""}</span>
          <span className="teamScore" style={{ color: P[1].c1 }}>{counts.a}</span>
          <span className={`clock ${row.turn === 1 && rem1 <= 30 ? "low" : ""}`}>{fmtClock(rem1)}</span>
        </div>
        <div className="scoreMid">:</div>
        <div className="team right" style={{ opacity: row.turn === 2 ? 1 : 0.6 }}>
          <span className={`teamName ${row.turn === 2 ? "activeName" : ""}`}>{names[2]}{myPlayer === 2 ? " (du)" : ""}<span className="dot" style={{ background: P[2].c1 }} /></span>
          <span className="teamScore" style={{ color: P[2].c1 }}>{counts.b}</span>
          <span className={`clock ${row.turn === 2 && rem2 <= 30 ? "low" : ""}`}>{fmtClock(rem2)}</span>
        </div>
      </div>
```

- [ ] **Step 10: „Abpfiff"-Modal — Timeout-Fall.** Den Inhalt des gameOver-Modals

```jsx
            {counts.a === counts.b ? <p className="winName">Unentschieden!</p> : (
              <p className="winName" style={{ color: counts.a > counts.b ? P[1].c1 : P[2].c1 }}>{counts.a > counts.b ? names[1] : names[2]} gewinnt</p>
            )}
            <p>{names[1]} {counts.a} : {counts.b} {names[2]}</p>
```

ersetzen durch:

```jsx
            {clk.timeout ? (
              <p className="winName" style={{ color: P[clk.timeout === 1 ? 2 : 1].c1 }}>{names[clk.timeout === 1 ? 2 : 1]} gewinnt</p>
            ) : counts.a === counts.b ? <p className="winName">Unentschieden!</p> : (
              <p className="winName" style={{ color: counts.a > counts.b ? P[1].c1 : P[2].c1 }}>{counts.a > counts.b ? names[1] : names[2]} gewinnt</p>
            )}
            <p>{clk.timeout ? `⏱ ${names[clk.timeout]} — Zeit abgelaufen` : `${names[1]} ${counts.a} : ${counts.b} ${names[2]}`}</p>
```

- [ ] **Step 11: Build + Tests**

Run: `npm run build` (Expected: `✓ built in …`) und `npm test` (Expected: PASS).

- [ ] **Step 12: Commit**

```bash
git add src/Game.jsx
git commit -m "feat: Schachuhr-Logik (Tick/Zug/Skip/Timeout) + zwei Uhren im Scoreboard"
```

---

## Task 4: Styles, Doku & Abschluss

**Files:**
- Modify: `src/styles.css`
- Modify: `data-pipeline/README.md` (kurzer Hinweis entfällt — Datei betrifft Pipeline; stattdessen Root-`README.md` nicht nötig). → Nur CSS + Migrationshinweis im PR.

- [ ] **Step 1: `.clock`/`.scoreMid` in `src/styles.css` ergänzen** — direkt nach der `.timer.low { ... }`-Regel einfügen:

```css
.clock { font-family: 'DM Mono', monospace; font-size: 18px; font-weight: 500; color: #cfe6dc; letter-spacing: .04em; margin-top: 2px; }
.team.right .clock { text-align: right; }
.clock.low { color: var(--rose); text-shadow: 0 0 12px rgba(251,113,133,.5); animation: pulse 1s infinite; }
.scoreMid { font-family: 'Anton', sans-serif; font-size: 22px; color: var(--muted); align-self: center; }
```

- [ ] **Step 2: Build + Tests final**

Run: `npm run build` (Expected: `✓`), `npm test` (Expected: PASS).

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "style: zwei Uhren im Scoreboard (.clock/.scoreMid)"
```

- [ ] **Step 4: Abschluss** — `superpowers:finishing-a-development-branch` (Push + PR). **Im PR/an den Nutzer klar angeben:** vor dem Test auf der Live-Seite muss auf Supabase einmalig ausgeführt werden:
  `alter table public.games add column if not exists clocks jsonb;`

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** 240 s/Spieler → Task 1 (`START_SECONDS`); Live-Restzeit/Format → Task 1 (`liveRemaining`/`fmtClock`); geteilter Zustand (`clocks` jsonb) → Task 2 (Schema) + Lobby-Init; Abzug bei Zug/Skip + `started`-Reset → Task 3 (Step 5/6); newGame-Reset → Step 7; Timeout→Niederlage, aktiv + defensiv Gegner → Step 4; zwei Uhren + low/Puls → Step 9 + Task 4; Modal-Timeout → Step 10; alten Timer/Auto-Skip entfernen → Step 2/4/8/9. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** `clk`, `rem1/rem2`, `clocks`-Form `{1,2,started,timeout}`, `liveRemaining(clocks,turn,nowMs)`, `fmtClock`, `START_SECONDS`, Klassen `.clock`/`.scoreMid` durchgängig konsistent. `timeoutFired` (useRef) — `useRef` ist bereits importiert (Zeile 1).
- **Manueller Test nötig:** Supabase-Migration + 2-Browser-Spieltest (kein automatisierter Realtime-Test).
