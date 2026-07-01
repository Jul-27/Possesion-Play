# „Daily-Star" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tägliches Solo-Rätsel „Daily-Star": weltweit identischer geheimer Star pro Tag (Datums-Seed), max. 8 Attributfragen + 2 Tipps, Emoji-Share und Streaks — komplett ohne Backend.

**Architecture:** Reine, getestete Logik in `src/dailyLogic.js` (Seed/PRNG, #N, Streaks, Share-Text); `gameData.js` exportiert den Guess-Kandidatenfilter als `guessEligibleIndices`; neue Solo-Komponente `Daily.jsx` (Bedienung wie `Guess.jsx`, aber localStorage statt Supabase); Routing über `?daily=1`, Daily-Kachel in der Lobby.

**Tech Stack:** Vite + React 18, localStorage, Tests `node:test` (`npm test`).

---

## File Structure

- `src/dailyLogic.js` — **create**: Konstanten, Datum/#N, Seeded-Auswahl, Streaks, Share-Text.
- `src/dailyLogic.test.js` — **create**: Tests dafür.
- `src/gameData.js` — **modify**: `guessEligibleIndices` extrahieren.
- `src/Daily.jsx` — **create**: Solo-Spielansicht.
- `src/App.jsx` — **modify**: `?daily`-Routing.
- `src/Lobby.jsx` — **modify**: Daily-Kachel.
- `src/styles.css` — **modify**: Kachel-/Zähler-/Endpanel-Stile.

---

## Task 1: `guessEligibleIndices` in `gameData.js` (TDD)

**Files:**
- Modify: `src/gameData.js`
- Modify: `src/gameData.test.js`

- [ ] **Step 1: Test schreiben.** Am Ende von `src/gameData.test.js` anhängen:

```js
import { guessEligibleIndices } from "./gameData.js";

test("guessEligibleIndices filtert auf pos+nat+clubs+sl>=GUESS_SL_MIN", () => {
  const list = [
    { pos: "ST", nat: ["GER"], clubs: ["FCB"], sl: 50 },  // ok
    { pos: null, nat: ["GER"], clubs: ["FCB"], sl: 50 },  // keine Position
    { pos: "MF", nat: [], clubs: ["FCB"], sl: 50 },       // keine Nation
    { pos: "MF", nat: ["GER"], clubs: [], sl: 50 },       // kein Verein
    { pos: "MF", nat: ["GER"], clubs: ["FCB"], sl: 10 },  // zu unbekannt
    { pos: "TW", nat: ["ESP"], clubs: ["BAR"], sl: 40 },  // ok (Grenze)
  ];
  assert.deepEqual(guessEligibleIndices(list), [0, 5]);
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag prüfen**

Run: `npm test`
Expected: FAIL — `guessEligibleIndices` „is not exported by ./gameData.js".

- [ ] **Step 3: Implementieren.** In `src/gameData.js` die Funktion `buildGuessSerial`

```js
export function buildGuessSerial(players) {
  const eligible = [];
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.pos && (p.nat || []).length && (p.clubs || []).length && (p.sl || 0) >= GUESS_SL_MIN) eligible.push(i);
  }
  const pool = eligible.length ? eligible : players.map((_, i) => i);
  const idx = pool[Math.floor(Math.random() * pool.length)];
  return { kind: "guess", tgt: encodeTarget(idx) };
}
```

ersetzen durch:

```js
// Indizes aller Spieler, die als Guess-/Daily-Ziel taugen (vollständige Daten + bekannt).
export function guessEligibleIndices(players) {
  const out = [];
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (p.pos && (p.nat || []).length && (p.clubs || []).length && (p.sl || 0) >= GUESS_SL_MIN) out.push(i);
  }
  return out;
}

export function buildGuessSerial(players) {
  const eligible = guessEligibleIndices(players);
  const pool = eligible.length ? eligible : players.map((_, i) => i);
  const idx = pool[Math.floor(Math.random() * pool.length)];
  return { kind: "guess", tgt: encodeTarget(idx) };
}
```

- [ ] **Step 4: Tests ausführen**

Run: `npm test`
Expected: PASS (27 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/gameData.js src/gameData.test.js
git commit -m "refactor: guessEligibleIndices aus buildGuessSerial extrahiert"
```

