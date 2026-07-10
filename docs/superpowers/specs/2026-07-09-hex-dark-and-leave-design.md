# Design: Dunkle Hex-Felder + Spielende beim Fenster-Schließen

**Datum:** 2026-07-09
**Status:** Genehmigt (User-Report), bereit für Implementierungsplanung

## Befund 1: Untere Hex-Felder zu dunkel (Hex + Solo)

**Diagnose (im Browser gemessen):** Kein Clipping (`overflow: visible`,
unterste Kante innerhalb des Boards). Ursache ist der **Zell-Gradient** in
`Emblems.jsx` (`Cell`, neutraler Hintergrund):
`linear-gradient(155deg, rgba(20,40,33,.72), rgba(8,20,15,.85))` läuft nach
unten fast ins Schwarze. In den mittleren Reihen kaschiert das Flutlicht das,
die unterste Reihe liegt aber außerhalb des Kegels → dort wirkt der dunkle
Sockel jedes Hex am stärksten.

**Fix (live verifiziert):**
- Neutraler Zell-Gradient aufgehellt:
  `linear-gradient(155deg, rgba(34,60,50,.92), rgba(22,42,34,.96))`.
- Flutlicht flacher/gleichmäßiger (`.board::before`):
  `radial-gradient(85% 72% at 50% 50%, rgba(244,201,93,.10), transparent 95%)`.

Da `Cell` von `Game.jsx` (Hex-Multiplayer) und `Solo.jsx` (Training) genutzt
wird, wirkt die eine Änderung in beiden Modi. (Raster nutzt eigene `.gcell` —
nicht betroffen, war auch nicht beanstandet.)

## Befund 2: Spielende beim Schließen (Multiplayer)

**Entscheidung:** Schließen beendet das Spiel, ein Reload/kurzer Ausfall nicht
(Karenz ~15 s). Gilt für alle drei Duell-Modi (Hex, Raster, Errate den Star).

**Mechanik (kein Server-Code):**
1. **Verlassen-Signal:** Beim `pagehide` (nur `event.persisted === false`, also
   echtes Entladen — nicht Mobile-Hintergrund/bfcache) schreibt der schließende
   Client per **`fetch(..., { keepalive: true })`** an die Supabase-REST-API
   einen weichen Marker in `last_move`: `{ ...last_move, leftBy: <player>,
   leftAt: <ts> }` (Status bleibt `playing`). Neuer Helfer
   `beaconUpdate(code, patch)` in `supabaseClient.js` (setzt apikey/Bearer-Header;
   `keepalive` überlebt das Entladen — anders als der normale supabase-js-Client).
2. **Rückkehr räumt auf:** Beim Mount, wenn `last_move.leftBy === myPlayer`
   (ich bin zurück, z. B. nach Reload), wird der Marker sofort entfernt.
3. **Gegner-Erkennung + Karenz:** Der noch offene Client sieht per Realtime
   `leftBy === Gegner`, zeigt ein Overlay „Gegner offline — Spiel endet gleich…"
   und startet einen 15-s-Timer. Kehrt der Gegner zurück (Marker verschwindet)
   oder zieht er (neuer `last_move`), wird der Timer abgebrochen. Läuft er ab,
   schreibt der **anwesende** Client das Spielende: `status = "finished"` +
   `last_move.forfeit = <leaver>`.
4. **Anzeige:** Endet das Spiel per `forfeit`, zeigt das Abpfiff-Overlay
   „🚪 <Name> hat das Spiel verlassen" und der andere Spieler gewinnt.

**Gemeinsame Logik** in neuem Hook `src/usePresence.js`
(`useLeaveEndsGame({ code, myPlayer, status, lastMoveRef, setRow, finalize })`):
kapselt Beacon, Aufräumen und Karenz-Timer; `finalize(leaver)` liefert jede
Komponente modus-spezifisch (schreibt das Forfeit-Ende). Gibt
`opponentLeaving` (bool) fürs Overlay zurück.

## Nicht-Ziele (YAGNI)

- Kein Ende beim „Verlassen"-Button (⏏ → Lobby, SPA-Nav, kein Unload) — bewusst.
- Keine exakte Sekundenanzeige im Overlay; kein Presence-/Heartbeat-System.
- Kein neuer DB-Spalten (Marker liegt in `last_move` jsonb).

## Fehlerfälle / Edge Cases

- Beide schließen → niemand finalisiert → Spiel bleibt „playing" (verwaist,
  egal). Akzeptiert.
- Mobile-Hintergrund (bfcache, `persisted === true`) → kein Marker → kein
  Fehl-Ende.
- Reload: `pagehide` setzt Marker → Remount (~1–2 s) räumt ihn ab → Gegner-Timer
  bricht ab → Spiel läuft weiter.
- Karenz-Ende nur einmal (Ref-Guard), nur vom anwesenden Client geschrieben.

## Tests / Verifikation

- Bestehende 42 Tests bleiben grün (reine UI/Timing-Änderung); Build grün.
- Visuell: untere Reihe im Browser gegengeprüft (Hex + Solo).
- Manuell: Fenster schließen → Gegner-Overlay → nach 15 s Abpfiff „verlassen";
  Reload während der Karenz → Spiel läuft weiter.

## Betroffene Dateien

- `src/Emblems.jsx`, `src/styles.css` (Befund 1)
- `src/supabaseClient.js` (`beaconUpdate`), `src/usePresence.js` (neu)
- `src/Game.jsx`, `src/Grid.jsx`, `src/Guess.jsx` (Hook + Forfeit-Overlay)
