# Design: Roster-Erweiterung aus Wikidata (alle Spieler)

**Datum:** 2026-06-25
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** Spieler, die nicht im Transfermarkt-Pool sind (Rücktritt vor ~2012),
als neue Einträge aus Wikidata ergänzen + Autocomplete nach Bekanntheit sortieren.

## Ziel

Der Spieler-Pool (`src/players.js`) enthält nur Spieler mit Top-5-Einsatz ab
~2012. Legenden wie Zidane, Henry, Figo, Ronaldinho, Ronaldo (R9) fehlen komplett.
Diese sollen als neue Einträge aus Wikidata hinzukommen, inkl. Vereinen, Nation
und Geburtsjahr — damit sie im Spiel als gültige Antworten zählen.

## Entscheidungen (aus dem Brainstorming)

1. **Maximaler Umfang:** alle Wikidata-Fußballer unserer 40 Vereine mit **≥1
   Wikipedia-Sprachversion** (Sitelink) und Geburtsjahr. Pool wächst auf ~26.000.
2. **Autocomplete nach Bekanntheit:** Vorschläge werden künftig nach Sitelinks
   (Bekanntheit) absteigend, dann Nachname sortiert — statt rein alphabetisch.
   Pflicht, damit bei großem Pool bekannte Spieler oben stehen.
3. **Dateigröße akzeptiert:** `players.js` ~2–3 MB (gzip ~0,6–0,8 MB). Lazy-Loading
   ist eine spätere Option, jetzt nicht nötig.
4. **Honours der neuen Spieler:** vorerst leer (vor ~2012 nicht ableitbar). Wird
   später separat angegangen. Liga-Felder funktionieren automatisch (aus Vereinen).

## Nicht-Ziele (YAGNI)

- Keine Honours/Titel für die neu hinzugefügten Alt-Spieler (späteres Projekt).
- Kein Lazy-Loading / Code-Splitting der Spielerdaten (jetzt).
- Keine Änderung an Hex-Typen, Matching-Logik, Board-Generierung.
- Keine neuen Vereine/Nationen (nur die bestehenden 40 Clubs / ~18 NATIONS).

## Datenmodell

Spieler-Record erhält ein **optionales Feld `sl`** (Sitelinks = Bekanntheit,
Integer). Format:

```
{ n, ln, by, nat:[ISO3], clubs:[KEY], t?:[HONOUR], sl?:Zahl }
```

`sl` wird zum Sortieren des Autocomplete genutzt; fehlt `sl`, gilt 0.

## Architektur

### A. Daten-Pipeline — `data-pipeline/wikidata_roster.mjs`

Erweitert die Idee von `wikidata_enrich.mjs` (das nur Vereine ergänzt) zu einem
**Roster-Builder**, der Spieler auch **neu anlegt**.

**Wikidata-Abfrage pro Spiel-Verein** (40 verifizierte QIDs aus `wikidata_enrich.mjs`):
für Personen mit `p:P54/ps:P54 = clubQID`, Beruf Fußballer (`wdt:P106 wd:Q937857`),
Geburtsjahr (`wdt:P569`) und **≥1 Sitelink** (`wikibase:sitelinks`), liefere:
- `?pLabel` (Name, en), `?by` (Geburtsjahr), `?sl` (Sitelinks),
- Nationalität: `?p wdt:P27 ?c. ?c wdt:P298 ?iso3` (ISO-3166-1 alpha-3).

**Aggregation** über alle Vereine zu `roster[(norm(name), by)] = { name, by,
clubs:Set(gameKeys), sl:max, iso3:erste }`.

**Merge mit `src/players.js`:**
- Vorhandener Spieler (Match per `norm(n)+by`): fehlende `clubs` ergänzen, `sl`
  setzen. `ln`, `nat`, `by`, `t` bleiben unverändert.
- Neuer Spieler: Record anlegen mit
  - `n` = Wikidata-Label,
  - `ln` = abgeleiteter Nachname (siehe unten),
  - `by` = Geburtsjahr,
  - `nat` = `[iso3]` falls iso3 in unseren NATIONS-Keys, sonst `[]`,
  - `clubs` = sortierte Spiel-Keys,
  - `sl` = Sitelinks.
  Kein `t`.

