import { useState } from "react";
import { shareText } from "./share.js";

/* Einheitlicher Teilen-Knopf für alle Abschlusspanels. Gibt Rückmeldung, weil sonst
   unklar bleibt, ob etwas passiert ist — auf dem Handy öffnet sich der Teilen-Dialog,
   am Rechner landet der Text still in der Zwischenablage. */
export default function ShareButton({ text, style }) {
  const [state, setState] = useState(null);
  async function go() {
    const r = await shareText(text);
    if (r === "shared") return;
    setState(r);
    setTimeout(() => setState(null), 1800);
  }
  const label = state === "copied" ? "Kopiert ✓" : state === "failed" ? "Teilen nicht möglich" : "Ergebnis teilen";
  return (
    <button className="btn primary" style={style} onClick={go} disabled={state === "failed"}>{label}</button>
  );
}
