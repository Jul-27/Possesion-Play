import { useState } from "react";
import { einladungsLink } from "./duelJoin.js";

/* „Warte auf Mitspieler" — eine Ansicht für alle vier Duell-Modi.

   Sie stand dreimal wortgleich in Game, Grid und Guess; das Karussell hatte eine
   eigene, die nur den Code kopierte, nicht den Link. Genau dort fiel es auf: Wer
   den Code bekommt, muss ihn abtippen, wer den Link bekommt, klickt einmal.

   Der Code bleibt trotzdem sichtbar — er ist der Weg, wenn man am Telefon vorliest
   oder der Link im Messenger zerbricht. */
export default function WaitForOpponent({ code, onLeave }) {
  const [kopiert, setKopiert] = useState(false);

  function linkKopieren() {
    const link = einladungsLink(code);
    /* navigator.share auf dem Handy, Zwischenablage am Rechner. Bricht der Nutzer
       das Teilen-Blatt ab, wirft share() ab — das ist kein Fehler, nur ein Nein. */
    if (navigator.share) { navigator.share({ text: link }).catch(() => {}); return; }
    navigator.clipboard?.writeText(link).then(() => {
      setKopiert(true);
      setTimeout(() => setKopiert(false), 1500);
    });
  }

  return (
    <div className="overlay">
      <div className="modal" style={{ textAlign: "center" }}>
        <h2>Warte auf Mitspieler</h2>
        <p>Schick den Link — wer ihn öffnet, ist sofort dabei.</p>
        <div className="code">{code}</div>
        <div className="closeline">
          <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={linkKopieren}>
            {kopiert ? "Link kopiert ✓" : "Einladungslink teilen"}
          </button>
        </div>
        <button className="btn ghost block" style={{ marginTop: 10 }} onClick={onLeave}>Abbrechen</button>
      </div>
    </div>
  );
}
