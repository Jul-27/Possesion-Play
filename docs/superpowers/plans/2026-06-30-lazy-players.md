# Lazy-Loading der Spielerdaten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/players.js` (~2,6 MB) per dynamischem Import aus dem Haupt-Bundle auslagern; on-demand + Hintergrund-Prefetch laden.

**Architecture:** Gecachter Loader (`playersStore.js`) mit `import("./players.js")`; `gameData.js` referenziert die Liste nicht mehr statisch (`buildGridSerial(players)` als Parameter); Game/Grid laden die Liste in lokalen State, Lobby prefetcht.

**Tech Stack:** Vite + React 18 (dynamischer Import = automatischer Code-Split), Tests: `node:test`.

---

## File Structure

- `src/playersStore.js` — **create**: gecachter `loadPlayers()`.
- `src/gameData.js` — **modify**: statischen PLAYERS-Import entfernen; `buildGridSerial(players)`.
- `src/gameData.test.js` — **modify**: `buildGridSerial(PLAYERS)`.
- `src/Lobby.jsx` — **modify**: Prefetch + Grid-Create `await loadPlayers()`.
- `src/Game.jsx` / `src/Grid.jsx` — **modify**: `loadPlayers` + `players`-State + Feld-Disable.

---

## Task 1: Loader + gameData entkoppeln (TDD)

**Files:**
- Create: `src/playersStore.js`
- Modify: `src/gameData.js`
- Modify: `src/gameData.test.js`

- [ ] **Step 1: Test anpassen** — in `src/gameData.test.js` im Test `"buildGridSerial: lösbares Raster"` den Aufruf `const g = buildGridSerial();` ersetzen durch:

```js
  const g = buildGridSerial(PLAYERS);
```
(`PLAYERS` wird in diesem Test bereits via `await import("./players.js")` geladen.)

- [ ] **Step 2: Test ausführen, Fehlschlag prüfen**

Run: `npm test`
Expected: FAIL — `buildGridSerial` erzeugt (noch) ohne Parameter ein Raster; nach Umbau erwartet es `players`. (Falls noch grün, weil alte Signatur PLAYERS intern nutzt: weiter zu Step 3, danach wird der Test verbindlich.)

- [ ] **Step 3: `gameData.js` — statischen PLAYERS-Import entfernen.** Den Block

```js
/* Spielerdaten sind nach ./players.js ausgelagert, damit der Voll-Datensatz
   (per Kaggle erzeugt, siehe data-pipeline/) durch einen Ein-Datei-Tausch
   eingesetzt werden kann. Re-Export hier hält bestehende Imports stabil. */
import { PLAYERS } from "./players.js";
export { PLAYERS };
```

ersetzen durch:

```js
/* Spielerdaten liegen in ./players.js (~2,6 MB) und werden NICHT mehr statisch
   importiert, sondern lazy über ./playersStore.js geladen (loadPlayers()).
   Funktionen, die die Liste brauchen (z. B. buildGridSerial), bekommen sie als
   Parameter. */
```

- [ ] **Step 4: `buildGridSerial` parametrisieren.** In `src/gameData.js` die Signatur und die interne Nutzung ändern:

```js
export function buildGridSerial(players) {
  const POOL = [...CLUBS, ...NATIONS, ...LEAGUES, ...HONOURS, ...SPECIALS];
  const ser = (d) => ({ t: d.type, k: d.key });
  const solvable = (rowDefs, colDefs) =>
    rowDefs.every((rd) => colDefs.every((cd) => players.some((p) => gridCellMatches(p, rd, cd))));
  for (let attempt = 0; attempt < 80; attempt++) {
    const six = pick(POOL, 6);
    const rows = six.slice(0, 3), cols = six.slice(3, 6);
    if (solvable(rows, cols)) return { kind: "grid", rows: rows.map(ser), cols: cols.map(ser) };
  }
  const rows = [lookupDef("league", "BL"), lookupDef("league", "PL"), lookupDef("league", "LL")];
  const cols = [lookupDef("nat", "GER"), lookupDef("nat", "ESP"), lookupDef("nat", "BRA")];
  return { kind: "grid", rows: rows.map(ser), cols: cols.map(ser) };
}
```

