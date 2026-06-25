# Design: Honours komplett aus Wikidata

**Datum:** 2026-06-25
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** Titel/Honours (`t`) für ALLE Spieler einheitlich aus Wikidata ableiten —
auch vor ~2012 und für die per Wikidata neu hinzugefügten Spieler.

## Ziel

Nach der Roster-Erweiterung (~27k Spieler) haben die vor ~2012 aktiven Spieler
keine Honours (die alte Pipeline leitete sie nur aus Match-Daten ab 2012 ab).
Wikidata kennt Saison-Sieger je Wettbewerb (`P1346`) und Spieler-Vereinszeiträume
(`P54` mit `P580/P582`). Daraus lässt sich für **jeden** Spieler bestimmen, ob er
in der Titelsaison beim Sieger war — vollständig und einheitlich.

## Entscheidungen (aus dem Brainstorming)

1. **Quelle:** Honours komplett aus Wikidata; ersetzt die bisherigen
   match-abgeleiteten `t` (streng „hat gespielt", nur 2012+) einheitlich.
2. **Definition:** „war im Titel-Saison-Zeitraum beim Sieger" (Kaderzugehörigkeit
   über `P54`-Datumsüberlappung) — nicht zwingend eingesetzt.
3. **WM:** über FIFA-WM-Turniere (Sieger = Nationalteam) + Länderspielzeitraum;
   gilt nun für **alle** WM-Jahre.
4. **Scope:** dieselben **11 Honours** (CL, WM, MBL, MPL, MLL, MSA, ML1, DFB, FAC,
   CDR, CIT). Keine Coupe de France.

## Nicht-Ziele (YAGNI)

- Keine neuen Honour-Typen, keine Änderung an `HONOURS`/Matching/Board/Rendering.
- Keine „hat gespielt"-Strenge mehr (Kaderzugehörigkeit genügt).
- Keine weiteren Wettbewerbe (Europa League, Supercups, nationale Pokale außerhalb
  der 4 genannten).

## Architektur

### Skript `data-pipeline/wikidata_honours.mjs`

Eigenständiger Node-Schritt (Internet nötig), läuft **nach** dem Roster
(`src/players.js` muss existieren). Setzt das Feld `t` je Spieler neu.

**Wettbewerbs-QIDs** (Honour-Key → Wikidata-Wettbewerb), in Task 0 verifiziert:
Champions League, die 5 Ligen, die 4 Pokale, FIFA-WM. Tabelle `COMP_QID`.

**Pro Vereins-Wettbewerb** (CL + 5 Ligen + 4 Pokale) eine SPARQL-Abfrage, die
Saison-Sieger mit dem damaligen Kader joint:

```sparql
SELECT ?pLabel ?by WHERE {
  ?season wdt:P3450 wd:{COMP} ; wdt:P1346 ?winner ; wdt:P580 ?ss .
  OPTIONAL { ?season wdt:P582 ?se. }
  ?p p:P54 ?st . ?st ps:P54 ?winner ; pq:P580 ?cs .
  OPTIONAL { ?st pq:P582 ?ce. }
  ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d . BIND(YEAR(?d) AS ?by)
  # Überlappung Vereinszeitraum × Saison-Zeitraum:
  FILTER( YEAR(?cs) <= YEAR(COALESCE(?se, ?ss)) && (!BOUND(?ce) || YEAR(?ce) >= YEAR(?ss)) )
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
```

Ergebnis: Menge (Name, Geburtsjahr) → bekommt den Honour-Key dieses Wettbewerbs.

**WM** analog mit FIFA-WM-QID; Sieger ist ein Nationalteam, der Spieler muss im
Turnierzeitraum `P54` zu diesem Nationalteam haben (Filter wie oben). Key `WM`.

**Merge in `src/players.js`:**
- Pro Spieler `t = sortierte Menge` der zugeordneten Honour-Keys.
- Match Wikidata-Spieler → unser Pool über `norm(name)+by`.
- Bestehendes `t` wird **ersetzt** (einheitliche Quelle). `clubs/nat/by/ln/sl` bleiben.
- `t` wird weggelassen, wenn leer.

Idempotent. Lauf: `node data-pipeline/wikidata_honours.mjs`.

### Spiel-Logik

Unverändert: `HONOURS`, `playerMatchesHex` (`honour` → `player.t`), Board, Rendering.

## Datenfluss

1. (einmalig pro Daten-Refresh) `wikidata_roster.mjs` → Spieler/Vereine.
2. `wikidata_honours.mjs` → setzt `t` je Spieler aus Wikidata.
3. App nutzt `t` wie bisher.

## Fehlerfälle / Edge Cases

- Spieler/Sieger ohne Datumsangaben in Wikidata → Honour wird nicht vergeben
  (lieber fehlend als falsch).
- Leih-/Jugendspieler, deren `P54`-Zeitraum die Titelsaison überlappt → bekommen
  den Titel evtl. mit (bewusst akzeptierter Lärm der Kaderdefinition).
- Namensabgleich verfehlt einzelne → `t` fehlt (kein Falschtreffer).
- Rate-Limit (429) → Retry/Backoff + Pausen zwischen Wettbewerben.
- Saison-Label-Spannen (z. B. 2009–10) werden über `P580/P582` als Zeitraum
  behandelt; keine Label-Parsing-Heuristik nötig.

## Tests / Verifikation

- **node:test:** alle `t`-Keys ⊆ `HONOURS`-Keys; Stichproben (z. B. Zidane hat
  `CL` & `WM`; Pirlo hat `MSA`, `CL`, `WM`; Iniesta hat `CL`, `MLL`, `WM`).
- **Build:** `npm run build` fehlerfrei.
- **Plausibilität:** Anzahl Spieler mit `t` deutlich > vorher (1.266).

## Betroffene Dateien

- `data-pipeline/wikidata_honours.mjs` (neu)
- `data-pipeline/wikidata_honours.test.mjs` (neu; QID-Verifikation/Helfer)
- `data-pipeline/README.md` (Doku)
- `src/players.js` (Feld `t` neu gesetzt)
