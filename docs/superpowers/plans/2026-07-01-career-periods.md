# Karrierezeiträume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Feld `cp` (Club-Perioden) via Wikidata + Teamkollegen-Frage (Guess/Daily) + drei Ära-Spezialfelder (Hex/Raster).

**Architecture:** Engine-Funktionen `wereTeammates`/`activeInRange` in `gameData.js` (rein, getestet); `mate`-Dimension in `answerGuessQuestion`/`guessQuestionLabel` mit `val = {n, cp}`-Snapshot; 3 neue SPECIALS über den vorhandenen `test:`-Mechanismus; neues Pipeline-Skript `wikidata_careers.mjs` (importiert verifizierte `CLUB_QID` aus dem Roster-Skript); `recToString` aller vier Bestandsskripte lernt `cp`.

**Tech Stack:** Node ESM + SPARQL (query.wikidata.org), Vite/React, Tests `node:test`.

---

## File Structure

- `src/gameData.js` — **modify**: `wereTeammates`, `activeInRange`, `mate`-Dimension, 3 Ära-SPECIALS.
- `src/gameData.test.js` — **modify**: Tests dafür.
- `src/Guess.jsx`, `src/Daily.jsx` — **modify**: „Teamkollege"-Chip + Referenz-Autocomplete.
- `data-pipeline/wikidata_careers.mjs` — **create**.
- `data-pipeline/wikidata_roster.mjs`, `wikidata_honours.mjs`, `wikidata_honours_extra.mjs`, `wikidata_positions.mjs` — **modify**: `recToString` + `cp`.
- `src/players.js` — **generiert**.

---

## Task 1: Engine — `wereTeammates`, `activeInRange`, mate, Ära-SPECIALS (TDD)

**Files:**
- Modify: `src/gameData.js`
- Modify: `src/gameData.test.js`

- [ ] **Step 1: Tests anhängen.** Am Ende von `src/gameData.test.js`:

```js
import { wereTeammates, activeInRange, SPECIALS } from "./gameData.js";

const XAVI = { n: "Xavi", cp: [["BAR", 1998, 2015]] };
const INIESTA = { n: "Andrés Iniesta", cp: [["BAR", 2002, 2018]] };
const KAHN = { n: "Oliver Kahn", cp: [["FCB", 1994, 2008]] };
const ACTIVE = { n: "Aktiv", cp: [["RMA", 2021, 0]] };           // offenes Ende
const RETURNER = { n: "Rückkehrer", cp: [["FCB", 1990, 1992], ["FCB", 2005, 2007]] };

test("wereTeammates: Überlappung, disjunkt, offenes Ende, Mehrfach-Engagement, fehlendes cp", () => {
  assert.equal(wereTeammates(XAVI, INIESTA), true);              // BAR 2002–2015
  assert.equal(wereTeammates(XAVI, KAHN), false);                // andere Vereine
  assert.equal(wereTeammates(ACTIVE, { cp: [["RMA", 2023, 0]] }), true);  // beide offen
  assert.equal(wereTeammates(RETURNER, { cp: [["FCB", 1991, 1991]] }), true); // 1. Engagement
  assert.equal(wereTeammates(RETURNER, { cp: [["FCB", 1995, 2004]] }), false); // Lücke
  assert.equal(wereTeammates(RETURNER, { cp: [["FCB", 2007, 2010]] }), true);  // Grenzjahr inkl.
  assert.equal(wereTeammates(XAVI, { n: "ohne" }), false);       // fehlendes cp
  assert.equal(wereTeammates({}, INIESTA), false);
});

test("activeInRange: innerhalb, außerhalb, übergreifend, offen, ohne cp", () => {
  assert.equal(activeInRange(XAVI, 1990, 1999), true);           // ab 1998
  assert.equal(activeInRange(XAVI, 2016, 2019), false);
  assert.equal(activeInRange(KAHN, 2000, 2009), true);           // übergreifend
  assert.equal(activeInRange(ACTIVE, 2030, 2039), true);         // offenes Ende
  assert.equal(activeInRange({}, 1990, 1999), false);
});

test("answerGuessQuestion: mate über cp-Snapshot", () => {
  assert.equal(answerGuessQuestion(XAVI, { dim: "mate", val: { n: "Iniesta", cp: INIESTA.cp } }), true);
  assert.equal(answerGuessQuestion(XAVI, { dim: "mate", val: { n: "Kahn", cp: KAHN.cp } }), false);
  assert.equal(answerGuessQuestion(XAVI, { dim: "mate", val: { n: "ohne", cp: [] } }), false);
});

test("guessQuestionLabel: mate", () => {
  assert.equal(guessQuestionLabel({ dim: "mate", val: { n: "Xavi", cp: [] } }), "Teamkollege von Xavi?");
});

test("SPECIALS: 6 Felder inkl. Ära, Ära-Tests greifen über cp", () => {
  assert.equal(SPECIALS.length, 6);
  assert.deepEqual(SPECIALS.map((s) => s.key).sort(), ["A00", "A10", "A90", "N90", "OLD", "Y2K"]);
  const a90 = lookupDef("spec", "A90"), a00 = lookupDef("spec", "A00");
  assert.equal(playerMatchesHex(XAVI, a90), true);
  assert.equal(playerMatchesHex(XAVI, a00), true);
  assert.equal(playerMatchesHex({ by: 1995 }, a90), false);      // ohne cp kein Match
});
```