---

## Task 2: `dailyLogic.js` (TDD)

**Files:**
- Create: `src/dailyLogic.js`
- Create: `src/dailyLogic.test.js`

- [ ] **Step 1: Tests schreiben.** `src/dailyLogic.test.js` erstellen:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { GUESS_SL_MIN } from "./gameData.js";
import {
  DAILY_EPOCH, DAILY_MAX_Q, DAILY_MAX_G,
  dailyDateStr, dailyNumber, dailyStarIndex, updateStreak, buildShareText,
} from "./dailyLogic.js";

test("Konstanten & dailyNumber", () => {
  assert.equal(DAILY_MAX_Q, 8);
  assert.equal(DAILY_MAX_G, 2);
  assert.equal(dailyNumber(DAILY_EPOCH), 0);
  assert.equal(dailyNumber("2026-07-01"), 1);
  assert.equal(dailyNumber("2026-07-31"), 31);
});

test("dailyDateStr formatiert lokal als YYYY-MM-DD", () => {
  assert.equal(dailyDateStr(new Date(2026, 6, 1)), "2026-07-01");
  assert.equal(dailyDateStr(new Date(2026, 0, 5)), "2026-01-05");
});

test("dailyStarIndex: deterministisch, variiert über Tage, erfüllt Filter", async () => {
  const { PLAYERS } = await import("./players.js");
  const a = dailyStarIndex("2026-07-01", PLAYERS);
  const b = dailyStarIndex("2026-07-01", PLAYERS);
  assert.equal(a, b);
  const days = Array.from({ length: 10 }, (_, i) => `2026-07-${String(i + 1).padStart(2, "0")}`);
  const idxs = new Set(days.map((d) => dailyStarIndex(d, PLAYERS)));
  assert.ok(idxs.size > 3, "zu wenig Variation über 10 Tage");
  const p = PLAYERS[a];
  assert.ok(p.pos && p.nat.length && p.clubs.length && (p.sl || 0) >= GUESS_SL_MIN);
});

test("updateStreak: Folgetag-Sieg, Lücke, Niederlage", () => {
  let s = updateStreak(null, "2026-07-01", true);
  assert.deepEqual(s, { played: 1, wins: 1, streak: 1, maxStreak: 1, last: "2026-07-01" });
  s = updateStreak(s, "2026-07-02", true);          // Folgetag
  assert.equal(s.streak, 2);
  assert.equal(s.maxStreak, 2);
  s = updateStreak(s, "2026-07-05", true);          // Lücke -> reset auf 1
  assert.equal(s.streak, 1);
  assert.equal(s.maxStreak, 2);
  s = updateStreak(s, "2026-07-06", false);         // Niederlage -> 0
  assert.deepEqual([s.streak, s.played, s.wins], [0, 4, 3]);
});

test("buildShareText: gewonnen und verloren", () => {
  const wonLog = [{ dim: "nat" }, { dim: "club" }, { guess: "X", wrong: true }, { dim: "pos" }, { guess: "Y", correct: true }];
  assert.equal(
    buildShareText(12, wonLog, true, "https://x.y?daily=1"),
    "Daily-Star #12 ⭐\n🟦🟦❌🟦⭐\nhttps://x.y?daily=1"
  );
  const lostLog = [{ dim: "nat" }, { guess: "X", wrong: true }, { guess: "Z", wrong: true }];
  assert.equal(
    buildShareText(3, lostLog, false, "https://x.y?daily=1"),
    "Daily-Star #3 💀\n🟦❌❌💀\nhttps://x.y?daily=1"
  );
});
```

- [ ] **Step 2: Tests ausführen, Fehlschlag prüfen**

Run: `npm test`
Expected: FAIL — Modul `./dailyLogic.js` nicht gefunden.

- [ ] **Step 3: `src/dailyLogic.js` erstellen:**

```js
/* Daily-Star — reine Logik (kein React, kein Netzwerk).
   Determinismus: gleiches Datum + gleiche players.js ⇒ gleicher Star für alle. */
