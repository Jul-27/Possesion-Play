# „Errate den Star" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dritter Spielmodus „Errate den Star" — 1v1-Deduktionsduell: Engine zieht einen geheimen, bekannten Spieler; beide jagen ihn über deterministische Ja/Nein-Attributfragen und tippen schließlich.

**Architecture:** Reine Engine-Funktionen in `gameData.js` (answer/label/build/encode/decode/check), neuer Board-Typ `{kind:"guess", tgt}`, Q&A-Protokoll in `last_move.log`, neue Komponente `Guess.jsx` (Muster wie `Grid.jsx`: Supabase-Subscription, `turn`, 4:00-Schachuhr). Vertrauensbasiert (Ziel client-seitig aufgelöst), keine DB-Migration.

**Tech Stack:** Vite + React 18, Supabase Realtime, Tests `node:test` (`npm test`).

---

## File Structure

- `src/gameData.js` — **modify**: Engine-Funktionen + Konstanten (`GUESS_SL_MIN`, `POS_LABEL`).
- `src/gameData.test.js` — **modify**: Tests der Engine-Funktionen.
- `src/Guess.jsx` — **create**: Spielkomponente inkl. Tipp-Filter-Combobox.
- `src/App.jsx` — **modify**: Routing `{kind:"guess"}` → `Guess.jsx`.
- `src/Lobby.jsx` — **modify**: dritter Modus + `createGame`-Verzweigung; Bugfix `buildGridSerial`.
- `src/Grid.jsx` — **modify**: Bugfix `newGame` (`buildGridSerial(players)`).
- `src/styles.css` — **modify**: Stile für Protokoll, Dimensions-Chips, Combobox.

---

## Task 1: Engine-Funktionen in `gameData.js` (TDD)

**Files:**
- Modify: `src/gameData.js`
- Modify: `src/gameData.test.js`

- [ ] **Step 1: Tests schreiben.** Am Ende von `src/gameData.test.js` anhängen:

```js
import {
  answerGuessQuestion, guessQuestionLabel, buildGuessSerial,
  encodeTarget, decodeTarget, checkGuess, GUESS_SL_MIN,
} from "./gameData.js";

const STAR = { n: "Lionel Messi", ln: "Messi", by: 1987, nat: ["ARG"], clubs: ["BAR", "PSG"], t: ["CL", "WM"], sl: 219, pos: "ST" };

test("answerGuessQuestion: nat / club / league / pos / title", () => {
  assert.equal(answerGuessQuestion(STAR, { dim: "nat", val: "ARG" }), true);
  assert.equal(answerGuessQuestion(STAR, { dim: "nat", val: "ESP" }), false);
  assert.equal(answerGuessQuestion(STAR, { dim: "club", val: "BAR" }), true);
  assert.equal(answerGuessQuestion(STAR, { dim: "club", val: "MUN" }), false);
  assert.equal(answerGuessQuestion(STAR, { dim: "league", val: "LL" }), true); // BAR -> LL
  assert.equal(answerGuessQuestion(STAR, { dim: "league", val: "BL" }), false);
  assert.equal(answerGuessQuestion(STAR, { dim: "pos", val: "ST" }), true);
  assert.equal(answerGuessQuestion(STAR, { dim: "pos", val: "TW" }), false);
  assert.equal(answerGuessQuestion(STAR, { dim: "title", val: "CL" }), true);
  assert.equal(answerGuessQuestion(STAR, { dim: "title", val: "FAC" }), false);
});

test("answerGuessQuestion: born vor/ab inkl. Grenzjahr", () => {
  assert.equal(answerGuessQuestion(STAR, { dim: "born", val: { cmp: "before", year: 1990 } }), true);
  assert.equal(answerGuessQuestion(STAR, { dim: "born", val: { cmp: "after", year: 1990 } }), false);
  assert.equal(answerGuessQuestion(STAR, { dim: "born", val: { cmp: "after", year: 1987 } }), true); // by >= year
  assert.equal(answerGuessQuestion(STAR, { dim: "born", val: { cmp: "before", year: 1987 } }), false);
});

test("answerGuessQuestion: fehlende Felder = false", () => {
  assert.equal(answerGuessQuestion({}, { dim: "title", val: "CL" }), false);
  assert.equal(answerGuessQuestion({}, { dim: "club", val: "BAR" }), false);
});

test("encodeTarget/decodeTarget Roundtrip", () => {
  for (const i of [0, 1, 50, 123, 27450]) assert.equal(decodeTarget(encodeTarget(i)), i);
});

test("checkGuess vergleicht Index", () => {
  const t = encodeTarget(50);
  assert.equal(checkGuess(t, 50), true);
  assert.equal(checkGuess(t, 51), false);
});

test("guessQuestionLabel formatiert lesbar", () => {
  assert.equal(guessQuestionLabel({ dim: "nat", val: "ARG" }), "Aus Argentinien?");
  assert.equal(guessQuestionLabel({ dim: "club", val: "BAR" }), "Spielte für FC Barcelona?");
  assert.equal(guessQuestionLabel({ dim: "league", val: "BL" }), "Spielte in der Bundesliga?");
  assert.equal(guessQuestionLabel({ dim: "pos", val: "ST" }), "Position: Sturm?");
  assert.equal(guessQuestionLabel({ dim: "title", val: "WM" }), "Weltmeister?");
  assert.equal(guessQuestionLabel({ dim: "born", val: { cmp: "before", year: 1990 } }), "Geboren vor 1990?");
  assert.equal(guessQuestionLabel({ dim: "born", val: { cmp: "after", year: 2000 } }), "Geboren ab 2000?");
});

test("buildGuessSerial: gültiger, bekannter Kandidat", async () => {
  const { PLAYERS } = await import("./players.js");
  for (let i = 0; i < 20; i++) {
    const g = buildGuessSerial(PLAYERS);
    assert.equal(g.kind, "guess");
    const p = PLAYERS[decodeTarget(g.tgt)];
    assert.ok(p, "Ziel-Index ungültig");
    assert.ok(p.pos, "Ziel ohne Position");
    assert.ok((p.nat || []).length, "Ziel ohne Nation");
    assert.ok((p.clubs || []).length, "Ziel ohne Verein");
    assert.ok((p.sl || 0) >= GUESS_SL_MIN, "Ziel nicht bekannt genug");
  }
});
```

