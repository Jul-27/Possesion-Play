# Design: Liga-Hexfelder (Teil A)

**Datum:** 2026-06-21
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** Nur die 5 Liga-Felder. Titel/Honours (Teil B) und Weltmeister (Teil C)
sind ausdrücklich NICHT Teil dieser Spec.

## Ziel

Fünf neue Hexfeld-Typen ins Spiel bringen, die abfragen, ob ein Spieler in einer
der Top-5-Ligen gespielt hat:

- **Bundesliga** (`BL`)
- **Premier League** (`PL`)
- **La Liga** (`LL`)
- **Serie A** (`SA`)
- **Ligue 1** (`L1`)

## Entscheidungen (aus dem Brainstorming)

1. **Ableitung aus den Vereinen** (keine Pipeline-Änderung, kein Kaggle-Lauf):
   „Spielte in Liga X" = der Spieler hat mindestens einen Verein, dessen Liga
   (`CLUBS[].lg`) gleich X ist. Nutzt die bereits transfer-erweiterten `clubs`,
   also gute Abdeckung auch vor 2012.
2. **Optik:** abgerundetes Badge mit Liga-Kürzel (BL/PL/LL/SA/L1) auf
   liga-typischem Farbverlauf; darunter der volle Liganame.
3. **Bretter:** pro Brett **zufällig 1–3** Liga-Felder (mindestens eine,
   höchstens drei). Gesamtzahl der Felder bleibt 31.

## Nicht-Ziele (YAGNI)

- Keine Titel/Meister/Pokal/CL-Felder (Teil B).
- Kein Weltmeister-Feld (Teil C).
- Keine Änderung an `src/players.js` oder der `data-pipeline/`.
- Kein neues Datenfeld (`leagues:[]` o. Ä.) — Ableitung passiert zur Laufzeit.

## Architektur / Änderungen

Bestehendes Hexfeld-Modell: Felder haben einen `type` (`club`, `nat`, `spec`),
werden in `buildBoardSerial()` ausgewählt, über `lookupDef(type, key)` aufgelöst
und in `playerMatchesHex(player, def)` geprüft. Gerendert wird über `Emblem`
(Schalter nach `def.type`) und `Cell` in `Emblems.jsx`.

Wir fügen einen vierten Typ `league` nach exakt demselben Muster hinzu.

### 1. `src/gameData.js`

**Neuer Export `LEAGUES`:**

```js
export const LEAGUES = [
  { key: "BL", label: "BL", name: "Bundesliga",     c1: "#D3010C", c2: "#1a1a1a" },
  { key: "PL", label: "PL", name: "Premier League", c1: "#3D195B", c2: "#1f0e36" },
  { key: "LL", label: "LL", name: "La Liga",        c1: "#E03A3E", c2: "#1f1f3c" },
  { key: "SA", label: "SA", name: "Serie A",        c1: "#0A66B0", c2: "#0a2a4a" },
  { key: "L1", label: "L1", name: "Ligue 1",        c1: "#091C3E", c2: "#1d6f6f" },
].map((l) => ({ ...l, type: "league" }));
```

Die `key`-Werte entsprechen bewusst den `lg`-Codes in `CLUBS` — dadurch ist das
Matching ein direkter Vergleich. Eigener Namespace (Typ `league`), keine Kollision
mit Vereins-Keys (`FCB` etc.) oder Nationen.

**Club-Key → Liga-Lookup** (für das Matching), nahe `CLUBS` definiert:

```js
const CLUB_LG = Object.fromEntries(CLUBS.map((c) => [c.key, c.lg]));
```

**`playerMatchesHex` erweitern:**

```js
if (def.type === "league")
  return (player.clubs || []).some((ck) => CLUB_LG[ck] === def.key);
```

**`DEF_BY_KEY` erweitern:**

```js
league: Object.fromEntries(LEAGUES.map((l) => [l.key, l])),
```

**`buildBoardSerial` anpassen** — 1–3 Liga-Felder, Rest-Vereine füllen auf:

```js
const nLeague = 1 + Math.floor(Math.random() * 3); // 1, 2 oder 3
const leagues = pick(LEAGUES, nLeague);
const specials = pick(SPECIALS, 3);
const blClubs  = pick(CLUBS.filter((c) => c.lg === "BL"), 4);
const nations  = pick(NATIONS, 6);
const rest     = pick(CLUBS.filter((c) => !blClubs.includes(c)), 31 - 3 - 4 - 6 - nLeague);
const chosen   = shuffle([...specials, ...blClubs, ...nations, ...rest, ...leagues]);
return chosen.map((d) => ({ t: d.type, k: d.key }));
```

Invariante: `3 + 4 + 6 + (18 − nLeague) + nLeague = 31`.

### 2. `src/Emblems.jsx`

**`Emblem` um Liga-Zweig erweitern** (rundes Badge mit Kürzel auf Verlauf):

```jsx
if (def.type === "league")
  return (
    <span
      className="emblem league"
      style={{ background: `linear-gradient(150deg, ${def.c1}, ${def.c2})` }}
    >
      {def.label}
    </span>
  );
```

- Badge zeigt das **Kürzel** (`def.label`, z. B. „BL").
- Das vorhandene `hexLabel` unter dem Emblem zeigt den **vollen Liganamen**
  (`def.name`), nicht das Kürzel. Dafür rendert `Cell` für `type === "league"`
  `def.name` statt `def.label` (analog wie Vereine zusätzlich das Land zeigen).
- Tooltip nutzt `cname(def)` → liefert für Nicht-Vereine bereits `def.name`
  („Bundesliga"), keine Änderung nötig.

**CSS:** Falls nötig, eine `.emblem.league`-Regel in `src/styles.css` (am Stil von
`.emblem.icon` orientiert: quadratisch/rund, zentrierter, fetter Text, ~2 Zeichen).

## Datenfluss

1. `buildBoardSerial()` wählt u. a. 1–3 `{ t: "league", k }` und serialisiert sie
   (Supabase-kompatibel, wie bisher).
2. `hydrateBoard(serial)` löst über `lookupDef("league", k)` zur vollen Def auf.
3. Beim Zug prüft `playerMatchesHex(player, def)` den Liga-Zweig.
4. `Emblem`/`Cell` rendern das Liga-Badge.

Keine Änderung an Supabase-Schema oder Serialisierungsformat (`{t,k}` bleibt).

## Fehlerfälle / Edge Cases

- Spieler ohne passenden Verein → Feld nicht erfüllbar (korrekt).
- `CLUB_LG[ck]` für unbekannten Key → `undefined`, matcht nichts (sicher).
- Liga-Felder sind breit/leicht erfüllbar — bewusst auf 1–3 begrenzt.
- Randfall Daten: ein Verein wird konstant einer Liga zugeordnet (z. B. RB Leipzig
  = `BL`), historische Auf-/Abstiege werden nicht berücksichtigt. Akzeptiert.

## Tests / Verifikation

- **Logik:** `playerMatchesHex` für `type:"league"` —
  Spieler mit `clubs:["FCB"]` erfüllt `BL`, erfüllt `PL` nicht; Spieler mit
  `clubs:["BAR"]` erfüllt `LL`.
- **Board-Invariante:** `buildBoardSerial()` liefert immer 31 Felder mit 1–3
  Liga-Feldern (über mehrere Läufe geprüft).
- **Build:** `npm run build` läuft fehlerfrei.
- **Sichtcheck:** ein Brett rendern, Liga-Badge sichtbar und korrekt beschriftet.

## Betroffene Dateien

- `src/gameData.js` (LEAGUES, CLUB_LG, playerMatchesHex, DEF_BY_KEY, buildBoardSerial)
- `src/Emblems.jsx` (Emblem-Zweig, Cell-Label für league)
- `src/styles.css` (optional: `.emblem.league`)
