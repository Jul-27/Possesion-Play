import { collectStats, totals, hasAnyStats } from "./stats.js";
import DataStamp from "./DataStamp.jsx";
import GameTop from "./GameTop.jsx";
import Icon from "./Icons.jsx";
import { alleBadges, BADGES } from "./badges.js";

/* Statistik-Übersicht. Bisher sammelte jeder Modus seine Zahlen in einem eigenen
   Speicher, ohne dass sie irgendwo zusammen zu sehen waren — gesammelter Fortschritt
   war damit praktisch unsichtbar. */
export default function Stats({ onLeave, onSolo, onDaily }) {
  const entries = collectStats();
  const t = totals(entries);
  const leer = !hasAnyStats(entries);

  return (
    <div className="ppRoot">
      <GameTop icon="chart" name="Deine Statistik" ton="#22D3EE">
        <button className="iconbtn" title="Zur Lobby" onClick={onLeave}><Icon name="leave" size={18} /></button>
      </GameTop>

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

          {(() => {
            const badges = alleBadges();
            const erreicht = badges.filter((b) => b.fertig).length;
            return (
              <>
                <div className="dSectionRow">
                  <span className="dSection">Abzeichen</span>
                  <span className={`dOffen ${erreicht === BADGES.length ? "" : "ghost"}`}>
                    {erreicht}/{BADGES.length}
                  </span>
                </div>
                <div className="badgeGrid">
                  {badges.map((b) => (
                    <div key={b.id} className={`badge ${b.fertig ? "hat" : ""}`} title={b.text}>
                      <span className="badgeIcon"><Icon name={b.icon} size={21} /></span>
                      <b className="badgeName">{b.name}</b>
                      <small className="badgeText">{b.text}</small>
                      {b.fertig
                        ? <span className="badgeXp">+{b.xp} XP</span>
                        : <span className="badgeBar"><i style={{ width: `${Math.round(b.anteil * 100)}%` }} /></span>}
                    </div>
                  ))}
                </div>
              </>
            );
          })()}

          <div className="dSectionRow"><span className="dSection">Modi</span></div>
          <div className="statList">
            {entries.map((e) => (
              <button key={e.key} type="button" className={`statRow ${e.played ? "" : "empty"}`}
                onClick={() => (e.solo ? onSolo(e.solo) : onDaily())}>
                <span className="statIcon"><Icon name={e.icon} size={20} /></span>
                <span className="statBody">
                  <span className="statName">{e.name}</span>
                  <span className="statLines">
                    {e.played
                      ? [`${e.played}×`, ...e.lines.map((l) => `${l.label} ${l.value}`)].join(" · ")
                      : "noch nicht gespielt"}
                  </span>
                </span>
                {e.streak > 0 && <span className="statStreak"><Icon name="streak" size={13} /> {e.streak}</span>}
              </button>
            ))}
          </div>
        </>
      )}

      <DataStamp />
    </div>
  );
}
