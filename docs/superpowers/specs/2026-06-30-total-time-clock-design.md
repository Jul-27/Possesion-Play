# Design: Gesamt-Zeitbudget (Schachuhr) statt Pro-Zug-Timer

**Datum:** 2026-06-30
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** Timer-Modell ändern: jeder Spieler hat 4:00 Min Gesamtbudget, das nur
während seines Zugs läuft; bei 0 (Brett nicht voll) verliert dieser Spieler.

## Ziel

Heute: 45 s pro Zug, lokal, Ablauf → Zug überspringen. Neu: **Schachuhr** — jeder
Spieler hat **4:00 Min insgesamt**, die nur während seines eigenen Zugs (bis er
ein Feld einträgt) heruntergezählt wird. Läuft das Budget eines Spielers ab und
das Brett ist noch nicht vollständig befüllt, **verliert** dieser Spieler.

## Entscheidungen (aus dem Brainstorming)

1. **Budget fix 4:00 (240 s) pro Spieler.** Kein Auswahlmenü.
2. **Anzeige:** zwei mm:ss-Uhren, je beim Spielernamen/Score; die aktive tickt.
3. **Geteilter Zustand:** Restzeiten in Supabase (neue Spalte), beide Clients
   sehen sie und erkennen den Timeout.
4. **Timeout = Niederlage** des Spielers, dessen Zeit abläuft (Brett nicht voll).

## Nicht-Ziele (YAGNI)