- [ ] **Step 2: Tests ausführen, Fehlschlag prüfen**

Run: `npm test`
Expected: FAIL — `answerGuessQuestion`/`buildGuessSerial`/… „is not exported by ./gameData.js".

- [ ] **Step 3: Engine in `gameData.js` implementieren.** Direkt **nach** der `playerMatchesHex`-Funktion (nach Zeile 157, vor `// ── Raster-Duell`) einfügen:

```js
// ── Errate den Star (Deduktions-Duell) ───────────────────────────────────────
export const GUESS_SL_MIN = 40; // Mindest-Bekanntheit der Ziel-Spieler (tunebar)
export const POS_LABEL = { TW: "Torwart", ABW: "Abwehr", MF: "Mittelfeld", ST: "Sturm" };

// Deterministische Ja/Nein-Antwort auf eine Attributfrage { dim, val }.
export function answerGuessQuestion(player, q) {
  if (!player || !q) return false;
  switch (q.dim) {
    case "nat":    return (player.nat || []).includes(q.val);
    case "club":   return (player.clubs || []).includes(q.val);
    case "league": return (player.clubs || []).some((ck) => CLUB_LG[ck] === q.val);
    case "pos":    return player.pos === q.val;
    case "title":  return (player.t || []).includes(q.val);
    case "born":   return q.val.cmp === "before" ? player.by < q.val.year : player.by >= q.val.year;
    default:       return false;
  }
}

// Klartext einer Frage für die Protokollanzeige.
export function guessQuestionLabel(q) {
  switch (q.dim) {
    case "nat":    return `Aus ${lookupDef("nat", q.val)?.name ?? q.val}?`;
    case "club":   return `Spielte für ${lookupDef("club", q.val)?.name ?? q.val}?`;
    case "league": return `Spielte in der ${lookupDef("league", q.val)?.name ?? q.val}?`;
    case "pos":    return `Position: ${POS_LABEL[q.val] ?? q.val}?`;
    case "title":  return `${lookupDef("honour", q.val)?.name ?? q.val}?`;
    case "born":   return `Geboren ${q.val.cmp === "before" ? "vor" : "ab"} ${q.val.year}?`;
    default:       return "?";
  }
}

// Leichte Verschleierung der Index-Referenz (kein echter Schutz; vertrauensbasiert).
export function encodeTarget(index) { return btoa(String(index)); }
export function decodeTarget(tgt)   { return Number(atob(tgt)); }
export function checkGuess(tgt, guessedIndex) { return decodeTarget(tgt) === guessedIndex; }

// Geheimes Ziel ziehen: bekannt (sl >= GUESS_SL_MIN) und mit vollständigen Daten,
// damit jede Frage-Dimension sinnvoll beantwortbar ist.
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

- [ ] **Step 4: Tests ausführen, Erfolg prüfen**

Run: `npm test`
Expected: PASS (alle bisherigen 19 + 7 neue Tests).

- [ ] **Step 5: Commit**

```bash
git add src/gameData.js src/gameData.test.js
git commit -m "feat: Engine für 'Errate den Star' (answer/label/build/encode/check)"
```

---

## Task 2: Lobby-Modus, Routing & Grid-Bugfix

**Files:**
- Modify: `src/Lobby.jsx`
- Modify: `src/App.jsx`
- Modify: `src/Grid.jsx`

- [ ] **Step 1: Grid-Bugfix.** In `src/Grid.jsx` ruft `newGame` `buildGridSerial()` ohne Argument auf (seit dem Lazy-Refactor fehlerhaft). Zeile

```jsx
      board: buildGridSerial(), owners: {}, turn: 1, status: "playing",
