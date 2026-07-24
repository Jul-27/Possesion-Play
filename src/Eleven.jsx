import { useState, useEffect, useMemo, useRef } from "react";
import { norm, suggestPlayers, POS_LABEL } from "./gameData.js";
import { buildEleven, elevenAccepts } from "./eleven.js";
import { Avatar, Emblem } from "./Emblems.jsx";
import Pitch, { Jersey } from "./Pitch.jsx";
import { loadPlayers } from "./playersStore.js";
import { dailyDateStr, dailyNumber } from "./dailyLogic.js";
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
import DataStamp from "./DataStamp.jsx";
import ShareButton from "./ShareButton.jsx";
import { shareEleven } from "./share.js";

const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Speicherstand weiter */ } },
};

export default function Eleven({ onLeave }) {
  const dateStr = dailyDateStr();
  const saveKey = `pp:eleven:${dateStr}`;

  const [players, setPlayers] = useState(null);
  const [names, setNames] = useState(() => store.get(saveKey)?.names || Array(11).fill(null));
  const [wrong, setWrong] = useState(() => store.get(saveKey)?.wrong || 0);
  const [formChecked, setFormChecked] = useState(false);
  const [active, setActive] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [nameInput, setNameInput] = useState("");
  const [sugOpen, setSugOpen] = useState(false);
  const [sugActive, setSugActive] = useState(-1);
  const [muted, setMuted] = useState(isMuted());
  const [showRules, setShowRules] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { loadPlayers().then(setPlayers); }, []);

  const puzzle = useMemo(() => (players ? buildEleven(dateStr, players) : null), [players, dateStr]);
  const slots = puzzle?.slots || [];
  const formation = puzzle?.formation;
  /* Slot-Breite richtet sich nach der dichtesten Linie: der Abstand zweier Slots ist
     100/(n+1) % der Feldbreite — bei einer 5er-Reihe nur ~62 px auf dem Handy. */
  const maxLine = formation ? Math.max(...formation.lines.map((l) => l[1])) : 4;
  const usedNames = useMemo(() => new Set(names.filter(Boolean)), [names]);
  // Namen -> Record, damit die besetzten Slots ein Foto zeigen können
  const byName = useMemo(() => {
    const m = new Map();
    if (players) for (const p of players) if (!m.has(p.n)) m.set(p.n, p);
    return m;
  }, [players]);
  const filled = names.filter(Boolean).length;
  const done = filled === 11;

  const suggestions = useMemo(
    () => (players ? suggestPlayers(players, nameInput, 8).filter((p) => !usedNames.has(p.n)) : []),
    [players, nameInput, usedNames],
  );

  /* Ein Deploy kann die Formation eines laufenden Tages ändern. Dann passen die
     gespeicherten Namen nicht mehr zu den Slots — Tagesstand verwerfen statt falsch zuordnen. */
  useEffect(() => {
    if (!formation || formChecked) return;
    const saved = store.get(saveKey);
    if (saved?.form && saved.form !== formation.name) { setNames(Array(11).fill(null)); setWrong(0); }
    setFormChecked(true);
  }, [formation, formChecked, saveKey]);

  useEffect(() => {
    if (!formation) return;
    store.set(saveKey, { names, wrong, done, form: formation.name });
    if (done) {
      const prev = store.get("pp:elevenStats") || { played: 0, solved: 0 };
      if (!prev.lastSolved || prev.lastSolved !== dateStr) {
        store.set("pp:elevenStats", { played: prev.played + 1, solved: prev.solved + 1, lastSolved: dateStr });
      }
    }
  }, [names, wrong, done, formation]); // eslint-disable-line react-hooks/exhaustive-deps

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
        {formation && <span className="dailyCount form">{formation.name}</span>}
        <span className="dailyCount">{filled}/11 besetzt</span>
        <span className={`dailyCount ${wrong ? "spent" : ""}`}>Fehlversuche {wrong}</span>
      </div>

      {!players || !slots.length ? <div className="qlogEmpty">Lade Spielerdaten…</div> : (
        <div className="pitch" style={{ "--maxn1": maxLine + 1 }}>
          <Pitch />
          {slots.map((s, i) => {
            const p = names[i] ? byName.get(names[i]) : null;
            return (
              <button key={i} type="button" title={`${POS_LABEL[s.pos]} · ${s.def.name}`}
                className={`pslot ${p ? "set" : ""} ${active === i ? "active" : ""}`}
                style={{ left: `${s.x}%`, top: `${s.y}%` }} onClick={() => openSlot(i)}>
                <span className="pslotFig">
                  {p ? <Avatar player={p} size={42} /> : <Jersey pos={s.pos} />}
                  <span className="pslotEm"><Emblem def={s.def} /></span>
                </span>
                <span className="pslotName">{p ? p.ln : POS_LABEL[s.pos]}</span>
              </button>
            );
          })}
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
                      <span className="sugWho"><Avatar player={s} size={30} />{s.n}</span>
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
            <ShareButton text={shareEleven(dailyNumber(dateStr), wrong, formation?.name)} style={{ flex: 1, padding: "12px" }} />
          </div>
          <div className="closeline">
            <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Zur Lobby</button>
          </div>
        </div>
      )}

      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Elf des Tages</h2>
            <p className="ruleP">Stelle eine Elf auf — die <b>Formation wechselt täglich</b>{formation ? ` (heute ${formation.name})` : ""}. Jede Position hat eine eigene <b>Bedingung</b>: ein Verein, eine Nation, eine Liga oder ein Titel. Das Wappen an der Position zeigt sie, den vollen Namen siehst du beim Antippen.</p>
            <p className="ruleP">Ein Spieler passt, wenn <b>Position und Bedingung</b> stimmen. Jeder Spieler nur einmal. Eine besetzte Position antippen gibt sie wieder frei.</p>
            <p className="ruleP">Jedes Tagesrätsel ist nachweislich lösbar: Es wird nur ausgegeben, wenn sich elf verschiedene bekannte Spieler darauf verteilen lassen. Gültig ist aber <b>jeder</b> passende Spieler — auch ein weniger bekannter.</p>
            <DataStamp />
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
