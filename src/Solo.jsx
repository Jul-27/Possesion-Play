import { useState, useEffect, useMemo, useRef } from "react";
import { Cell } from "./Emblems.jsx";
import {
  P, cname, norm, suggestPlayers, ADJP, hydrateBoard, playerMatchesHex,
  buildBoardSerial, BOARDH,
} from "./gameData.js";
import { loadPlayers } from "./playersStore.js";
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
import { DATA_ASOF } from "./dataInfo.js";

// Hex-Training: volles Duell-Board, aber solo, ohne Uhr und ohne Zugverlust.
export default function Solo({ onLeave }) {
  const [serial, setSerial] = useState(() => buildBoardSerial());
  const board = useMemo(() => hydrateBoard(serial), [serial]);
  const [owners, setOwners] = useState({});
  const [moves, setMoves] = useState(0);
  const [misses, setMisses] = useState(0);
  const [selected, setSelected] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [chosen, setChosen] = useState(null);
  const [sugOpen, setSugOpen] = useState(false);
  const [sugActive, setSugActive] = useState(-1);
  const [feedback, setFeedback] = useState(null);
  const [lastClaimed, setLastClaimed] = useState([]);
  const [showRules, setShowRules] = useState(false);
  const [muted, setMuted] = useState(isMuted());
  const inputRef = useRef(null);
  const [players, setPlayers] = useState(null);
  useEffect(() => { loadPlayers().then(setPlayers); }, []);
  useEffect(() => { if (selected !== null && inputRef.current) inputRef.current.focus(); }, [selected]);

  const captured = Object.keys(owners).length;
  const done = captured === 31;
  const suggestions = useMemo(() => (players ? suggestPlayers(players, nameInput, 8) : []), [players, nameInput]);
  const adjSet = selected !== null ? new Set(ADJP[selected]) : new Set();

  function pickHex(idx) {
    if (done || owners[String(idx)]) return;
    setSelected(idx); setNameInput(""); setChosen(null); setFeedback(null); setSugOpen(false); setSugActive(-1);
    play("click");
  }

  function handleSubmit() {
    if (selected === null) return;
    let player = chosen;
    if (!player) {
      const q = norm(nameInput.trim());
      const hits = (players || []).filter((p) => norm(p.n) === q || norm(p.ln) === q);
      if (hits.length === 1) player = hits[0];
    }
    if (!player) { setFeedback({ type: "err", text: "Bitte einen Spieler aus der Vorschlagsliste wählen." }); return; }
    if (!playerMatchesHex(player, board[selected].def)) {
      setMisses((m) => m + 1);
      setFeedback({ type: "err", text: `${player.n} passt nicht zu „${cname(board[selected].def)}".`,
        detail: "Kein Zugverlust im Training — probier's gleich nochmal." });
      play("err");
      setNameInput(""); setChosen(null); setSugOpen(false);
      return;
    }
    const newOwners = { ...owners, [String(selected)]: 1 };
    const claimed = [selected];
    ADJP[selected].forEach((ai) => {
      if (newOwners[String(ai)]) return;
      if (playerMatchesHex(player, board[ai].def)) { newOwners[String(ai)] = 1; claimed.push(ai); }
    });
    const extra = claimed.length - 1;
    setOwners(newOwners); setMoves((m) => m + 1);
    setLastClaimed(claimed); setTimeout(() => setLastClaimed([]), 900);
    setSelected(null); setNameInput(""); setChosen(null); setSugOpen(false);
    const doneNow = Object.keys(newOwners).length === 31;
    setFeedback(doneNow ? null : { type: "ok",
      text: `✓ ${player.n} → „${cname(board[selected].def)}" erobert${extra ? ` · +${extra} Nachbarfeld${extra > 1 ? "er" : ""}` : ""}` });
    play(doneNow ? "win" : "ok");
  }

  function newBoard() {
    setSerial(buildBoardSerial()); setOwners({}); setMoves(0); setMisses(0);
    setSelected(null); setNameInput(""); setChosen(null); setSugOpen(false); setFeedback(null);
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

  return (
    <div className="ppRoot">
      <div className="topbar">
        <div><h1 className="title">POSSESSION PLAY</h1><div className="subtitle">🎯 Hex-Training · Solo</div></div>
        <div className="iconrow">
          <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}>{muted ? "🔇" : "🔊"}</button>
          <button className="iconbtn" title="Regeln" onClick={() => setShowRules(true)}>?</button>
          <button className="iconbtn" title="Zur Lobby" onClick={onLeave}>⏏</button>
        </div>
      </div>

      <div className="dailyMeta">
        <span className="dailyCount">Erobert {captured}/31</span>
        <span className="dailyCount">Züge {moves}</span>
        <span className={`dailyCount ${misses ? "spent" : ""}`}>Fehlversuche {misses}</span>
      </div>

      <div className="board" style={{ aspectRatio: `5 / ${BOARDH.toFixed(3)}` }}>
        {board.map((cell) => (
          <Cell key={`${cell.idx}-${serial[cell.idx].t}-${serial[cell.idx].k}`} cell={cell} owner={owners[String(cell.idx)]}
            selected={selected === cell.idx} adjHint={adjSet.has(cell.idx)} justClaimed={lastClaimed.includes(cell.idx)}
            clickable={!done && !owners[String(cell.idx)]} onClick={() => pickHex(cell.idx)} />
        ))}
      </div>

      {!done && selected !== null && (
        <div className="panel">
          <div className="prompt"><b>Training</b> · Nenne einen Spieler für <b style={{ color: P[1].c1 }}>{cname(board[selected].def)}</b></div>
          <div className="inrow">
            <div className="inwrap">
              <input ref={inputRef} className="field"
                placeholder={players ? "Nachname eingeben (ab 2 Buchstaben)…" : "Lade Spielerdaten…"}
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
            <button className="btn primary" disabled={!chosen && !nameInput.trim()} onClick={handleSubmit}>Prüfen</button>
          </div>
          <div className="minirow">
            <button className="btn ghost" onClick={() => { setSelected(null); setNameInput(""); setChosen(null); setSugOpen(false); }}>Anderes Feld</button>
          </div>
        </div>
      )}
      {!done && selected === null && (
        <div className="hint"><span className="turnpill" style={{ color: P[1].c1, borderColor: P[1].c1 }}><span className="dot" style={{ background: P[1].c1 }} />Training</span><span>— wähle ein freies Feld, kein Zeitdruck</span></div>
      )}

      {feedback && (<div className={`fb ${feedback.type}`}>{feedback.text}{feedback.detail && <div className="fbDetail">{feedback.detail}</div>}</div>)}

      {done && (
        <div className="panel dailyEnd">
          <Confetti />
          <h2 style={{ marginTop: 0 }}>{misses === 0 ? "🏆 Perfektes Board!" : "✅ Board gelöst!"}</h2>
          <div className="dailyStats">
            <span><b>{moves}</b> Züge</span>
            <span><b>{misses}</b> Fehlversuche</span>
            <span><b>{(31 / Math.max(1, moves)).toFixed(1)}</b> Felder/Zug</span>
          </div>
          <div className="closeline">
            <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={newBoard}>Neues Board</button>
            <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Zur Lobby</button>
          </div>
        </div>
      )}

      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Hex-Training</h2>
            <p className="ruleP">Erobere das Board <b>alleine und ohne Zeitdruck</b> — perfekt zum Üben fürs Duell.</p>
            <p className="ruleP">Passt dein Spieler <b>auch zu Nachbarfeldern</b>, eroberst du sie mit — genau wie im Duell.</p>
            <p className="ruleP">Fehlversuche kosten hier <b>keinen Zug</b>, werden aber gezählt. Schaffst du ein Board ohne Fehler?</p>
            <p className="dataStamp">Datenstand: {DATA_ASOF.split("-").reverse().join(".")} · Quelle: Wikidata</p>
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
