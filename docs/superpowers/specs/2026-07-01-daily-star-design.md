# Design: „Daily-Star" — tägliches Solo-Rätsel

**Datum:** 2026-07-01
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** Erster Solo-Modus: Jeden Tag ein weltweit identischer geheimer Star.
Max. 8 Attributfragen + 2 finale Tipps. Emoji-Share, Streaks. Komplett ohne
Backend (kein Supabase, kein Netzwerk außer statischem Hosting).

## Ziel

Possession Play ist bisher reines 2-Spieler-Spiel — allein kann man nichts tun
(Kaltstart-Problem). Der Daily-Star gibt jedem Besucher sofort ein Ritual
(à la Wordle) und über das teilbare Emoji-Ergebnis einen Viral-Loop.

## Entscheidungen (aus dem Brainstorming)

1. **Spielform:** „Errate den Star" solo — täglicher geheimer Star, für alle gleich.
2. **Budget:** getrennt — max. **8 Attributfragen** und max. **2 finale Tipps**.
   Richtig getippt = gewonnen. Beide Tipps daneben = verloren (Star wird aufgedeckt).
3. **Pool:** wie im Duell — Kandidatenfilter aus `buildGuessSerial`
   (`pos` gesetzt, `nat`/`clubs` nicht leer, `sl >= GUESS_SL_MIN` = 40, ~1.200).
4. **Kein Backend:** Determinismus über Datums-Seed im Client; Fortschritt und
   Streaks in localStorage.

## Nicht-Ziele (YAGNI)

- Keine globale Bestenliste, keine Server-Validierung, kein Archiv vergangener
  Tage, kein Hard-Mode, keine Zeitmessung.
- Keine Änderung am Duell-Guess-Modus (nur eine kleine Extraktion in `gameData.js`).

## Architektur

### A. `src/dailyLogic.js` (neu, rein & testbar)

- `DAILY_EPOCH = "2026-06-30"` — Daily #1 ist der 2026-07-01.
- `DAILY_MAX_Q = 8`, `DAILY_MAX_G = 2`.
- `dailyDateStr(d = new Date())` → lokales Datum als `"YYYY-MM-DD"`
  (Wordle-Prinzip: jeder Nutzer wechselt um seine lokale Mitternacht).
