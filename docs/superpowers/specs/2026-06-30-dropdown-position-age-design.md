# Design: Position + Alter im Spieler-Dropdown

**Datum:** 2026-06-30
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** Autocomplete-Einträge um Position und Alter ergänzen, damit bei
gleichnamigen Spielern der gemeinte erkennbar ist.

## Ziel

Bei der Spielersuche können mehrere Treffer denselben Namen haben. Neben dem
Namen sollen **Position** und **Alter** stehen, damit der Nutzer den richtigen
Spieler wählen kann.

## Entscheidungen (aus dem Brainstorming)

1. **Position in 4 Grobgruppen:** `TW`, `ABW`, `MF`, `ST` (aus Wikidata P413).
2. **Beides zusammen** umsetzen (Position + Alter).
3. **Keine Vereine** im Dropdown (Spoiler-Schutz bleibt — wurde früher entfernt).

## Datenmodell

Neues optionales Feld pro Spieler in `src/players.js`: `pos` ∈
`{"TW","ABW","MF","ST"}` (weggelassen, wenn unbekannt). Alter wird **nicht**
gespeichert, sondern zur Laufzeit aus `by` berechnet.

Record-Felder künftig: `{ n, ln, by, nat, clubs, t?, sl?, pos? }`.

## Architektur

### A. Daten — `data-pipeline/wikidata_positions.mjs` (neu)

Ergänzt `pos` in `src/players.js`, ohne die anderen Felder zu verändern (kein
Roster-/Honours-Neulauf nötig).

- Wiederverwendete 40 `CLUB_QID` (aus `wikidata_roster.mjs`).
- Pro Verein eine SPARQL-Abfrage: Spieler des Vereins (`p:P54/ps:P54`), Beruf
  Fußballer, mit Geburtsjahr (`P569`) und Positionen (`wdt:P413`, englisches
  Label).
- **Mapping `posBucket(label)`** (reine Funktion, testbar) per Stichwort:
  - enthält „goalkeeper" → `TW`
  - enthält „back" / „defender" / „sweeper" / „defence" → `ABW`
  - enthält „midfield" → `MF`
  - enthält „forward" / „striker" / „wing" / „attack" → `ST`
  - sonst → `null` (ignorieren)
- Hat ein Spieler mehrere Positionen → eine Gruppe per **Priorität
  `TW > ST > MF > ABW`**.
- Match Wikidata-Spieler → Pool über `norm(name)+by`; setzt `pos`.
- Schreibt `src/players.js` neu (Felder inkl. `pos`, `t`, `sl` erhalten).
  Idempotent. Lauf: `node data-pipeline/wikidata_positions.mjs`.

### B. Anzeige

- `src/Game.jsx`: in der `suggestions`-Liste pro Eintrag eine Meta-Anzeige
  rechts: `pos` (falls vorhanden) und Alter = `new Date().getFullYear() - by`,
  z. B. „ST · 38". Nur Alter, falls `pos` fehlt. `suggestPlayers`-Logik
  (Filter + Sortierung nach `sl`) **unverändert**.
- `src/styles.css`: `.sugItem` als Flex mit Name links, `.sugMeta` rechts
  (dezent). `.sugMeta` wird wieder eingeführt (war für die alten Vereins-Hinweise
  entfernt) — zeigt jetzt nur Position + Alter.

## Datenfluss

1. (Daten-Refresh) `wikidata_positions.mjs` ergänzt `pos`.
2. App lädt `PLAYERS` wie bisher.
3. Autocomplete zeigt „Name  POS · Alter".

## Fehlerfälle / Edge Cases

- Spieler ohne P413 in Wikidata → kein `pos`; Dropdown zeigt nur Alter.
- Namensabgleich verfehlt einzelne → kein `pos` (kein Falschwert).
- Mehrere Positionen → eindeutige Gruppe per Priorität.
- Rate-Limit (429)/Timeout → Retry/Backoff + Pausen (wie in den anderen Skripten).

## Tests / Verifikation

- **node:test:** `posBucket` mappt Beispiel-Labels korrekt (goalkeeper→TW,
  „centre-back"→ABW, „central midfielder"→MF, „centre-forward"→ST, Unbekanntes→null).
- **Datenvalidität:** alle gesetzten `pos` ∈ {TW,ABW,MF,ST}.
- **Build:** `npm run build` fehlerfrei; bestehende Tests grün.
- **Sichtprüfung:** Dropdown zeigt „Name  POS · Alter", keine Vereine.

## Betroffene Dateien

- `data-pipeline/wikidata_positions.mjs` (neu) + Test
- `data-pipeline/README.md` (Doku)
- `src/players.js` (Feld `pos` ergänzt)
- `src/Game.jsx` (Dropdown-Meta)
- `src/styles.css` (`.sugMeta`)
