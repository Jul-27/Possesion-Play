import { useState, useEffect, useMemo, useRef } from "react";
import {
  norm, suggestPlayers, NATIONS, CLUBS, LEAGUES, HONOURS, POS_LABEL,
  answerGuessQuestion, guessQuestionLabel,
} from "./gameData.js";
import {
  DAILY_MAX_Q, DAILY_MAX_G, dailyDateStr, dailyNumber, dailyStarIndex,
  updateStreak, buildShareText,
} from "./dailyLogic.js";
import { Avatar } from "./Emblems.jsx";
import { loadPlayers } from "./playersStore.js";
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
import { DATA_ASOF } from "./dataInfo.js";

const sigOf = (dim, val) =>
  dim === "born" ? `born:${val.cmp}:${val.year}` :
  dim === "mate" ? `mate:${norm(val.n)}` : `${dim}:${val}`;

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
  const [mateInput, setMateInput] = useState("");
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
  const [muted, setMuted] = useState(isMuted());

  const target = useMemo(() => (players ? players[dailyStarIndex(dateStr, players)] : null), [players, dateStr]);
  const log = game.log;
  const questionsUsed = log.filter((e) => e.dim).length;
  const guessesUsed = log.filter((e) => !e.dim).length;
  const askedSigs = useMemo(() => new Set(log.filter((e) => e.dim).map((e) => sigOf(e.dim, e.val))), [log]);
  const suggestions = useMemo(() => (players ? suggestPlayers(players, nameInput, 8) : []), [players, nameInput]);
  const mateSuggestions = useMemo(() => (players && dim === "mate" ? suggestPlayers(players, mateInput, 8) : []), [players, dim, mateInput]);

  // Countdown bis lokale Mitternacht
  const nextMid = new Date(); nextMid.setHours(24, 0, 0, 0);
  const minsLeft = Math.max(0, Math.floor((nextMid.getTime() - now) / 60000));
  const countdown = `${Math.floor(minsLeft / 60)} h ${minsLeft % 60} min`;

  function save(next) {
    if (next.done && !game.done) store.set("pp:dailyStats", updateStreak(store.get("pp:dailyStats"), dateStr, next.won));
    setGame(next);
    store.set(storeKey, next);
  }

  function ask(dimKey, val) {
    if (game.done || !target || questionsUsed >= DAILY_MAX_Q) return;
    if (askedSigs.has(sigOf(dimKey, val))) { setFeedback({ type: "info", text: "Diese Frage wurde schon gestellt." }); return; }
    const a = answerGuessQuestion(target, { dim: dimKey, val });
    play(a ? "ok" : "click");
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
      setFeedback(null);
      play("win");
      save({ ...game, log: [...log, { guess: player.n, correct: true }], done: true, won: true });
    } else {
      const newLog = [...log, { guess: player.n, wrong: true }];
      const out = guessesUsed + 1 >= DAILY_MAX_G;
      setFeedback(out ? null : { type: "err", text: `${player.n} ist falsch — letzter Tipp!` });
      play(out ? "lose" : "err");
      save({ ...game, log: newLog, done: out, won: false });
    }
  }

  function giveUp() {
    if (game.done) return;
    play("lose");
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
    { k: "mate", label: "Teamkollege" },
  ];

  return (
    <div className="ppRoot">
      <div className="topbar">
        <div><h1 className="title">POSSESSION PLAY</h1><div className="subtitle">🌟 Daily-Star #{num}</div></div>
        <div className="iconrow">
          <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}>{muted ? "🔇" : "🔊"}</button>
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
          <div className="minirow"><button className="btn ghost" onClick={giveUp}>Auflösen (aufgeben)</button></div>
        </div>
      )}

      {feedback && (<div className={`fb ${feedback.type}`}>{feedback.text}</div>)}

      {game.done && (
        <div className="panel dailyEnd">
          {game.won && <Confetti />}
          <h2 style={{ marginTop: 0 }}>{game.won ? "⭐ Gefunden!" : "💀 Nicht erwischt"}</h2>
          {target && <div className="revealWho"><Avatar player={target} size={88} /><b>{target.n}</b></div>}
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
            <p className="dataStamp">Datenstand: {DATA_ASOF.split("-").reverse().join(".")} · Quelle: Wikidata</p>
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
