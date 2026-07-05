# Analyse-Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vier Bugfixes + README (Housekeeping) und zwei Robustheits-Fixes (Realtime-Reconnect, stabiler Daily-Seed via Rendezvous-Hashing) in einem PR.

**Architecture:** `dailyStarIndex` wählt künftig den Kandidaten mit minimalem `hashStr(dateStr|norm(n)|by)` (stabil gegen Pool-Verschiebungen); Game/Grid/Guess bekommen einen Refetch-Effect bei Tab-Rückkehr; Rest sind punktuelle Textfixes/Guards.

**Tech Stack:** unverändert (React/Vite, node:test).

---

## File Structure

- `src/dailyLogic.js` + `src/dailyLogic.test.js` — Rendezvous-Seed.
- `src/Game.jsx`, `src/Grid.jsx`, `src/Guess.jsx`, `src/Daily.jsx` — Fixes + Reconnect.
- `README.md` — Aktualisierung.

---

## Task 1: Stabiler Daily-Seed (TDD)

**Files:**
- Modify: `src/dailyLogic.js`, `src/dailyLogic.test.js`

- [ ] **Step 1: Stabilitätstest ergänzen.** Am Ende von `src/dailyLogic.test.js`:

```js
test("dailyStarIndex: stabil gegenüber Pool-Verschiebung (Rendezvous)", () => {
  const mk = (n) => ({ n, ln: n, by: 1990, nat: ["GER"], clubs: ["FCB"], sl: 50, pos: "ST" });
  const base = ["Anna Adler", "Ben Berg", "Carl Cords", "Dora Dill", "Emil Eck"].map(mk);
  const a = dailyStarIndex("2026-07-05", base);
  const winner = base[a].n;
  // Kandidat am ANFANG einfügen -> alle Indizes verschieben sich um 1
  const extended = [mk("Zora Zusatz"), ...base];
  const b = dailyStarIndex("2026-07-05", extended);
  // Gewinner bleibt derselbe, sofern der Neue nicht selbst gewinnt (deterministisch prüfbar):
  if (extended[b].n !== "Zora Zusatz") assert.equal(extended[b].n, winner);
  // Entfernen eines Nicht-Gewinners ändert nichts:
  const reduced = base.filter((p) => p.n !== winner ? p.n !== base[(a + 1) % base.length].n : true);
  const c = dailyStarIndex("2026-07-05", reduced);
  assert.equal(reduced[c].n, winner);
});
```

