# Design: Datenstand-Anzeige & automatischer Wikidata-Refresh

**Datum:** 2026-07-04
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** Sichtbarer Datenstand (`DATA_ASOF`) in Lobby + Regel-Modals;
Ein-Kommando-Refresh-Kette; GitHub Action mit Zeitplan und Auto-PR.

## Motivation

Transferfenster: Spieler wechseln, unsere Wikidata-Snapshots altern. Der
Spieler (v. a. im Hex-Duell mit Vereins-Feldern) muss sehen, von wann die
Daten sind; der Refresh muss ohne manuelles 5-Skripte-Jonglieren laufen.

## Entscheidungen (aus dem Brainstorming)

GitHub Action + Auto-PR (Empfehlung angenommen): Anzeige + Ein-Kommando-Kette
+ monatliche Action, Merge weiterhin manuell auf Zuruf.

## Nicht-Ziele (YAGNI)

- Kein Runtime-Fetching von Wikidata im Client/Edge.
- Kein Auto-Merge des Daten-PRs.
- Keine feingranularen „zuletzt geändert je Spieler"-Angaben.

## Architektur

### A. `src/dataInfo.js` (generiert) + `data-pipeline/stamp.mjs` (neu)

- `src/dataInfo.js`: `export const DATA_ASOF = "YYYY-MM-DD";` — winzig,
  statisch importierbar (unabhängig vom lazy players-Chunk).
- `data-pipeline/stamp.mjs`: `export function stampDataInfo()` schreibt die
  Datei mit dem Tagesdatum (UTC-lokalunabhängig: lokales Datum genügt).
- **Alle 5 Pipeline-Skripte** (roster, honours, honours_extra, positions,
  careers) rufen `stampDataInfo()` unmittelbar nach ihrem
  `writeFileSync(PLAYERS_PATH, …)` auf.

### B. Anzeige

- **Lobby:** unter `.lobHint` eine Zeile `.dataStamp`:
  „Datenstand: <TT.MM.JJJJ> · Quelle: Wikidata".
- **Regel-Modals:** gleiche Zeile am Ende des Modals in `Game.jsx`,
  `Grid.jsx`, `Guess.jsx`, `Daily.jsx`; in `Game.jsx` (Hex) zusätzlich:
  „Ganz frische Transfers können noch fehlen."
- Formatierung: `DATA_ASOF` → `dd.mm.yyyy` (einfacher String-Split, keine
  Date-Parsing-Zeitzonen-Fallen).

### C. Refresh-Kette — `data-pipeline/refresh_all.mjs` (neu)

- Führt sequenziell aus (Abbruch bei Exit ≠ 0):
  1. `wikidata_roster.mjs` (Basis: Spieler/Vereine/sl)
  2. `wikidata_honours.mjs` (setzt `t` neu — nur seine 11 Wettbewerbe)
  3. `wikidata_honours_extra.mjs` (ergänzt BDO/EM/CA/EL — MUSS nach 2 laufen)
  4. `wikidata_positions.mjs` (pos)
  5. `wikidata_careers.mjs` (cp)
- `child_process.spawnSync(process.execPath, [script], { stdio: "inherit" })`.
- npm-Script: `"data:refresh": "node data-pipeline/refresh_all.mjs"`.

### D. GitHub Action — `.github/workflows/data-refresh.yml` (neu)

- Trigger: `schedule` cron `0 3 1 * *` (monatlich am 1., 03:00 UTC — deckt
  Transferschluss 1.9./1.2. ab) + `workflow_dispatch` (manueller Probelauf).
- Permissions: `contents: write`, `pull-requests: write`.
- Steps: checkout → setup-node 20 (npm-Cache) → `npm ci` →
  `npm run data:refresh` → `npm test` → `peter-evans/create-pull-request@v6`
  (Branch `data/refresh-<run-datum>`, Commit „data: Wikidata-Refresh",
  PR-Titel „data: Wikidata-Refresh <datum>", Body mit Hinweis auf Diff-Check).
- Kein Auto-Merge: PR wird wie gewohnt auf Zuruf gemergt, Vercel deployt
  nach Merge.

## Fehlerfälle / Edge Cases

- Skript in der Kette schlägt fehl → Kette bricht ab, Action rot, kein PR
  mit halben Daten (players.js bleibt im Runner, wird nicht committet).
- `npm test` nach Refresh rot (z. B. Datenformat kaputt) → kein PR.
- Kein Diff (Wikidata unverändert) → create-pull-request erstellt keinen PR.
- Wikidata-Rate-Limits im Runner → bestehende Retry-/Fenster-Logik der
  Skripte greift.

## Tests / Verifikation

- node:test: `DATA_ASOF` matcht `/^\d{4}-\d{2}-\d{2}$/` und ist gültiges Datum.
- `npm run build` grün; Lobby/Modals zeigen den Stempel.
- Action: YAML committen, manueller `workflow_dispatch`-Probelauf durch den
  User (Beobachtung: PR erscheint oder „no changes").

## Betroffene Dateien

- `src/dataInfo.js` (generiert), `data-pipeline/stamp.mjs` (neu)
- `data-pipeline/wikidata_{roster,honours,honours_extra,positions,careers}.mjs` (Stamp-Aufruf)
- `data-pipeline/refresh_all.mjs` (neu), `package.json` (Script)
- `.github/workflows/data-refresh.yml` (neu)
- `src/Lobby.jsx`, `src/Game.jsx`, `src/Grid.jsx`, `src/Guess.jsx`, `src/Daily.jsx`, `src/styles.css`
- `src/dataInfo.test.js` (neu)