**Aufnahmekriterien für neue Spieler:** ≥1 Sitelink, Geburtsjahr vorhanden,
≥1 Spiel-Verein. (Bestehende Spieler bleiben immer erhalten.)

**`ln`-Ableitung:** letzter durch Leerzeichen getrennter Namensteil; vorangestellte
Partikel (`van`, `von`, `de`, `del`, `della`, `di`, `da`, `dos`, `der`, `ten`,
`ter`) werden mit aufgenommen (z. B. „Robin van Persie" → „van Persie"). Einzelname
(Mononym) → voller Name (z. B. „Ronaldinho").

**Ausgabe:** `src/players.js` neu schreiben (Header + Records, `sl`/`t` nur wenn
vorhanden). Idempotent. Läuft lokal mit Internet: `node data-pipeline/wikidata_roster.mjs`.

> `wikidata_enrich.mjs` bleibt als „nur Vereine ergänzen"-Variante bestehen oder
> wird durch den Roster-Builder ersetzt (Implementierungsdetail; der Roster-Builder
> übernimmt dessen Aufgabe vollständig). Die verifizierte `CLUB_QID`-Tabelle und
> die `CLUB_OVERRIDES` werden wiederverwendet.

### B. Spiel-Logik

- `src/players.js`: Records mit optionalem `sl`. Keine Strukturänderung sonst.
- `src/gameData.js`: unverändert (Matching, Board, Typen). `PLAYERS` re-export bleibt.
- `src/Game.jsx`: `suggestions`-`useMemo` sortiert künftig nach
  `(sl desc, ln asc)` statt nur `ln`. Filter (Nachname-Präfix ab 2 Zeichen) und
  `.slice(0, 8)` bleiben.

## Datenfluss

1. `wikidata_roster.mjs` erzeugt/aktualisiert `src/players.js` (mit `sl`).
2. App lädt `PLAYERS` wie bisher.
3. Autocomplete filtert per Nachname-Präfix, **sortiert nach Bekanntheit**, zeigt Top-8.
4. Matching/Board unverändert — neue Spieler zählen über `clubs`/`nat`, Liga-Felder
   greifen automatisch.

## Fehlerfälle / Edge Cases

- Spieler ohne Nationalität in unseren NATIONS → `nat:[]` (kann Nationen-Hex nicht
  erfüllen; korrekt).
- Namensdublette (gleicher `norm(name)+by`) bereits im Pool → Merge, kein Duplikat.
- Wikidata-Label ohne sinnvollen Nachnamen → `ln` = voller Name (Suche bleibt möglich).
- Rate-Limit (429) bei Wikidata → Retry mit Backoff im Skript; Pausen zwischen Vereinen.
- Sehr großer Pool → Filter über `.slice(0,8)` + Bekanntheits-Sortierung hält
  das Autocomplete relevant.

## Tests / Verifikation

- **node:test:**
  - Sortier-Helper: bekanntere (höheres `sl`) vor unbekannteren, dann alphabetisch.
  - Datenvalidität nach Lauf: alle `clubs` ⊆ CLUBS-Keys, alle `nat` ⊆ NATIONS-Keys,
    jeder Spieler hat `n`, `ln`, `by`.
- **Build:** `npm run build` fehlerfrei.
- **Stichproben:** Zidane/Henry/Figo/Ronaldinho vorhanden mit plausiblen Vereinen;
  Tippen von „Zid"/„Hen" zeigt die bekannten Spieler oben.

## Betroffene Dateien

- `data-pipeline/wikidata_roster.mjs` (neu; nutzt CLUB_QID/CLUB_OVERRIDES)
- `data-pipeline/README.md` (Doku)
- `src/players.js` (neu erzeugt: ~26k Spieler, Feld `sl`)
- `src/Game.jsx` (Autocomplete-Sortierung nach Bekanntheit)
- `src/gameData.test.js` (Sortier-/Validitäts-Tests)