import { guessEligibleIndices } from "./gameData.js";

export const DAILY_EPOCH = "2026-06-30"; // Daily #1 = 2026-07-01
export const DAILY_MAX_Q = 8;            // max. Attributfragen
export const DAILY_MAX_G = 2;            // max. finale Tipps

// Lokales Datum als "YYYY-MM-DD" (Tageswechsel um lokale Mitternacht, wie Wordle).
export function dailyDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Laufende Nummer: Tagesdifferenz zur Epoche (beide via Date.parse = UTC-Mitternacht).
export function dailyNumber(dateStr) {
  return Math.round((Date.parse(dateStr) - Date.parse(DAILY_EPOCH)) / 86400000);
}

function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Index des Tages-Stars: Seeded-Zug aus dem Guess-Kandidatenpool.
export function dailyStarIndex(dateStr, players) {
  const pool = guessEligibleIndices(players);
  const list = pool.length ? pool : players.map((_, i) => i);
  const rnd = mulberry32(hashStr("daily:" + dateStr));
  return list[Math.floor(rnd() * list.length)];
}

// Streak zählt weiter, wenn der letzte gespielte Tag genau der Vortag war.
export function updateStreak(stats, dateStr, won) {
  const s = stats || {};
  const cont = s.last != null && dailyNumber(dateStr) === dailyNumber(s.last) + 1;
  const streak = won ? (cont ? (s.streak || 0) + 1 : 1) : 0;
  return {
    played: (s.played || 0) + 1,
    wins: (s.wins || 0) + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(s.maxStreak || 0, streak),
    last: dateStr,
  };
}

// Share-Zeilen: Frage 🟦, Fehltipp ❌, Treffer ⭐; Niederlage endet mit 💀.
export function buildShareText(num, log, won, url) {
  const emojis = log.map((e) => (e.dim ? "🟦" : e.correct ? "⭐" : "❌")).join("");
  return `Daily-Star #${num} ${won ? "⭐" : "💀"}\n${emojis}${won ? "" : "💀"}\n${url}`;
}
```

- [ ] **Step 4: Tests ausführen**

Run: `npm test`
Expected: PASS (32 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/dailyLogic.js src/dailyLogic.test.js
git commit -m "feat: dailyLogic — Seed-Auswahl, #N, Streaks, Share-Text (getestet)"
```

---

## Task 3: Komponente `Daily.jsx`

**Files:**
- Create: `src/Daily.jsx`

- [ ] **Step 1: Komponente anlegen.** `src/Daily.jsx` mit folgendem Inhalt erstellen:

