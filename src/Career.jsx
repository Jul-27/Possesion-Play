import { useState, useEffect, useMemo, useRef } from "react";
import { Emblem } from "./Emblems.jsx";
import { norm, suggestPlayers, lookupDef } from "./gameData.js";
import { careerStations, pickCareerIndex } from "./careerPath.js";
import { loadPlayers } from "./playersStore.js";
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
import { DATA_ASOF } from "./dataInfo.js";

const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Statistik weiter */ } },
};

// Karriere-Pfad: Stationen nacheinander aufdecken, Spieler möglichst früh erraten.
export default function Career({ onLeave }) {
  const [players, setPlayers] = useState(null);
  const [idx, setIdx] = useState(-1);
  const [revealed, setRevealed] = useState(1);
  const [wrong, setWrong] = useState(0);
  const [done, setDone] = useState(false);
  const [won, setWon] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [chosen, setChosen] = useState(null);
  const [sugOpen, setSugOpen] = useState(false);
  const [sugActive, setSugActive] = useState(-1);
  const [feedback, setFeedback] = useState(null);
  const [muted, setMuted] = useState(isMuted());
  const [showRules, setShowRules] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { loadPlayers().then(setPlayers); }, []);
  useEffect(() => { if (players && idx < 0) setIdx(pickCareerIndex(players)); }, [players, idx]);

  const target = players && idx >= 0 ? players[idx] : null;
  const stations = useMemo(() => (target ? careerStations(target) : []), [target]);
  const allShown = revealed >= stations.length;
  const suggestions = useMemo(() => (players ? suggestPlayers(players, nameInput, 8) : []), [players, nameInput]);

  function finish(success) {
    setDone(true); setWon(success);
    const s = store.get("pp:careerStats") || { played: 0, solved: 0, best: 0 };
    const next = {
      played: s.played + 1,
      solved: s.solved + (success ? 1 : 0),
      best: success ? (s.best ? Math.min(s.best, revealed) : revealed) : s.best,
    };
    store.set("pp:careerStats", next);
    play(success ? "win" : "lose");
  }

  function submitGuess() {
    if (done || !players || !target) return;
    let player = chosen;
    if (!player) {
      const q = norm(nameInput.trim());
      const hits = players.filter((p) => norm(p.n) === q || norm(p.ln) === q);
      if (hits.length === 1) player = hits[0];
    }
    if (!player) { setFeedback({ type: "err", text: "Bitte einen Spieler aus der Vorschlagsliste wählen." }); return; }
    setNameInput(""); setChosen(null); setSugOpen(false);
    if (player === target) { setFeedback(null); finish(true); return; }
    setWrong((w) => w + 1);
    if (allShown) {
      setFeedback({ type: "err", text: `${player.n} ist leider falsch.` });
      finish(false);
    } else {
      setFeedback({ type: "err", text: `${player.n} ist falsch — eine Station mehr.` });
      setRevealed((r) => r + 1);
      play("err");
    }
  }

  function revealNext() {
    if (done || allShown) return;
    setRevealed((r) => r + 1); setFeedback(null); play("click");
  }

  function giveUp() { if (!done) { setRevealed(stations.length); finish(false); } }

  function newRound() {
    setIdx(players ? pickCareerIndex(players) : -1);
    setRevealed(1); setWrong(0); setDone(false); setWon(false);
    setNameInput(""); setChosen(null); setSugOpen(false); setFeedback(null);
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

  const stats = store.get("pp:careerStats");
  const shown = stations.slice(0, done ? stations.length : revealed);

  return (
    <div className="ppRoot">
      <div className="topbar">
        <div><h1 className="title">POSSESSION PLAY</h1><div className="subtitle">🧭 Karriere-Pfad · Solo</div></div>
        <div className="iconrow">
          <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}>{muted ? "🔇" : "🔊"}</button>
          <button className="iconbtn" title="Regeln" onClick={() => setShowRules(true)}>?</button>
          <button className="iconbtn" title="Zur Lobby" onClick={onLeave}>⏏</button>
        </div>
      </div>

      <div className="dailyMeta">
        <span className="dailyCount">Station {Math.min(revealed, stations.length) || 0}/{stations.length || "–"}</span>
        <span className={`dailyCount ${wrong ? "spent" : ""}`}>Fehlversuche {wrong}</span>
      </div>

      {!players || !target ? <div className="qlogEmpty">Lade Spielerdaten…</div> : (
        <div className="careerList">
          {shown.map((s, i) => {
            const def = lookupDef("club", s.club);
            return (
              <div key={i + s.club + s.from} className="careerRow">
                <span className="careerStep">{i + 1}</span>
                <span className="careerEmblem">{def ? <Emblem def={def} /> : null}</span>
                <span className="careerClub">{def ? def.name : s.club}</span>
                <span className="careerYears">{s.from}–{s.to === 0 ? "heute" : s.to}</span>
              </div>
            );
          })}
          {!done && !allShown && <div className="careerMore">… {stations.length - revealed} weitere Station{stations.length - revealed > 1 ? "en" : ""} verborgen</div>}
        </div>
      )}

      {!done && players && target && (
        <div className="panel">
          <div className="prompt">Welcher Spieler hat diese Karriere?</div>
          <div className="inrow">
            <div className="inwrap">
              <input ref={inputRef} className="field" placeholder="Spielernamen tippen…" value={nameInput} autoComplete="off"
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
          <div className="minirow">
            <button className="btn ghost" disabled={allShown} onClick={revealNext}>Nächste Station</button>
            <button className="btn ghost" onClick={giveUp}>Auflösen</button>
          </div>
        </div>
      )}

      {feedback && (<div className={`fb ${feedback.type}`}>{feedback.text}</div>)}

      {done && (
        <div className="panel dailyEnd">
          {won && <Confetti />}
          <h2 style={{ marginTop: 0 }}>{won ? `🧭 Gelöst nach ${revealed} Station${revealed > 1 ? "en" : ""}!` : "💡 Aufgelöst"}</h2>
          <p>Gesucht war: <b>{target ? target.n : "—"}</b></p>
          {stats && (
            <div className="dailyStats">
              <span><b>{stats.played}</b> gespielt</span>
              <span><b>{stats.solved}</b> gelöst</span>
              <span><b>{stats.best || "–"}</b> beste Runde</span>
            </div>
          )}
          <div className="closeline">
            <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={newRound}>Neue Karriere</button>
            <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Zur Lobby</button>
          </div>
        </div>
      )}

      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Karriere-Pfad</h2>
            <p className="ruleP">Die Karrierestationen eines Spielers werden <b>nacheinander aufgedeckt</b> — älteste zuerst.</p>
            <p className="ruleP">Errate ihn so <b>früh wie möglich</b>. Ein falscher Tipp deckt automatisch die nächste Station auf.</p>
            <p className="ruleP">„Nächste Station" hilft freiwillig weiter, „Auflösen" beendet die Runde.</p>
            <p className="dataStamp">Datenstand: {DATA_ASOF.split("-").reverse().join(".")} · Quelle: Wikidata</p>
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