- [ ] **Step 5: `src/playersStore.js` anlegen:**

```js
// Lädt die große Spielerliste (players.js) lazy als eigenen Vite-Chunk.
// Gecacht: ein gemeinsamer Promise für alle Consumer.
let promise;
export function loadPlayers() {
  return (promise ||= import("./players.js").then((m) => m.PLAYERS));
}
```

- [ ] **Step 6: Test ausführen, Erfolg prüfen**

Run: `npm test`
Expected: PASS (alle Tests; `buildGridSerial(PLAYERS)` liefert lösbares Raster).

- [ ] **Step 7: Commit**

```bash
git add src/gameData.js src/gameData.test.js src/playersStore.js
git commit -m "feat: players.js lazy entkoppelt (loadPlayers, buildGridSerial(players))"
```

---

## Task 2: Lobby — Prefetch + Grid-Create

**Files:**
- Modify: `src/Lobby.jsx`

- [ ] **Step 1: Imports.** In `src/Lobby.jsx` `useEffect` aus React importieren und `loadPlayers` ergänzen. Die ersten zwei Importzeilen

```js
import { useState } from "react";
import { supabase, getClientId, getSavedName, saveName } from "./supabaseClient.js";
import { buildBoardSerial, buildGridSerial, genCode, START_SECONDS } from "./gameData.js";
```

ersetzen durch:

```js
import { useState, useEffect } from "react";
import { supabase, getClientId, getSavedName, saveName } from "./supabaseClient.js";
import { buildBoardSerial, buildGridSerial, genCode, START_SECONDS } from "./gameData.js";
import { loadPlayers } from "./playersStore.js";
```

- [ ] **Step 2: Prefetch beim Mount.** Direkt nach der `const [error, setError] = useState("");`-Zeile (Ende des State-Blocks) einfügen:

```js
  useEffect(() => { loadPlayers(); }, []); // Hintergrund-Prefetch der Spielerliste
```

- [ ] **Step 3: Grid-Create lädt die Liste.** In `createGame` die Board-Zeile

```js
        board: mode === "grid" ? buildGridSerial() : buildBoardSerial(),
```

ersetzen durch (Liste vorab laden und übergeben):

```js
        board: mode === "grid" ? buildGridSerial(await loadPlayers()) : buildBoardSerial(),
```

(`createGame` ist bereits `async`.)

- [ ] **Step 4: Build prüfen**

Run: `npm run build`
Expected: `✓ built in …`; Ausgabe zeigt nun einen separaten Chunk für `players`.

- [ ] **Step 5: Commit**

```bash
git add src/Lobby.jsx
git commit -m "feat: Lobby prefetcht Spielerliste + Grid-Create lädt sie"
```

---

## Task 3: Game.jsx & Grid.jsx — Liste lazy in State

**Files:**
- Modify: `src/Game.jsx`
- Modify: `src/Grid.jsx`

- [ ] **Step 1: `Game.jsx` — Importe.** `PLAYERS` aus dem `gameData`-Import entfernen und `loadPlayers` ergänzen. Die Importzeile

```jsx
  P, cname, norm, PLAYERS, suggestPlayers, ADJP, hydrateBoard, playerMatchesHex,
  buildBoardSerial, BOARDH, HEXH, START_SECONDS, fmtClock, liveRemaining,
} from "./gameData.js";
```

ersetzen durch:

```jsx
  P, cname, norm, suggestPlayers, ADJP, hydrateBoard, playerMatchesHex,
  buildBoardSerial, BOARDH, HEXH, START_SECONDS, fmtClock, liveRemaining,
} from "./gameData.js";
import { loadPlayers } from "./playersStore.js";
```

- [ ] **Step 2: `Game.jsx` — players-State + Laden.** Nach `const inputRef = useRef(null);` einfügen:

```jsx
  const [players, setPlayers] = useState(null);
  useEffect(() => { loadPlayers().then(setPlayers); }, []);
```

- [ ] **Step 3: `Game.jsx` — suggestions nutzt players.** Die Zeile

```jsx
  const suggestions = useMemo(() => suggestPlayers(PLAYERS, nameInput, 8), [nameInput]);
```

ersetzen durch:

