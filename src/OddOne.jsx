import { useState, useEffect } from "react";
import { buildOddRound, oddRuleLabel } from "./oddOneOut.js";
import { loadPlayers } from "./playersStore.js";
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
import { Avatar } from "./Emblems.jsx";
import { DATA_ASOF } from "./dataInfo.js";

const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Statistik weiter */ } },
};

// Wer passt nicht? — drei Spieler teilen eine Eigenschaft, einer nicht.
export default function OddOne({ onLeave }) {
  const [players, setPlayers] = useState(null);
  const [round, setRound] = useState(null);
  const [picked, setPicked] = useState(null);   // Index der Wahl, null = offen
  const [stats, setStats] = useState(() => store.get("pp:oddStats") || { played: 0, solved: 0, streak: 0, best: 0 });
  const [muted, setMuted] = useState(isMuted());
  const [showRules, setShowRules] = useState(false);

  useEffect(() => { loadPlayers().then(setPlayers); }, []);
  useEffect(() => { if (players && !round) setRound(buildOddRound(players)); }, [players, round]);

  function choose(i) {
    if (picked !== null || !round) return;
    setPicked(i);
    const right = i === round.oddIndex;
    const streak = right ? stats.streak + 1 : 0;
    const next = {
      played: stats.played + 1,
      solved: stats.solved + (right ? 1 : 0),
      streak,
      best: Math.max(stats.best || 0, streak),
    };
    setStats(next); store.set("pp:oddStats", next);
    play(right ? "win" : "err");
  }

  function nextRound() { setPicked(null); setRound(players ? buildOddRound(players) : null); }

  const solved = picked !== null && picked === round?.oddIndex;

  return (
    <div className="ppRoot">
      <div className="topbar">
        <div><h1 className="title">POSSESSION PLAY</h1><div className="subtitle">🧩 Wer passt nicht? · Solo</div></div>
        <div className="iconrow">
          <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}>{muted ? "🔇" : "🔊"}</button>
          <button className="iconbtn" title="Regeln" onClick={() => setShowRules(true)}>?</button>
          <button className="iconbtn" title="Zur Lobby" onClick={onLeave}>⏏</button>
        </div>
      </div>

      <div className="dailyMeta">
        <span className="dailyCount">Serie {stats.streak}</span>
        <span className="dailyCount">Rekord {stats.best || 0}</span>
        <span className="dailyCount">{stats.solved}/{stats.played} richtig</span>
      </div>

      {!players || !round ? <div className="qlogEmpty">Lade Spielerdaten…</div> : (
        <>
          <div className="prompt" style={{ textAlign: "center", marginTop: 14 }}>
            Drei dieser Spieler haben etwas gemeinsam — <b>wer passt nicht?</b>
          </div>
          <div className="oddGrid">
            {round.options.map((p, i) => {
              const state = picked === null ? "" : i === round.oddIndex ? "right" : i === picked ? "wrong" : "dim";
              return (
                <button key={p.n + p.by} className={`oddCard ${state}`} disabled={picked !== null} onClick={() => choose(i)}>
                  <Avatar player={p} size={64} />
                  <span className="oddName">{p.n}</span>
                  <span className="oddMeta">{[p.pos, new Date().getFullYear() - p.by].filter(Boolean).join(" · ")}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {picked !== null && round && (
        <div className="panel dailyEnd">
          {solved && <Confetti />}
          <h2 style={{ marginTop: 0 }}>{solved ? "✅ Richtig!" : "❌ Daneben"}</h2>
          <p>Die anderen drei <b>{oddRuleLabel(round.def)}</b>.</p>
          <p className="dataStamp" style={{ marginTop: 4 }}>
            Außenseiter war: <b>{round.options[round.oddIndex].n}</b>
          </p>
          <div className="closeline">
            <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={nextRound}>Nächste Runde</button>
            <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Zur Lobby</button>
          </div>
        </div>
      )}

      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Wer passt nicht?</h2>
            <p className="ruleP">Von vier Spielern teilen <b>drei eine Eigenschaft</b> — ein Verein, eine Nation, eine Liga oder ein Titel.</p>
            <p className="ruleP">Finde den <b>Außenseiter</b>. Jede Runde ist eindeutig: Es gibt immer nur eine passende Gruppierung.</p>
            <p className="ruleP">Richtige Tipps in Folge bauen deine <b>Serie</b> auf.</p>
            <p className="dataStamp">Datenstand: {DATA_ASOF.split("-").reverse().join(".")} · Quelle: Wikidata</p>
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
