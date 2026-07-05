import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient.js";
import { Cell } from "./Emblems.jsx";
import {
  P, cname, norm, suggestPlayers, ADJP, hydrateBoard, playerMatchesHex,
  buildBoardSerial, BOARDH, HEXH, START_SECONDS, fmtClock, liveRemaining,
} from "./gameData.js";
import { loadPlayers } from "./playersStore.js";
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
import { DATA_ASOF } from "./dataInfo.js";

export default function Game({ code, clientId, onLeave }) {
  const [row, setRow] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [selected, setSelected] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [chosen, setChosen] = useState(null);
  const [sugOpen, setSugOpen] = useState(false);
  const [sugActive, setSugActive] = useState(-1);
  const [localFeedback, setLocalFeedback] = useState(null);
  const [lastClaimed, setLastClaimed] = useState([]);
  const [now, setNow] = useState(Date.now());
  const timeoutFired = useRef(false);
  const [showRules, setShowRules] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);
  const [players, setPlayers] = useState(null);
  useEffect(() => { loadPlayers().then(setPlayers); }, []);
  const [muted, setMuted] = useState(isMuted());
  const prevStatus = useRef(null);

  // ── Laden + Realtime-Abo ──────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    supabase.from("games").select("*").eq("code", code).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setLoadErr(error.message);
        else if (!data) setLoadErr("Spiel nicht gefunden.");
        else setRow(data);
      });
    const ch = supabase
      .channel("game:" + code)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `code=eq.${code}` },
        (payload) => { setRow(payload.new); })
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
  const owners = row?.owners || {};
  const board = useMemo(() => (row?.board ? hydrateBoard(row.board) : []), [row?.board]);

  const clk = row?.clocks || { 1: START_SECONDS, 2: START_SECONDS, started: null, timeout: null };
  const rem1 = status === "playing" && row?.turn === 1 && clk.started ? liveRemaining(clk, 1, now) : (clk[1] ?? START_SECONDS);
  const rem2 = status === "playing" && row?.turn === 2 && clk.started ? liveRemaining(clk, 2, now) : (clk[2] ?? START_SECONDS);

  const counts = useMemo(() => {
    let a = 0, b = 0;
    Object.values(owners).forEach((v) => { if (v === 1) a++; else if (v === 2) b++; });
    return { a, b, neutral: 31 - a - b };
  }, [owners]);

  const suggestions = useMemo(() => (players ? suggestPlayers(players, nameInput, 8) : []), [players, nameInput]);

  // Erobert-Animation, wenn ein neuer Zug ankommt
  useEffect(() => {
    const lm = row?.last_move;
    if (lm?.claimed?.length) {
      setLastClaimed(lm.claimed);
      const id = setTimeout(() => setLastClaimed([]), 900);
      return () => clearTimeout(id);
    }
  }, [row?.last_move?.ts]);

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
  useEffect(() => { if (selected !== null && inputRef.current) inputRef.current.focus(); }, [selected]);

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

  function pickHex(idx) {
    if (!myTurn || owners[String(idx)]) return;
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
      setLocalFeedback({ type: "err", text: "Bitte einen Spieler aus der Vorschlagsliste wählen.",
        detail: "Ab 2 Buchstaben des Nachnamens erscheinen Treffer aus der Datenbank." });
      return;
    }
    const adjIdx = ADJP[selected].filter((i) => owners[String(i)] !== myPlayer);
    const ids = [selected, ...adjIdx];
    const results = {};
    ids.forEach((i) => { results[i] = playerMatchesHex(player, board[i].def); });
    if (results[selected] !== true) {
      setLocalFeedback({ type: "err", text: `${player.n} passt nicht zu „${cname(board[selected].def)}".`,
        detail: "Wähle ein Feld, das zur Karriere des Spielers passt (Verein, Nation, Liga, Titel oder Spezialfeld)." });
      play("err");
      return;
    }
    const newOwners = { ...owners };
    newOwners[String(selected)] = myPlayer;
    let stolen = 0, gained = 0; const claimed = [selected];
    ADJP[selected].forEach((ai) => {
      if (owners[String(ai)] === myPlayer) return;
      if (results[ai] === true) { if (owners[String(ai)]) stolen++; else gained++; newOwners[String(ai)] = myPlayer; claimed.push(ai); }
    });
    const neutralLeft = 31 - Object.keys(newOwners).length;
    const extra = gained + stolen;
    let text = `✓ ${player.n} → „${cname(board[selected].def)}" erobert`;
    if (extra) text += ` · +${extra} Nachbarfeld${extra > 1 ? "er" : ""}${stolen ? ` (${stolen} gestohlen)` : ""}`;
    const detail = ADJP[selected].filter((ai) => owners[String(ai)] !== myPlayer)
      .map((ai) => `${board[ai].def.label} ${results[ai] === true ? "✓" : "✗"}`);
    const move = { by: myPlayer, who: player.n, text, detail: detail.length ? "Geprüft: " + detail.join("   ·   ") : null, claimed, ts: Date.now() };
    setSelected(null); setNameInput(""); setChosen(null); setSugOpen(false); setLocalFeedback(null);
    const rem = liveRemaining(clk, myPlayer, Date.now());
    const nextClocks = { ...clk, [myPlayer]: rem, started: new Date().toISOString() };
    play("ok");
    writeMove({ owners: newOwners, turn: myPlayer === 1 ? 2 : 1, status: neutralLeft === 0 ? "finished" : "playing", last_move: move, clocks: nextClocks });
  }

  function skipTurn() {
    if (!myTurn) return;
    setSelected(null); setNameInput(""); setChosen(null); setSugOpen(false);
    play("click");
    const rem = liveRemaining(clk, myPlayer, Date.now());
    const nextClocks = { ...clk, [myPlayer]: rem, started: new Date().toISOString() };
    writeMove({ turn: myPlayer === 1 ? 2 : 1, last_move: { by: myPlayer, text: `${names[myPlayer]} überspringt den Zug.`, claimed: [], ts: Date.now() }, clocks: nextClocks });
  }

  async function newGame() {
    await supabase.from("games").update({
      board: buildBoardSerial(), owners: {}, turn: 1, status: "playing", last_move: null,
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

  if (loadErr) return (
    <div className="lobby"><div className="panel"><div className="fb err">{loadErr}</div>
      <button className="btn primary block" style={{ marginTop: 12 }} onClick={onLeave}>Zur Lobby</button></div></div>
  );
  if (!row) return <div className="lobby"><div className="subtitle" style={{ marginTop: 40 }}>Lädt…</div></div>;

  const total = counts.a + counts.b;
  const aPct = total ? (counts.a / total) * 100 : 50;
  const adjSet = selected !== null ? new Set(ADJP[selected]) : new Set();
  const fb = localFeedback || (row.last_move?.text ? { type: row.last_move.by ? "ok" : "info", text: row.last_move.text, detail: row.last_move.detail } : null);
  const gameOver = status === "finished";
  const winnerNo = !gameOver ? 0 : clk.timeout ? (clk.timeout === 1 ? 2 : 1) : counts.a === counts.b ? 0 : counts.a > counts.b ? 1 : 2;

  return (
    <div className="ppRoot">
      <div className="topbar">
        <div>
          <h1 className="title">POSSESSION PLAY</h1>
          <div className="subtitle">Online · Code {code}</div>
        </div>
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

      <div className="bar"><div className="barA" style={{ width: `${aPct}%` }} /><div className="barB" style={{ width: `${100 - aPct}%` }} /></div>
      <div className="barLbl"><span>Ballbesitz</span><span>{counts.neutral} frei</span></div>

      <div className="board" style={{ aspectRatio: `5 / ${BOARDH.toFixed(3)}` }}>
        {board.map((cell) => (
          <Cell key={cell.idx} cell={cell} owner={owners[String(cell.idx)]} selected={selected === cell.idx}
            adjHint={adjSet.has(cell.idx)} justClaimed={lastClaimed.includes(cell.idx)}
            clickable={myTurn && !owners[String(cell.idx)]} onClick={() => pickHex(cell.idx)} />
        ))}
      </div>

      {!gameOver && (myTurn ? (selected !== null ? (
        <div className="panel">
          <div className="prompt"><b>Du</b> · Nenne einen Spieler für <b style={{ color: P[myPlayer].c1 }}>{cname(board[selected].def)}</b></div>
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
                    <div key={s.n} className={`sugItem ${i === sugActive ? "active" : ""}`}
                      onMouseDown={(e) => { e.preventDefault(); chooseSug(s); }}>
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
            <button className="btn ghost" onClick={() => { setSelected(null); setNameInput(""); setChosen(null); setSugOpen(false); }}>Anderes Feld</button>
            <button className="btn ghost" onClick={skipTurn}>Zug überspringen</button>
          </div>
        </div>
      ) : (
        <div className="hint">
          <span className="turnpill" style={{ color: P[myPlayer].c1, borderColor: P[myPlayer].c1 }}><span className="dot" style={{ background: P[myPlayer].c1 }} />Du bist am Zug</span>
          <span>— wähle ein freies Feld</span>
        </div>
      )) : (
        <div className="hint">
          <span className="turnpill" style={{ color: P[row.turn].c1, borderColor: P[row.turn].c1 }}><span className="dot" style={{ background: P[row.turn].c1 }} />{names[row.turn]} ist am Zug</span>
          <span>— warte kurz</span>
        </div>
      ))}

      {fb && (<div className={`fb ${fb.type}`}>{fb.text}{fb.detail && <div className="fbDetail">{fb.detail}</div>}</div>)}

      {/* Warten auf Mitspieler */}
      {status === "waiting" && (
        <div className="overlay">
          <div className="modal" style={{ textAlign: "center" }}>
            <h2>Warte auf Mitspieler</h2>
            <p>Teile diesen Code mit deinem Freund:</p>
            <div className="code">{code}</div>
            <div className="closeline">
              <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={copyShare}>{copied ? "Link kopiert ✓" : "Einladungslink kopieren"}</button>
            </div>
            <button className="btn ghost block" style={{ marginTop: 10 }} onClick={onLeave}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* Abpfiff */}
      {gameOver && (
        <div className="overlay">
          {winnerNo !== 0 && winnerNo === myPlayer && <Confetti />}
          <div className="modal" style={{ textAlign: "center" }}>
            <h2>Abpfiff</h2>
            {clk.timeout ? (
              <p className="winName" style={{ color: P[clk.timeout === 1 ? 2 : 1].c1 }}>{names[clk.timeout === 1 ? 2 : 1]} gewinnt</p>
            ) : counts.a === counts.b ? <p className="winName">Unentschieden!</p> : (
              <p className="winName" style={{ color: counts.a > counts.b ? P[1].c1 : P[2].c1 }}>{counts.a > counts.b ? names[1] : names[2]} gewinnt</p>
            )}
            <p>{clk.timeout ? `⏱ ${names[clk.timeout]} — Zeit abgelaufen` : `${names[1]} ${counts.a} : ${counts.b} ${names[2]}`}</p>
            <div className="closeline">
              <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={newGame}>Neues Spiel</button>
              <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Lobby</button>
            </div>
          </div>
        </div>
      )}

      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>So wird gespielt</h2>
            <p className="ruleP">Abwechselnd wählt ihr ein <b>freies Feld</b> und nennt einen Spieler, der zur Kategorie passt (Verein, Nation, Liga, Titel oder Spezialfeld wie Jahrgang/Ära).</p>
            <p className="ruleP">Passt euer Spieler <b>auch zu angrenzenden Feldern</b>, erobert ihr diese mit — und nehmt sie dem Gegner ab, wenn sie ihm gehören.</p>
            <p className="ruleP">Ab <b>2 Buchstaben des Nachnamens</b> erscheinen Treffer aus der Datenbank. Wähle einen Spieler aus der Liste.</p>
            <p className="ruleP">Sind alle 31 Felder vergeben, gewinnt, wer mehr besitzt.</p>
            <p className="dataStamp">Datenstand: {DATA_ASOF.split("-").reverse().join(".")} · Quelle: Wikidata — ganz frische Transfers können noch fehlen.</p>
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
