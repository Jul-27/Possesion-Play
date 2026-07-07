# Echte Logos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Echte Wappen/Logos für 41 Vereine + 7 Ligen via TheSportsDB, zentral in `Emblems.jsx` mit automatischem Fallback auf die gezeichneten Badges.

**Architecture:** Einmalig/wiederholbares Download-Skript mit Verifikationspflicht (Land bzw. Liga-Name muss passen, sonst MISS statt falschem Logo); PNGs nach `public/logos/**`; UI-Änderung nur in `Emblems.jsx` (`Logo`-Komponente mit `onError`-Fallback).

**Tech Stack:** Node fetch (TheSportsDB, Key „3"), React, keine neuen Dependencies.

---

## File Structure

- `data-pipeline/fetch_logos.mjs` — **create**: Download + Verifikation + Report.
- `public/logos/club/*.png`, `public/logos/league/*.png` — **generiert, committet**.
- `src/Emblems.jsx` — **modify**: `Logo`-Komponente, club/league-Zweige.
- `src/styles.css` — **modify**: `.emImg`.

---

## Task 1: Download-Skript + Lauf

**Files:**
- Create: `data-pipeline/fetch_logos.mjs`

- [ ] **Step 1: Skript anlegen:**

```js
#!/usr/bin/env node
/*
 * fetch_logos.mjs — lädt Vereins-Badges + Liga-Logos von TheSportsDB (Key "3")
 * nach public/logos/{club,league}/<KEY>.png. Verifikationspflicht: Land bzw.
 * Liga-Name muss zur Erwartung passen, sonst MISS (kein falsches Logo).
 * Idempotent, wiederholbar.   node data-pipeline/fetch_logos.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "logos");
const API = "https://www.thesportsdb.com/api/v1/json/3";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Key -> [API-Suchname, erwartetes Land (String oder Liste)]
const CLUB_SEARCH = {
  FCB: ["Bayern Munich", "Germany"], BVB: ["Borussia Dortmund", "Germany"],
  RBL: ["RB Leipzig", "Germany"], B04: ["Bayer Leverkusen", "Germany"],
  SGE: ["Eintracht Frankfurt", "Germany"], BMG: ["Borussia Monchengladbach", "Germany"],
  VFB: ["VfB Stuttgart", "Germany"], WOB: ["VfL Wolfsburg", "Germany"], SVW: ["Werder Bremen", "Germany"],
  MCI: ["Manchester City", "England"], MUN: ["Manchester United", "England"],
  LIV: ["Liverpool", "England"], CHE: ["Chelsea", "England"], ARS: ["Arsenal", "England"],
  TOT: ["Tottenham Hotspur", "England"], NEW: ["Newcastle United", "England"],
  EVE: ["Everton", "England"], AVL: ["Aston Villa", "England"],
  BAR: ["Barcelona", "Spain"], RMA: ["Real Madrid", "Spain"], ATM: ["Atletico Madrid", "Spain"],
  SEV: ["Sevilla", "Spain"], VAL: ["Valencia", "Spain"], VIL: ["Villarreal", "Spain"],
  JUV: ["Juventus", "Italy"], MIL: ["AC Milan", "Italy"], INT: ["Inter Milan", "Italy"],
  NAP: ["Napoli", "Italy"], ROM: ["AS Roma", "Italy"], LAZ: ["Lazio", "Italy"],
  PSG: ["Paris Saint-Germain", "France"], ASM: ["Monaco", ["France", "Monaco"]],
  OM: ["Marseille", "France"], OL: ["Lyon", "France"], LIL: ["Lille", "France"],
  POR: ["Porto", "Portugal"], SLB: ["Benfica", "Portugal"], SCP: ["Sporting CP", "Portugal"],
  AJA: ["Ajax", "Netherlands"], PSV: ["PSV Eindhoven", "Netherlands"], FEY: ["Feyenoord", "Netherlands"],
};

// Liga-Key -> [TheSportsDB-Liga-ID, erwarteter Namensbestandteil]
const LEAGUE_IDS = {
  PL: [4328, "Premier League"], BL: [4331, "Bundesliga"], SA: [4332, "Serie A"],
  L1: [4334, "Ligue 1"], LL: [4335, "La Liga"], NL: [4337, "Eredivisie"], PT: [4344, "Primeira"],
};

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
async function download(url, path) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  writeFileSync(path, Buffer.from(await r.arrayBuffer()));
}

async function main() {
  mkdirSync(join(OUT, "club"), { recursive: true });
  mkdirSync(join(OUT, "league"), { recursive: true });
  const miss = [];

  for (const [key, [name, country]] of Object.entries(CLUB_SEARCH)) {
    try {
      const j = await getJson(`${API}/searchteams.php?t=${encodeURIComponent(name)}`);
      const ok = [].concat(country);
      const team = (j.teams || []).find((t) => t.strSport === "Soccer" && ok.includes(t.strCountry) && t.strBadge);
      if (!team) { miss.push(`club ${key} (${name}): kein verifizierter Treffer`); continue; }
      await download(team.strBadge, join(OUT, "club", key + ".png"));
      console.log(`  club ${key}: ${team.strTeam} ✓`);
    } catch (e) { miss.push(`club ${key}: ${e.message}`); }
    await sleep(300);
  }

  for (const [key, [id, expect]] of Object.entries(LEAGUE_IDS)) {
    try {
      const j = await getJson(`${API}/lookupleague.php?id=${id}`);
      const lg = j.leagues?.[0];
      if (!lg || !(lg.strLeague || "").includes(expect) || !lg.strBadge) {
        miss.push(`league ${key} (${id}): "${lg?.strLeague}" passt nicht zu "${expect}"`); continue;
      }
      await download(lg.strBadge, join(OUT, "league", key + ".png"));
      console.log(`  league ${key}: ${lg.strLeague} ✓`);
    } catch (e) { miss.push(`league ${key}: ${e.message}`); }
    await sleep(300);
  }

  console.log(miss.length ? `\nMISS (${miss.length}):\n  ` + miss.join("\n  ") : "\nAlle 48 Logos geladen.");
}
main();
```

- [ ] **Step 2: Lauf**

Run: `node data-pipeline/fetch_logos.mjs` (~30 s)
Expected: 41 `club … ✓` + 7 `league … ✓`; MISS-Liste idealerweise leer. Bei MISS: Suchnamen in `CLUB_SEARCH` anpassen und erneut laufen lassen (idempotent); dokumentierte Rest-MISSes sind okay (Fallback greift).

- [ ] **Step 3: Stichprobe**

Run: `ls -la public/logos/club | head -5 && file public/logos/club/FCB.png`
Expected: PNGs mit plausibler Größe (>5 KB), `PNG image data`.

- [ ] **Step 4: Commit**

```bash
git add data-pipeline/fetch_logos.mjs public/logos
git commit -m "feat: Vereins- & Liga-Logos via TheSportsDB (verifizierter Download)"
```

---

## Task 2: Einbindung in Emblems.jsx

**Files:**
- Modify: `src/Emblems.jsx`, `src/styles.css`

- [ ] **Step 1: Import + Logo-Komponente.** In `src/Emblems.jsx` die erste Zeile

```jsx
import { useId } from "react";
```

ersetzen durch:

```jsx
import { useId, useState } from "react";
```

Und vor `export function Emblem` einfügen:

```jsx
// Echtes Logo mit automatischem Fallback auf die gezeichnete Variante.
function Logo({ src, fallback }) {
  const [err, setErr] = useState(false);
  return err ? fallback : <img className="emImg" src={src} alt="" onError={() => setErr(true)} />;
}
```

- [ ] **Step 2: Emblem-Zweige.** In `Emblem`:
  - league-Zweig: `{def.label}` → `<Logo src={`/logos/league/${def.key}.png`} fallback={def.label} />`
  - club-Zweig (letzte Zeile): `<ClubBadge …/>` einwickeln:
    `<Logo src={`/logos/club/${def.key}.png`} fallback={<ClubBadge c1={def.c1} c2={def.c2} pat={def.pat} />} />`
  - **Prüfen:** Falls die Hex-`Cell`-Komponente (Dateiende) `ClubBadge`/`Flag` direkt rendert statt über `Emblem`, dort denselben `Logo`-Wrapper für den club-Fall einsetzen (identisches Muster).

- [ ] **Step 3: CSS** (Ende von `src/styles.css`):

```css
.emImg { width: 100%; height: 100%; object-fit: contain; display: block; }
```

- [ ] **Step 4: Build + Tests**

Run: `npm run build` und `npm test`
Expected: `✓` / 42 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/Emblems.jsx src/styles.css
git commit -m "feat: Emblems rendern echte Logos mit Fallback auf gezeichnete Badges"
```

---

## Task 3: Verifikation & Abschluss

- [ ] **Step 1:** `npm test` + `npm run build` final grün.
- [ ] **Step 2:** `superpowers:finishing-a-development-branch` — Push + PR via GitHub-API, mergen auf Zuruf. Manuell: Board/Raster/Combobox zeigen Logos; eine PNG-Datei umbenennen → gezeichnetes Badge erscheint.

---

## Self-Review-Ergebnis

- **Spec-Abdeckung:** Skript inkl. Suchnamen-Tabelle, Liga-IDs, Verifikation, Report (A) → Task 1; Logo-Komponente + club/league-Zweige + Cell-Check + CSS (B) → Task 2; Assets committet (C) → Task 1 Step 4. Keine Lücke.
- **Platzhalter:** keine.
- **Typ-/Namenskonsistenz:** Pfade `/logos/club/<KEY>.png` / `/logos/league/<KEY>.png` identisch in Skript (OUT) und UI (public/ wird von Vite als Root serviert).