```jsx
import { useState, useEffect, useMemo, useRef } from "react";
import {
  P, norm, suggestPlayers, NATIONS, CLUBS, LEAGUES, HONOURS, POS_LABEL,
  answerGuessQuestion, guessQuestionLabel,
} from "./gameData.js";
import {
  DAILY_MAX_Q, DAILY_MAX_G, dailyDateStr, dailyNumber, dailyStarIndex,
  updateStreak, buildShareText,
} from "./dailyLogic.js";
import { loadPlayers } from "./playersStore.js";

const sigOf = (dim, val) => (dim === "born" ? `born:${val.cmp}:${val.year}` : `${dim}:${val}`);

const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Persistenz weiterspielen */ } },
};

// Tipp-Filter-Combobox über eine Def-Liste (Nation/Verein) — wie im Guess-Duell.
function Combo({ options, placeholder, dimKey, asked, onPick }) {
  const [q, setQ] = useState("");
  const res = useMemo(() => {
    const nq = norm(q.trim());
    const base = nq ? options.filter((o) => norm(o.name).includes(nq) || norm(o.label).includes(nq)) : options;
    return base.slice(0, 12);
  }, [q, options]);
  return (
    <div>
      <input className="field" placeholder={placeholder} value={q} autoComplete="off" onChange={(e) => setQ(e.target.value)} />
      <div className="cbList">
        {res.map((o) => {
          const used = asked.has(sigOf(dimKey, o.key));
          return (
            <button key={o.key} className="cbItem" disabled={used} onClick={() => onPick(o.key)}>
              {o.name} <span className="cbMeta">{used ? "gefragt" : o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Daily({ onLeave }) {
  const [players, setPlayers] = useState(null);
  const dateStr = useMemo(() => dailyDateStr(), []);
  const num = useMemo(() => dailyNumber(dateStr), [dateStr]);
  const storeKey = `pp:daily:${dateStr}`;
  const [game, setGame] = useState(() => store.get(storeKey) || { log: [], done: false, won: false });
  const [act, setAct] = useState("ask");
  const [dim, setDim] = useState(null);
  const [yearInput, setYearInput] = useState("2000");
  const [nameInput, setNameInput] = useState("");
  const [chosen, setChosen] = useState(null);
  const [sugOpen, setSugOpen] = useState(false);
  const [sugActive, setSugActive] = useState(-1);
  const [feedback, setFeedback] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [now, setNow] = useState(Date.now());
  const inputRef = useRef(null);

  useEffect(() => { loadPlayers().then(setPlayers); }, []);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);

  const target = useMemo(() => (players ? players[dailyStarIndex(dateStr, players)] : null), [players, dateStr]);
  const log = game.log;
  const questionsUsed = log.filter((e) => e.dim).length;
  const guessesUsed = log.filter((e) => !e.dim).length;
  const askedSigs = useMemo(() => new Set(log.filter((e) => e.dim).map((e) => sigOf(e.dim, e.val))), [log]);
  const suggestions = useMemo(() => (players ? suggestPlayers(players, nameInput, 8) : []), [players, nameInput]);

  // Countdown bis lokale Mitternacht
  const nextMid = new Date(); nextMid.setHours(24, 0, 0, 0);
  const minsLeft = Math.max(0, Math.floor((nextMid.getTime() - now) / 60000));
  const countdown = `${Math.floor(minsLeft / 60)} h ${minsLeft % 60} min`;

  function save(next) {
    setGame(next);
    store.set(storeKey, next);
    if (next.done && !game.done) store.set("pp:dailyStats", updateStreak(store.get("pp:dailyStats"), dateStr, next.won));
  }

  function ask(dimKey, val) {
    if (game.done || !target || questionsUsed >= DAILY_MAX_Q) return;
    if (askedSigs.has(sigOf(dimKey, val))) { setFeedback({ type: "info", text: "Diese Frage wurde schon gestellt." }); return; }
    const a = answerGuessQuestion(target, { dim: dimKey, val });
    setDim(null); setFeedback(null);
    save({ ...game, log: [...log, { dim: dimKey, val, a }] });
  }

  function askBorn(cmp) {
    const year = parseInt(yearInput, 10);
    if (!Number.isFinite(year) || year < 1900 || year > new Date().getFullYear()) {
      setFeedback({ type: "err", text: "Bitte ein gültiges Jahr eingeben." });
      return;
    }
    ask("born", { cmp, year });
  }

  function submitGuess() {
    if (game.done || !target || guessesUsed >= DAILY_MAX_G) return;
    let player = chosen;
    if (!player) {
      const q = norm(nameInput.trim());
      const hits = (players || []).filter((p) => norm(p.n) === q || norm(p.ln) === q);
      if (hits.length === 1) player = hits[0];
    }
    if (!player) { setFeedback({ type: "err", text: "Bitte einen Spieler aus der Vorschlagsliste wählen." }); return; }
    setNameInput(""); setChosen(null); setSugOpen(false);
    if (player === target) {
      save({ ...game, log: [...log, { guess: player.n, correct: true }], done: true, won: true });
    } else {
      const newLog = [...log, { guess: player.n, wrong: true }];
      const out = guessesUsed + 1 >= DAILY_MAX_G;
      setFeedback(out ? null : { type: "err", text: `${player.n} ist falsch — letzter Tipp!` });
      save({ ...game, log: newLog, done: out, won: false });
    }
  }

  function giveUp() {
    if (game.done) return;
    save({ ...game, done: true, won: false });
  }

  function share() {
    const url = `${window.location.origin}${window.location.pathname}?daily=1`;
    const text = buildShareText(num, log, game.won, url);
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  function chooseSug(p) { setChosen(p); setNameInput(p.n); setSugOpen(false); setSugActive(-1); inputRef.current?.focus(); }
  function onInputKey(e) {
    if (sugOpen && suggestions.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSugActive((i) => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSugActive((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" && sugActive >= 0) { e.preventDefault(); chooseSug(suggestions[sugActive]); return; }
      if (e.key === "Escape") { setSugOpen(false); return; }
    }
    if (e.key === "Enter") submitGuess();
  }

  const stats = store.get("pp:dailyStats");
  const noQLeft = questionsUsed >= DAILY_MAX_Q;
  const DIMS = [
    { k: "nat", label: "Nation" }, { k: "club", label: "Verein" }, { k: "league", label: "Liga" },
    { k: "pos", label: "Position" }, { k: "title", label: "Titel" }, { k: "born", label: "Geburtsjahr" },
  ];

  return (
    <div className="ppRoot">
      <div className="topbar">
        <div><h1 className="title">POSSESSION PLAY</h1><div className="subtitle">🌟 Daily-Star #{num}</div></div>
        <div className="iconrow">
          <button className="iconbtn" title="Regeln" onClick={() => setShowRules(true)}>?</button>
          <button className="iconbtn" title="Zur Lobby" onClick={onLeave}>⏏</button>
        </div>
      </div>

      <div className="dailyMeta">
        <span className={`dailyCount ${noQLeft ? "spent" : ""}`}>Fragen {questionsUsed}/{DAILY_MAX_Q}</span>
        <span className={`dailyCount ${guessesUsed >= DAILY_MAX_G ? "spent" : ""}`}>Tipps {guessesUsed}/{DAILY_MAX_G}</span>
      </div>

      <div className="qlog">
        {log.length === 0 && <div className="qlogEmpty">Wer ist der Star des Tages? Stelle deine erste Frage.</div>}
        {log.map((e, i) => (
          <div key={i} className="qlogRow">
            {e.dim ? (
              <>
                <span className="qlogText">{guessQuestionLabel({ dim: e.dim, val: e.val })}</span>
                <span className={`qlogAns ${e.a ? "yes" : "no"}`}>{e.a ? "Ja" : "Nein"}</span>
              </>
            ) : (
              <span className="qlogText">Tipp: <b>{e.guess}</b> {e.correct ? "✓ richtig" : "✗ falsch"}</span>
            )}
          </div>
        ))}
      </div>

      {!game.done && (
        <div className="panel">
          <div className="inrow" style={{ marginBottom: 10 }}>
            <button className={`btn ${act === "ask" ? "primary" : "ghost"}`} style={{ flex: 1 }} onClick={() => { setAct("ask"); setDim(null); }} disabled={noQLeft}>Frage stellen</button>
            <button className={`btn ${act === "guess" ? "primary" : "ghost"}`} style={{ flex: 1 }} onClick={() => setAct("guess")}>Tippen</button>
          </div>

          {act === "ask" && !noQLeft ? (
            !players ? <div className="qlogEmpty">Lade Spielerdaten…</div> : (
              <>
                <div className="chiprow">
                  {DIMS.map((d) => (
                    <button key={d.k} className={`chip ${dim === d.k ? "on" : ""}`} onClick={() => setDim(d.k)}>{d.label}</button>
                  ))}
                </div>
                {dim === "nat" && <Combo options={NATIONS} placeholder="Nation tippen…" dimKey="nat" asked={askedSigs} onPick={(k) => ask("nat", k)} />}
                {dim === "club" && <Combo options={CLUBS} placeholder="Verein tippen…" dimKey="club" asked={askedSigs} onPick={(k) => ask("club", k)} />}
                {dim === "league" && (
                  <div className="chiprow">
                    {LEAGUES.map((l) => <button key={l.key} className="chip" disabled={askedSigs.has(sigOf("league", l.key))} onClick={() => ask("league", l.key)}>{l.name}</button>)}
                  </div>
                )}
                {dim === "pos" && (
                  <div className="chiprow">
                    {Object.entries(POS_LABEL).map(([k, lbl]) => <button key={k} className="chip" disabled={askedSigs.has(sigOf("pos", k))} onClick={() => ask("pos", k)}>{lbl}</button>)}
                  </div>
                )}
                {dim === "title" && (
                  <div className="chiprow">
                    {HONOURS.map((h) => <button key={h.key} className="chip" disabled={askedSigs.has(sigOf("title", h.key))} onClick={() => ask("title", h.key)}>{h.icon} {h.name}</button>)}
                  </div>
                )}
                {dim === "born" && (
                  <div className="inrow">
                    <input className="field" type="number" min="1900" max="2025" value={yearInput} onChange={(e) => setYearInput(e.target.value)} />
                    <button className="btn ghost" onClick={() => askBorn("before")}>vor</button>
                    <button className="btn ghost" onClick={() => askBorn("after")}>ab</button>
                  </div>
                )}
              </>
            )
          ) : (
            <div className="inrow">
              <div className="inwrap">
                <input ref={inputRef} className="field"
                  placeholder={players ? "Spielernamen tippen…" : "Lade Spielerdaten…"}
                  disabled={!players} value={nameInput} autoComplete="off"
                  onChange={(e) => { setNameInput(e.target.value); setChosen(null); setSugOpen(true); setSugActive(-1); }}
                  onKeyDown={onInputKey} onBlur={() => setTimeout(() => setSugOpen(false), 120)} onFocus={() => setSugOpen(true)} />
                {sugOpen && suggestions.length > 0 && (
                  <div className="sug">
                    {suggestions.map((s, i) => (
                      <div key={s.n} className={`sugItem ${i === sugActive ? "active" : ""}`} onMouseDown={(e) => { e.preventDefault(); chooseSug(s); }}>
                        <span>{s.n}</span>
                        <span className="sugMeta">{[s.pos, new Date().getFullYear() - s.by].filter(Boolean).join(" · ")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn primary" disabled={!chosen && !nameInput.trim()} onClick={submitGuess}>Tippen</button>
            </div>
          )}
          <div className="minirow"><button className="btn ghost" onClick={giveUp}>Auflösen (aufgeben)</button></div>
        </div>
      )}

      {feedback && (<div className={`fb ${feedback.type}`}>{feedback.text}</div>)}

      {game.done && (
        <div className="panel dailyEnd">
          <h2 style={{ marginTop: 0 }}>{game.won ? "⭐ Gefunden!" : "💀 Nicht erwischt"}</h2>
          <p>Der Star des Tages: <b>{target ? target.n : "…"}</b></p>
          {stats && (
            <div className="dailyStats">
              <span><b>{stats.played}</b> gespielt</span>
              <span><b>{Math.round((stats.wins / Math.max(1, stats.played)) * 100)}%</b> gewonnen</span>
              <span><b>{stats.streak}</b> Serie</span>
              <span><b>{stats.maxStreak}</b> Rekord</span>
            </div>
          )}
          <div className="closeline">
            <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={share}>{copied ? "Kopiert ✓" : "Ergebnis teilen"}</button>
            <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Zur Lobby</button>
          </div>
          <p className="dailyNext">Nächster Star in {countdown}</p>
        </div>
      )}

      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Daily-Star</h2>
            <p className="ruleP">Jeden Tag ein <b>geheimer Star</b> — für alle Spieler weltweit derselbe.</p>
            <p className="ruleP">Du hast <b>{DAILY_MAX_Q} Attributfragen</b> (Nation, Verein, Liga, Position, Titel, Geburtsjahr) und <b>{DAILY_MAX_G} Tipps</b>.</p>
            <p className="ruleP">Errätst du ihn, wächst deine <b>Serie</b> — teile dein Ergebnis!</p>
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit** (Build erst nach Task 4, wenn Routing/Styles stehen)

```bash
git add src/Daily.jsx
git commit -m "feat: Daily.jsx — tägliches Solo-Rätsel (8 Fragen, 2 Tipps, Share, Streak)"
```

---

## Task 4: Routing, Lobby-Kachel & Styles

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/Lobby.jsx`
- Modify: `src/styles.css`

