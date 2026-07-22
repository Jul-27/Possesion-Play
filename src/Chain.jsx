import { useState, useEffect, useMemo, useRef } from "react";
import { norm, suggestPlayers } from "./gameData.js";
import {
  playerAttrs, openAttrs, linkBetween, attrLabel, pickChainStart, chainHint,
  CHAIN_START_SECONDS, CHAIN_BONUS_SECONDS,
} from "./chain.js";
import { Avatar } from "./Emblems.jsx";
import { loadPlayers } from "./playersStore.js";
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
import DataStamp from "./DataStamp.jsx";

const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Statistik weiter */ } },
};

// Fußball-Kette: Spieler aneinanderreihen, jede Verbindung nur einmal.
export default function Chain({ onLeave }) {
  const [players, setPlayers] = useState(null);
  const [chain, setChain] = useState([]);          // [{ player, via }] — via = Verbindung zum Vorgänger
  const [burned, setBurned] = useState(() => new Set());
  const [left, setLeft] = useState(CHAIN_START_SECONDS);
  const [over, setOver] = useState(null);          // { reason: "time"|"stuck"|"quit", hint }
  const [feedback, setFeedback] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [sugOpen, setSugOpen] = useState(false);
  const [sugActive, setSugActive] = useState(-1);
  const [muted, setMuted] = useState(isMuted());
  const [showRules, setShowRules] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { loadPlayers().then(setPlayers); }, []);
  useEffect(() => { if (players && !chain.length) startGame(players); }, [players]); // eslint-disable-line react-hooks/exhaustive-deps

  // Uhr — läuft nur im laufenden Spiel
  useEffect(() => {
    if (over || !chain.length) return;
    const t = setInterval(() => setLeft((s) => {
      if (s <= 1) { setOver({ reason: "time", hint: null }); play("err"); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [over, chain.length]);

  const current = chain.length ? chain[chain.length - 1].player : null;
  const usedNames = useMemo(() => new Set(chain.map((c) => c.player.n)), [chain]);
  const open = useMemo(() => (current ? openAttrs(current, burned) : []), [current, burned]);
  const suggestions = useMemo(
    () => (players ? suggestPlayers(players, nameInput, 8).filter((p) => !usedNames.has(p.n)) : []),
    [players, nameInput, usedNames],
  );

  function startGame(list) {
    const i = pickChainStart(list);
    setChain(i >= 0 ? [{ player: list[i], via: null }] : []);
    setBurned(new Set());
    setLeft(CHAIN_START_SECONDS);
    setOver(null); setFeedback(null); setNameInput(""); setSugOpen(false);
  }

  function finish(reason) {
    const hint = reason === "quit" || reason === "stuck"
      ? chainHint(players, current, burned, usedNames)
      : null;
    setOver({ reason, hint });
    const prev = store.get("pp:chainStats") || { played: 0, best: 0, total: 0 };
    const next = { played: prev.played + 1, best: Math.max(prev.best, chain.length), total: prev.total + chain.length };
    store.set("pp:chainStats", next);
    play(chain.length > prev.best ? "win" : "err");
  }

  function submit() {
    if (over || !players || !current) return;
    const q = norm(nameInput.trim());
    if (!q) return;
    const hit = players.find((p) => norm(p.n) === q) || players.find((p) => norm(p.ln) === q);
    if (!hit) { setFeedback({ ok: false, text: "Diesen Spieler kenne ich nicht." }); return; }
    if (usedNames.has(hit.n)) { setFeedback({ ok: false, text: `${hit.n} ist schon in der Kette.` }); return; }

    const via = linkBetween(current, hit, burned);
    if (!via) {
      setFeedback({ ok: false, text: `${hit.n} teilt keine freie Verbindung mit ${current.n}.` });
      play("err");
      return;
    }

    const nextBurned = new Set(burned); nextBurned.add(via);
    const nextChain = [...chain, { player: hit, via }];
    setBurned(nextBurned);
    setChain(nextChain);
    setLeft((s) => s + CHAIN_BONUS_SECONDS);
    setFeedback({ ok: true, text: `+${CHAIN_BONUS_SECONDS}s · über ${attrLabel(via)}` });
    setNameInput(""); setSugOpen(false); setSugActive(-1);
    play("ok");

    // Sackgasse: der neue Spieler hat keine freien Anschlüsse mehr
    if (!openAttrs(hit, nextBurned).length) {
      const prev = store.get("pp:chainStats") || { played: 0, best: 0, total: 0 };
      store.set("pp:chainStats", { played: prev.played + 1, best: Math.max(prev.best, nextChain.length), total: prev.total + nextChain.length });
      setOver({ reason: "stuck", hint: null });
    }
  }

  function chooseSug(p) { setNameInput(p.n); setSugOpen(false); setSugActive(-1); inputRef.current?.focus(); }
  function onInputKey(e) {
    if (sugOpen && suggestions.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSugActive((i) => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSugActive((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" && sugActive >= 0) { e.preventDefault(); chooseSug(suggestions[sugActive]); return; }
      if (e.key === "Escape") { setSugOpen(false); return; }
    }
    if (e.key === "Enter") submit();
  }

  const stats = store.get("pp:chainStats") || { played: 0, best: 0, total: 0 };
  const isRecord = over && chain.length >= stats.best && chain.length > 1;

  return (
    <div className="ppRoot">
      <div className="topbar">
        <div><h1 className="title">POSSESSION PLAY</h1><div className="subtitle">⛓ Fußball-Kette · Solo</div></div>
        <div className="iconrow">
          <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}>{muted ? "🔇" : "🔊"}</button>
          <button className="iconbtn" title="Regeln" onClick={() => setShowRules(true)}>?</button>
          <button className="iconbtn" title="Zur Lobby" onClick={onLeave}>⏏</button>
        </div>
      </div>

      <div className="dailyMeta">
        <span className="dailyCount">Kette {chain.length}</span>
        <span className="dailyCount">Rekord {stats.best}</span>
        <span className={`timer ${left <= 15 ? "low" : ""}`} style={{ fontSize: 16, padding: "4px 12px", minWidth: 0 }}>
          {String(Math.floor(left / 60))}:{String(left % 60).padStart(2, "0")}
        </span>
      </div>

      {!players || !chain.length ? <div className="qlogEmpty">Lade Spielerdaten…</div> : (
        <>
          <div className="chainList">
            {chain.map(({ player, via }, i) => (
              <div key={player.n} className={`chainRow ${i === chain.length - 1 ? "cur" : ""}`}>
                <span className="chainStep">{i + 1}</span>
                <Avatar player={player} size={36} />
                <span className="chainName">{player.n}</span>
                {via && <span className="chainVia">über {attrLabel(via)}</span>}
              </div>
            ))}
          </div>

          {!over && (
            <div className="panel">
              <div className="prompt">Wer passt zu <b>{current.n}</b>?</div>
              <div className="chainChips">
                {open.map((a) => <span key={a} className="chainChip">{attrLabel(a)}</span>)}
              </div>
              <div className="inrow" style={{ marginTop: 10 }}>
                <div className="inwrap">
                  <input ref={inputRef} className="field" placeholder="Spielernamen tippen…" value={nameInput} autoComplete="off"
                    onChange={(e) => { setNameInput(e.target.value); setSugOpen(true); setSugActive(-1); setFeedback(null); }}
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
                <button className="btn primary" disabled={!nameInput.trim()} onClick={submit}>Anhängen</button>
              </div>
              {feedback && <div className={`fb ${feedback.ok ? "ok" : "err"}`} style={{ marginTop: 10 }}>{feedback.text}</div>}
              <div className="minirow"><button className="btn ghost" onClick={() => finish("quit")}>Aufgeben</button></div>
            </div>
          )}
        </>
      )}

      {over && (
        <div className="panel dailyEnd">
          {isRecord && <Confetti />}
          <h2 style={{ marginTop: 0 }}>
            {over.reason === "time" ? "⏱ Zeit abgelaufen" : over.reason === "stuck" ? "🚧 Sackgasse" : "🏁 Beendet"}
          </h2>
          <p>Deine Kette: <b>{chain.length} Spieler</b>{isRecord ? " — neuer Rekord!" : ` · Rekord ${stats.best}`}</p>
          {over.reason === "stuck" && (
            <p className="ruleP">{current?.n} hat keine freie Verbindung mehr — alle seine Vereine, Ligen, Titel und seine Nation sind verbraucht.</p>
          )}
          {over.hint && (
            <p className="ruleP">Möglich gewesen wäre etwa <b>{over.hint.player.n}</b> über {attrLabel(over.hint.via)}.</p>
          )}
          <div className="closeline">
            <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={() => startGame(players)}>Neue Kette</button>
            <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Zur Lobby</button>
          </div>
        </div>
      )}

      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Fußball-Kette</h2>
            <p className="ruleP">Häng an den Startspieler einen weiteren an. Er muss mit ihm eine <b>Gemeinsamkeit</b> teilen: einen Verein, eine Nation, eine Liga oder einen Titel.</p>
            <p className="ruleP">Jede genutzte Verbindung ist danach <b>verbraucht</b>. Die noch freien Anschlüsse des aktuellen Spielers stehen unter der Kette.</p>
            <p className="ruleP">Du startest mit {CHAIN_START_SECONDS} Sekunden, jeder Treffer bringt <b>+{CHAIN_BONUS_SECONDS}s</b>. Wähle Spieler mit vielen offenen Anschlüssen — sonst endet die Kette in einer Sackgasse.</p>
            <DataStamp />
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