- [ ] **Step 2: Tests ausführen, Fehlschlag prüfen**

Run: `npm test`
Expected: FAIL (`wereTeammates` nicht exportiert).

- [ ] **Step 3: Engine implementieren.** In `src/gameData.js`:

**(a)** Nach der Funktion `playerMatchesHex` (vor `// ── Errate den Star`) einfügen:

```js
// ── Karrierezeiträume (Feld cp: [[clubKey, von, bis], ...]; bis 0 = offen) ──
const cpEnd = (to) => (to === 0 ? 9999 : to);

// Waren zwei Spieler Teamkollegen? Gemeinsamer Verein + überlappende Jahre
// (inklusiv). Ohne cp auf einer Seite: false (missing is better than wrong).
export function wereTeammates(a, b) {
  const ca = a?.cp, cb = b?.cp;
  if (!ca || !ca.length || !cb || !cb.length) return false;
  for (const [k1, f1, t1] of ca) for (const [k2, f2, t2] of cb) {
    if (k1 === k2 && Math.max(f1, f2) <= Math.min(cpEnd(t1), cpEnd(t2))) return true;
  }
  return false;
}

// Aktiv (bei einem unserer Vereine) im Jahresbereich [from, to]?
export function activeInRange(p, from, to) {
  const cp = p?.cp;
  if (!cp || !cp.length) return false;
  return cp.some(([, f, t]) => f <= to && cpEnd(t) >= from);
}
```

**(b)** In `SPECIALS` nach der `OLD`-Zeile drei Einträge ergänzen (Array bleibt `.map((s) => ({ ...s, type: "spec" }))`):

```js
  { key: "A90", label: "90ER AKTIV", icon: "📼", name: "Aktiv in den 90ern",   c1: "#F472B6", c2: "#831843", test: (p) => activeInRange(p, 1990, 1999) },
  { key: "A00", label: "00ER AKTIV", icon: "💿", name: "Aktiv in den 2000ern", c1: "#60A5FA", c2: "#1e3a8a", test: (p) => activeInRange(p, 2000, 2009) },
  { key: "A10", label: "10ER AKTIV", icon: "📱", name: "Aktiv in den 2010ern", c1: "#FBBF24", c2: "#78350f", test: (p) => activeInRange(p, 2010, 2019) },
```

**Achtung Reihenfolge:** `SPECIALS` nutzt `test`-Funktionen, die `activeInRange` referenzieren — `activeInRange` muss VOR dem `SPECIALS`-Array definiert sein. Da `SPECIALS` früh in der Datei steht: die beiden Funktionen aus (a) stattdessen DIREKT VOR `export const SPECIALS` platzieren.