- [ ] **Step 1: `App.jsx` — `?daily`-Routing.** Import ergänzen und Routing erweitern. Die Zeile

```jsx
import Guess from "./Guess.jsx";
```

ersetzen durch:

```jsx
import Guess from "./Guess.jsx";
import Daily from "./Daily.jsx";
```

Die Funktion `codeFromUrl` um einen Daily-Check ergänzen — direkt darunter einfügen:

```jsx
function dailyFromUrl() {
  return new URLSearchParams(window.location.search).get("daily") != null;
}
```

In `App()` den State und die Handler erweitern. Den Block

```jsx
export default function App() {
  const [code, setCode] = useState(codeFromUrl());
  const clientId = getClientId();

  useEffect(() => {
    const onPop = () => setCode(codeFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function enter(c) {
    const url = `${window.location.pathname}?game=${c}`;
    window.history.pushState({}, "", url);
    setCode(c);
  }
  function leave() {
    window.history.pushState({}, "", window.location.pathname);
    setCode(null);
  }

  return code
    ? <GameRouter code={code} clientId={clientId} onLeave={leave} />
    : <Lobby onEnter={enter} />;
}
```

ersetzen durch:

```jsx
export default function App() {
  const [code, setCode] = useState(codeFromUrl());
  const [daily, setDaily] = useState(dailyFromUrl());
  const clientId = getClientId();

  useEffect(() => {
    const onPop = () => { setCode(codeFromUrl()); setDaily(dailyFromUrl()); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function enter(c) {
    const url = `${window.location.pathname}?game=${c}`;
    window.history.pushState({}, "", url);
    setDaily(false); setCode(c);
  }
  function enterDaily() {
    window.history.pushState({}, "", `${window.location.pathname}?daily=1`);
    setCode(null); setDaily(true);
  }
  function leave() {
    window.history.pushState({}, "", window.location.pathname);
    setCode(null); setDaily(false);
  }

  if (daily) return <Daily onLeave={leave} />;
  return code
    ? <GameRouter code={code} clientId={clientId} onLeave={leave} />
    : <Lobby onEnter={enter} onDaily={enterDaily} />;
}
```