```

ersetzen durch:

```jsx
      board: buildGridSerial(players), owners: {}, turn: 1, status: "playing",
```

- [ ] **Step 2: Lobby-Import erweitern.** In `src/Lobby.jsx` die Zeile

```jsx
import { buildBoardSerial, buildGridSerial, genCode, START_SECONDS } from "./gameData.js";
```

ersetzen durch:

```jsx
import { buildBoardSerial, buildGridSerial, buildGuessSerial, genCode, START_SECONDS } from "./gameData.js";
```

- [ ] **Step 3: Lobby `createGame` verzweigen.** In `src/Lobby.jsx` den `try`-Block-Anfang von `createGame` — die Zeilen

```jsx
      const code = genCode();
      const me = getClientId();
      const myName = name.trim() || "Spieler 1";
      saveName(myName);
      const { error } = await supabase.from("games").insert({
        code,
        board: mode === "grid" ? buildGridSerial(await loadPlayers()) : buildBoardSerial(),
        owners: {},
        turn: 1,
        status: "waiting",
        host_id: me,
        guest_id: null,
        names: { 1: myName, 2: "Spieler 2" },
        last_move: mode === "grid" ? { picksAll: {} } : null,
        clocks: { 1: START_SECONDS, 2: START_SECONDS, started: null, timeout: null },
        updated_at: new Date().toISOString(),
      });
```

ersetzen durch:

```jsx
      const code = genCode();
      const me = getClientId();
      const myName = name.trim() || "Spieler 1";
      saveName(myName);
      let board, last_move;
      if (mode === "grid") { board = buildGridSerial(await loadPlayers()); last_move = { picksAll: {} }; }
      else if (mode === "guess") { board = buildGuessSerial(await loadPlayers()); last_move = { log: [], winner: null }; }
      else { board = buildBoardSerial(); last_move = null; }
      const { error } = await supabase.from("games").insert({
        code,
        board,
        owners: {},
        turn: 1,
        status: "waiting",
        host_id: me,
        guest_id: null,
        names: { 1: myName, 2: "Spieler 2" },
        last_move,
        clocks: { 1: START_SECONDS, 2: START_SECONDS, started: null, timeout: null },
        updated_at: new Date().toISOString(),
      });
```

- [ ] **Step 4: Lobby Modus-Buttons.** In `src/Lobby.jsx` den Modus-Block

```jsx
        <div className="inrow">
          <button type="button" className={`btn ${mode === "hex" ? "primary" : "ghost"}`} style={{ flex: 1 }} onClick={() => setMode("hex")}>Hex-Duell</button>
          <button type="button" className={`btn ${mode === "grid" ? "primary" : "ghost"}`} style={{ flex: 1 }} onClick={() => setMode("grid")}>Raster-Duell</button>
        </div>
