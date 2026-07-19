import { useState, useEffect, useMemo, useRef } from "react";
import { norm, suggestPlayers, POS_LABEL } from "./gameData.js";
import { FORMATION, SLOT_POSITIONS, buildEleven, elevenAccepts } from "./eleven.js";
import { loadPlayers } from "./playersStore.js";
import { dailyDateStr, dailyNumber } from "./dailyLogic.js";
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
import { DATA_ASOF } from "./dataInfo.js";

const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Speicherstand weiter */ } },
};

// Reihen von vorne nach hinten anzeigen: Sturm oben, Tor unten.
const ROWS = (() => {
  let at = 0;
  const rows = FORMATION.map((f) => { const r = { ...f, from: at }; at += f.count; return r; });
  return rows.reverse();
})();

export default function Eleven({ onLeave }) {
  const dateStr = dailyDateStr();
  const saveKey = `pp:eleven:${dateStr}`;

  const [players, setPlayers] = useState(null);
  const [names, setNames] = useState(() => store.get(saveKey)?.names || Array(11).fill(null));
  const [wrong, setWrong] = useState(() => store.get(saveKey)?.wrong || 0);
  const [active, setActive] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [sugOpen, setSugOpen] = useState(false);
  const [sugActive, setSugActive] = useState(-1);
  const [muted, setMuted] = useState(isMuted());
  const [showRules, setShowRules] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { loadPlayers().then(setPlayers); }, []);

  const slots = useMemo(() => (players ? buildEleven(dateStr, players).slots : []), [players, dateStr]);
  const usedNames = useMemo(() => new Set(names.filter(Boolean)), [names]);
  const filled = names.filter(Boolean).length;
  const done = filled === 11;

  const suggestions = useMemo(
    () => (players ? suggestPlayers(players, nameInput, 8).filter((p) => !usedNames.has(p.n)) : []),
    [players, nameInput, usedNames],
  );

  useEffect(() => {
    store.set(saveKey, { names, wrong, done });
    if (done) {
      const prev = store.get("pp:elevenStats") || { played: 0, solved: 0 };
      if (!prev.lastSolved || prev.lastSolved !== dateStr) {
        store.set("pp:elevenStats", { played: prev.played + 1, solved: prev.solved + 1, lastSolved: dateStr });
      }
    }
  }, [names, wrong, done]); // eslint-disable-line react-hooks/exhaustive-deps

  function openSlot(i) {
    if (names[i]) { // besetzte Position wieder freigeben
      const next = [...names]; next[i] = null; setNames(next);
      setActive(i); setFeedback(null); setNameInput("");
      play("click");
      return;
    }
    setActive(i); setFeedback(null); setNameInput("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function submit() {
    if (active === null || !players) return;
    const q = norm(nameInput.trim());
    if (!q) return;
    const hit = players.find((p) => norm(p.n) === q) || players.find((p) => norm(p.ln) === q);
    if (!hit) { setFeedback({ ok: false, text: "Diesen Spieler kenne ich nicht." }); return; }
    if (usedNames.has(hit.n)) { setFeedback({ ok: false, text: `${hit.n} steht schon in der Elf.` }); return; }

    const slot = slots[active];
    if (!elevenAccepts(hit, slot)) {
      const why = hit.pos !== slot.pos
        ? `${hit.n} ist ${POS_LABEL[hit.pos] || hit.pos}, gesucht ist ${POS_LABEL[slot.pos]}.`
        : `${hit.n} erfüllt „${slot.def.name}" nicht.`;
      setWrong((w) => w + 1);
      setFeedback({ ok: false, text: why });
      play("err");
      return;
    }

    const next = [...names]; next[active] = hit.n; setNames(next);
    setNameInput(""); setSugOpen(false); setActive(null); setFeedback(null);
    play("ok");
  }

  function chooseSug(p) { setNameInput(p.n); setSugOpen(false); setSugActive(-1); inputRef.current?.focus(); }
  function onInputKey(e) {
    if (sugOpen && suggestions.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSugActive((i) => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSugActive((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" && sugActive >= 0) { e.preventDefault(); chooseSug(suggestions[sugActive]); return; }
      if (e.key === "Escape") { setActive(null); return; }
    }
    if (e.key === "Enter") submit();
  }

  return (
    <div className="ppRoot">
      <div className="topbar">
        <div><h1 className="title">POSSESSION PLAY</h1><div className="subtitle">👕 Elf des Tages · #{dailyNumber(dateStr)}</div></div>
        <div className="iconrow">
          <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}>{muted ? "🔇" : "🔊"}</button>
          <button className="iconbtn" title="Regeln" onClick={() => setShowRules(true)}>?</button>
          <button className="iconbtn" title="Zur Lobby" onClick={onLeave}>⏏</button>
        </div>
      </div>

      <div className="dailyMeta">
        <span className="dailyCount">{filled}/11 besetzt</span>
        <span className={`dailyCount ${wrong ? "spent" : ""}`}>Fehlversuche {wrong}</span>
      </div>

      {!players || !slots.length ? <div className="qlogEmpty">Lade Spielerdaten…</div> : (
        <div className="pitch">
          {ROWS.map((row) => (
            <div key={row.pos} className="pitchRow">
              {Array.from({ length: row.count }, (_, k) => {
                const i = row.from + k;
                const s = slots[i];
                return (
                  <button key={i} className={`slot ${names[i] ? "set" : ""} ${active === i ? "active" : ""}`} onClick={() => openSlot(i)}>
                    <span className="slotDef">{s.def.name}</span>
                    <span className="slotName">{names[i] || POS_LABEL[SLOT_POSITIONS[i]]}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {active !== null && !done && slots.length > 0 && (
        <div className="panel">
          <div className="prompt">
            {POS_LABEL[slots[active].pos]} · <b>{slots[active].def.name}</b>
          </div>
          <div className="inrow">
            <div className="inwrap">
              <input ref={inputRef} className="field" placeholder="Spielernamen tippen…" value={nameInput} autoComplete="off"
                onChange={(e) => { setNameInput(e.target.value); setSugOpen(true); setSugActive(-1); setFeedback(null); }}
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
            <button className="btn primary" disabled={!nameInput.trim()} onClick={submit}>Aufstellen</button>
          </div>
          {feedback && <div className={`fb ${feedback.ok ? "ok" : "err"}`} style={{ marginTop: 10 }}>{feedback.text}</div>}
          <div className="minirow"><button className="btn ghost" onClick={() => setActive(null)}>Abbrechen</button></div>
        </div>
      )}

      {done && (
        <div className="panel dailyEnd">
          <Confetti />
          <h2 style={{ marginTop: 0 }}>👕 Elf komplett!</h2>
          <p>Du hast die Elf des Tages #{dailyNumber(dateStr)} aufgestellt — mit {wrong} Fehlversuch{wrong === 1 ? "" : "en"}.</p>
          <div className="closeline">
            <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Zur Lobby</button>
          </div>
        </div>
      )}

      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Elf des Tages</h2>
            <p className="ruleP">Stelle eine Elf in 4-4-2 auf. Jede Position hat eine eigene <b>Bedingung</b> — ein Verein, eine Nation, eine Liga oder ein Titel.</p>
            <p className="ruleP">Ein Spieler passt, wenn <b>Position und Bedingung</b> stimmen. Jeder Spieler nur einmal. Eine besetzte Position antippen gibt sie wieder frei.</p>
            <p className="ruleP">Jedes Tagesrätsel ist nachweislich lösbar: Es wird nur ausgegeben, wenn sich elf verschiedene bekannte Spieler darauf verteilen lassen. Gültig ist aber <b>jeder</b> passende Spieler — auch ein weniger bekannter.</p>
            <p className="dataStamp">Datenstand: {DATA_ASOF.split("-").reverse().join(".")} · Quelle: Wikidata</p>
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