(Der Alt-Test „deterministisch, variiert über Tage, erfüllt Filter" bleibt unverändert gültig.)

- [ ] **Step 2: Tests ausführen** — Run: `npm test` — Expected: FAIL (alte Index-PRNG-Wahl ist nicht verschiebungsstabil).

- [ ] **Step 3: `dailyStarIndex` umbauen.** In `src/dailyLogic.js`:
  - Import erweitern: `import { guessEligibleIndices, norm } from "./gameData.js";`
  - Die Funktionen `mulberry32` (wird unbenutzt) entfernen und `dailyStarIndex` ersetzen durch:

```js
// Index des Tages-Stars per Rendezvous-Hashing: Es gewinnt der Kandidat mit dem
// kleinsten Hash aus Datum + stabilem Spieler-Schlüssel (norm(n)|by). Dadurch
// ändern Datenupdates den Tages-Star nur, wenn genau der Gewinner entfällt —
// nicht bei jeder Pool-Verschiebung (wichtig für den monatlichen Refresh).
export function dailyStarIndex(dateStr, players) {
  const pool = guessEligibleIndices(players);
  const list = pool.length ? pool : players.map((_, i) => i);
  let best = list[0], bestH = Infinity;
  for (const i of list) {
    const p = players[i];
    const h = hashStr(`daily:${dateStr}|${norm(p.n)}|${p.by}`);
    if (h < bestH) { bestH = h; best = i; }
  }
  return best;
}
```

- [ ] **Step 4: Tests ausführen** — Run: `npm test` — Expected: PASS (41 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/dailyLogic.js src/dailyLogic.test.js
git commit -m "fix: Daily-Seed via Rendezvous-Hashing — stabil gegen Datenupdates"
```

---

## Task 2: Housekeeping-Fixes

**Files:**
- Modify: `src/Game.jsx`, `src/Grid.jsx`, `src/Guess.jsx`, `src/Daily.jsx`

- [ ] **Step 1: Regeltexte Hex.** In `src/Game.jsx`:
  - Fehlertext-`detail` (in `handleSubmit`): `"Wähle ein Feld, das zur Karriere des Spielers passt (Verein, Nation oder Geburtsjahr)."` → `"Wähle ein Feld, das zur Karriere des Spielers passt (Verein, Nation, Liga, Titel oder Spezialfeld)."`
  - Regel-Modal: `nennt einen Spieler, der zur Kategorie passt (Verein, Nation oder Geburtsjahr).` → `nennt einen Spieler, der zur Kategorie passt (Verein, Nation, Liga, Titel oder Spezialfeld wie Jahrgang/Ära).`

- [ ] **Step 2: `newGame`-Guards.**
  - `src/Grid.jsx`: `async function newGame() {` → erste Zeile im Body: `if (!players) return;` und im Abpfiff-Overlay den „Neues Spiel"-Button um `disabled={!players}` ergänzen.
  - `src/Guess.jsx`: identisch (Guard + `disabled={!players}` am „Neues Spiel"-Button).

- [ ] **Step 3: Geburtsjahr-Max dynamisch.** In `src/Guess.jsx` und `src/Daily.jsx` jeweils `max="2025"` → `max={new Date().getFullYear()}`.

- [ ] **Step 4: skipTurn-Sound.** In `src/Game.jsx` in `skipTurn` nach den State-Resets `play("click");` einfügen.

- [ ] **Step 5: Build + Commit**

Run: `npm run build` (Expected: `✓`)

```bash
git add src/Game.jsx src/Grid.jsx src/Guess.jsx src/Daily.jsx
git commit -m "fix: Regeltexte, newGame-Guards, dynamisches Geburtsjahr-Max, skipTurn-Sound"
```

---

## Task 3: Realtime-Reconnect

**Files:**
- Modify: `src/Game.jsx`, `src/Grid.jsx`, `src/Guess.jsx`

- [ ] **Step 1:** In allen drei Dateien direkt NACH dem Laden+Realtime-Abo-Effect (der mit `return () => { active = false; supabase.removeChannel(ch); };` endet) einfügen:

```jsx
  // Reconnect-Heilung: nach Tab-Rückkehr/Fokus Spielstand einmalig nachladen
  // (Websocket kann auf Mobile einschlafen; Realtime-Abo bleibt bestehen).
  useEffect(() => {
    const refetch = () => {
      if (document.visibilityState !== "visible") return;
      supabase.from("games").select("*").eq("code", code).maybeSingle()
        .then(({ data }) => { if (data) setRow(data); });
    };
    document.addEventListener("visibilitychange", refetch);
    window.addEventListener("focus", refetch);
    return () => { document.removeEventListener("visibilitychange", refetch); window.removeEventListener("focus", refetch); };
  }, [code]);
```

- [ ] **Step 2: Build + Commit**

Run: `npm run build` (Expected: `✓`)

```bash
git add src/Game.jsx src/Grid.jsx src/Guess.jsx
git commit -m "fix: Refetch bei Tab-Rückkehr — heilt eingeschlafene Realtime-Verbindungen"
```

---

## Task 4: README aktualisieren

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** Titelzeile/Intro und zwei Abschnitte ersetzen:
  - Intro-Absatz (unter `# Possession Play …`) ersetzen durch:

```markdown
Fußball-Trivia online: **vier Spielmodi** — Hex-Duell (31 Felder erobern),
Raster-Duell (3×3-Tic-Tac-Toe), „Errate den Star" (Deduktions-Duell mit
Ja/Nein-Fragen) und der tägliche **Daily-Star** (solo, mit Emoji-Share &
Streaks). Vercel hostet die App, Supabase hält Duelle in Echtzeit synchron,
alle Duelle laufen mit 4:00-Schachuhr. ~27.000 Spieler aus Wikidata mit
Vereinen, Nationen, 15 Titeln, Positionen und Karrierezeiträumen.
```

  - Den kompletten Abschnitt `## Spielerdatenbank aktualisieren` (inkl. der 4 Kaggle-Schritte) ersetzen durch:

```markdown
## Spielerdatenbank aktualisieren

Die Spielerdaten (`src/players.js`) kommen aus **Wikidata** über die Pipeline
in `data-pipeline/` (Basis-Roster einmalig via Kaggle-Notebook, siehe
`data-pipeline/README.md`). Aktualisieren:

- **Automatisch:** Die GitHub Action „Wikidata Daten-Refresh" läuft monatlich
  am 1. und öffnet einen PR mit frischen Daten — nur noch mergen.
  Manuell anstoßbar über den Actions-Tab (`workflow_dispatch`).
- **Lokal:** `npm run data:refresh` führt alle fünf Skripte in der korrekten
  Reihenfolge aus (roster → honours → honours_extra → positions → careers).

Das Datum des letzten Laufs steht in `src/dataInfo.js` (`DATA_ASOF`) und wird
in der Lobby sowie den Regel-Modals angezeigt.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README — vier Spielmodi + aktueller Daten-Workflow"
```

---

## Task 5: Verifikation & Abschluss

- [ ] **Step 1:** `npm test` (41 grün) + `npm run build` (`✓`).
- [ ] **Step 2:** `superpowers:finishing-a-development-branch` — Push + PR via GitHub-API, mergen auf Zuruf.

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** A1 Texte → Task 2.1; A2 Guards+disabled → Task 2.2; A3 Jahr → Task 2.3; A4 Sound → Task 2.4; A5 README → Task 4; B6 Reconnect → Task 3; B7 Rendezvous-Seed inkl. Tests → Task 1. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** `hashStr`/`norm`-Nutzung konsistent; `mulberry32` wird entfernt (sonst toter Code); Test nutzt nur öffentliche API.
