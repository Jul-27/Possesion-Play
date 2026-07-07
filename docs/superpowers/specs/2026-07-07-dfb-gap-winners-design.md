# Design: Saison-Sieger-Lücken schließen (DFB-Pokal)

**Datum:** 2026-07-07
**Status:** Genehmigt (Folge-Fix zu Report 5 / PR #26+#27)

## Befund

Wikidata-Diagnose: DFB-Pokal-Saison-Items haben nur bis 2022/23 einen
`P1346`-Sieger. Es fehlen 2009/10–2013/14 (Lücke) und 2023/24 ff. — fehlende
Sieger-Statements kann keine Query kompensieren (der P580/P585-Fix rettete nur
Saisons mit Datumsproblem, daher CDR +637, DFB +1).

## Lösung

Kuratierte **`GAP_WINNERS`**-Tabelle (öffentliches Faktenwissen, vom Owner
bestätigbar) in `wikidata_honours.mjs`: Honour-Key → Liste
`[Saisonstartjahr, Club-Key]`. Anwendung mit **derselben Semantik wie die
Wikidata-Query**, aber über unsere eigenen `cp`-Karrieredaten:
Spieler bekommt den Titel, wenn eine `cp`-Periode beim Sieger-Verein die
Saison überlappt (`from <= saison+1 && ende >= saison`, offenes Ende = ∞).

Einträge (DFB, Saisonstartjahr):
- 2009 FCB, 2011 BVB, 2012 FCB, 2013 FCB (Wikidata-Loch 2009–2013;
  2010/11 Schalke entfällt — kein S04 in unseren CLUBS)
- 2023 B04, 2024 VFB, 2025 FCB (2025/26 vom Owner bestätigt via Kane)

Mechanik generisch (funktioniert für jeden Honour-Key), befüllt wird nur, was
der Owner bestätigt. Anwendung: (a) im Honours-Skript bei jedem Voll-Lauf
(nach Wikidata-Zuweisung, vor `HONOUR_OVERRIDES`), (b) sofort via neuem
`data-pipeline/apply_gap_winners.mjs` (kein Netz nötig).

## Nicht-Ziele (YAGNI)

- Keine Gap-Einträge für andere Wettbewerbe ohne Anlass/Bestätigung.
- Kein Ersatz der Wikidata-Pipeline — nur Lückenfüller.

## Tests / Verifikation

- Nach Anwendung: DFB-Count deutlich > 1.038; Wirtz/Kane haben DFB auch ohne
  Override-Pfad (cp-Überlappung greift); Stichproben (z. B. Hummels/Reus für
  BVB 2011/12, Neuer/Müller für FCB-Jahre).
- Diff: nur `t`-Erweiterungen; `npm test` + Build grün.

## Betroffene Dateien

- `data-pipeline/wikidata_honours.mjs` (GAP_WINNERS + Anwendung im main)
- `data-pipeline/apply_gap_winners.mjs` (neu)
- `src/players.js` (generiert)
