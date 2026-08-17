import { useState, useEffect, useMemo, useRef } from "react";
import { Cell } from "./Emblems.jsx";
import { P, cname, norm, suggestPlayers, hydrateBoard, BOARDH, POSITIONS } from "./gameData.js";
import {
  HEAT_CENTER, HEAT_CELLS, HEAT_ADJ, buildHeatSerial, heatMove, applyHeat,
  heatFilled, heatDone, heatDensity, heatPaint, heatMoveText, heatShareGrid, HEAT_MAX,
} from "./heatmap.js";
import { loadPlayers } from "./playersStore.js";
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
import DataStamp from "./DataStamp.jsx";
import ShareButton from "./ShareButton.jsx";
import { shareHeat } from "./share.js";
import { dailyRnd, challengeState, recordChallenge, challengeStats } from "./dailyChallenge.js";
import { submit as lbSubmit } from "./leaderboard.js";

/* 🔥 Heatmap — Solo-Modus auf dem bekannten Brett, aber mit Wertung statt Eroberung.
   Alle Regeln stehen in heatmap.js; hier steht nur, wie sie sichtbar werden. */
const BEST_KEY = "pp:heatBest";
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Bestwert weiter */ } },
};

export default function Heatmap({ onLeave }) {
  const [isDaily, setIsDaily] = useState(() => !challengeState("heat"));
  const [serial, setSerial] = useState(() => buildHeatSerial(challengeState("heat") ? Math.random : dailyRnd("heat")));
  const board = useMemo(() => hydrateBoard(serial), [serial]);
  const [heat, setHeat] = useState({});
  const [score, setScore] = useState(0);
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
  const [best, setBest] = useState(() => store.get(BEST_KEY));
  const inputRef = useRef(null);
  const [players, setPlayers] = useState(null);
  useEffect(() => { loadPlayers().then(setPlayers); }, []);
  useEffect(() => { if (selected !== null && inputRef.current) inputRef.current.focus(); }, [selected]);

  const gefuellt = heatFilled(heat);
  const done = heatDone(heat);
  const dichte = heatDensity(heat);
  const suggestions = useMemo(() => (players ? suggestPlayers(players, nameInput, 8) : []), [players, nameInput]);
  const adjSet = selected !== null ? new Set(HEAT_ADJ[selected]) : new Set();

  function pickHex(idx) {
    if (done || heat[idx]) return;
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

    const zug = heatMove(board, heat, selected, player);
    if (!zug) {
      setMisses((m) => m + 1);
      setFeedback({ type: "err", text: `${player.n} passt nicht zu „${cname(board[selected].def)}".`,
        detail: "Kein Punktabzug — probier's gleich nochmal." });
      play("err");
      setNameInput(""); setChosen(null); setSugOpen(false);
      return;
    }

    const naechste = applyHeat(heat, zug);
    setHeat(naechste); setScore((s) => s + zug.punkte); setMoves((m) => m + 1);
    setLastClaimed([...zug.neu, ...zug.reheat]); setTimeout(() => setLastClaimed([]), 900);
    setSelected(null); setNameInput(""); setChosen(null); setSugOpen(false);

    const fertig = heatDone(naechste);
    if (fertig) {
      const ergebnis = { score: score + zug.punkte, density: heatDensity(naechste), moves: moves + 1, misses };
      if (!best || ergebnis.score > best.score) { store.set(BEST_KEY, ergebnis); setBest(ergebnis); }
      if (isDaily) {
        recordChallenge("heat", true);   // ein volles Board zählt als gelöst
        lbSubmit("heat", ergebnis).catch(() => {});
      }
    }
    setFeedback(fertig ? null : { type: "ok", text: heatMoveText(zug, cname(board[selected].def)) });
    play(fertig ? "win" : "ok");
  }

  function newBoard() {
    setIsDaily(false); setSerial(buildHeatSerial()); setHeat({}); setScore(0); setMoves(0); setMisses(0);
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

  const mitte = POSITIONS[HEAT_CENTER];

  return (
    <div className="ppRoot">
      <div className="topbar">
        <div><h1 className="title">POSSESSION PLAY</h1><div className="subtitle">🔥 Heatmap · {isDaily ? "Board des Tages" : "frei"}</div></div>
        <div className="iconrow">
          <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}>{muted ? "🔇" : "🔊"}</button>
          <button className="iconbtn" title="Regeln" onClick={() => setShowRules(true)}>?</button>
          <button className="iconbtn" title="Zur Lobby" onClick={onLeave}>⏏</button>
        </div>
      </div>

      <div className="dailyMeta">
        <span className="dailyCount">Felder {gefuellt}/{HEAT_CELLS.length}</span>
        <span className="dailyCount form">Dichte {dichte.toFixed(2)}</span>
        {isDaily && (() => { const st = challengeStats("heat");
          return <span className="dailyCount">Serie {st?.streak || 0}</span>; })()}
        <span className="dailyCount">Züge {moves}</span>
        <span className={`dailyCount ${misses ? "spent" : ""}`}>Fehlversuche {misses}</span>
      </div>

      {/* Legende ÜBER dem Brett: darunter lag sie auf dem Handy unter der Falz und war
          genau dann unsichtbar, wenn man sie zum Deuten der Farben gebraucht hätte. */}
      <div className="heatLegend" title="Wie viele Felder ein Zug auf einmal erobert hat (+1 je nachgeheiztem Feld)">
        <span className="heatLegendLab">Hitze</span>
        {Array.from({ length: HEAT_MAX }, (_, i) => i + 1).map((stufe) => {
          const p = heatPaint(stufe);
          return (
            <span key={stufe} className="heatLegendDot" style={{ background: p.bg, color: p.txt, border: p.border }}>
              {stufe === HEAT_MAX ? `${HEAT_MAX}+` : stufe}
            </span>
          );
        })}
      </div>

      <div className="board" style={{ aspectRatio: `5 / ${BOARDH.toFixed(3)}` }}>
        {HEAT_CELLS.map((i) => (
          <Cell key={`${i}-${serial[i].t}-${serial[i].k}`} cell={board[i]} paint={heatPaint(heat[i])}
            selected={selected === i} adjHint={adjSet.has(i)} justClaimed={lastClaimed.includes(i)}
            clickable={!done && !heat[i]} onClick={() => pickHex(i)} />
        ))}
        {/* Punkteanzeige in der Mittelzelle: eigene Kachel, kein Spielfeld. Absichtlich
            türkis abgesetzt — die Hitzerampe ist gelb, eine goldene Mitte hätte
            ausgesehen wie ein besonders heißes Feld. */}
        <div className="hexScore" style={{ left: `${mitte.left}%`, top: `${mitte.top}%` }}>
          <div className="hexScoreInner">
            <span className="hexScoreLabel">Score</span>
            {/* key = score: der Wechsel montiert die Zahl neu und startet damit die
                Pop-Animation — sonst änderte sich der Stand lautlos. */}
            <b key={score} className="hexScoreVal">{score}</b>
          </div>
        </div>
      </div>

      {!done && selected !== null && (
        <div className="panel">
          <div className="prompt">Nenne einen Spieler für <b style={{ color: P[1].c1 }}>{cname(board[selected].def)}</b></div>
          <div className="inrow">
            <div className="inwrap">
              <input ref={inputRef} className="field"
                placeholder={players ? "Nachname eingeben (ab 2 Buchstaben)…" : "Lade Spielerdaten…"}
                disabled={!players} value={nameInput} autoComplete="off"
                onChange={(e) => { setNameInput(e.target.value); setChosen(null); setSugOpen(true); setSugActive(-1); setFeedback(null); }}
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
          {feedback && (<div className={`fb ${feedback.type}`}>{feedback.text}{feedback.detail && <div className="fbDetail">{feedback.detail}</div>}</div>)}
          <div className="minirow">
            <button className="btn ghost" onClick={() => { setSelected(null); setNameInput(""); setChosen(null); setSugOpen(false); }}>Anderes Feld</button>
          </div>
        </div>
      )}
      {!done && selected === null && (
        <>
          {feedback && <div className={`fb ${feedback.type}`} style={{ margin: "0 2px" }}>{feedback.text}</div>}
          <div className="hint">
            <span className="turnpill" style={{ color: P[1].c1, borderColor: P[1].c1 }}><span className="dot" style={{ background: P[1].c1 }} />Heatmap</span>
            <span>— wähle ein freies Feld. Viele Felder in EINEM Zug zählen mehrfach.</span>
          </div>
        </>
      )}

      {done && (
        <div className="panel dailyEnd">
          <Confetti />
          <h2 style={{ marginTop: 0 }}>🔥 Heatmap komplett · {score} Punkte</h2>
          <div className="dailyStats">
            <span><b>{dichte.toFixed(2)}</b> Heat Density</span>
            <span><b>{moves}</b> Züge</span>
            <span><b>{misses}</b> Fehlversuche</span>
          </div>
          {best && (
            <p className="dataStamp" style={{ marginTop: 2 }}>
              {best.score === score && best.moves === moves
                ? "🏆 neuer Bestwert!"
                : `Bestwert ${best.score} Punkte${best.density ? ` (Dichte ${best.density.toFixed(2)})` : ""}`}
            </p>
          )}
          <pre className="heatGrid">{heatShareGrid(heat)}</pre>
          <div className="closeline">
            <ShareButton text={shareHeat(score, dichte, heatShareGrid(heat))} style={{ flex: 1, padding: "12px" }} />
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
            <h2>Heatmap</h2>
            <p className="ruleP"><b>Feld wählen.</b> Jedes freie Hexfeld zeigt eine Kategorie — Verein, Nation, Liga, Titel oder ein Spezialfeld.</p>
            <p className="ruleP"><b>Spieler nennen.</b> Passt er zur Kategorie, ist das Feld erobert.</p>
            <p className="ruleP"><b>Größere Züge bauen.</b> Ein gültiger Spieler prüft auch alle angrenzenden Felder. Jedes, das ebenfalls passt, fällt im selben Zug mit.</p>
            <p className="ruleP"><b>Combos bringen mehr.</b> Neue Felder zählen als Combo: 1 Feld = 1 Punkt, 2 = 3, 3 = 6, 4 = 10 — und so weiter. Sieben Felder auf einmal sind 28 Punkte, sieben einzeln nur sieben.</p>
            <p className="ruleP"><b>Erobertes nachheizen.</b> Schon eroberte Nachbarn zählen weiter, wenn dein Spieler zu ihnen passt: +1 Punkt je Feld, und das Feld steigt eine Hitzestufe.</p>
            <p className="ruleP"><b>Die Farbe zeigt die Zuggröße.</b> Alle Felder eines Zuges werden gleich heiß eingefärbt — hellgelb bei einem Feld, dann gelb, orange, hellrot, rot und schwarz ab sechs Feldern auf einmal.</p>
            <p className="ruleP"><b>Heatmap füllen.</b> Das Spiel endet, wenn alle {HEAT_CELLS.length} Felder erobert sind. Die <b>Heat Density</b> ist der Schnitt aller Hitzestufen: 1,00 heißt „lauter Alleingänge", alles darüber steht für größere Züge.</p>
            <p className="ruleP">Fehlversuche kosten keine Punkte, werden aber gezählt. Spieler dürfen mehrfach genannt werden.</p>
            <DataStamp />
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
