# Sounds & Micro-Animationen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** WebAudio-Synth-Sounds mit Mute-Toggle + Konfetti & CSS-Micro-Animationen in allen vier Spielansichten.

**Architecture:** `src/sound.js` (rein, lazy AudioContext, localStorage-Mute) + `src/Confetti.jsx` (CSS-Keyframes, kein Lib); Integration über lokale Aktions-Handler und einen Status-Übergangs-Effect (playing→finished ⇒ win/lose, Ref-Guard gegen Reload-Replays). CSS: qlog-Slide-in, Uhr-Puls, Zellen-Pop, Button-Scale.

**Tech Stack:** Web Audio API, CSS-Animationen, React 18. Keine neuen Dependencies.

---

## File Structure

- `src/sound.js` — **create**: `play/isMuted/toggleMute`.
- `src/Confetti.jsx` — **create**: Sieg-Konfetti.
- `src/Game.jsx`, `src/Grid.jsx`, `src/Guess.jsx`, `src/Daily.jsx` — **modify**: Sound-Hooks, Mute-Button, Konfetti.
- `src/styles.css` — **modify**: Keyframes + Konfetti-Stile.

---

## Task 1: `sound.js` + `Confetti.jsx` + CSS

**Files:**
- Create: `src/sound.js`, `src/Confetti.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: `src/sound.js` anlegen:**

```js
/* WebAudio-Synth für UI-Sounds — keine Assets, nie funktionskritisch.
   AudioContext lazy (Browser erlaubt Audio erst nach User-Geste). */
const KEY = "pp:muted";
let ctx;

export function isMuted() {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}
export function toggleMute() {
  const m = !isMuted();
  try { m ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY); } catch { /* egal */ }
  return m;
}

function tone(freq, dur, delay = 0, type = "sine", gain = 0.15) {
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t0); o.stop(t0 + dur);
}

export function play(name) {
  if (typeof window === "undefined" || isMuted()) return;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    switch (name) {
      case "click": tone(880, 0.05); break;
      case "ok":    tone(660, 0.08); tone(880, 0.12, 0.07); break;
      case "err":   tone(160, 0.2, 0, "square", 0.12); break;
      case "tick":  tone(1200, 0.03, 0, "sine", 0.08); break;
      case "win":   tone(523, 0.12); tone(659, 0.12, 0.11); tone(784, 0.22, 0.22); break;
      case "lose":  tone(392, 0.15); tone(330, 0.28, 0.14); break;
    }
  } catch { /* Sound nie kritisch */ }
}
```

- [ ] **Step 2: `src/Confetti.jsx` anlegen:**

```jsx
import { useState } from "react";

const COLORS = ["#2DD4BF", "#FB7185", "#FACC15", "#60A5FA", "#F472B6"];
const makeParts = () => Array.from({ length: 40 }, (_, i) => ({
  left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2 + Math.random() * 2,
  color: COLORS[i % COLORS.length], size: 6 + Math.random() * 6, rot: Math.random() * 360,
}));

