# Design: Hex-Training (Solo-Modus)

**Datum:** 2026-07-09
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** Freies Hex-Training ohne Gegner und ohne Uhr — komplett lokal
(kein Supabase), volle Duell-Eroberungsmechanik, Fehlversuchs-Zählung.

## Entscheidungen (aus dem Brainstorming)

- Variante: **Freies Training** (kein Bot, keine Zeit-Challenge — Backlog).
- **Ohne Schachuhr**; Fehlversuch kostet KEINEN Zug (sofort nochmal probieren),
  wird aber gezählt.

## Architektur

### A. `src/Solo.jsx` (neu) — lokale Variante von Game.jsx

- State: `serial` (einmal `buildBoardSerial()`), `board` (hydratisiert),
  `owners` (alle Eroberungen als Spieler 1), `moves` (erfolgreiche Züge),
  `misses` (Fehlversuche), `selected`/Autocomplete-State wie im Duell,
  `lastClaimed` (Erobert-Animation), `players` lazy via `loadPlayers()`.
- Zug: Feld wählen → Spieler nennen → `playerMatchesHex` auf Feld +
  `ADJP`-Nachbarn (identische Mehrfach-Eroberung wie im Duell; „gestohlen"
  entfällt, alles ist neutral). Treffer: `ok`-Sound + Claim-Animation +
  `moves+1`. Fehlversuch: `err`-Sound, Feedback, `misses+1`, Auswahl bleibt.
- Kopfzeile: Zähler „Erobert X/31 · Züge · Fehlversuche" (nutzt vorhandene
  `.dailyMeta`/`.dailyCount`-Klassen).
- 31/31 → Abschluss-Panel (`.panel.dailyEnd` + `Confetti` + `win`-Sound):
  „Board gelöst in N Zügen, M Fehlversuche", bei M = 0 „Perfektes Board! 🏆";
  Buttons „Neues Board" (kompletter Reset mit frischem Serial) und „Zur Lobby".
- Topbar: Mute-Toggle, Regeln (inkl. Datenstand-Zeile), Verlassen.
- Kein Persistieren des Spielstands, keine Statistik-Historie (YAGNI).

### B. Einstieg

- **`Lobby.jsx`:** Ghost-Button unter der Modus-Wahl:
  „🎯 Hex-Training — solo üben (ohne Mitspieler)" → `onSolo()`.
- **`App.jsx`:** `?solo=1`-Routing (Muster wie `?daily=1`): `soloFromUrl`,
  `enterSolo()`, Render-Priorität daily → solo → game → lobby;
  `leave()` räumt beides.

## Fehlerfälle / Edge Cases

- Spielerliste lädt noch → Eingabe deaktiviert („Lade Spielerdaten…").
- Reload verwirft das Board (bewusst — Training, kein Spielstand).
- Fehlversuch auf bereits erobertem Feld unmöglich (nur freie Felder klickbar).

## Tests / Verifikation

- Engine unverändert (42 Tests bleiben grün); `npm run build` grün.
- Manuell: Training starten, Mehrfach-Eroberung, Fehlversuchs-Zähler,
  Abschluss mit/ohne „Perfekt", „Neues Board", `?solo=1`-Deeplink.

## Betroffene Dateien

- `src/Solo.jsx` (neu), `src/App.jsx`, `src/Lobby.jsx`
