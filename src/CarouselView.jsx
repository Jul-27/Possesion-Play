import { useRef } from "react";
import { lookupDef } from "./gameData.js";
import { CAROUSEL_LIVES, CAROUSEL_SECONDS } from "./carousel.js";
import { Avatar, Emblem } from "./Emblems.jsx";

/* Gemeinsame Darstellung für Solo und Duell. Beide Modi zeigen dasselbe Karussell —
   nur die Gegenseite ist einmal ein Bot und einmal ein Mensch. */

const herzen = (n) => "❤️".repeat(Math.max(0, n)) + "🖤".repeat(Math.max(0, CAROUSEL_LIVES - n));

/** Leben, Runde, Uhr — der Kopf über der Kette. */
export function CarScore({ lives, owner, round, left, chainLen, names, over }) {
  /* Gedeckelt, weil die Restzeit im Duell aus einer gemeinsamen Frist minus lokaler
     Uhr entsteht. Wird ein Tab in den Hintergrund gelegt, drosselt der Browser das
     Intervall auf etwa einen Tick pro Minute — die lokale Uhr hinkt dann nach und die
     Differenz wird zu groß. Angezeigt wurde so schon „0:63". */
  const sek = Math.max(0, Math.min(Math.round(left), CAROUSEL_SECONDS));
  return (
    <div className="carScore">
      <div className={`carSide ${owner === 0 && !over ? "am-zug" : ""}`}>
        <span className="carWho">{names[0]}</span><span className="carHearts">{herzen(lives[0])}</span>
      </div>
      <div className="carMiddle">
        <span className="dailyCount">Runde {round}</span>
        <span className={`timer ${sek <= 10 ? "low" : ""}`} style={{ fontSize: 16, padding: "4px 12px", minWidth: 0 }}>
          0:{String(sek).padStart(2, "0")}
        </span>
        <span className="dailyCount">Kette {chainLen}</span>
      </div>
      <div className={`carSide ${owner === 1 && !over ? "am-zug" : ""}`}>
        <span className="carWho">{names[1]}</span><span className="carHearts">{herzen(lives[1])}</span>
      </div>
    </div>
  );
}

/** Die Kette selbst: Spieler mit Foto, Vereine mit Wappen, farbig nach Urheber. */
export function CarChain({ moves, players, idx, me = 0, leer }) {
  if (!moves.length) return <div className="qlogEmpty">{leer}</div>;
  return (
    <div className="carChain">
      {moves.map((m, i) => (
        <div key={i} className={`carStep ${m.kind} ${m.by === me ? "mein" : "bot"} ${i === moves.length - 1 ? "cur" : ""}`}>
          {m.kind === "player"
            ? <><Avatar player={players.find((p) => p.n === m.value)} size={30} /><span>{m.value}</span></>
            : <>{wappen(idx, m.value)}<span>{m.value}</span></>}
        </div>
      ))}
    </div>
  );
}

/* Eingabe mit Vorschlägen. Vereine werden getippt, nicht aus einer Liste geklickt —
   bei 47 Vereinen wäre eine vollständige Liste ein Spickzettel. */
export function CarInput({ kind, idx, value, onChange, onSubmit, vorschlaege, sugOpen, setSugOpen, sugActive, setSugActive }) {
  const ref = useRef(null);
  const waehle = (v) => { onChange(kind === "club" ? v : v.n); setSugOpen(false); setSugActive(-1); ref.current?.focus(); };
  function onKey(e) {
    if (sugOpen && vorschlaege.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSugActive(Math.min(sugActive + 1, vorschlaege.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSugActive(Math.max(sugActive - 1, 0)); return; }
      if (e.key === "Enter" && sugActive >= 0) { e.preventDefault(); waehle(vorschlaege[sugActive]); return; }
      if (e.key === "Escape") { setSugOpen(false); return; }
    }
    if (e.key === "Enter") onSubmit();
  }
  return (
    <div className="inrow">
      <div className="inwrap">
        <input ref={ref} className="field" autoComplete="off" value={value}
          placeholder={kind === "club" ? "Verein tippen…" : "Spielernamen tippen…"}
          onChange={(e) => { onChange(e.target.value); setSugOpen(true); setSugActive(-1); }}
          onKeyDown={onKey} onBlur={() => setTimeout(() => setSugOpen(false), 120)} onFocus={() => setSugOpen(true)} />
        {sugOpen && vorschlaege.length > 0 && (
          <div className="sug">
            {vorschlaege.map((v, i) => (
              <div key={kind === "club" ? v : v.n} className={`sugItem ${i === sugActive ? "active" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); waehle(v); }}>
                {kind === "club"
                  ? <span className="sugWho">{wappen(idx, v)}{v}</span>
                  : <><span className="sugWho"><Avatar player={v} size={30} />{v.n}</span>
                      <span className="sugMeta">{[v.pos, new Date().getFullYear() - v.by].filter(Boolean).join(" · ")}</span></>}
              </div>
            ))}
          </div>
        )}
      </div>
      <button className="btn primary" disabled={!value.trim()} onClick={onSubmit}>Nennen</button>
    </div>
  );
}

/** Die Frage über dem Eingabefeld. */
export function CarPrompt({ kind, chainLen, aktuellerSpieler, letzterVerein }) {
  if (kind === "club") return <>Bei welchem Verein war <b>{aktuellerSpieler?.n}</b>?</>;
  if (chainLen === 0) return <>Nenne einen Spieler mit <b>mindestens zwei Vereinen</b></>;
  return <>Wer hat bei <b>{letzterVerein}</b> gespielt?</>;
}

/* Wappen nur für die 47 Spielvereine — die übrigen Tausend haben keins im Repo und
   bekommen ein schlichtes Namensfeld statt eines Platzhalterbilds. */
function wappen(idx, name) {
  const key = idx?.keyOf?.(name);
  return key ? <span className="carEm"><Emblem def={lookupDef("club", key)} /></span> : null;
}