// Sieg-Konfetti: rein dekorativ, CSS-animiert, kein Pointer-Target.
export default function Confetti() {
  const [parts] = useState(makeParts);
  return (
    <div className="confetti">
      {parts.map((p, i) => (
        <span key={i} style={{ left: `${p.left}%`, background: p.color, width: p.size, height: p.size * 0.5,
          animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, transform: `rotate(${p.rot}deg)` }} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: CSS anhängen** (Ende von `src/styles.css`):

```css
/* ── Sounds & Micro-Animationen ─────────────────────────────────── */
.confetti { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 60; }
.confetti span { position: absolute; top: -20px; border-radius: 2px; animation: confettiFall linear forwards; }
@keyframes confettiFall { to { transform: translateY(105vh) rotate(720deg); opacity: .2; } }
@keyframes qlogIn { from { opacity: 0; transform: translateX(-14px); } to { opacity: 1; transform: none; } }
.qlogRow { animation: qlogIn .25s ease; }
@keyframes clockPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
.clock.low { animation: clockPulse 1s ease-in-out infinite; display: inline-block; }
@keyframes cellPop { 0% { transform: scale(.85); } 60% { transform: scale(1.06); } 100% { transform: scale(1); } }
.gcell.owned { animation: cellPop .25s ease; }
.btn:active:not(:disabled), .chip:active:not(:disabled), .cbItem:active:not(:disabled), .iconbtn:active { transform: scale(.96); }
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: `✓`.

- [ ] **Step 5: Commit**

```bash
git add src/sound.js src/Confetti.jsx src/styles.css
git commit -m "feat: WebAudio-Sounds (sound.js), Confetti, Animations-Keyframes"
```

---

## Task 2: Game.jsx (Hex)

**Files:**
- Modify: `src/Game.jsx`

- [ ] **Step 1: Importe.** Nach `import { loadPlayers } from "./playersStore.js";`:

```jsx
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
```

- [ ] **Step 2: Mute-State + End-Sound-Effect.** Nach `useEffect(() => { loadPlayers().then(setPlayers); }, []);` einfügen:

```jsx
  const [muted, setMuted] = useState(isMuted());
  const prevStatus = useRef(null);
```

Nach dem Timeout-Erkennungs-Effect (nach der Zeile `}, [now, status, row?.turn, myTurn, myPlayer, code]); // eslint-disable-line`) einfügen:

```jsx
  // End-Sound nur beim beobachteten Übergang playing -> finished (kein Replay bei Reload)
  useEffect(() => {
    if (prevStatus.current === "playing" && status === "finished" && myPlayer !== 0) {
      const w = clk.timeout ? (clk.timeout === 1 ? 2 : 1) : counts.a === counts.b ? 0 : counts.a > counts.b ? 1 : 2;
      if (w !== 0) play(w === myPlayer ? "win" : "lose");
    }
    prevStatus.current = status;
  }, [status]); // eslint-disable-line

  // Tick-Warnung in den letzten 10 Sekunden der eigenen Uhr
  useEffect(() => {
    if (status !== "playing" || !myTurn) return;
    const rem = liveRemaining(clk, myPlayer, now);
    if (rem > 0 && rem <= 10) play("tick");
  }, [now]); // eslint-disable-line
```

- [ ] **Step 3: Aktions-Sounds.**
  - In `pickHex` nach `setSelected(idx); …`-Zeile: `play("click");`
  - In `handleSubmit` im Nicht-passt-Zweig (vor `return;` nach `setLocalFeedback({ type: "err", text: \`${player.n} passt nicht …`): `play("err");`
  - In `handleSubmit` vor `writeMove({ owners: newOwners, …})`: `play("ok");`

- [ ] **Step 4: Mute-Button.** In der Topbar-`iconrow` vor dem Regeln-Button:

```jsx
          <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}>{muted ? "🔇" : "🔊"}</button>
```

- [ ] **Step 5: Konfetti.** Im Abpfiff-Overlay: `winnerNo` im Renderbereich (nach `const gameOver = status === "finished";`) berechnen und Konfetti einfügen:

```jsx
  const winnerNo = !gameOver ? 0 : clk.timeout ? (clk.timeout === 1 ? 2 : 1) : counts.a === counts.b ? 0 : counts.a > counts.b ? 1 : 2;
```

Im `{gameOver && (<div className="overlay">…` direkt nach `<div className="overlay">`:

```jsx
          {winnerNo !== 0 && winnerNo === myPlayer && <Confetti />}
```

- [ ] **Step 6: Commit**

```bash
git add src/Game.jsx
git commit -m "feat: Sounds, Mute & Sieg-Konfetti im Hex-Duell"
```

---

## Task 3: Grid.jsx (Raster)

**Files:**
- Modify: `src/Grid.jsx`

- [ ] **Step 1: Importe** (nach `import { loadPlayers } …`):

```jsx
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
```

- [ ] **Step 2: State/Effects.** Nach `useEffect(() => { loadPlayers().then(setPlayers); }, []);`:

```jsx
  const [muted, setMuted] = useState(isMuted());
  const prevStatus = useRef(null);
```

Nach dem Timeout-Effect (Zeile `}, [now, status, row?.turn, myTurn, myPlayer, code]); // eslint-disable-line`):

```jsx
  useEffect(() => {
    if (prevStatus.current === "playing" && status === "finished" && myPlayer !== 0) {
      const w = clk.timeout ? (clk.timeout === 1 ? 2 : 1)
        : (gridWinner(owners) || (Object.keys(owners).length === 9 ? (counts.a === counts.b ? 0 : counts.a > counts.b ? 1 : 2) : 0));
      if (w !== 0) play(w === myPlayer ? "win" : "lose");
    }
    prevStatus.current = status;
  }, [status]); // eslint-disable-line

  useEffect(() => {
    if (status !== "playing" || !myTurn) return;
    const rem = liveRemaining(clk, myPlayer, now);
    if (rem > 0 && rem <= 10) play("tick");
  }, [now]); // eslint-disable-line
```

- [ ] **Step 3: Aktions-Sounds.**
  - `pickCell`: nach der `setSelected(idx); …`-Zeile `play("click");`
  - `handleSubmit` Nicht-passt-Zweig (nach dem `setLocalFeedback({ type: "err", text: \`${player.n} passt nicht …`-Aufruf): `play("err");`
  - `handleSubmit` Erfolgspfad: vor `writeMove({ owners: newOwners, …})`: `play("ok");`
  - `skipTurn`: `play("click");` nach den setters.

- [ ] **Step 4: Mute-Button** in `iconrow` vor Regeln-Button (identisch zu Task 2 Step 4).

- [ ] **Step 5: Zellen-Pop + Konfetti.**
  - Zellen-Klasse: `className="gcell"` im Zellen-Button → `` className={`gcell ${o ? "owned" : ""}`} ``
  - Im Abpfiff-Overlay direkt nach `<div className="overlay">`:

```jsx
          {winner !== 0 && winner === myPlayer && <Confetti />}
```

(`winner` existiert dort bereits.)

- [ ] **Step 6: Commit**

```bash
git add src/Grid.jsx
git commit -m "feat: Sounds, Mute, Zellen-Pop & Konfetti im Raster-Duell"
```

---

## Task 4: Guess.jsx & Daily.jsx

**Files:**
- Modify: `src/Guess.jsx`, `src/Daily.jsx`

- [ ] **Step 1: `Guess.jsx` Importe** (nach `import { loadPlayers } …`):

```jsx
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
```

- [ ] **Step 2: `Guess.jsx` State/Effects.** Nach `useEffect(() => { loadPlayers().then(setPlayers); }, []);`:

```jsx
  const [muted, setMuted] = useState(isMuted());
  const prevStatus = useRef(null);
```

Nach dem Timeout-Effect:

```jsx
  useEffect(() => {
    if (prevStatus.current === "playing" && status === "finished" && myPlayer !== 0) {
      const w = clk.timeout ? (clk.timeout === 1 ? 2 : 1) : (row?.last_move?.winner || 0);
      if (w !== 0) play(w === myPlayer ? "win" : "lose");
    }
    prevStatus.current = status;
  }, [status]); // eslint-disable-line

  useEffect(() => {
    if (status !== "playing" || !myTurn) return;
    const rem = liveRemaining(clk, myPlayer, now);
    if (rem > 0 && rem <= 10) play("tick");
  }, [now]); // eslint-disable-line
```

- [ ] **Step 3: `Guess.jsx` Aktions-Sounds.**
  - In `ask` nach `const a = answerGuessQuestion(target, q);`: `play(a ? "ok" : "click");`
  - In `submitGuess` im falsch-Zweig (nach `setLocalFeedback({ type: "err", text: \`${player.n} ist falsch …`): `play("err");`
  - Mute-Button in `iconrow` (wie Task 2 Step 4).
  - Im „Aufgelöst"-Overlay nach `<div className="overlay">`: `{winner !== 0 && winner === myPlayer && <Confetti />}`

- [ ] **Step 4: `Daily.jsx` Importe:**

```jsx
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
```

- [ ] **Step 5: `Daily.jsx` Sounds + Mute + Konfetti** (kein Tick — keine Uhr; End-Sound direkt in den Handlern, nicht per Effect, da lokal entschieden):
  - Nach `useEffect(() => { loadPlayers().then(setPlayers); }, []);`: `const [muted, setMuted] = useState(isMuted());`
  - In `ask` nach `const a = answerGuessQuestion(target, { dim: dimKey, val });`: `play(a ? "ok" : "click");`
  - In `submitGuess` richtig-Zweig vor `save(...)`: `play("win");`
  - In `submitGuess` falsch-Zweig vor `save(...)`: `play(out ? "lose" : "err");`
  - In `giveUp` vor `save(...)`: `play("lose");`
  - Mute-Button in `iconrow` vor Regeln-Button (wie Task 2 Step 4).
  - Im End-Panel (`{game.done && (<div className="panel dailyEnd">`) direkt nach dem öffnenden Tag: `{game.won && <Confetti />}`

- [ ] **Step 6: Build + Tests**

Run: `npm run build` und `npm test`
Expected: `✓` / 37 PASS.

- [ ] **Step 7: Commit**

```bash
git add src/Guess.jsx src/Daily.jsx
git commit -m "feat: Sounds, Mute & Konfetti in Guess-Duell und Daily-Star"
```

---

## Task 5: Verifikation & Abschluss

- [ ] **Step 1:** `npm test` (37 grün) + `npm run build` (`✓`).
- [ ] **Step 2:** Manuell: Mute-Toggle persistiert über Reload; click/ok/err/tick/win/lose an den richtigen Stellen; Konfetti nur beim Gewinner bzw. Daily-Sieg; qlog-Slide-in, Uhr-Puls ≤ 30 s, Zellen-Pop im Raster, Button-Scale.
- [ ] **Step 3:** `superpowers:finishing-a-development-branch` — Push + PR via GitHub-API, mergen auf Zuruf.

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** sound.js (A) → Task 1; Integration Game/Grid/Guess/Daily inkl. Tick, End-Übergangs-Guard, Mute-Toggle (B) → Tasks 2–4; Confetti + CSS-Animationen (C) → Task 1 + Einbindung in 2–4; Edge Cases (suspended ctx, No-op ohne window, kein Replay bei Reload) → sound.js-Guards + prevStatus-Ref. Keine Lücke. (Hex-Zellen-Pop existiert bereits als `justClaimed`-Animation — bewusst nicht doppelt.)
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** `play/isMuted/toggleMute` einheitlich; Sound-Namen `click|ok|err|tick|win|lose` überall identisch; `winner`-Berechnungen entsprechen der jeweils vorhandenen Overlay-Logik der Datei.
