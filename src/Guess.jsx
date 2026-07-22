import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient.js";
import {
  P, norm, suggestPlayers, NATIONS, CLUBS, LEAGUES, HONOURS, POS_LABEL,
  buildGuessSerial, answerGuessQuestion, guessQuestionLabel, decodeTarget, checkGuess,
  START_SECONDS, fmtClock, liveRemaining,
} from "./gameData.js";
import { Avatar } from "./Emblems.jsx";
import { loadPlayers } from "./playersStore.js";
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
import { DATA_ASOF } from "./dataInfo.js";
import { useLeaveEndsGame } from "./usePresence.js";

const sigOf = (dim, val) =>
  dim === "born" ? `born:${val.cmp}:${val.year}` :
  dim === "mate" ? `mate:${norm(val.n)}` : `${dim}:${val}`;

// Tipp-Filter-Combobox über eine Def-Liste (Nation/Verein).
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

export default function Guess({ code, clientId, onLeave }) {
  const [row, setRow] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [players, setPlayers] = useState(null);
  const [now, setNow] = useState(Date.now());
  const timeoutFired = useRef(false);
  const [act, setAct] = useState("ask");        // "ask" | "guess"
  const [dim, setDim] = useState(null);          // gewählte Dimension
  const [yearInput, setYearInput] = useState("2000");
  const [mateInput, setMateInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [chosen, setChosen] = useState(null);
  const [sugOpen, setSugOpen] = useState(false);
  const [sugActive, setSugActive] = useState(-1);
  const [localFeedback, setLocalFeedback] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { loadPlayers().then(setPlayers); }, []);
  const [muted, setMuted] = useState(isMuted());
  const prevStatus = useRef(null);

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

  // Reconnect-Heilung: nach Tab-Rückkehr/Fokus Spielstand einmalig nachladen
  // (Websocket kann auf Mobile einschlafen; Realtime-Abo bleibt bestehen).
  useEffect(() => {
    const refetch = () => {
      if (document.visibilityState !== "visible") return;
      supabase.from("games").select("*").eq("code", code).maybeSingle()
        .then(({ data }) => { if (data) setRow(data); });
    };
    document.addEventListener("visibilitychange", refetch);
    window.addEventListener("focus", refetch);
    return () => { document.removeEventListener("visibilitychange", refetch); window.removeEventListener("focus", refetch); };
  }, [code]);

  const myPlayer = !row ? 0 : (row.host_id === clientId ? 1 : row.guest_id === clientId ? 2 : 0);
  const status = row?.status || "loading";
  const myTurn = myPlayer !== 0 && status === "playing" && row?.turn === myPlayer;
  const names = row?.names || { 1: "Spieler 1", 2: "Spieler 2" };
  const board = row?.board || { kind: "guess", tgt: "" };
  const log = row?.last_move?.log || [];
  const forfeit = row?.last_move?.forfeit || 0;
  const opponentLeaving = useLeaveEndsGame({
    code, myPlayer, status, lastMove: row?.last_move,
    finalize: (leaver) => supabase.from("games").update({
      status: "finished",
      last_move: { ...(row?.last_move || {}), forfeit: leaver, winner: leaver === 1 ? 2 : 1 },
      updated_at: new Date().toISOString(),
    }).eq("code", code).then(() => {}),
  });
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
  const mateSuggestions = useMemo(() => (players && dim === "mate" ? suggestPlayers(players, mateInput, 8) : []), [players, dim, mateInput]);

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
    // .then() ist Pflicht: Supabase-Builder sind lazy und feuern sonst nie.
    if (myTurn) supabase.from("games").update(finish).eq("code", code).eq("turn", myPlayer).eq("status", "playing").then(() => {});
    else if (myPlayer !== 0) supabase.from("games").update(finish).eq("code", code).eq("status", "playing").then(() => {});
  }, [now, status, row?.turn, myTurn, myPlayer, code]); // eslint-disable-line

  // End-Sound nur beim beobachteten Übergang playing -> finished (kein Replay bei Reload)
  useEffect(() => {
    if (prevStatus.current === "playing" && status === "finished" && myPlayer !== 0) {
      const w = clk.timeout ? (clk.timeout === 1 ? 2 : 1) : (row?.last_move?.winner || 0);
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
    play(a ? "ok" : "click");
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
      play("err");
      writeMove({ turn: myPlayer === 1 ? 2 : 1,
        clocks: { ...clk, [myPlayer]: rem, started: new Date().toISOString() },
        last_move: { ...(row.last_move || {}), log: [...log, { p: myPlayer, guess: player.n, wrong: true }] } });
    }
  }

  async function newGame() {
    if (!players) return;
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
  const winner = forfeit ? (forfeit === 1 ? 2 : 1) : clk.timeout ? (clk.timeout === 1 ? 2 : 1) : (row.last_move?.winner || 0);
  const fb = localFeedback;
  const DIMS = [
    { k: "nat", label: "Nation" }, { k: "club", label: "Verein" }, { k: "league", label: "Liga" },
    { k: "pos", label: "Position" }, { k: "title", label: "Titel" }, { k: "born", label: "Geburtsjahr" },
    { k: "mate", label: "Teamkollege" },
  ];

  return (
    <div className="ppRoot">
      <div className="topbar">
        <div><h1 className="title">POSSESSION PLAY</h1><div className="subtitle">Errate den Star · Code {code}</div></div>
        <div className="iconrow">
          <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}>{muted ? "🔇" : "🔊"}</button>
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
                    <input className="field" type="number" min="1900" max={new Date().getFullYear()} value={yearInput} onChange={(e) => setYearInput(e.target.value)} />
                    <button className="btn ghost" onClick={() => askBorn("before")}>vor</button>
                    <button className="btn ghost" onClick={() => askBorn("after")}>ab</button>
                  </div>
                )}
                {dim === "mate" && (
                  <div>
                    <input className="field" placeholder="Referenzspieler tippen…" value={mateInput}
                      autoComplete="off" onChange={(e) => setMateInput(e.target.value)} />
                    <div className="cbList">
                      {mateSuggestions.map((s) => {
                        const used = askedSigs.has(sigOf("mate", { n: s.n }));
                        return (
                          <button key={s.n} className="cbItem" disabled={used}
                            onClick={() => { ask("mate", { n: s.n, cp: s.cp || [] }); setMateInput(""); }}>
                            {s.n} <span className="cbMeta">{used ? "gefragt" : [s.pos, new Date().getFullYear() - s.by].filter(Boolean).join(" · ")}</span>
                          </button>
                        );
                      })}
                    </div>
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
                        <span className="sugWho"><Avatar player={s} size={30} />{s.n}</span>
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
      {opponentLeaving && !gameOver && (<div className="fb info">Gegner offline — das Spiel endet gleich, falls er nicht zurückkommt…</div>)}

      {status === "waiting" && (
        <div className="overlay"><div className="modal" style={{ textAlign: "center" }}>
          <h2>Warte auf Mitspieler</h2><p>Teile diesen Code mit deinem Freund:</p><div className="code">{code}</div>
          <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={copyShare}>{copied ? "Link kopiert ✓" : "Einladungslink kopieren"}</button></div>
          <button className="btn ghost block" style={{ marginTop: 10 }} onClick={onLeave}>Abbrechen</button>
        </div></div>
      )}

      {gameOver && (
        <div className="overlay">
          {winner !== 0 && winner === myPlayer && <Confetti />}
          <div className="modal" style={{ textAlign: "center" }}>
          <h2>Aufgelöst</h2>
          {winner === 0 ? <p className="winName">Spiel beendet</p> : <p className="winName" style={{ color: P[winner].c1 }}>{names[winner]} gewinnt</p>}
          {forfeit ? <p>🚪 {names[forfeit]} hat das Spiel verlassen</p> : null}
          {target && <div className="revealWho"><Avatar player={target} size={88} /><b>{target.n}</b></div>}
          <p>Gesuchter Star: <b>{target ? target.n : "—"}</b></p>
          {clk.timeout ? <p>⏱ {names[clk.timeout]} — Zeit abgelaufen</p> : null}
          <div className="closeline">
            <button className="btn primary" style={{ flex: 1, padding: "12px" }} disabled={!players} onClick={newGame}>Neues Spiel</button>
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
            <p className="dataStamp">Datenstand: {DATA_ASOF.split("-").reverse().join(".")} · Quelle: Wikidata</p>
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