```

ersetzen durch:

```jsx
        <div className="inrow" style={{ flexWrap: "wrap" }}>
          <button type="button" className={`btn ${mode === "hex" ? "primary" : "ghost"}`} style={{ flex: 1 }} onClick={() => setMode("hex")}>Hex-Duell</button>
          <button type="button" className={`btn ${mode === "grid" ? "primary" : "ghost"}`} style={{ flex: 1 }} onClick={() => setMode("grid")}>Raster-Duell</button>
          <button type="button" className={`btn ${mode === "guess" ? "primary" : "ghost"}`} style={{ flex: 1 }} onClick={() => setMode("guess")}>Errate den Star</button>
        </div>
```

Außerdem den Modus-Kommentar oben anpassen:

```jsx
  const [mode, setMode] = useState("hex"); // "hex" | "grid" | "guess"
```

- [ ] **Step 5: App-Routing.** In `src/App.jsx` den Import-Block und die Router-Logik anpassen. Zeile

```jsx
import Grid from "./Grid.jsx";
```

ersetzen durch:

```jsx
import Grid from "./Grid.jsx";
import Guess from "./Guess.jsx";
```

und in `GameRouter` die Zeilen

```jsx
  const isGrid = board && !Array.isArray(board);
  return isGrid
    ? <Grid code={code} clientId={clientId} onLeave={onLeave} />
    : <Game code={code} clientId={clientId} onLeave={onLeave} />;
```

ersetzen durch:

```jsx
  const kind = board && !Array.isArray(board) ? board.kind : "hex";
  if (kind === "grid") return <Grid code={code} clientId={clientId} onLeave={onLeave} />;
  if (kind === "guess") return <Guess code={code} clientId={clientId} onLeave={onLeave} />;
  return <Game code={code} clientId={clientId} onLeave={onLeave} />;
```

- [ ] **Step 6: Commit** (Build folgt nach Task 3, da `Guess.jsx` noch fehlt)

```bash
git add src/Lobby.jsx src/App.jsx src/Grid.jsx
git commit -m "feat: Lobby-Modus + Routing für 'Errate den Star'; Grid-newGame-Bugfix"
```

---

## Task 3: Komponente `Guess.jsx`

**Files:**
- Create: `src/Guess.jsx`

- [ ] **Step 1: Komponente anlegen.** `src/Guess.jsx` mit folgendem Inhalt erstellen:

```jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient.js";
import {
  P, norm, suggestPlayers, lookupDef, NATIONS, CLUBS, LEAGUES, HONOURS, POS_LABEL,
  buildGuessSerial, answerGuessQuestion, guessQuestionLabel, decodeTarget, checkGuess,
  START_SECONDS, fmtClock, liveRemaining,
} from "./gameData.js";
import { loadPlayers } from "./playersStore.js";

const sigOf = (dim, val) => (dim === "born" ? `born:${val.cmp}:${val.year}` : `${dim}:${val}`);

