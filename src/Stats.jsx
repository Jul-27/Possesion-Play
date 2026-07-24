import { collectStats, totals, hasAnyStats } from "./stats.js";
import DataStamp from "./DataStamp.jsx";

/* Statistik-Übersicht. Bisher sammelte jeder Modus seine Zahlen in einem eigenen
   Speicher, ohne dass sie irgendwo zusammen zu sehen waren — gesammelter Fortschritt
   war damit praktisch unsichtbar. */
export default function Stats({ onLeave, onSolo, onDaily }) {
  const entries = collectStats();
  const t = totals(entries);
  const leer = !hasAnyStats(entries);

  return (
    <div className="ppRoot">
      <div className="topbar">
        <div><h1 className="title">POSSESSION PLAY</h1><div className="subtitle">📊 Deine Statistik</div></div>
        <div className="iconrow">
          <button className="iconbtn" title="Zur Lobby" onClick={onLeave}>⏏</button>
        </div>
      </div>

      {leer ? (
        <div className="panel" style={{ marginTop: 18 }}>
          <div className="prompt">Noch nichts gespielt</div>
          <p className="ruleP">Sobald du ein Rätsel löst, sammeln sich hier deine Serien und Bestwerte.</p>
          <div className="closeline">
            <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={onDaily}>Daily-Star starten</button>
          </div>
        </div>
      ) : (
        <>
          <div className="statTotals">
            <div className="statTotal"><b>{t.played}</b><span>Rätsel gespielt</span></div>
            <div className="statTotal"><b>{t.modes}</b><span>Modi genutzt</span></div>
            <div className="statTotal"><b>{t.bestStreak}</b><span>längste Serie</span></div>
          </div>

          <div className="statList">
            {entries.map((e) => (
              <button key={e.key} type="button" className={`statRow ${e.played ? "" : "empty"}`}
                onClick={() => (e.solo ? onSolo(e.solo) : onDaily())}>
                <span className="statIcon">{e.icon}</span>
                <span className="statBody">
                  <span className="statName">{e.name}</span>
                  <span className="statLines">
                    {e.played
                      ? [`${e.played}×`, ...e.lines.map((l) => `${l.label} ${l.value}`)].join(" · ")
                      : "noch nicht gespielt"}
                  </span>
                </span>
                {e.streak > 0 && <span className="statStreak">🔥 {e.streak}</span>}
              </button>
            ))}
          </div>
        </>
      )}

      <DataStamp />
    </div>
  );
}