```jsx
  const suggestions = useMemo(() => (players ? suggestPlayers(players, nameInput, 8) : []), [players, nameInput]);
```

- [ ] **Step 4: `Game.jsx` — handleSubmit nutzt players.** In `handleSubmit` die Zeile

```jsx
      const hits = PLAYERS.filter((p) => norm(p.n) === q || norm(p.ln) === q);
```

ersetzen durch:

```jsx
      const hits = (players || []).filter((p) => norm(p.n) === q || norm(p.ln) === q);
```

- [ ] **Step 5: `Game.jsx` — Eingabefeld bis geladen deaktivieren.** Im Eingabefeld (`<input ref={inputRef} className="field" placeholder="Nachname eingeben (ab 2 Buchstaben)…" …>`) das `placeholder`-Attribut und ein `disabled` so setzen:

```jsx
                placeholder={players ? "Nachname eingeben (ab 2 Buchstaben)…" : "Lade Spielerdaten…"}
                disabled={!players}
```
(Die übrigen Attribute des `<input>` bleiben unverändert.)

- [ ] **Step 6: `Grid.jsx` — dieselben 5 Änderungen.**
  - Import: `PLAYERS` entfernen, `import { loadPlayers } from "./playersStore.js";` ergänzen. Konkret die Zeile
    ```jsx
      P, cname, norm, PLAYERS, suggestPlayers, lookupDef,
    ```
    ersetzen durch
    ```jsx
      P, cname, norm, suggestPlayers, lookupDef,
    ```
    und nach dem `} from "./gameData.js";` die Zeile `import { loadPlayers } from "./playersStore.js";` einfügen.
  - State nach `const inputRef = useRef(null);`:
    ```jsx
      const [players, setPlayers] = useState(null);
      useEffect(() => { loadPlayers().then(setPlayers); }, []);
    ```
  - suggestions:
    ```jsx
      const suggestions = useMemo(() => (players ? suggestPlayers(players, nameInput, 8) : []), [players, nameInput]);
    ```
  - handleSubmit:
    ```jsx
      const hits = (players || []).filter((p) => norm(p.n) === q || norm(p.ln) === q);
    ```
  - Eingabefeld:
    ```jsx
                placeholder={players ? "Nachname eingeben (ab 2 Buchstaben)…" : "Lade Spielerdaten…"}
                disabled={!players}
    ```

- [ ] **Step 7: Build + Tests**

Run: `npm run build` (Expected: `✓`; separater players-Chunk) und `npm test` (Expected: PASS).

- [ ] **Step 8: Commit**

```bash
git add src/Game.jsx src/Grid.jsx
git commit -m "feat: Game/Grid laden Spielerliste lazy (loadPlayers + players-State)"
```

---

## Task 4: Bundle-Aufteilung verifizieren & Abschluss

**Files:** keine

- [ ] **Step 1: Chunk-Aufteilung prüfen**

Run: `npm run build`
Expected: Zwei große JS-Dateien in `dist/assets/`: ein **kleines** `index-*.js` (App/Logik) und ein **großer** `players-*.js` (~2,5 MB) — Letzterer wird nur on-demand geladen. Kontrolle:
```bash
ls -lh dist/assets/*.js | awk '{print $5, $9}'
```
Expected: `index-*.js` deutlich kleiner als vorher (war 2,6 MB), separater `players-*.js` vorhanden.

- [ ] **Step 2: Abschluss** — `superpowers:finishing-a-development-branch` (Push + PR). Kein Schema-/Daten-Wechsel; Funktionstest: Landing lädt schnell, Autocomplete arbeitet nach (Pre-)Laden normal.

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** dynamischer Import/Chunk → `playersStore.js` (Task 1); gameData entkoppelt + `buildGridSerial(players)` → Task 1; Prefetch + Grid-Create → Task 2; Game/Grid lazy + Feld-Disable → Task 3; Chunk-Verifikation → Task 4. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** `loadPlayers()` (Promise→Array), `players`-State, `buildGridSerial(players)`, `suggestPlayers(players,…)` durchgängig konsistent; `PLAYERS` wird in `gameData.js`/`Game.jsx`/`Grid.jsx` nicht mehr referenziert (nur noch in Tests via direktem `players.js`-Import).