// Tipp-Filter-Combobox über eine Def-Liste (Nation/Verein).
function Combo({ options, placeholder, asked, onPick }) {
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
          const used = asked.has(sigOf(o.type === "nat" ? "nat" : "club", o.key));
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

export default function Guess({ code, clientId, onLeave }) {
  const [row, setRow] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [players, setPlayers] = useState(null);
  const [now, setNow] = useState(Date.now());
  const timeoutFired = useRef(false);
  const [act, setAct] = useState("ask");        // "ask" | "guess"
  const [dim, setDim] = useState(null);          // gewählte Dimension
  const [yearInput, setYearInput] = useState("2000");
  const [nameInput, setNameInput] = useState("");
  const [chosen, setChosen] = useState(null);
  const [sugOpen, setSugOpen] = useState(false);
  const [sugActive, setSugActive] = useState(-1);
  const [localFeedback, setLocalFeedback] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { loadPlayers().then(setPlayers); }, []);

  useEffect(() => {
    let active = true;
    supabase.from("games").select("*").eq("code", code).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setLoadErr(error.message);
        else if (!data) setLoadErr("Spiel nicht gefunden.");
        else setRow(data);
      });
    const ch = supabase.channel("game:" + code)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `code=eq.${code}` },
        (payload) => setRow(payload.new))
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [code]);

  const myPlayer = !row ? 0 : (row.host_id === clientId ? 1 : row.guest_id === clientId ? 2 : 0);
  const status = row?.status || "loading";
  const myTurn = myPlayer !== 0 && status === "playing" && row?.turn === myPlayer;
  const names = row?.names || { 1: "Spieler 1", 2: "Spieler 2" };
  const board = row?.board || { kind: "guess", tgt: "" };
  const log = row?.last_move?.log || [];
  const askedSigs = useMemo(
    () => new Set(log.filter((e) => e.dim).map((e) => sigOf(e.dim, e.val))),
    [log]
  );
  const target = useMemo(
    () => (players && board.tgt ? players[decodeTarget(board.tgt)] : null),
    [players, board.tgt]
  );

  const clk = row?.clocks || { 1: START_SECONDS, 2: START_SECONDS, started: null, timeout: null };
  const rem1 = status === "playing" && row?.turn === 1 && clk.started ? liveRemaining(clk, 1, now) : (clk[1] ?? START_SECONDS);
  const rem2 = status === "playing" && row?.turn === 2 && clk.started ? liveRemaining(clk, 2, now) : (clk[2] ?? START_SECONDS);

  const suggestions = useMemo(() => (players ? suggestPlayers(players, nameInput, 8) : []), [players, nameInput]);

  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => { timeoutFired.current = false; }, [status, row?.turn]);
  useEffect(() => {
    if (status !== "playing" || !clk.started || timeoutFired.current) return;
    if (liveRemaining(clk, row.turn, now) > 0) return;
    timeoutFired.current = true;
    const finish = {
      status: "finished",
      clocks: { ...clk, [row.turn]: 0, started: null, timeout: row.turn },
      last_move: { ...(row.last_move || {}), log },
      updated_at: new Date().toISOString(),
    };
    if (myTurn) supabase.from("games").update(finish).eq("code", code).eq("turn", myPlayer).eq("status", "playing");
    else if (myPlayer !== 0) supabase.from("games").update(finish).eq("code", code).eq("status", "playing");
  }, [now, status, row?.turn, myTurn, myPlayer, code]); // eslint-disable-line

  async function writeMove(patch) {
    const { error } = await supabase.from("games").update({ ...patch, updated_at: new Date().toISOString() })
      .eq("code", code).eq("turn", myPlayer);
    if (error) setLocalFeedback({ type: "err", text: "Zug konnte nicht gespeichert werden.", detail: error.message });
  }

  function chargedClocks() {
    const rem = liveRemaining(clk, myPlayer, Date.now());
    return { ...clk, [myPlayer]: rem, started: new Date().toISOString() };
  }

  function ask(dimKey, val) {
    if (!myTurn || !target) return;
    const q = { dim: dimKey, val };
    if (askedSigs.has(sigOf(dimKey, val))) {
      setLocalFeedback({ type: "info", text: "Diese Frage wurde schon gestellt." });
      return;
    }
    const a = answerGuessQuestion(target, q);
    const newLog = [...log, { p: myPlayer, dim: dimKey, val, a }];
    setDim(null); setLocalFeedback(null);
    writeMove({ turn: myPlayer === 1 ? 2 : 1, clocks: chargedClocks(),
      last_move: { ...(row.last_move || {}), log: newLog } });
  }

  function askBorn(cmp) {
    const year = parseInt(yearInput, 10);
    if (!Number.isFinite(year) || year < 1900 || year > new Date().getFullYear()) {
      setLocalFeedback({ type: "err", text: "Bitte ein gültiges Jahr eingeben." });
      return;
    }
    ask("born", { cmp, year });
  }

  function submitGuess() {
    if (!myTurn || !target) return;
    let player = chosen;
    if (!player) {
      const q = norm(nameInput.trim());
      const hits = (players || []).filter((p) => norm(p.n) === q || norm(p.ln) === q);
      if (hits.length === 1) player = hits[0];
    }
    if (!player) {
      setLocalFeedback({ type: "err", text: "Bitte einen Spieler aus der Vorschlagsliste wählen." });
      return;
    }
    const idx = players.indexOf(player);
    setNameInput(""); setChosen(null); setSugOpen(false);
    if (checkGuess(board.tgt, idx)) {
      writeMove({ status: "finished", clocks: chargedClocks(),
        last_move: { ...(row.last_move || {}), log: [...log, { p: myPlayer, guess: player.n, correct: true }], winner: myPlayer } });
    } else {
      const rem = Math.max(0, liveRemaining(clk, myPlayer, Date.now()) - 30);
      setLocalFeedback({ type: "err", text: `${player.n} ist falsch — −30 s, Gegner ist dran.` });
      writeMove({ turn: myPlayer === 1 ? 2 : 1,
        clocks: { ...clk, [myPlayer]: rem, started: new Date().toISOString() },
        last_move: { ...(row.last_move || {}), log: [...log, { p: myPlayer, guess: player.n, wrong: true }] } });
    }
  }

  async function newGame() {
    await supabase.from("games").update({
      board: buildGuessSerial(players), turn: 1, status: "playing",
      last_move: { log: [], winner: null },
      clocks: { 1: START_SECONDS, 2: START_SECONDS, started: new Date().toISOString(), timeout: null },
      updated_at: new Date().toISOString(),
    }).eq("code", code);
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
  function copyShare() {
    const link = `${window.location.origin}${window.location.pathname}?game=${code}`;
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  if (loadErr) return (<div className="ppRoot"><div className="fb err" style={{ marginTop: 40 }}>{loadErr}</div><button className="btn ghost block" style={{ marginTop: 12 }} onClick={onLeave}>Zur Lobby</button></div>);
  if (!row) return <div className="ppRoot"><div className="panel" style={{ marginTop: 40 }}>Lade…</div></div>;

  const gameOver = status === "finished";
  const winner = clk.timeout ? (clk.timeout === 1 ? 2 : 1) : (row.last_move?.winner || 0);
  const fb = localFeedback;
  const DIMS = [
    { k: "nat", label: "Nation" }, { k: "club", label: "Verein" }, { k: "league", label: "Liga" },
    { k: "pos", label: "Position" }, { k: "title", label: "Titel" }, { k: "born", label: "Geburtsjahr" },
  ];

  return (
    <div className="ppRoot">
      <div className="topbar">
        <div><h1 className="title">POSSESSION PLAY</h1><div className="subtitle">Errate den Star · Code {code}</div></div>
        <div className="iconrow">
          <button className="iconbtn" title="Regeln" onClick={() => setShowRules(true)}>?</button>
          <button className="iconbtn" title="Verlassen" onClick={onLeave}>⏏</button>
        </div>
      </div>

      <div className="score">
        <div className="team" style={{ opacity: row.turn === 1 ? 1 : 0.6 }}>
          <span className={`teamName ${row.turn === 1 ? "activeName" : ""}`}><span className="dot" style={{ background: P[1].c1 }} />{names[1]}{myPlayer === 1 ? " (du)" : ""}</span>
          <span className={`clock ${row.turn === 1 && rem1 <= 30 ? "low" : ""}`}>{fmtClock(rem1)}</span>
        </div>
        <div className="scoreMid">vs</div>
        <div className="team right" style={{ opacity: row.turn === 2 ? 1 : 0.6 }}>
          <span className={`teamName ${row.turn === 2 ? "activeName" : ""}`}>{names[2]}{myPlayer === 2 ? " (du)" : ""}<span className="dot" style={{ background: P[2].c1 }} /></span>
          <span className={`clock ${row.turn === 2 && rem2 <= 30 ? "low" : ""}`}>{fmtClock(rem2)}</span>
        </div>
      </div>

      <div className="qlog">
        {log.length === 0 && <div className="qlogEmpty">Noch keine Fragen — stelle die erste Attributfrage.</div>}
        {log.map((e, i) => (
          <div key={i} className="qlogRow">
            <span className="qlogWho" style={{ background: P[e.p]?.c1 }} />
            {e.dim ? (
              <>
                <span className="qlogText">{guessQuestionLabel({ dim: e.dim, val: e.val })}</span>
                <span className={`qlogAns ${e.a ? "yes" : "no"}`}>{e.a ? "Ja" : "Nein"}</span>
              </>
            ) : (
              <span className="qlogText">Tipp: <b>{e.guess}</b> {e.correct ? "✓ richtig" : "✗ falsch (−30 s)"}</span>
            )}
          </div>
        ))}
      </div>

      {!gameOver && (myTurn ? (
        <div className="panel">
          <div className="inrow" style={{ marginBottom: 10 }}>
            <button className={`btn ${act === "ask" ? "primary" : "ghost"}`} style={{ flex: 1 }} onClick={() => { setAct("ask"); setDim(null); }}>Frage stellen</button>
            <button className={`btn ${act === "guess" ? "primary" : "ghost"}`} style={{ flex: 1 }} onClick={() => setAct("guess")}>Tippen</button>
          </div>

          {act === "ask" ? (
            !players ? <div className="qlogEmpty">Lade Spielerdaten…</div> : (
              <>
                <div className="chiprow">
                  {DIMS.map((d) => (
                    <button key={d.k} className={`chip ${dim === d.k ? "on" : ""}`} onClick={() => setDim(d.k)}>{d.label}</button>
                  ))}
                </div>
                {dim === "nat" && <Combo options={NATIONS} placeholder="Nation tippen…" asked={askedSigs} onPick={(k) => ask("nat", k)} />}
                {dim === "club" && <Combo options={CLUBS} placeholder="Verein tippen…" asked={askedSigs} onPick={(k) => ask("club", k)} />}
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
        </div>
      ) : (
        <div className="hint"><span className="turnpill" style={{ color: P[row.turn].c1, borderColor: P[row.turn].c1 }}><span className="dot" style={{ background: P[row.turn].c1 }} />{names[row.turn]} ist am Zug</span><span>— warte kurz</span></div>
      ))}

      {fb && (<div className={`fb ${fb.type}`}>{fb.text}{fb.detail && <div className="fbDetail">{fb.detail}</div>}</div>)}

      {status === "waiting" && (
        <div className="overlay"><div className="modal" style={{ textAlign: "center" }}>
          <h2>Warte auf Mitspieler</h2><p>Teile diesen Code mit deinem Freund:</p><div className="code">{code}</div>
          <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={copyShare}>{copied ? "Link kopiert ✓" : "Einladungslink kopieren"}</button></div>
          <button className="btn ghost block" style={{ marginTop: 10 }} onClick={onLeave}>Abbrechen</button>
        </div></div>
      )}

      {gameOver && (
        <div className="overlay"><div className="modal" style={{ textAlign: "center" }}>
          <h2>Aufgelöst</h2>
          {winner === 0 ? <p className="winName">Spiel beendet</p> : <p className="winName" style={{ color: P[winner].c1 }}>{names[winner]} gewinnt</p>}
          <p>Gesuchter Star: <b>{target ? target.n : "—"}</b></p>
          {clk.timeout ? <p>⏱ {names[clk.timeout]} — Zeit abgelaufen</p> : null}
          <div className="closeline">
            <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={newGame}>Neues Spiel</button>
            <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Lobby</button>
          </div>
        </div></div>
      )}

      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>So wird gespielt</h2>
            <p className="ruleP">Die App hat einen <b>geheimen Star</b> gezogen. Beide jagen denselben.</p>
            <p className="ruleP">Abwechselnd stellt ihr eine <b>Attributfrage</b> (Nation, Verein, Liga, Position, Titel, Geburtsjahr) — die App antwortet mit <b>Ja/Nein</b>. Alle Antworten sieht jeder.</p>
            <p className="ruleP">Statt einer Frage darfst du jederzeit <b>tippen</b>. Richtig = du gewinnst. Falsch = <b>−30 s</b> und der Gegner ist dran.</p>
            <p className="ruleP">Läuft deine Zeit ab, verlierst du.</p>
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build** (Styling kommt in Task 4, Funktion zuerst prüfen)

Run: `npm run build`
Expected: `✓ built in …`; `players.js` weiterhin als eigener Chunk. Keine Import-/Syntaxfehler.

- [ ] **Step 3: Commit**

```bash
git add src/Guess.jsx
git commit -m "feat: Guess.jsx — Deduktions-Duell 'Errate den Star'"
```

---

## Task 4: Styles

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Stile anhängen.** Am Ende von `src/styles.css` einfügen:

```css
/* ── Errate den Star ───────────────────────────────────────────── */
.qlog { margin-top: 14px; display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }
.qlogEmpty { color: #7fa093; font-size: 14px; text-align: center; padding: 14px 0; }
.qlogRow { display: flex; align-items: center; gap: 8px; background: rgba(10,22,19,.55); border: 1px solid rgba(255,255,255,.06); border-radius: 10px; padding: 8px 12px; }
.qlogWho { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.qlogText { flex: 1; color: #d7ece3; font-size: 14px; }
.qlogAns { font-weight: 700; font-size: 13px; padding: 2px 10px; border-radius: 999px; }
.qlogAns.yes { background: rgba(45,212,191,.18); color: #2DD4BF; }
.qlogAns.no { background: rgba(251,113,133,.18); color: #FB7185; }
.chiprow { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 10px; }
.chip { background: rgba(10,22,19,.6); border: 1px solid rgba(255,255,255,.12); color: #d7ece3; border-radius: 999px; padding: 8px 14px; font-size: 14px; cursor: pointer; }
.chip:hover:not(:disabled) { border-color: #2DD4BF; }
.chip.on { background: linear-gradient(150deg, #2DD4BF, #0D9488); color: #042; border-color: transparent; font-weight: 700; }
.chip:disabled { opacity: .4; cursor: not-allowed; }
.cbList { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; max-height: 240px; overflow-y: auto; }
.cbItem { display: flex; justify-content: space-between; align-items: center; background: rgba(10,22,19,.6); border: 1px solid rgba(255,255,255,.08); color: #d7ece3; border-radius: 8px; padding: 9px 12px; font-size: 14px; cursor: pointer; text-align: left; }
.cbItem:hover:not(:disabled) { border-color: #2DD4BF; }
.cbItem:disabled { opacity: .4; cursor: not-allowed; }
.cbMeta { color: #7fa093; font-size: 12px; }
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `✓ built in …`.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "style: Q&A-Protokoll, Chips & Combobox für 'Errate den Star'"
```

---

## Task 5: Verifikation & Abschluss

**Files:** keine

- [ ] **Step 1: Volltest**

Run: `npm test` (Expected: alle grün, inkl. 7 neue) und `npm run build` (Expected: `✓`, players-Chunk getrennt).

- [ ] **Step 2: Manueller Smoke-Test (falls Dev-Umgebung/Supabase verfügbar)**

`npm run dev`; in zwei Browser-Tabs: Modus „Errate den Star" erstellen + per Code beitreten. Prüfen: Fragen aller 6 Dimensionen liefern Ja/Nein im Protokoll; bereits gestellte Frage ist gesperrt; Geburtsjahr vor/ab; Fehltipp zieht 30 s ab und wechselt den Zug; richtiger Tipp deckt den Star auf und beendet; „Neues Spiel" zieht neuen Star.

- [ ] **Step 3: Abschluss** — `superpowers:finishing-a-development-branch` (Push + PR via GitHub-API, mergen auf Zuruf).

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** Engine (answer/label/build/encode/decode/check, GUESS_SL_MIN) → Task 1; Daten/`last_move.log`, keine Migration → Task 3 (Schreiblogik); Routing + Lobby-Modus → Task 2; UI mit Protokoll, Dimensions-Auswahl, Tipp-Filter-Combobox (Nation/Verein), Buttons (Liga/Position/Titel), Geburtsjahr vor/ab, Namens-Autocomplete, Doppelfrage-Sperre, Ladezustand, Fehltipp −30 s + Zugwechsel, Aufdeckung am Ende, Schachuhr → Task 3; Stile → Task 4; Tests/Build → Task 1/5. Zusätzlich Grid-newGame-Bugfix (durch Lazy-Refactor verursacht) → Task 2. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** Frage `{dim,val}` mit `dim ∈ {nat,club,league,pos,title,born}`; `born.val = {cmp:"before"|"after", year}`; `log`-Eintrag Frage `{p,dim,val,a}` bzw. Tipp `{p,guess,correct|wrong}`; `winner` in `last_move`; `sigOf` identisch in `gameData`-Logik (Engine) und `Guess.jsx`; `decodeTarget`/`checkGuess`/`buildGuessSerial`/`answerGuessQuestion`/`guessQuestionLabel`/`POS_LABEL`/`GUESS_SL_MIN` durchgängig konsistent verwendet.
