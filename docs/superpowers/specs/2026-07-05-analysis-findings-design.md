# Design: Analyse-Findings — Bugfixes & Robustheit

**Datum:** 2026-07-05
**Status:** Genehmigt (aus der Projekt-Analyse), bereit für Implementierungsplanung
**Scope:** Vier kleine Bugfixes + README-Update (Housekeeping) sowie zwei
Robustheits-Verbesserungen (Realtime-Reconnect, stabiler Daily-Seed). Ein PR
(gemeinsame Dateien, kleine Diffs).

## Teil A — Housekeeping

1. **Regel-/Fehlertexte Hex** (`Game.jsx`): „Verein, Nation oder Geburtsjahr" →
   umfasst jetzt alle Feldtypen („Verein, Nation, Liga, Titel oder Spezialfeld
   wie Jahrgang/Ära").
2. **`newGame`-Guard** (`Grid.jsx`, `Guess.jsx`): `if (!players) return;` am
   Funktionsanfang + „Neues Spiel"-Button `disabled={!players}` — kein
   TypeError mehr, wenn vor Ladeende geklickt wird.
3. **Geburtsjahr-Input dynamisch** (`Guess.jsx`, `Daily.jsx`):
   `max={new Date().getFullYear()}` statt `max="2025"`.
4. **Sound-Konsistenz** (`Game.jsx`): `play("click")` auch in `skipTurn`.
5. **README**: Abschnitt „Spielmodi" (Hex, Raster, Errate den Star, Daily-Star),
   Datenpipeline-Abschnitt auf Wikidata-Realität aktualisiert
   (`npm run data:refresh`, monatliche GitHub Action, `DATA_ASOF`); der
   veraltete Kaggle-1:1-Tausch-Abschnitt wird durch den aktuellen Ablauf ersetzt.

## Teil B — Robustheit

6. **Realtime-Reconnect** (`Game.jsx`, `Grid.jsx`, `Guess.jsx`): Effect, der bei
   `document.visibilitychange` (sichtbar) und `window.focus` die Spielzeile
   einmalig per `select` nachlädt (`setRow(data)`). Heilt eingeschlafene
   Websockets (gesperrtes Handy, Hintergrund-Tab) ohne Reload.
7. **Stabiler Daily-Seed** (`dailyLogic.js`): `dailyStarIndex` wählt per
   **Rendezvous-Hashing** — Kandidat mit minimalem
   `hashStr(dateStr + "|" + norm(n) + "|" + by)` gewinnt. Dadurch ändern
   Datenupdates (monatlicher Refresh) den Tages-Star nur noch, wenn genau der
   Gewinner entfällt/hinzukommt — nicht mehr bei jeder Pool-Verschiebung.
   `norm` wird aus `gameData.js` importiert (dort vorhanden). Einmaliger
   Star-Wechsel am Deploy-Tag wird akzeptiert.

## Nicht-Ziele (YAGNI)

- Kein RLS-Umbau, keine Edge Function (bewusste Haltung unverändert).
- Kein Guess/Daily-Code-Sharing-Refactor (Backlog).
- Kein Xavi-Fallback-Matching im Careers-Skript.

## Tests / Verifikation

- `dailyStarIndex`: deterministisch pro Datum; **Stabilitätstest**: Einfügen
  eines zusätzlichen (nicht gewinnenden) Kandidaten ändert den Star nicht;
  Gewinner erfüllt weiterhin den Kandidatenfilter; verschiedene Tage variieren.
- Bestehende 40 Tests bleiben grün; `npm run build` grün.
- Manuell: „Neues Spiel" direkt nach Reload (kein Crash), Tab-Wechsel-Refetch,
  Regeltext, Jahr 2026 wählbar.

## Betroffene Dateien

- `src/Game.jsx`, `src/Grid.jsx`, `src/Guess.jsx`, `src/Daily.jsx`
- `src/dailyLogic.js`, `src/dailyLogic.test.js`
- `README.md`