- [ ] **Step 2: `Lobby.jsx` — Daily-Kachel.** Import ergänzen (nach der `loadPlayers`-Zeile):

```jsx
import { dailyDateStr, dailyNumber } from "./dailyLogic.js";
```

Signatur ändern:

```jsx
export default function Lobby({ onEnter, onDaily }) {
```

Direkt nach `<div className="subtitle">Hex-Duell · Online gegen einen Freund</div>` einfügen:

```jsx
      <DailyCard onDaily={onDaily} />
```

Und am Dateiende (nach der `Lobby`-Funktion) die Kachel-Komponente ergänzen:

```jsx
function DailyCard({ onDaily }) {
  const dateStr = dailyDateStr();
  let state = null;
  try { state = JSON.parse(localStorage.getItem(`pp:daily:${dateStr}`) || "null"); } catch { /* egal */ }
  const badge = state?.done ? (state.won ? "✓ gelöst" : "✗ vorbei") : "heute offen";
  return (
    <button className="dailyCard" onClick={onDaily}>
      <span className="dailyCardIcon">🌟</span>
      <span className="dailyCardText">
        <b>Daily-Star #{dailyNumber(dateStr)}</b>
        <small>Das tägliche Rätsel — solo, für alle gleich</small>
      </span>
      <span className={`dailyBadge ${state?.done ? (state.won ? "won" : "lost") : ""}`}>{badge}</span>
    </button>
  );
}
```

