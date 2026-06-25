# Roster-Erweiterung aus Wikidata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fehlende (vor ~2012 zurückgetretene) Spieler aus Wikidata als neue Einträge in `src/players.js` ergänzen und das Autocomplete nach Bekanntheit sortieren.

**Architecture:** Reine Autocomplete-Sortierung als testbarer Helfer in `gameData.js`; ein Node-Skript `data-pipeline/wikidata_roster.mjs` baut den Spieler-Pool neu (vorhandene ergänzen + fehlende anlegen) aus Wikidata (P54-Kader, Sitelinks=Bekanntheit, P27→ISO-3 Nation). Spieler-Records bekommen optionales Feld `sl`.

**Tech Stack:** Vite + React 18 (ESM). Tests: Node `node:test`. Datenquelle: Wikidata SPARQL (Internet nötig). Node 20 global `fetch`.

**Phasen:**
- **Phase 1 (Task 1):** Autocomplete-Sortierung — lokal, TDD, sofort mergebar (wirkt auch ohne `sl`).
- **Phase 2 (Task 2–4):** Roster-Builder — reine Helfer per TDD, dann Netzwerk-Lauf (Controller) + Daten-Integration.

Alles auf Branch `feat/wikidata-roster`; Merge am Ende.

---

## File Structure

- `src/gameData.js` — **modify**: `suggestPlayers(players, query, limit)` (Filter + Bekanntheits-Sortierung).
- `src/Game.jsx` — **modify**: `suggestions`-`useMemo` nutzt `suggestPlayers`.
- `src/gameData.test.js` — **modify**: Test für `suggestPlayers`.
- `data-pipeline/wikidata_roster.mjs` — **create**: Roster-Builder (ersetzt `wikidata_enrich.mjs`).
- `data-pipeline/wikidata_roster.test.mjs` — **create**: Test für `deriveLastName`.
- `data-pipeline/wikidata_enrich.mjs` — **delete**: durch Roster-Builder ersetzt.
- `data-pipeline/README.md` — **modify**: Doku.
- `src/players.js` — **regenerate**: ~26k Spieler, Feld `sl`.

---

## Task 1: Autocomplete nach Bekanntheit sortieren (TDD)

**Files:**
- Modify: `src/gameData.js`
- Modify: `src/gameData.test.js`
- Modify: `src/Game.jsx`

- [ ] **Step 1: Failing test anhängen** an `src/gameData.test.js`:

```js
import { suggestPlayers } from "./gameData.js";

test("suggestPlayers: Nachname-Präfix, Bekanntheit zuerst, dann alphabetisch", () => {
  const players = [
    { n: "Mohamed Salah", ln: "Salah", sl: 90 },
    { n: "Saúl Ñíguez", ln: "Saúl", sl: 30 },
    { n: "Unbekannt Sava", ln: "Sava" },          // kein sl -> 0
    { n: "Andrea Pirlo", ln: "Pirlo", sl: 80 },   // matcht "sa" nicht
  ];
  assert.deepEqual(suggestPlayers(players, "sa", 8).map((p) => p.ln), ["Salah", "Saúl", "Sava"]);
  assert.deepEqual(suggestPlayers(players, "s", 8), []); // <2 Zeichen
  assert.equal(suggestPlayers(players, "sa", 2).length, 2); // Limit
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag prüfen**

Run: `npm test`
Expected: FAIL — `suggestPlayers` nicht exportiert.

- [ ] **Step 3: `suggestPlayers` in `src/gameData.js` ergänzen** (direkt nach der `norm`-Definition):

```js
// Autocomplete-Vorschläge: Nachname-Präfix, sortiert nach Bekanntheit (sl) desc, dann alphabetisch.
export function suggestPlayers(players, query, limit = 8) {
  const q = norm((query || "").trim());
  if (q.length < 2) return [];
  return players
    .filter((p) => norm(p.ln).startsWith(q))
    .sort((a, b) => (b.sl || 0) - (a.sl || 0) || a.ln.localeCompare(b.ln, "de"))
    .slice(0, limit);
}
```

- [ ] **Step 4: Test ausführen, Erfolg prüfen**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: `Game.jsx` auf `suggestPlayers` umstellen**

In `src/Game.jsx` den Import (Zeile 5, aus `./gameData.js`) um `suggestPlayers` ergänzen, sodass er u. a. enthält: `P, cname, norm, PLAYERS, suggestPlayers, ADJP, hydrateBoard, playerMatchesHex`.

Dann den `suggestions`-`useMemo` (Zeilen 57–61) ersetzen durch:

```jsx
  const suggestions = useMemo(() => suggestPlayers(PLAYERS, nameInput, 8), [nameInput]);
