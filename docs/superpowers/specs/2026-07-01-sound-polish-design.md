# Design: Sounds & Micro-Animationen

**Datum:** 2026-07-01
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** WebAudio-Synth-Sounds (kein Asset), Mute-Toggle, Konfetti beim Sieg,
Protokoll-Einwurf-, Uhr-Puls-, Zellen-Pop- und Button-Animationen — in allen
vier Spielansichten (Game, Grid, Guess, Daily).

## Entscheidungen (aus dem Brainstorming)

WebAudio-Synth (keine Audio-Dateien); Mute-Toggle mit localStorage.

## Nicht-Ziele (YAGNI)

- Keine Lautstärke-Regler, keine Musik-Loops, keine Audio-Dateien,
  kein Sound in der Lobby, keine Animations-Library.

## Architektur

### A. `src/sound.js` (neu, rein, kein React)

- Lazy `AudioContext` (erst bei erster `play()`-Nutzung nach User-Geste;
  Guard `typeof window === "undefined"` → No-op für node:test).
- `play(name)` mit `click | ok | err | tick | win | lose`:
  Oszillator (sine/square) + Gain-Hüllkurve, ≤ 0,4 s, Gain ≈ 0,15.
  - `click` 1 Tap (880 Hz, 0,05 s) · `ok` Zwei-Ton aufwärts (660→880) ·
    `err` Buzz (160 Hz square, 0,2 s) · `tick` leise (1200 Hz, 0,03 s) ·
    `win` Fanfare 523/659/784 gestaffelt · `lose` 392→330 abwärts.
- `isMuted()` / `toggleMute()` — localStorage-Key `pp:muted` ("1"/fehlt);
  `play` ist bei mute No-op. try/catch um localStorage/AudioContext.

### B. Sound-Integration (lokale Aktionen + Spielende)

- **Game.jsx / Grid.jsx:** Zelle wählen → `click`; Zug korrekt → `ok`;
  falsch/verfallen → `err`; eigene Uhr ≤ 10 s (am Zug) → `tick` je Sekunde
  (im bestehenden `now`-Interval-Effect); Statuswechsel zu finished →
  Gewinner `win`, Verlierer `lose` (einmalig, Ref-Guard).
- **Guess.jsx:** Frage-Antwort „Ja" → `ok`, „Nein" → `click`; Fehltipp →
  `err`; Sieg/Niederlage wie oben.
- **Daily.jsx:** identisch zu Guess; Abschluss gewonnen → `win`, sonst `lose`.
- **Mute-Toggle:** `iconbtn` 🔊/🔇 in der Topbar aller vier Ansichten;
  lokaler State + `toggleMute()`.

### C. Micro-Animationen

- **`src/Confetti.jsx` (neu):** ~40 absolut positionierte Teilchen
  (zufällige Farbe aus P1/P2/Gold, left, Dauer, Delay als Inline-Style),
  CSS-Keyframes `confettiFall` (translateY + rotate, opacity out), Container
  `position:fixed; inset:0; pointer-events:none`. Gerendert im Sieg-Overlay:
  Game/Grid nur wenn `winner === myPlayer`, Daily wenn `game.won`,
  Guess wenn `winner === myPlayer`.
- **styles.css:**
  - `.qlogRow` → `animation: qlogIn .25s ease` (slide-in von links + fade).
  - `.clock.low` → `animation: clockPulse 1s infinite` (Farbe/Scale-Puls).
  - Zellen-Pop: `.gcell` mit Owner (Grid) und Hex-Zellen mit Owner (Game,
    bestehende Owner-Klasse/Struktur) → `animation: cellPop .25s ease`.
  - `.btn:active, .chip:active` → `transform: scale(.96)`.

## Fehlerfälle / Edge Cases

- AudioContext vom Browser suspendiert → `ctx.resume()` bei `play`;
  Fehler still schlucken (Sound ist nie funktionskritisch).
- SSR/Tests ohne `window`/AudioContext → No-op.
- End-Sound nur einmal (Ref-Guard gegen Re-Render/Reconnect).
- Reload einer fertigen Partie: kein erneuter Win-Sound (Guard: Sound nur
  bei beobachtetem Statuswechsel im Client, nicht bei initialem Load).

## Tests / Verifikation

- Bestehende 37 node:tests bleiben grün (sound.js wird von keiner getesteten
  Datei importiert; Guard schadet nicht).
- `npm run build` grün.
- Manuell: Mute-Toggle persistiert; Sounds bei Zug/Fehler/Tick/Sieg;
  Konfetti nur beim Gewinner; Animationen (Protokoll, Uhr, Zellen, Buttons).

## Betroffene Dateien

- `src/sound.js`, `src/Confetti.jsx` (neu)
- `src/Game.jsx`, `src/Grid.jsx`, `src/Guess.jsx`, `src/Daily.jsx`
- `src/styles.css`