- [ ] **Step 3: Styles.** Am Ende von `src/styles.css` anhängen:

```css
/* ── Daily-Star ────────────────────────────────────────────────── */
.dailyCard { display: flex; align-items: center; gap: 12px; width: 100%; margin-top: 18px; padding: 14px 16px; background: linear-gradient(150deg, rgba(250,204,21,.14), rgba(10,22,19,.6)); border: 1px solid rgba(250,204,21,.35); border-radius: 14px; color: #f3efdc; cursor: pointer; text-align: left; }
.dailyCard:hover { border-color: #FACC15; }
.dailyCardIcon { font-size: 26px; }
.dailyCardText { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.dailyCardText small { color: #b9c9b9; font-size: 12px; }
.dailyBadge { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: rgba(250,204,21,.15); color: #FACC15; }
.dailyBadge.won { background: rgba(45,212,191,.18); color: #2DD4BF; }
.dailyBadge.lost { background: rgba(251,113,133,.18); color: #FB7185; }
.dailyMeta { display: flex; gap: 10px; margin-top: 12px; }
.dailyCount { font-size: 13px; font-weight: 700; padding: 5px 12px; border-radius: 999px; background: rgba(10,22,19,.6); border: 1px solid rgba(255,255,255,.12); color: #d7ece3; }
.dailyCount.spent { color: #FB7185; border-color: rgba(251,113,133,.4); }
.dailyEnd { text-align: center; }
.dailyStats { display: flex; justify-content: center; gap: 18px; margin: 10px 0 14px; color: #b9c9b9; font-size: 13px; }
.dailyStats b { display: block; font-size: 18px; color: #fff; }
.dailyNext { color: #7fa093; font-size: 13px; margin-top: 10px; }
```

