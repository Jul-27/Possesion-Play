# Design: Gameplay-Feedback-Fixes (4 User-Reports)

**Datum:** 2026-07-07
**Status:** Genehmigt (User-Report), bereit für Implementierungsplanung
**Scope:** Vier beim Spielen gemeldete Fehler.

## Befunde & Fixes

### 1. Lobby zeigt immer „Hex-Duell"

`Lobby.jsx` hat einen statischen Untertitel. Fix: dynamisch nach gewähltem
Modus (`{ hex: "Hex-Duell", grid: "Raster-Duell", guess: "Errate den Star" }` +
„· Online gegen einen Freund"). Zusätzlich Konsistenz: `Game.jsx`-Topbar sagt
„Online · Code X" → „Hex-Duell · Code X".

### 2. Spieler-Suche: Vorname & Sonderzeichen

`suggestPlayers` matcht nur `norm(ln).startsWith(q)`; `norm` (NFD-Strip)
zerlegt ø/ł/đ/æ/ß/ð/þ/œ nicht.
Fix in `gameData.js`:
- `norm` erweitert um explizite Ersetzungen (nach `toLowerCase`):
  ø→o, ł→l, đ→d, æ→ae, ß→ss, ð→d, þ→th, œ→oe.
- `suggestPlayers` matcht zusätzlich **Vollnamen-Präfix** und **Wortanfänge**
  im Namen (`full.startsWith(q) || full.includes(" " + q)`), Sortierung
  unverändert (sl desc, dann Nachname). Konsistenz: `handleSubmit`-Exaktmatch
  nutzt dasselbe `norm` auf beiden Seiten — bleibt korrekt.

### 3. Grüne Letzter-Zug-Box stört beim Dropdown

`Game.jsx`/`Grid.jsx` zeigen `row.last_move.text` dauerhaft als Feedback-Box.
Fix: Box nur zeigen, wenn KEINE Zelle ausgewählt ist
(`selected === null`) — während der Eingabe verschwindet sie, lokale
Fehlermeldungen (`localFeedback`) bleiben sichtbar.

### 4. Zeit abgelaufen → nichts passiert (kritisch)

Root Cause: Supabase-Query-Builder sind **lazy Thenables** — ohne
`await`/`.then()` wird kein Request gesendet. Die Timeout-Effects in
`Game.jsx`, `Grid.jsx`, `Guess.jsx` rufen `supabase.…update(finish)…` ohne
beides auf → das Finish wird nie geschrieben.
Fix: `.then(() => {})` an beide Update-Ketten (myTurn-Zweig und defensiver
Gegner-Zweig) in allen drei Dateien.

## Nicht-Ziele (YAGNI)

- Keine Fuzzy-Suche/Ranking-Umbau; kein Refactor der Feedback-Anzeige.

## Tests / Verifikation

- `suggestPlayers`: Vorname („lionel" → Messi), ø („sorloth" → Sørloth),
  Ł („lukasz" → Piszczek), Vollnamen-Präfix („mohamed sa" → Salah);
  bestehender Präfix-Test bleibt grün.
- `norm`: bestehende Nutzungen (Tests laufen mit).
- Timeout: Code-Fix + manueller Test (Uhr ablaufen lassen → Abpfiff bei beiden).
- Build grün; Lobby-Untertitel wechselt mit Modus-Klick.

## Betroffene Dateien

- `src/gameData.js`, `src/gameData.test.js`
- `src/Lobby.jsx`, `src/Game.jsx`, `src/Grid.jsx`, `src/Guess.jsx`