- `dailyNumber(dateStr)` → laufende Nummer (#N) = Tagesdifferenz zur Epoche
  (beide Seiten via `Date.parse(dateStr)` = UTC-Mitternacht → exakte Tage).
- `dailyStarIndex(dateStr, players)` → Index des Tages-Stars: Kandidatenliste via
  `guessEligibleIndices(players)` (aus gameData, s. B), Seeded-PRNG
  (mulberry32 über String-Hash von `"daily:" + dateStr`), ein Zug aus dem Pool.
  Gleiche deployte `players.js` ⇒ gleicher Star für alle. (Bewusst akzeptiert:
  Nutzer auf einer alten gecachten Version können abweichen; Wiederholungen
  über die Jahre sind bei ~1.200 Kandidaten möglich und okay.)
- `updateStreak(stats, dateStr, won)` → neue Stats `{ played, wins, streak,
  maxStreak, last }`; Streak zählt weiter, wenn `dailyNumber(dateStr) ===
  dailyNumber(stats.last) + 1` und gewonnen, sonst Reset auf 1 (Sieg) bzw. 0
  (Niederlage).
- `buildShareText(num, log, won, url)` → Share-String:
  - Zeile 1: `Daily-Star #N ⭐` (gewonnen) bzw. `Daily-Star #N 💀` (verloren)
  - Zeile 2: Emoji je Log-Eintrag in Reihenfolge — Frage `🟦`, Fehltipp `❌`,
    richtiger Tipp `⭐`; bei Niederlage `💀` ans Ende.
  - Zeile 3: `url`.

### B. `src/gameData.js` (kleine Extraktion)

- Neu: `export function guessEligibleIndices(players)` — der bestehende
  Kandidatenfilter aus `buildGuessSerial`, als eigene Funktion.
- `buildGuessSerial` nutzt intern `guessEligibleIndices` (Verhalten unverändert).

### C. `src/Daily.jsx` (neu)

Solo-Ansicht, gleiche Bedienung wie `Guess.jsx` (Dimensions-Chips,
Tipp-Filter-Combobox für Nation/Verein, Buttons für Liga/Position/Titel,
Jahr vor/ab, Namens-Autocomplete für den Tipp), aber:

- Kein Supabase, keine Schachuhr, kein Zugwechsel.
- Kopf: `Daily-Star #N` + Zähler `Fragen x/8 · Tipps y/2`.
- Q&A-Protokoll wie im Guess-Modus (`.qlog`-Klassen), nur eigene Einträge.
- Zustand pro Tag in localStorage `pp:daily:<dateStr>`:
  `{ log: [...], done: boolean, won: boolean }` — nach jeder Aktion gespeichert;
  Reload setzt das Spiel fort; abgeschlossene Tage zeigen das Endergebnis
  (kein Zweitversuch).
- Stats in localStorage `pp:dailyStats` via `updateStreak` beim Abschluss.
- Fragen deaktiviert, wenn 8 erreicht; Spiel endet mit richtigem Tipp, mit dem
  2. Fehltipp oder Aufgeben-Button („Auflösen") — Auflösen zählt als Niederlage.
- End-Panel: Star-Aufdeckung, Stats (gespielt, Siegquote, Streak, Max-Streak),
  **Teilen-Button** (`navigator.share` wenn vorhanden, sonst Clipboard) und
  Countdown „Nächster Star um Mitternacht" (lokale Zeit, mm:ss-frei, grob in h/min).
- Spielerliste lazy via `loadPlayers()`; bis geladen Eingaben deaktiviert.

### D. Routing & Lobby

- **`App.jsx`:** liest zusätzlich `?daily` aus der URL. `?daily=1` → `<Daily …/>`
  (unabhängig von `?game`; `daily` gewinnt). `enterDaily()` pusht `?daily=1`,
  `leave()` räumt die Query wie bisher.
- **`Lobby.jsx`:** oberhalb des bestehenden Panels eine **Daily-Kachel**:
  „🌟 Daily-Star #N — Das tägliche Rätsel" mit Badge `✓ gelöst` /
  `✗ vorbei` / `y offen`, je nach localStorage-Zustand des heutigen Tages.
  Klick → `onDaily()`.

## Datenfluss

1. Lobby/URL → Daily-Ansicht; `loadPlayers()` → `dailyStarIndex(heute, players)`.
2. Jede Frage: `answerGuessQuestion(star, q)` lokal → Log + localStorage.
3. Tipp: Vergleich per Index; richtig → gewonnen; falsch → Tipp verbraucht.
4. Abschluss: `updateStreak`, End-Panel mit Share + Countdown.

## Fehlerfälle / Edge Cases

- **Doppelfrage:** exakt gleiche Frage im UI gesperrt (wie im Duell, `sigOf`).
- **Mitternachtswechsel während des Spielens:** Ansicht bleibt auf dem beim
  Öffnen geladenen Datum; erst Reload/Neueinstieg lädt den neuen Tag.
- **localStorage nicht verfügbar/korrupt:** try/catch, Fallback = frisches Spiel
  ohne Persistenz (Spiel funktioniert, nur ohne Speicherung).
- **Alte gecachte App-Version:** anderer Star möglich — akzeptiert (kein Backend).

## Tests / Verifikation (node:test, `src/dailyLogic.test.js`)

- `dailyNumber`: Epoche+1 Tag = 1; Monotonie.
- `dailyStarIndex`: deterministisch (gleiches Datum ⇒ gleicher Index, 2 Aufrufe);
  verschiedene Tage ⇒ nicht alle gleich (über 10 Tage); Ergebnis erfüllt den
  Kandidatenfilter (pos/nat/clubs/sl ≥ GUESS_SL_MIN).
- `guessEligibleIndices`: filtert korrekt (synthetische Mini-Liste).
- `updateStreak`: Folgetag-Sieg erhöht, Lückentag-Sieg reset auf 1, Niederlage
  auf 0, maxStreak wächst mit.
- `buildShareText`: Beispiel-Log → exakter erwarteter String (gewonnen und verloren).
- Build grün; `players.js` bleibt eigener Lazy-Chunk.
- Manuell: Daily spielen (Fragen, Fehltipp, Sieg), Reload mittendrin, Share-Text,
  Lobby-Badge, `?daily=1`-Deeplink.

## Betroffene Dateien

- `src/dailyLogic.js` (neu) + `src/dailyLogic.test.js` (neu)
- `src/gameData.js` (`guessEligibleIndices` extrahiert)
- `src/Daily.jsx` (neu)
- `src/App.jsx` (Routing `?daily`)
- `src/Lobby.jsx` (Daily-Kachel)
- `src/styles.css` (Kachel, Zähler, End-Panel)