**(c)** In `answerGuessQuestion` vor `default:` einfügen:

```js
    case "mate":   return wereTeammates(player, q.val);
```

**(d)** In `guessQuestionLabel` vor `default:` einfügen:

```js
    case "mate":   return `Teamkollege von ${q.val?.n ?? "?"}?`;
```

- [ ] **Step 4: Tests ausführen**

Run: `npm test`
Expected: PASS (bestehende Board-Tests bleiben grün — `buildBoardSerial` wählt 3 aus jetzt 6 SPECIALS).

- [ ] **Step 5: Commit**

```bash
git add src/gameData.js src/gameData.test.js
git commit -m "feat: wereTeammates/activeInRange, mate-Dimension, 3 Ära-SPECIALS"
```

---

## Task 2: Pipeline — `wikidata_careers.mjs` + recToString-Fixes

**Files:**
- Create: `data-pipeline/wikidata_careers.mjs`
- Modify: `data-pipeline/wikidata_roster.mjs`, `data-pipeline/wikidata_honours.mjs`, `data-pipeline/wikidata_honours_extra.mjs`, `data-pipeline/wikidata_positions.mjs`

- [ ] **Step 1: In allen vier Bestandsskripten** in `recToString` direkt vor `return s + "}";` diese Zeile einfügen (bei `wikidata_roster.mjs` zusätzlich die pos-Zeile, falls fehlend — Zielzustand überall identisch):

```js
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`;
  if (r.cp && r.cp.length) s += `, "cp": ${JSON.stringify(r.cp)}`;
