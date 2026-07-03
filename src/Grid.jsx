import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient.js";
import { Emblem } from "./Emblems.jsx";
import {
  P, cname, norm, suggestPlayers, lookupDef,
  buildGridSerial, gridCellMatches, gridWinner, START_SECONDS, fmtClock, liveRemaining,
} from "./gameData.js";
import { loadPlayers } from "./playersStore.js";
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";

export default function Grid({ code, clientId, onLeave }) {
  const [row, setRow] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [selected, setSelected] = useState(null); // 0..8
  const [nameInput, setNameInput] = useState("");
  const [chosen, setChosen] = useState(null);
  const [sugOpen, setSugOpen] = useState(false);
  const [sugActive, setSugActive] = useState(-1);
  const [localFeedback, setLocalFeedback] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const timeoutFired = useRef(false);
  const inputRef = useRef(null);
  const [players, setPlayers] = useState(null);
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

  const myPlayer = !row ? 0 : (row.host_id === clientId ? 1 : row.guest_id === clientId ? 2 : 0);
  const status = row?.status || "loading";
  const myTurn = myPlayer !== 0 && status === "playing" && row?.turn === myPlayer;
  const names = row?.names || { 1: "Spieler 1", 2: "Spieler 2" };
  const owners = row?.owners || {};
  const grid = row?.board || { rows: [], cols: [] };
  const rowDefs = useMemo(() => (grid.rows || []).map((s) => lookupDef(s.t, s.k)), [row?.board]);
  const colDefs = useMemo(() => (grid.cols || []).map((s) => lookupDef(s.t, s.k)), [row?.board]);
  const picksAll = row?.last_move?.picksAll || {};

  const counts = useMemo(() => {
    let a = 0, b = 0;
    Object.values(owners).forEach((v) => { if (v === 1) a++; else if (v === 2) b++; });
    return { a, b };
  }, [owners]);

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
      last_move: { ...(row.last_move || {}), by: 0, text: `⏱ ${names[row.turn]} — Zeit abgelaufen`, ts: Date.now() },
      updated_at: new Date().toISOString(),
    };
    if (myTurn) supabase.from("games").update(finish).eq("code", code).eq("turn", myPlayer).eq("status", "playing");
    else if (myPlayer !== 0) supabase.from("games").update(finish).eq("code", code).eq("status", "playing");
  }, [now, status, row?.turn, myTurn, myPlayer, code]); // eslint-disable-line

  // End-Sound nur beim beobachteten Übergang playing -> finished (kein Replay bei Reload)
  useEffect(() => {
    if (prevStatus.current === "playing" && status === "finished" && myPlayer !== 0) {
      const w = clk.timeout ? (clk.timeout === 1 ? 2 : 1)
        : (gridWinner(owners) || (Object.keys(owners).length === 9 ? (counts.a === counts.b ? 0 : counts.a > counts.b ? 1 : 2) : 0));
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

  useEffect(() => { if (selected !== null && inputRef.current) inputRef.current.focus(); }, [selected]);

  function pickCell(idx) {
    if (!myTurn || owners[idx]) return;
    setSelected(idx); setNameInput(""); setChosen(null); setLocalFeedback(null); setSugOpen(false); setSugActive(-1);
    play("click");
  }

  async function writeMove(patch) {
    const { error } = await supabase.from("games").update({ ...patch, updated_at: new Date().toISOString() })
      .eq("code", code).eq("turn", myPlayer);
    if (error) setLocalFeedback({ type: "err", text: "Zug konnte nicht gespeichert werden.", detail: error.message });
  }

  function handleSubmit() {
    if (!myTurn || selected === null) return;
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
    const usedNames = new Set(Object.values(picksAll).map((n) => norm(n)));
    if (usedNames.has(norm(player.n))) {
      setLocalFeedback({ type: "err", text: `${player.n} wurde in diesem Raster schon verwendet.` });
      return;
    }
    const r = Math.floor(selected / 3), c = selected % 3;
    const rem = liveRemaining(clk, myPlayer, Date.now());
    const nextClocks = { ...clk, [myPlayer]: rem, started: new Date().toISOString() };
    if (!gridCellMatches(player, rowDefs[r], colDefs[c])) {
      setLocalFeedback({ type: "err", text: `${player.n} passt nicht zu „${cname(rowDefs[r])}" × „${cname(colDefs[c])}".`,
        detail: "Zug verfällt — der Gegner ist dran." });
      play("err");
      setSelected(null); setNameInput(""); setChosen(null); setSugOpen(false);
      writeMove({ turn: myPlayer === 1 ? 2 : 1, clocks: nextClocks,
        last_move: { ...(row.last_move || {}), picksAll, by: 0, text: `${names[myPlayer]}: ${player.n} passt nicht — Zug verfällt.`, ts: Date.now() } });
      return;
    }
    const newOwners = { ...owners, [selected]: myPlayer };
    const newPicks = { ...picksAll, [selected]: player.n };
    const win = gridWinner(newOwners);
    const full = Object.keys(newOwners).length === 9;
    setSelected(null); setNameInput(""); setChosen(null); setSugOpen(false); setLocalFeedback(null);
    play("ok");
    writeMove({
      owners: newOwners,
      turn: myPlayer === 1 ? 2 : 1,
      status: win || full ? "finished" : "playing",
      clocks: nextClocks,
      last_move: { picksAll: newPicks, by: myPlayer, who: player.n,
        text: `✓ ${player.n} → „${cname(rowDefs[r])}" × „${cname(colDefs[c])}"`, ts: Date.now() },
    });
  }

  function skipTurn() {
    if (!myTurn) return;
    const rem = liveRemaining(clk, myPlayer, Date.now());
    const nextClocks = { ...clk, [myPlayer]: rem, started: new Date().toISOString() };
    setSelected(null); setNameInput(""); setChosen(null); setSugOpen(false);
    play("click");
    writeMove({ turn: myPlayer === 1 ? 2 : 1, clocks: nextClocks,
      last_move: { ...(row.last_move || {}), picksAll, by: 0, text: `${names[myPlayer]} überspringt den Zug.`, ts: Date.now() } });
  }

  async function newGame() {
    await supabase.from("games").update({
      board: buildGridSerial(players), owners: {}, turn: 1, status: "playing",
      last_move: { picksAll: {} },
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
    if (e.key === "Enter") handleSubmit();
  }
  function copyShare() {
    const link = `${window.location.origin}${window.location.pathname}?game=${code}`;
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  if (loadErr) return (<div className="ppRoot"><div className="fb err" style={{ marginTop: 40 }}>{loadErr}</div><button className="btn ghost block" style={{ marginTop: 12 }} onClick={onLeave}>Zur Lobby</button></div>);
  if (!row) return <div className="ppRoot"><div className="panel" style={{ marginTop: 40 }}>Lade…</div></div>;

  const gameOver = status === "finished";
  const winner = clk.timeout ? (clk.timeout === 1 ? 2 : 1)
    : (gridWinner(owners) || (Object.keys(owners).length === 9 ? (counts.a === counts.b ? 0 : counts.a > counts.b ? 1 : 2) : 0));
  const fb = localFeedback || (row.last_move?.text ? { type: row.last_move.by ? "ok" : "info", text: row.last_move.text, detail: row.last_move.detail } : null);

  return (
    <div className="ppRoot">
      <div className="topbar">
        <div><h1 className="title">POSSESSION PLAY</h1><div className="subtitle">Raster · Code {code}</div></div>
        <div className="iconrow">
          <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}>{muted ? "🔇" : "🔊"}</button>
          <button className="iconbtn" title="Regeln" onClick={() => setShowRules(true)}>?</button>
          <button className="iconbtn" title="Verlassen" onClick={onLeave}>⏏</button>
        </div>
      </div>

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

      <div className="grid3">
        <div className="gcorner" />
        {colDefs.map((d, i) => (
          <div key={"c" + i} className="ghead" title={cname(d)}><Emblem def={d} /><span className="gheadLbl">{d.label}</span></div>
        ))}
        {rowDefs.map((rd, r) => [
          <div key={"r" + r} className="ghead" title={cname(rd)}><Emblem def={rd} /><span className="gheadLbl">{rd.label}</span></div>,
          ...colDefs.map((cd, c) => {
            const idx = r * 3 + c; const o = owners[idx];
            const bg = o ? `linear-gradient(150deg, ${P[o].c1}, ${P[o].c2})` : "rgba(10,22,19,.55)";
            return (
              <button key={idx} className={`gcell ${o ? "owned" : ""}`} disabled={!myTurn || !!o} onClick={() => pickCell(idx)}
                style={{ background: bg, color: o ? "#fff" : "#cfe6dc", outline: selected === idx ? "3px solid #FACC15" : "none" }}>
                {o ? <span className="gpick">{picksAll[idx] || ""}</span> : <span className="gplus">＋</span>}
              </button>
            );
          }),
        ])}
      </div>

      {!gameOver && (myTurn ? (selected !== null ? (
        <div className="panel">
          <div className="prompt"><b>Du</b> · Nenne einen Spieler für <b style={{ color: P[myPlayer].c1 }}>{cname(rowDefs[Math.floor(selected / 3)])}</b> × <b style={{ color: P[myPlayer].c1 }}>{cname(colDefs[selected % 3])}</b></div>
          <div className="inrow">
            <div className="inwrap">
              <input ref={inputRef} className="field"
                placeholder={players ? "Nachname eingeben (ab 2 Buchstaben)…" : "Lade Spielerdaten…"}
                disabled={!players}
                value={nameInput} autoComplete="off"
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
            <button className="btn primary" disabled={!chosen && !nameInput.trim()} onClick={handleSubmit}>Prüfen</button>
          </div>
          <div className="minirow">
            <button className="btn ghost" onClick={() => { setSelected(null); setNameInput(""); setChosen(null); setSugOpen(false); }}>Andere Zelle</button>
            <button className="btn ghost" onClick={skipTurn}>Zug überspringen</button>
          </div>
        </div>
      ) : (
        <div className="hint"><span className="turnpill" style={{ color: P[myPlayer].c1, borderColor: P[myPlayer].c1 }}><span className="dot" style={{ background: P[myPlayer].c1 }} />Du bist am Zug</span><span>— wähle eine freie Zelle</span></div>
      )) : (
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
        <div className="overlay">
          {winner !== 0 && winner === myPlayer && <Confetti />}
          <div className="modal" style={{ textAlign: "center" }}>
          <h2>Abpfiff</h2>
          {winner === 0 ? <p className="winName">Unentschieden!</p> : (
            <p className="winName" style={{ color: P[winner].c1 }}>{names[winner]} gewinnt</p>
          )}
          <p>{clk.timeout ? `⏱ ${names[clk.timeout]} — Zeit abgelaufen` : `${names[1]} ${counts.a} : ${counts.b} ${names[2]}`}</p>
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
            <p className="ruleP">Abwechselnd wählt ihr eine <b>freie Zelle</b> und nennt einen Spieler, der <b>beide</b> Bedingungen (Zeile × Spalte) erfüllt.</p>
            <p className="ruleP">Passt der Spieler, gehört euch die Zelle. Passt er nicht, <b>verfällt der Zug</b>.</p>
            <p className="ruleP">Jeder Spieler darf pro Raster nur <b>einmal</b> verwendet werden.</p>
            <p className="ruleP">Wer zuerst <b>drei in einer Reihe</b> hat, gewinnt — sonst der mit mehr Zellen. Läuft die Zeit ab, verliert man.</p>
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
