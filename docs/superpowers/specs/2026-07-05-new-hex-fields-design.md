# Design: Neue Hex-Felder — Ligen PT/NL, Top-5-Wanderer, Geburts-Dekaden

**Datum:** 2026-07-05
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** Zwei neue Liga-Felder (Liga Portugal, Eredivisie), ein Spezial-Feld
„In 3+ Top-5-Ligen gespielt", drei Geburts-Dekaden-Felder (70er/80er/2000er).
Reine `gameData.js`-Erweiterung — kein Pipeline-Lauf, keine UI-Änderung nötig.

## Entscheidungen (aus dem Brainstorming)

- WM/EM/CA: bereits als Einzel-Honours vorhanden — kein neues Feld (Punkt erledigt).
- Dekaden: 70er + 80er + 2000er ergänzen; „Vor 1990"/„Ab 2000"/„90er" bleiben.

## Nicht-Ziele (YAGNI)

- Keine Positions-Felder, Kontinent-Felder, Karriere-Specials (Backlog).
- Keine Gewichtung im Board-Builder.

## Architektur (alles `src/gameData.js`)

### A. LEAGUES 5 → 7

```js
{ key: "PT", label: "PT", name: "Liga Portugal", c1: "#046A38", c2: "#DA291C" },
{ key: "NL", label: "NL", name: "Eredivisie",    c1: "#FF7900", c2: "#21468B" },
```

Matching existiert via `CLUB_LG` (POR/SLB/SCP=PT, AJA/PSV/FEY=NL). Wirkung
automatisch: Hex (1–3 Ligen aus 7), Raster-Pool, Guess/Daily-Liga-Buttons (7).

### B. SPECIALS 6 → 10

```js
const TOP5 = new Set(["BL", "PL", "LL", "SA", "L1"]);
{ key: "T5L", label: "3+ TOP-LIGEN", icon: "🌐", name: "In 3+ Top-5-Ligen gespielt", c1: "#38BDF8", c2: "#0c4a6e",
  test: (p) => new Set((p.clubs || []).map((k) => CLUB_LG[k]).filter((lg) => TOP5.has(lg))).size >= 3 },
{ key: "B70", label: "70ER JG.",   icon: "📻", name: "Geboren 1970–1979", c1: "#D4A373", c2: "#6b4423", test: (p) => p.by >= 1970 && p.by <= 1979 },
{ key: "B80", label: "80ER JG.",   icon: "🎧", name: "Geboren 1980–1989", c1: "#C084FC", c2: "#581c87", test: (p) => p.by >= 1980 && p.by <= 1989 },
{ key: "B00", label: "2000ER JG.", icon: "🎮", name: "Geboren 2000–2009", c1: "#4ADE80", c2: "#14532d", test: (p) => p.by >= 2000 && p.by <= 2009 },
```

**Reihenfolge-Detail:** `CLUB_LG` steht aktuell NACH `SPECIALS` in der Datei —
für den `T5L`-Test (Closure, läuft erst zur Spielzeit) unkritisch; `TOP5` wird
direkt vor `SPECIALS` definiert.

## Fehlerfälle / Edge Cases

- Spieler ohne `clubs` → `T5L` false; PT/NL zählen nicht als Top-5.
- Dekaden-Grenzjahre inklusiv (1970/1979 etc.).
- Board-Builder wählt 3 SPECIALS aus 10, 1–3 LEAGUES aus 7 — mengen-agnostisch,
  keine Code-Änderung.

## Tests / Verifikation

- `LEAGUES`: Länge 7, Keys inkl. PT/NL; `playerMatchesHex` mit POR→PT, AJA→NL.
- `SPECIALS`: Länge 10, Key-Liste `[A00, A10, A90, B00, B70, B80, N90, OLD, T5L, Y2K]`.
- `T5L`: 2 Top-5-Ligen → false, 3 → true; PT/NL zählen nicht; doppelte Vereine
  derselben Liga zählen einfach.
- Dekaden: Grenzjahre 1970/1979/1980/1989/2000/2009.
- Bestehende Tests bleiben grün (Board-Builder mengen-agnostisch);
  `npm run build` grün.

## Betroffene Dateien

- `src/gameData.js`, `src/gameData.test.js`