```

(In `wikidata_honours.mjs`, `wikidata_honours_extra.mjs`, `wikidata_positions.mjs` existiert die pos-Zeile schon — dort nur die cp-Zeile ergänzen.)

- [ ] **Step 2: `data-pipeline/wikidata_careers.mjs` anlegen:**

```js
#!/usr/bin/env node
/*
 * wikidata_careers.mjs — setzt das Feld `cp` (Club-Perioden [[key, von, bis], ...],
 * bis 0 = offen) je Spieler aus Wikidata (P54 mit P580/P582 je Verein).
 * Nur Club-Keys, die bereits in clubs[] stehen. Idempotent. Internet nötig.
 *   node data-pipeline/wikidata_careers.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { CLUB_QID, norm } from "./wikidata_roster.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } });
    } catch (e) { await sleep(5000); continue; }
    if (res.status === 429 || res.status >= 500) { await sleep(8000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    const text = await res.text();
    try { return JSON.parse(text).results.bindings; }
    catch (e) { await sleep(5000); continue; }
  }
  throw new Error("SPARQL fehlgeschlagen (Retries erschöpft)");
}

// Alle P54-Perioden eines Vereins: Spielername, Geburtsjahr, von, bis (0 = offen).
async function fetchClubPeriods(qid) {
  const q = `SELECT ?pLabel ?by ?f ?t WHERE {
    ?p p:P54 ?st . ?st ps:P54 wd:${qid} ; pq:P580 ?s .
    OPTIONAL { ?st pq:P582 ?e. }
    ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d .
    BIND(YEAR(?d) AS ?by) BIND(YEAR(?s) AS ?f) BIND(IF(BOUND(?e), YEAR(?e), 0) AS ?t)
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  return (await sparql(q)).map((b) => ({
    name: b.pLabel?.value,
    by: b.by?.value ? parseInt(b.by.value) : null,
    from: b.f?.value ? parseInt(b.f.value) : null,
    to: b.t?.value != null ? parseInt(b.t.value) : 0,
  }));
}

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`;
  if (r.cp && r.cp.length) s += `, "cp": ${JSON.stringify(r.cp)}`;
  return s + "}";
}

async function main() {
  // 1) Perioden je Spieler sammeln: "norm|by" -> [[key, von, bis], ...]
  const per = new Map();
  for (const [key, qid] of Object.entries(CLUB_QID)) {
    let rows;
    try { rows = await fetchClubPeriods(qid); } catch (e) { console.log(`  ${key} FEHLER ${e.message}`); continue; }
    let c = 0;
    for (const r of rows) {
      if (!r.name || !r.by || !r.from) continue;
      const k = norm(r.name) + "|" + r.by;
      if (!per.has(k)) per.set(k, []);
      per.get(k).push([key, r.from, r.to]); c++;
    }
    console.log(`  ${key}: ${rows.length} Zeilen, ${c} Perioden`);
    await sleep(900);
  }

  // 2) players.js laden, cp setzen (nur Keys aus clubs[]; sortiert; Duplikate raus)
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const players = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  let withCp = 0;
  for (const p of players) {
    const raw = per.get(norm(p.n) + "|" + p.by) || [];
    const own = new Set(p.clubs);
    const seen = new Set();
    const cp = raw
      .filter(([k]) => own.has(k))
      .filter(([k, f, t]) => { const sig = `${k}|${f}|${t}`; if (seen.has(sig)) return false; seen.add(sig); return true; })
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    if (cp.length) { p.cp = cp; withCp++; } else delete p.cp;
  }

  // 3) Schreiben (Reihenfolge wie zuvor: nach Name)
  players.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  const body = players.map(recToString).join(",\n  ");
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + body + "\n];\n");
  console.log(`\nFertig: ${withCp} Spieler mit cp -> src/players.js`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
```

**Hinweis:** Der Import aus `wikidata_roster.mjs` führt dessen Modul-Top-Level aus (nur Konstanten/Funktionen, `main()` ist durch den `import.meta.url`-Guard geschützt) — gefahrlos.

- [ ] **Step 3: Commit**

```bash
git add data-pipeline/wikidata_careers.mjs data-pipeline/wikidata_roster.mjs data-pipeline/wikidata_honours.mjs data-pipeline/wikidata_honours_extra.mjs data-pipeline/wikidata_positions.mjs
git commit -m "feat: wikidata_careers.mjs (cp-Perioden); recToString aller Skripte schreibt cp"
```

---

## Task 3: Pipeline-Lauf & Datenverifikation

**Files:**
- Modify (generiert): `src/players.js`

- [ ] **Step 1: Lauf**

Run: `node data-pipeline/wikidata_careers.mjs` (41 Vereins-Queries, einige Minuten)
Expected: Zeilen-/Perioden-Counts je Verein; `Fertig: <n> Spieler mit cp` (Erwartung: deutlich über 20.000 — Roster stammt aus denselben P54-Daten; von/bis sind dort Pflicht-Qualifikatoren der Roster-Query).

- [ ] **Step 2: Verifikation**

```bash
node -e '
import("./src/players.js").then(({PLAYERS})=>{
  const withCp = PLAYERS.filter(p=>p.cp&&p.cp.length);
  console.log("mit cp:", withCp.length, "von", PLAYERS.length);
  const xavi = PLAYERS.find(p=>p.n==="Xavi"), ini = PLAYERS.find(p=>p.n.includes("Iniesta"));
  console.log("Xavi:", JSON.stringify(xavi?.cp), "Iniesta:", JSON.stringify(ini?.cp));
});
'
```
Expected: Xavi/Iniesta mit BAR-Perioden, die sich überlappen. Zusätzlich Diff-Stichprobe: `git diff src/players.js | grep '"pos"' | head -2` — pos bleibt erhalten.

- [ ] **Step 3: Tests + Build**

Run: `npm test` und `npm run build`
Expected: PASS / `✓`.

- [ ] **Step 4: Commit**

```bash
git add src/players.js
git commit -m "data: Karrierezeiträume (cp) aus Wikidata"
```

---

## Task 4: UI — „Teamkollege"-Dimension in Guess.jsx & Daily.jsx

**Files:**
- Modify: `src/Guess.jsx`
- Modify: `src/Daily.jsx`

Beide Dateien erhalten dieselben vier Änderungen (Zeileninhalte sind in beiden identisch):

- [ ] **Step 1: `sigOf` erweitern.** Die Zeile

```js
const sigOf = (dim, val) => (dim === "born" ? `born:${val.cmp}:${val.year}` : `${dim}:${val}`);
```

ersetzen durch:

```js
const sigOf = (dim, val) =>
  dim === "born" ? `born:${val.cmp}:${val.year}` :
  dim === "mate" ? `mate:${norm(val.n)}` : `${dim}:${val}`;
```

- [ ] **Step 2: Mate-Referenz-State + Vorschläge.** In der Hauptkomponente nach der Zeile `const [yearInput, setYearInput] = useState("2000");` einfügen:

```jsx
  const [mateInput, setMateInput] = useState("");
```

Und nach der bestehenden `suggestions`-Zeile:

```jsx
  const mateSuggestions = useMemo(() => (players && dim === "mate" ? suggestPlayers(players, mateInput, 8) : []), [players, dim, mateInput]);
```

- [ ] **Step 3: Dimension anbieten.** Im `DIMS`-Array den Eintrag ergänzen:

```jsx
    { k: "mate", label: "Teamkollege" },
```

(nach `{ k: "born", label: "Geburtsjahr" },`)

- [ ] **Step 4: Eingabe-UI.** Nach dem `{dim === "born" && (...)}`-Block einfügen:

```jsx
                {dim === "mate" && (
                  <div>
                    <input className="field" placeholder="Referenzspieler tippen…" value={mateInput}
                      autoComplete="off" onChange={(e) => setMateInput(e.target.value)} />
                    <div className="cbList">
                      {mateSuggestions.map((s) => {
                        const used = askedSigs.has(sigOf("mate", { n: s.n }));
                        return (
                          <button key={s.n} className="cbItem" disabled={used}
                            onClick={() => { ask("mate", { n: s.n, cp: s.cp || [] }); setMateInput(""); }}>
                            {s.n} <span className="cbMeta">{used ? "gefragt" : [s.pos, new Date().getFullYear() - s.by].filter(Boolean).join(" · ")}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
```

- [ ] **Step 5: Build + Tests**

Run: `npm run build` und `npm test`
Expected: `✓` / PASS.

- [ ] **Step 6: Commit**

```bash
git add src/Guess.jsx src/Daily.jsx
git commit -m "feat: Teamkollegen-Frage in Guess-Duell und Daily-Star"
```

---

## Task 5: Verifikation & Abschluss

- [ ] **Step 1:** `npm test` + `npm run build` final grün; Bundle-Größen notieren (players-Chunk wächst durch cp).
- [ ] **Step 2:** Manuell (falls Dev-Umgebung): Hex-Board zeigt gelegentlich Ära-Felder; Guess/Daily haben „Teamkollege"-Chip; Frage „Teamkollege von Xavi?" bei Ziel Iniesta → Ja.
- [ ] **Step 3:** `superpowers:finishing-a-development-branch` — Push + PR via GitHub-API, mergen auf Zuruf.

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** Datenformat/`cp` + Pipeline + recToString-Fixes (A/B) → Task 2+3; Engine `wereTeammates`/`activeInRange`/`mate`/Label (C) → Task 1; Ära-SPECIALS (C) → Task 1; UI-Chip + Autocomplete + sigOf (D) → Task 4; Tests/Verifikation (E) → Task 1/3/5. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** `cp`-Form `[[key, from, to]]` mit `to 0 = offen` überall identisch (Engine, Tests, Pipeline, UI-Snapshot `{n, cp}`); `sigOf`-mate über `norm(val.n)` konsistent zwischen Fragestellung und Sperr-Check (`ask("mate", {n, cp})` → gespeicherter Log-Eintrag hat `val.n`); `activeInRange` vor SPECIALS definiert (Reihenfolge-Hinweis in Task 1).