```

- [ ] **Step 6: Build + Test**

Run: `npm run build` (Expected: `✓ built in …`) und `npm test` (Expected: PASS).

- [ ] **Step 7: Commit**

```bash
git add src/gameData.js src/gameData.test.js src/Game.jsx
git commit -m "feat: Autocomplete nach Bekanntheit (sl) sortieren"
```

---

## Task 2: Roster-Builder Grundgerüst + deriveLastName (TDD)

**Files:**
- Create: `data-pipeline/wikidata_roster.mjs`
- Create: `data-pipeline/wikidata_roster.test.mjs`

- [ ] **Step 1: Failing test erstellen** `data-pipeline/wikidata_roster.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveLastName } from "./wikidata_roster.mjs";

test("deriveLastName", () => {
  assert.equal(deriveLastName("Zinedine Zidane"), "Zidane");
  assert.equal(deriveLastName("Thierry Henry"), "Henry");
  assert.equal(deriveLastName("Robin van Persie"), "van Persie");
  assert.equal(deriveLastName("Ronaldinho"), "Ronaldinho");
  assert.equal(deriveLastName("Rafael van der Vaart"), "van der Vaart");
});
```

- [ ] **Step 2: Test ausführen, Fehlschlag prüfen**

Run: `node --test data-pipeline/wikidata_roster.test.mjs`
Expected: FAIL — Modul/Export fehlt.

- [ ] **Step 3: `data-pipeline/wikidata_roster.mjs` anlegen** (Grundgerüst mit Konstanten + `deriveLastName` + `norm`; `main()` per Guard, läuft NICHT bei Import):

```js
#!/usr/bin/env node
/*
 * wikidata_roster.mjs — Baut src/players.js neu: ergänzt Vereine vorhandener
 * Spieler UND legt fehlende Spieler aus Wikidata an (Name, Nachname, Geburtsjahr,
 * Nation, Vereine, Bekanntheit `sl`). Internet nötig. Idempotent.
 *   node data-pipeline/wikidata_roster.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = join(HERE, "..", "src", "players.js");
const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; data enrichment)";

export const CLUB_QID = {
  FCB:"Q15789", BVB:"Q41420", RBL:"Q702455", B04:"Q104761", SGE:"Q38245",
  BMG:"Q101959", VFB:"Q4512", WOB:"Q101859", SVW:"Q51976",
  MCI:"Q50602", MUN:"Q18656", LIV:"Q1130849", CHE:"Q9616", ARS:"Q9617",
  TOT:"Q18741", NEW:"Q18716", EVE:"Q5794", AVL:"Q18711",
  BAR:"Q7156", RMA:"Q8682", ATM:"Q8701", SEV:"Q10329", VAL:"Q10333", VIL:"Q12297",
  JUV:"Q1422", MIL:"Q1543", INT:"Q631", NAP:"Q2641", ROM:"Q2739", LAZ:"Q2609",
  PSG:"Q483020", ASM:"Q180305", OM:"Q132885", OL:"Q704", LIL:"Q19516",
  POR:"Q128446", SLB:"Q131499", SCP:"Q75729", AJA:"Q81888", PSV:"Q11938", FEY:"Q134241",
};

export const CLUB_OVERRIDES = {
  "Cristiano Ronaldo": ["SCP"],
  "David Beckham": ["MUN", "RMA", "MIL"],
  "Zlatan Ibrahimović": ["AJA", "JUV", "INT", "BAR"],
  "Wesley Sneijder": ["AJA", "RMA"],
  "Arjen Robben": ["PSV", "CHE", "RMA"],
  "Xabi Alonso": ["LIV"],
  "Andrea Pirlo": ["MIL", "INT"],
  "Samuel Eto'o": ["BAR", "INT"],
  "Fernando Torres": ["LIV"],
};

// ISO-3-Codes unserer Spiel-Nationen (NATIONS in gameData.js)
export const NATION_KEYS = new Set(["FRA","GER","ESP","ITA","NED","BEL","CRO","ENG","PRT","JPN","BRA","ARG","MEX","NGA","CIV","SEN","COL","USA"]);

const PARTICLES = new Set(["van","von","de","del","della","di","da","dos","der","den","ten","ter","la","le"]);

export function norm(s) {
  return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function deriveLastName(name) {
  const parts = String(name).trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || "";
  let i = parts.length - 1;
  while (i > 0 && PARTICLES.has(parts[i - 1].toLowerCase())) i--;
  return parts.slice(i).join(" ");
}

async function main() {
  // wird in Task 3 implementiert
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
```

- [ ] **Step 4: Test ausführen, Erfolg prüfen**

Run: `node --test data-pipeline/wikidata_roster.test.mjs`
Expected: PASS (5 Assertions).

- [ ] **Step 5: Commit**

```bash
git add data-pipeline/wikidata_roster.mjs data-pipeline/wikidata_roster.test.mjs
git commit -m "feat: Roster-Builder Grundgerüst + deriveLastName"
```

---

## Task 3: Roster aus Wikidata holen, mergen, players.js neu schreiben (Netzwerk)

> Controller-Schritt: braucht Internet. Verifikation über Stichproben/Counts.

**Files:**
- Modify: `data-pipeline/wikidata_roster.mjs` (Fetch + Merge + `main`)
- Delete: `data-pipeline/wikidata_enrich.mjs`
- Regenerate: `src/players.js`

- [ ] **Step 1: `main` + Fetch/Merge in `wikidata_roster.mjs` implementieren** — die leere `async function main()` ersetzen durch:

```js
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sparql(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept": "application/sparql-results+json" } });
    if (res.status === 429) { await sleep(8000); continue; }
    if (!res.ok) throw new Error("HTTP " + res.status);
    return (await res.json()).results.bindings;
  }
  throw new Error("429 wiederholt");
}

async function fetchClubRoster(qid) {
  const q = `SELECT ?pLabel ?by ?sl ?iso WHERE {
    ?p p:P54 ?st . ?st ps:P54 wd:${qid} .
    ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d ; wikibase:sitelinks ?sl .
    BIND(YEAR(?d) AS ?by)
    OPTIONAL { ?p wdt:P27 ?c . ?c wdt:P298 ?iso . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  return (await sparql(q)).map((b) => ({
    name: b.pLabel?.value, by: b.by?.value ? parseInt(b.by.value) : null,
    sl: b.sl?.value ? parseInt(b.sl.value) : 0, iso: b.iso?.value || null,
  }));
}

function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  return s + "}";
}

async function main() {
  // 1) Roster aus Wikidata aggregieren: key "norm|by" -> {name, by, clubs:Set, sl, iso}
  const roster = new Map();
  for (const [key, qid] of Object.entries(CLUB_QID)) {
    let rows;
    try { rows = await fetchClubRoster(qid); } catch (e) { console.log(`  ${key} FEHLER ${e.message}`); continue; }
    for (const r of rows) {
      if (!r.name || !r.by) continue;
      const k = norm(r.name) + "|" + r.by;
      let e = roster.get(k);
      if (!e) { e = { name: r.name, by: r.by, clubs: new Set(), sl: 0, iso: null }; roster.set(k, e); }
      e.clubs.add(key);
      if (r.sl > e.sl) e.sl = r.sl;
      if (!e.iso && r.iso && NATION_KEYS.has(r.iso)) e.iso = r.iso;
    }
    console.log(`  ${key} (${qid}): ${rows.length} Zeilen`);
    await sleep(1300);
  }

  // 2) Bestehende Spieler laden
  const mod = await import(pathToFileURL(PLAYERS_PATH).href + "?t=" + Date.now());
  const existing = mod.PLAYERS.map((p) => ({ ...p, clubs: [...(p.clubs || [])], nat: [...(p.nat || [])] }));
  const byKey = new Map(existing.map((p) => [norm(p.n) + "|" + p.by, p]));

  // 3) Merge: vorhandene ergänzen, fehlende neu anlegen
  let added = 0, enriched = 0;
  for (const [k, e] of roster) {
    const cur = byKey.get(k);
    if (cur) {
      const before = cur.clubs.length;
      cur.clubs = [...new Set([...cur.clubs, ...e.clubs])].sort();
      cur.sl = Math.max(cur.sl || 0, e.sl);
      if (cur.clubs.length > before) enriched++;
    } else {
      const rec = {
        n: e.name, ln: deriveLastName(e.name), by: e.by,
        nat: e.iso ? [e.iso] : [], clubs: [...e.clubs].sort(), sl: e.sl,
      };
      existing.push(rec); byKey.set(k, rec); added++;
    }
  }

  // 4) Kuratierte Overrides anwenden (vorhandene + neue)
  for (const p of existing) {
    const ov = CLUB_OVERRIDES[p.n];
    if (ov) p.clubs = [...new Set([...p.clubs, ...ov])].sort();
  }

  // 5) Schreiben (sortiert nach Name)
  existing.sort((a, b) => a.n.localeCompare(b.n, "en"));
  const header = readFileSync(PLAYERS_PATH, "utf8").split("export const PLAYERS")[0];
  const body = existing.map(recToString).join(",\n  ");
  writeFileSync(PLAYERS_PATH, header + "export const PLAYERS = [\n  " + body + "\n];\n");
  console.log(`\nFertig: ${existing.length} Spieler (${added} neu, ${enriched} ergänzt) -> src/players.js`);
}
```

- [ ] **Step 2: `wikidata_enrich.mjs` entfernen** (durch Roster-Builder ersetzt):

```bash
git rm data-pipeline/wikidata_enrich.mjs
```

- [ ] **Step 3: Roster-Builder ausführen** (Internet nötig, ~2–4 Min):

Run: `node data-pipeline/wikidata_roster.mjs`
Expected: 41 Vereinszeilen, dann z. B. `Fertig: ~26000 Spieler (~22000 neu, …) -> src/players.js`.

- [ ] **Step 4: Validieren** (alle Keys gültig, Stichproben, Größe):

```bash
node --input-type=module -e "
import('file://'+process.cwd()+'/src/players.js').then(async m=>{
  const g=await import('file://'+process.cwd()+'/src/gameData.js');
  const C=new Set(g.CLUBS.map(c=>c.key)), N=new Set(g.NATIONS.map(n=>n.key));
  let bc=new Set(), nc=new Set(), noln=0;
  for(const p of m.PLAYERS){ (p.clubs||[]).forEach(c=>{if(!C.has(c))bc.add(c)}); (p.nat||[]).forEach(n=>{if(!N.has(n))nc.add(n)}); if(!p.ln) noln++; }
  console.log('Spieler:', m.PLAYERS.length, '| ungültige clubs:', [...bc], '| ungültige nat:', [...nc], '| ohne ln:', noln);
  for(const n of ['Zinedine Zidane','Thierry Henry','Luís Figo','Ronaldinho']){const p=m.PLAYERS.find(x=>x.n===n);console.log(' ',n,'->',p?p.clubs.join(','):'(fehlt)');}
});
"
```
Expected: ungültige clubs `[]`, ungültige nat `[]`, ohne ln `0`; Zidane/Henry/Figo vorhanden mit Vereinen.

- [ ] **Step 5: Commit** (Datei groß — das ist erwartet):

```bash
git add src/players.js data-pipeline/wikidata_roster.mjs data-pipeline/wikidata_enrich.mjs
git commit -m "feat: fehlende Spieler aus Wikidata ergänzt (Roster ~26k, Feld sl)"
```

---

## Task 4: Datenvalidität-Test, Build, Doku

**Files:**
- Modify: `data-pipeline/wikidata_roster.test.mjs`
- Modify: `data-pipeline/README.md`

- [ ] **Step 1: Datenvalidität als Test ergänzen** an `data-pipeline/wikidata_roster.test.mjs`:

```js
import { readFileSync } from "node:fs";

test("players.js: gültige Struktur (Keys, Pflichtfelder)", async () => {
  const players = (await import("../src/players.js")).PLAYERS;
  const game = await import("../src/gameData.js");
  const C = new Set(game.CLUBS.map((c) => c.key));
  const N = new Set(game.NATIONS.map((n) => n.key));
  assert.ok(players.length > 10000, "Pool sollte stark gewachsen sein");
  for (const p of players) {
    assert.ok(p.n && p.ln && typeof p.by === "number", "Pflichtfelder fehlen: " + JSON.stringify(p));
    for (const c of p.clubs || []) assert.ok(C.has(c), "ungültiger club " + c);
    for (const n of p.nat || []) assert.ok(N.has(n), "ungültige nat " + n);
  }
});
```

- [ ] **Step 2: Test + Build ausführen**

Run: `npm test` (Expected: PASS) und `npm run build` (Expected: `✓ built in …`).

- [ ] **Step 3: `data-pipeline/README.md` aktualisieren** — den `wikidata_enrich.mjs`-Eintrag ersetzen durch:

```markdown
| `wikidata_roster.mjs` | Baut `src/players.js` neu aus Wikidata: ergänzt Vereine vorhandener Spieler UND legt fehlende Spieler an (Name, Geburtsjahr, Nation via P27→ISO-3, Vereine, Bekanntheit `sl`). Lauf: `node data-pipeline/wikidata_roster.mjs` (Internet nötig). Idempotent. |
```

- [ ] **Step 4: Commit**

```bash
git add data-pipeline/wikidata_roster.test.mjs data-pipeline/README.md
git commit -m "test+docs: Datenvalidität des Rosters + README"
```

- [ ] **Step 5: Abschluss** — `superpowers:finishing-a-development-branch` (Push + PR).

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** maximaler Umfang (≥1 Sitelink, ohne explizites Filtern, da Query nur Spieler mit Sitelinks liefert) → Task 3 (`fetchClubRoster` mit `wikibase:sitelinks` Pflicht via `;`); Autocomplete-Sortierung → Task 1; `sl`-Feld → Task 1/3; neue Spieler mit n/ln/by/nat/clubs/sl → Task 3; `ln`-Heuristik → Task 2; Nation P27→ISO-3, nur NATIONS → Task 3 (`NATION_KEYS`); Honours leer für Neue → Task 3 (kein `t`); Reproduzierbarkeit → Task 3 Skript; Tests → Task 1/2/4. Keine Lücke.
- **Hinweis Sitelink-Pflicht:** `wikibase:sitelinks ?sl` ist im Query verpflichtend (kein OPTIONAL) → Spieler ohne jeglichen Sitelink fallen automatisch raus = „≥1"-Schwelle ohne extra Filter.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** `suggestPlayers`, `deriveLastName`, `CLUB_QID`, `CLUB_OVERRIDES`, `NATION_KEYS`, Feld `sl` durchgängig konsistent.