- Kein Pro-Zug-Limit mehr, kein Auto-Skip bei Ablauf (manueller „Zug
  überspringen"-Button bleibt, verbraucht Budget).
- Kein Zeit-Inkrement/Bonus pro Zug.
- Keine serverseitige Uhr (kein Backend) — Client-Zeit genügt.
- Keine Timer-Konfiguration im UI.

## Datenmodell

### Supabase (Schema-Erweiterung — Nutzer führt SQL aus)

Neue Spalte auf `public.games`:

```sql
alter table public.games add column if not exists clocks jsonb;
```

`clocks`-Struktur:

```
{ "1": <Restsekunden Spieler 1>, "2": <Restsekunden Spieler 2>,
  "started": <ISO-Zeit, wann der aktuelle Zug zu ticken begann | null>,
  "timeout": <1 | 2 | null>  // welcher Spieler die Zeit überschritten hat
}
```

`schema.sql` wird entsprechend ergänzt (für neue Setups). Bestehende DB braucht
das `alter table`.

## Architektur

### Reine Uhr-Helfer (`src/gameData.js`, testbar)

- `liveRemaining(clocks, turn, nowMs)` → Restsekunden des aktiven Spielers:
  `clocks[turn] - floor((nowMs - Date.parse(clocks.started)) / 1000)`, min 0;
  wenn `clocks.started` null → `clocks[turn]`.
- `fmtClock(sec)` → "m:ss" (z. B. 240 → "4:00", 65 → "1:05", ≤0 → "0:00").
- Konstante `START_SECONDS = 240`.

### Spiel-Logik (`src/Game.jsx`)

- **Init/Reset clocks:**
  - `Lobby.createGame`: `clocks = { "1":240, "2":240, started:null, timeout:null }`.
  - Gast tritt bei (`status`→`playing`): `clocks.started = new Date().toISOString()`.
  - `newGame`: `clocks = { "1":240, "2":240, started:now, timeout:null }`.
- **Live-Tick (lokal):** 1-Sekunden-Intervall, das nur ein Re-Render auslöst,
  solange `status==="playing"`; Restzeit wird stets aus `clocks`+`now` berechnet
  (kein eigener Countdown-State, der driftet).
- **Bei Zug (`handleSubmit`) und `skipTurn`:** vor dem Schreiben
  `rem = liveRemaining(clocks, myPlayer, Date.now())`; neue `clocks =
  { [myPlayer]: rem, [gegner]: clocks[gegner], started: now, timeout:null }`
  mit ins Update (zusätzlich zu owners/turn/last_move). Schreiben wie bisher über
  `writeMove` (turn-guarded).
- **Timeout-Erkennung & -Niederlage:**
  - Effekt prüft bei jedem Tick: wenn `status==="playing"`, Brett nicht voll und
    `liveRemaining(clocks, row.turn, now) <= 0` → Timeout.
  - **Aktiver Spieler** schreibt: `status:"finished"`,
    `clocks:{...clocks, [row.turn]:0, started:null, timeout: row.turn}`,
    `last_move:{ by:0, text:"⏱ <Name> — Zeit abgelaufen", ts:now }` (turn-guarded).
  - **Gegner (defensiv):** erkennt denselben Zustand (aktiver Spieler offline)
    und schreibt dasselbe Ende **ungeguardet** (eigener Pfad ohne `.eq turn`),
    nur falls `status` noch `playing`. Verhindert Hängenbleiben bei geschlossenem
    Tab des aktiven Spielers.

### Anzeige (`src/Game.jsx` + `src/styles.css`)

- `.score`: pro Team statt/neben dem Score eine **mm:ss-Uhr**. Aktive Uhr
  (= `row.turn`) zeigt `liveRemaining(...)`, tickt; inaktive zeigt
  `clocks[gegner]`. Unter 30 s: rot + Puls (vorhandene `.timer.low`-Optik
  wiederverwenden).
- Zentrale Einzel-Uhr entfällt.
- **„Abpfiff"-Modal:** bei `clocks.timeout` → „⏱ {Verlierer} — Zeit abgelaufen"
  und Sieger = der andere Spieler; sonst Feld-Mehrheit wie bisher.

### Entfernen

`timerMode`, `timeLeft`, der Pro-Zug-Reset und der Auto-Skip-bei-0-Effekt.

## Datenfluss

1. Spielstart setzt `clocks` (Budget 240/240).
2. Aktiver Client tickt lokal (Anzeige aus `clocks`+`now`).
3. Zug/Skip zieht verstrichene Zeit ab, setzt `started=now`, übergibt.
4. Timeout → `status:finished`, `timeout` gesetzt → Modal zeigt Sieger.

## Fehlerfälle / Edge Cases

- Aktiver Spieler schließt Tab bei ablaufender Zeit → Gegner-Client schreibt das
  Ende (defensiver ungeguardeter Pfad).
- Beide offline → Spiel bleibt offen (akzeptiert, kein Backend).
- Uhr-Drift zwischen Geräten (lokale `now`) → minimal, akzeptiert.
- `clocks` fehlt (Altspiel ohne Migration / null) → Fallback: als 240/240 ohne
  `started` behandeln, damit nichts crasht (Anzeige „4:00", kein Timeout bis
  erster Zug Werte setzt).

## Tests / Verifikation

- **node:test:** `fmtClock` (240→"4:00", 65→"1:05", 5→"0:05", −3→"0:00");
  `liveRemaining` (kein `started` → voll; verstrichene Sekunden korrekt
  abgezogen; min 0).
- **Build:** `npm run build` grün; bestehende Tests grün.
- **Manuell (zwei Browser):** Budget tickt nur beim aktiven Spieler; nach Zug
  wechselt das Ticken; bei 0 endet das Spiel mit korrektem Sieger; Gegner-seitige
  Erkennung bei geschlossenem Tab.

## Betroffene Dateien

- `supabase/schema.sql` (Spalte `clocks`)
- `src/gameData.js` (`liveRemaining`, `fmtClock`, `START_SECONDS`)
- `src/gameData.test.js` (Tests)
- `src/Lobby.jsx` (clocks-Init beim Erstellen + beim Beitreten)
- `src/Game.jsx` (Init/Tick/Zug/Skip/Timeout/Anzeige, alten Timer entfernen)
- `src/styles.css` (zwei Uhren statt zentraler Uhr)