- [ ] **Step 4: Build + Tests**

Run: `npm run build` (Expected: `✓`, players-Chunk getrennt) und `npm test` (Expected: PASS).

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/Lobby.jsx src/styles.css
git commit -m "feat: Daily-Routing (?daily=1), Lobby-Kachel & Styles"
```

---

## Task 5: Verifikation & Abschluss

**Files:** keine

- [ ] **Step 1: Volltest**

Run: `npm test` (Expected: 32 Tests grün) und `npm run build` (Expected: `✓`; `players-*.js` weiterhin eigener Chunk).

- [ ] **Step 2: Manueller Smoke-Test (falls Dev-Umgebung verfügbar)**

`npm run dev`: Lobby zeigt Daily-Kachel mit #N; Klick → Daily; Fragen aller Dimensionen; Reload mitten im Spiel setzt fort; Fehltipp verbraucht Tipp; 2. Fehltipp/Aufgeben löst auf; Sieg zeigt Stats + Share-Text (Clipboard); `?daily=1`-Deeplink funktioniert; nach Mitternacht (Datum simulieren) neues Rätsel.

- [ ] **Step 3: Abschluss** — `superpowers:finishing-a-development-branch` (Push + PR via GitHub-API, mergen auf Zuruf).

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** `dailyLogic.js` (Epoche, #N, Seed/PRNG, Streaks, Share) → Task 2; `guessEligibleIndices`-Extraktion → Task 1; `Daily.jsx` (8/2-Budget, Protokoll, Persistenz `pp:daily:<date>` + `pp:dailyStats`, Aufgeben, End-Panel mit Stats/Share/Countdown, Lazy-Load) → Task 3; Routing `?daily=1` + Lobby-Kachel mit Badge + Styles → Task 4; Tests/Build/manuell → Tasks 1/2/5. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** Log-Einträge identisch zum Guess-Duell (`{dim,val,a}` / `{guess, correct|wrong}`) — `buildShareText` konsumiert exakt diese Form; `updateStreak`-Shape `{played,wins,streak,maxStreak,last}` in Daily.jsx (Stats-Anzeige) identisch; `dailyStarIndex(dateStr, players)`-Signatur in Test, Daily.jsx konsistent; localStorage-Keys `pp:daily:<dateStr>` in Daily.jsx und Lobby-Kachel identisch.
