# Design: Karriere-Pfad (Solo) + Solo-Bereich in der Lobby

**Datum:** 2026-07-15
**Status:** Genehmigt (User: „Reihenfolge passt, leg einfach los")
**Scope:** Erstes von vier neuen Spielen. Zusätzlich der einmalige Lobby-Umbau
zu einem skalierbaren Solo-Bereich, an den die drei folgenden Spiele andocken.

## Spielprinzip

Die App wählt einen Spieler mit mehreren Karrierestationen. Diese werden
**chronologisch nacheinander aufgedeckt** (älteste zuerst, z. B.
„Sporting Lissabon · 2002–2003"). Ziel: den Spieler so früh wie möglich erraten.

- **Falscher Tipp deckt die nächste Station auf** (natürliche Strafe, das Spiel
  bleibt in Bewegung). Zusätzlich gibt es „Nächste Station" als freiwilligen Hinweis.
- Sind alle Stationen aufgedeckt und der Tipp ist wieder falsch → verloren,
  Auflösung. „Aufgeben" jederzeit möglich.
- Erfolg: „Gelöst nach N Stationen" + Konfetti; danach „Neue Karriere".
- Freies Spiel (endlos), kein Tageslimit — ergänzt den Daily-Star.

## Datenlage (geprüft)

`cp` (Karriereperioden) liefert **578 Spieler mit ≥3 verschiedenen Vereinen und
`sl ≥ 40`** (bekannt genug). Beispiel Ronaldo: SCP 2002–03 → MUN 2003–09 →
RMA 2009–18 → JUV 2018–21 → MUN 2021–22.

## Architektur

### A. `src/careerPath.js` (neu, rein & testbar)

```js
export const CAREER_SL_MIN = 40;
export const CAREER_MIN_CLUBS = 3;
// Indizes aller Spieler mit genug Stationen und Bekanntheit
export function careerCandidates(players)
// cp -> [{ club, from, to }] chronologisch (mehrfache Engagements bleiben eigene Stationen)
export function careerStations(player)
// zufälliger Kandidat (rnd injizierbar für Tests)
export function pickCareerIndex(players, rnd = Math.random)
```

### B. `src/Career.jsx` (neu)

Lazy `loadPlayers()`; State: `target`, `revealed` (Anzahl sichtbarer Stationen,
Start 1), `guesses` (Fehlversuche), `done`/`won`, Autocomplete-State wie in den
anderen Modi. Stationen mit Vereins-`Emblem` (echtes Logo) + Name + Jahren.
Sounds (`ok`/`err`/`win`), `Confetti` bei Erfolg, Mute-Toggle, Regeln-Modal mit
`DATA_ASOF`. Leichte Statistik in localStorage `pp:careerStats`
(`{played, solved, best}` — `best` = wenigste Stationen bis zur Lösung).

### C. Routing skalierbar machen (`src/App.jsx`)

`?solo=` wird von Boolean auf **Modus-Schlüssel** umgestellt, damit die drei
folgenden Spiele ohne weitere Flags andocken:

- `soloFromUrl()` → `null | "hex" | "career" | …`; `?solo=1` bleibt als
  „hex" kompatibel.
- `enterSolo(mode)` schreibt `?solo=<mode>`.
- Render: `solo === "hex" → <Solo/>`, `solo === "career" → <Career/>`.

### D. Solo-Bereich in der Lobby (`src/Lobby.jsx`)

Der einzelne Hex-Training-Button weicht einem **Solo-Grid**, das mitwächst:
Überschrift „Solo spielen", darunter Kacheln (Icon + Name + einzeiliger
Untertitel) für **Hex-Training** und **Karriere-Pfad**; die Daily-Star-Kachel
bleibt als hervorgehobene Tageskachel darüber. Neue CSS-Klassen `.soloSection`,
`.soloTitle`, `.soloGrid`, `.soloTile`.

## Fehlerfälle / Edge Cases

- Spielerliste lädt noch → Eingabe deaktiviert („Lade Spielerdaten…").
- Kandidat ohne verwertbare Stationen kann nicht auftreten (Filter ≥3 Vereine).
- Reload verwirft die Runde (freies Spiel, kein Spielstand) — Statistik bleibt.
- localStorage nicht verfügbar → try/catch, Spiel läuft ohne Statistik.

## Tests (node:test, `src/careerPath.test.js`)

- `careerCandidates`: filtert nach ≥3 verschiedenen Vereinen und `sl ≥ 40`
  (synthetische Liste; Spieler mit 2 Vereinen oder zu geringem `sl` fallen raus).
- `careerStations`: chronologisch sortiert, Mehrfach-Engagements bleiben
  getrennt, `to = 0` bedeutet „bis heute".
- `pickCareerIndex`: liefert mit injiziertem `rnd` deterministisch einen
  Kandidaten aus der gefilterten Menge.
- Echtdaten-Check: Kandidatenzahl > 100.

## Nicht-Ziele (YAGNI)

- Keine tägliche Variante (Daily-Star deckt das ab), kein Share, kein
  Multiplayer, keine Hinweise außerhalb der Stationen.

## Betroffene Dateien

- `src/careerPath.js`, `src/careerPath.test.js`, `src/Career.jsx` (neu)
- `src/App.jsx`, `src/Lobby.jsx`, `src/styles.css`
