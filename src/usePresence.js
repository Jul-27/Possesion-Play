import { useEffect, useRef, useState } from "react";
import { supabase, beaconUpdate } from "./supabaseClient.js";

const GRACE_MS = 15000;

// Beendet ein Multiplayer-Spiel, wenn der Gegner das Fenster schließt (Karenz).
// finalize(leaver) schreibt das modus-spezifische Forfeit-Ende.
// lastMove = row?.last_move. Gibt opponentLeaving (bool) fürs Overlay zurück.
export function useLeaveEndsGame({ code, myPlayer, status, lastMove, finalize }) {
  const [opponentLeaving, setOpponentLeaving] = useState(false);
  const lmRef = useRef(lastMove);
  lmRef.current = lastMove;
  const finRef = useRef(finalize);
  finRef.current = finalize;

  // 1) Beim echten Entladen weichen Marker senden (keepalive überlebt das)
  useEffect(() => {
    const onHide = (e) => {
      if (e.persisted) return;                 // Mobile-Hintergrund/bfcache ignorieren
      if (status !== "playing" || !myPlayer) return;
      beaconUpdate(code, {
        last_move: { ...(lmRef.current || {}), leftBy: myPlayer, leftAt: Date.now() },
        updated_at: new Date().toISOString(),
      });
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [code, myPlayer, status]);

  // 2) Rückkehr (z. B. nach Reload) räumt den eigenen Marker ab
  useEffect(() => {
    if (myPlayer && lastMove?.leftBy === myPlayer) {
      const { leftBy, leftAt, ...rest } = lastMove;
      supabase.from("games").update({ last_move: rest, updated_at: new Date().toISOString() })
        .eq("code", code).then(() => {});
    }
  }, [lastMove?.leftBy, myPlayer, code]); // eslint-disable-line

  // 3) Gegner offline -> Karenz -> finalisieren
  useEffect(() => {
    const leaver = lastMove?.leftBy;
    if (status !== "playing" || !myPlayer || !leaver || leaver === myPlayer) { setOpponentLeaving(false); return; }
    setOpponentLeaving(true);
    let fired = false;
    const id = setTimeout(() => { if (!fired) { fired = true; finRef.current(leaver); } }, GRACE_MS);
    return () => clearTimeout(id);
  }, [lastMove?.leftBy, lastMove?.leftAt, status, myPlayer]); // eslint-disable-line

  return opponentLeaving;
}
