# Gameplay-Feedback-Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vier User-Reports fixen: dynamischer Lobby-Untertitel, bessere Spielersuche (Vorname + Sonderzeichen), Letzter-Zug-Box weicht dem Dropdown, Timeout beendet das Spiel wirklich.

**Architecture:** `norm`-Erweiterung + Wortanfang-Matching in `suggestPlayers` (TDD); UI-Fixes punktuell; Timeout-Root-Cause = lazy Supabase-Thenables → `.then(() => {})` an die Finish-Updates in allen drei Duell-Ansichten.

**Tech Stack:** unverändert.

---

## Task 1: Spielersuche — norm + suggestPlayers (TDD)

**Files:**
- Modify: `src/gameData.js`, `src/gameData.test.js`

- [ ] **Step 1: Tests ergänzen.** Nach dem bestehenden `suggestPlayers`-Test in `src/gameData.test.js`:

```js
test("suggestPlayers: Vorname, Wortanfang, Sonderzeichen, Vollnamen-Präfix", () => {
  const players = [
    { n: "Lionel Messi", ln: "Messi", sl: 99 },
    { n: "Alexander Sørloth", ln: "Sørloth", sl: 40 },
    { n: "Łukasz Piszczek", ln: "Piszczek", sl: 30 },
    { n: "Mohamed Salah", ln: "Salah", sl: 90 },
  ];
  assert.deepEqual(suggestPlayers(players, "lionel", 8).map((p) => p.ln), ["Messi"]);     // Vorname
  assert.deepEqual(suggestPlayers(players, "sorloth", 8).map((p) => p.ln), ["Sørloth"]);  // ø -> o
  assert.deepEqual(suggestPlayers(players, "lukasz", 8).map((p) => p.ln), ["Piszczek"]);  // Ł -> l
  assert.deepEqual(suggestPlayers(players, "mohamed sa", 8).map((p) => p.ln), ["Salah"]); // Vollnamen-Präfix
});
```

- [ ] **Step 2:** Run `npm test` — Expected: FAIL (alle 4 Assertions: nur Nachnamen-Präfix matcht, ø/ł unbehandelt).

- [ ] **Step 3: `norm` erweitern.** In `src/gameData.js`:

```js
export const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/ø/g, "o").replace(/ł/g, "l").replace(/đ/g, "d").replace(/æ/g, "ae")
  .replace(/ß/g, "ss").replace(/ð/g, "d").replace(/þ/g, "th").replace(/œ/g, "oe");
```

- [ ] **Step 4: `suggestPlayers` erweitern:**

```js
// Autocomplete: Nachname-Präfix, Vollnamen-Präfix oder Wortanfang im Namen;
// sortiert nach Bekanntheit (sl) desc, dann alphabetisch.
export function suggestPlayers(players, query, limit = 8) {
  const q = norm((query || "").trim());
  if (q.length < 2) return [];
  const out = [];
  for (const p of players) {
    const full = norm(p.n);
    if (norm(p.ln).startsWith(q) || full.startsWith(q) || full.includes(" " + q)) out.push(p);
  }
  return out
    .sort((a, b) => (b.sl || 0) - (a.sl || 0) || a.ln.localeCompare(b.ln, "de"))
    .slice(0, limit);
}
```

- [ ] **Step 5:** Run `npm test` — Expected: PASS (42 Tests; Alt-Test „sa" → Salah/Saúl/Sava bleibt grün, da Wortanfang dieselben findet).

- [ ] **Step 6: Commit**

```bash
git add src/gameData.js src/gameData.test.js
git commit -m "fix: Spielersuche — Vorname/Wortanfang + Sonderzeichen (ø, ł, æ, ß …)"
```

---

## Task 2: Timeout-Fix (lazy Thenables)

**Files:**
- Modify: `src/Game.jsx`, `src/Grid.jsx`, `src/Guess.jsx`

- [ ] **Step 1:** In allen drei Dateien im Timeout-Effect beide Update-Aufrufe um `.then(() => {})` ergänzen (Supabase-Builder feuern sonst nie):

```jsx
    if (myTurn) supabase.from("games").update(finish).eq("code", code).eq("turn", myPlayer).eq("status", "playing").then(() => {});
    else if (myPlayer !== 0) supabase.from("games").update(finish).eq("code", code).eq("status", "playing").then(() => {});
```

(In `Game.jsx` stehen die zwei Aufrufe in `{}`-Blöcken — dort jeweils die `supabase.…`-Zeile um `.then(() => {});` erweitern.)

- [ ] **Step 2:** Run `npm run build` — Expected: `✓`.

- [ ] **Step 3: Commit**

```bash
git add src/Game.jsx src/Grid.jsx src/Guess.jsx
git commit -m "fix: Timeout-Finish wurde nie gesendet (lazy Supabase-Thenables)"
```

---

## Task 3: Lobby-Untertitel + Hex-Topbar

**Files:**
- Modify: `src/Lobby.jsx`, `src/Game.jsx`

- [ ] **Step 1:** In `src/Lobby.jsx` die Zeile

```jsx
      <div className="subtitle">Hex-Duell · Online gegen einen Freund</div>
```

ersetzen durch:

```jsx
      <div className="subtitle">{{ hex: "Hex-Duell", grid: "Raster-Duell", guess: "Errate den Star" }[mode]} · Online gegen einen Freund</div>
```

- [ ] **Step 2:** In `src/Game.jsx` die Topbar-Zeile `<div className="subtitle">Online · Code {code}</div>` → `<div className="subtitle">Hex-Duell · Code {code}</div>`.

- [ ] **Step 3: Commit**

```bash
git add src/Lobby.jsx src/Game.jsx
git commit -m "fix: Lobby-Untertitel folgt dem gewählten Modus; Hex-Topbar benannt"
```

---

## Task 4: Letzter-Zug-Box weicht dem Dropdown

**Files:**
- Modify: `src/Game.jsx`, `src/Grid.jsx`

- [ ] **Step 1:** In `src/Game.jsx`:

```jsx
  const fb = localFeedback || (row.last_move?.text ? { type: row.last_move.by ? "ok" : "info", text: row.last_move.text, detail: row.last_move.detail } : null);
```

ersetzen durch (Letzter-Zug-Anzeige nur ohne offene Eingabe; lokale Fehler bleiben immer sichtbar):

```jsx
  const fb = localFeedback || (selected === null && row.last_move?.text ? { type: row.last_move.by ? "ok" : "info", text: row.last_move.text, detail: row.last_move.detail } : null);
```

- [ ] **Step 2:** In `src/Grid.jsx` dieselbe Ersetzung (identische Zeile dort).

- [ ] **Step 3: Build + Commit**

Run: `npm run build` — Expected: `✓`.

```bash
git add src/Game.jsx src/Grid.jsx
git commit -m "fix: Letzter-Zug-Box ausgeblendet, solange die Spielereingabe offen ist"
```

---

## Task 5: Verifikation & Abschluss

- [ ] **Step 1:** `npm test` (42 grün) + `npm run build` (`✓`).
- [ ] **Step 2:** `superpowers:finishing-a-development-branch` — Push + PR via GitHub-API, mergen auf Zuruf. Manuell danach: Uhr ablaufen lassen → Abpfiff bei beiden Clients.

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** Report 1 → Task 3; Report 2 → Task 1; Report 3 → Task 4; Report 4 → Task 2. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** `norm`-Erweiterung wirkt symmetrisch auf Suche und Exaktvergleich (`handleSubmit` normt beide Seiten); Guess/Daily nutzen `suggestPlayers` mit — profitieren automatisch.
