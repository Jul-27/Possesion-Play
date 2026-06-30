# Design: Lazy-Loading der Spielerdaten

**Datum:** 2026-06-30
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** `src/players.js` (~2,6 MB) per dynamischem Import aus dem Haupt-Bundle
auslagern; on-demand + Hintergrund-Prefetch laden.

## Ziel

Die große Spielerliste landet aktuell im Haupt-Bundle (~2,6 MB) → langsames
erstes Laden. Sie soll in einen separaten Chunk, der nur bei Bedarf geladen wird.

## Entscheidungen (aus dem Brainstorming)

1. **Dynamischer Import** von `players.js` (eigener Vite-Chunk).
2. **On-demand + Prefetch:** Liste wird beim Spielstart/-beitritt geladen;
   Lobby startet beim Mount einen leisen Hintergrund-Prefetch.
3. Bis geladen: Eingabefeld kurz deaktiviert mit Hinweis (dank Prefetch meist
   nicht spürbar).

## Nicht-Ziele (YAGNI)

- Keine Daten-/Pipeline-Änderung; `players.js`-Inhalt unverändert.
- Kein Pagination/Streaming der Liste; ein Chunk genügt.
- Keine Änderung an Spiellogik/Realtime/Matching.

## Architektur

### A. Loader — `src/playersStore.js` (neu)

```js
let promise;
export function loadPlayers() {
  return (promise ||= import("./players.js").then((m) => m.PLAYERS));
}
```
Gecacht (ein Fetch, von allen Consumern geteilt).

### B. `src/gameData.js`

- Statischen `import { PLAYERS } from "./players.js"; export { PLAYERS };`
  **entfernen** → `gameData.js` referenziert `players.js` nicht mehr statisch,
  die 2,6 MB fallen aus dem Haupt-Bundle.
- `buildGridSerial()` → `buildGridSerial(players)`: bekommt die Liste als
  Parameter (nutzt sie für die Lösbarkeitsprüfung). `suggestPlayers(players,…)`
  ist bereits parametrisiert.

### C. Consumer

- **`Lobby.jsx`:** `import { loadPlayers }`; beim Mount `useEffect(() => { loadPlayers(); }, [])`
  (Hintergrund-Prefetch, fire-and-forget). `createGame` im Raster-Modus:
  `const players = await loadPlayers(); board = buildGridSerial(players);`
  (Hex-Modus braucht keine Liste). `buildGridSerial`-Import bleibt.
- **`Game.jsx` / `Grid.jsx`:** `PLAYERS` aus dem `gameData`-Import entfernen,
  `import { loadPlayers } from "./playersStore.js"`. Lokaler State
  `const [players, setPlayers] = useState(null); useEffect(() => { loadPlayers().then(setPlayers); }, []);`
  - `suggestions`: `useMemo(() => (players ? suggestPlayers(players, nameInput, 8) : []), [players, nameInput])`.
  - `handleSubmit`: nutzt `players` (statt `PLAYERS`); wenn `!players` → nichts tun.
  - Eingabefeld `disabled={!players}` mit Platzhalter „Lade Spielerdaten…",
    solange `players===null`.

## Datenfluss

1. App/Lobby lädt sofort (kleines Bundle); Lobby stößt Prefetch an.
2. Spielstart/-beitritt: `loadPlayers()` (gecacht) → `players`-State gesetzt.
3. Autocomplete/Submit/Grid-Erzeugung nutzen die geladene Liste.

## Fehlerfälle / Edge Cases

- Langsamer/erstmaliger Load → Eingabe deaktiviert + Hinweis bis bereit.
- Mehrere Consumer → ein geteilter, gecachter Promise (kein Doppel-Fetch).
- Raster-Erstellung vor geladener Liste → `createGame` awaited `loadPlayers()`
  (Button-`busy` deckt die kurze Wartezeit ab).

## Tests / Verifikation

- **node:test:** `buildGridSerial(PLAYERS)` (Liste explizit übergeben; `PLAYERS`
  im Test direkt aus `players.js`). Bestehende Tests bleiben grün.
- **Build:** `npm run build` zeigt **zwei Chunks** — kleines `index` + großer
  `players`-Chunk (nur on-demand). Haupt-Bundle deutlich < 2,6 MB.
- **Manuell:** Landing lädt schnell; Autocomplete funktioniert nach (Pre-)Laden.

## Betroffene Dateien

- `src/playersStore.js` (neu)
- `src/gameData.js` (PLAYERS-Import raus; `buildGridSerial(players)`)
- `src/gameData.test.js` (buildGridSerial-Aufruf mit PLAYERS)
- `src/Lobby.jsx` (Prefetch + grid-create await)
- `src/Game.jsx`, `src/Grid.jsx` (loadPlayers + players-State)
