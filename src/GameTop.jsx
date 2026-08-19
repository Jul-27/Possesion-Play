import Icon from "./Icons.jsx";
import { collectStats } from "./stats.js";
import { berechneXp, stufeFuer, tagesserie } from "./progress.js";

/* Gemeinsame Kopfzeile aller Spielansichten.

   WAS SIE ERSETZT: Bisher stand auf JEDEM Spielbildschirm der volle Titel
   „POSSESSION PLAY" — auf dem Handy zwei Zeilen in Riesenschrift, plus Untertitel.
   Das kostet vor jedem Brett rund 120 Pixel, um etwas zu sagen, das der Spieler
   längst weiß. Stattdessen steht hier jetzt kompakt, WO man ist (Modus-Icon und
   -Name) und WER man ist (Stufe, Fortschritt, Serie) — dieselbe Identität wie in
   der Lobby, aber in einer Zeile statt in einem Block.

   Die Bedienknöpfe kommen als children, weil sie sich je Ansicht unterscheiden:
   Stats und Bestenliste haben nur „Zur Lobby", die Spielmodi zusätzlich Ton,
   Regeln und Fehlermeldung. */
export default function GameTop({ icon, name, zusatz, ton, children, ohneFortschritt = false }) {
  const entries = collectStats();
  const stufe = stufeFuer(berechneXp(entries).xp);
  const serie = tagesserie(entries);

  return (
    <>
      <div className="gtop">
        <div className="gtopMain">
          <span className="gtopIcon" style={ton ? { "--ton": ton } : undefined}>
            <Icon name={icon} size={20} />
          </span>
          <span className="gtopText">
            <b>{name}</b>
            {zusatz != null && zusatz !== "" && <small>{zusatz}</small>}
          </span>
        </div>
        <div className="iconrow">{children}</div>
      </div>

      {!ohneFortschritt && (
        <div className="gtopMe">
          <span className="gtopStufe">{stufe.kurz}</span>
          <span className="gtopBar"><i style={{ width: `${Math.round(stufe.anteil * 100)}%` }} /></span>
          <span className="gtopStufeName">{stufe.name}</span>
          {serie > 0 && (
            <span className="gtopSerie" title="Tage in Folge gespielt">
              <Icon name="streak" size={12} />{serie}
            </span>
          )}
        </div>
      )}
    </>
  );
}
