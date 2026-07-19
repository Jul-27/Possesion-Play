# Elf des Tages — Design

**Ziel:** Eine Startelf in 4-4-2 aufstellen. Jede Position hat eine eigene Bedingung; der
eingesetzte Spieler muss Position **und** Bedingung erfüllen. Ein Rätsel pro Tag, für alle gleich.

## Regeln

1. Elf Positionen: 1 Torwart, 4 Abwehr, 4 Mittelfeld, 2 Sturm.
2. Jede Position trägt eine Bedingung aus denselben 83 Attributen wie die anderen Modi
   (Verein, Nation, Liga, Titel). Alle elf Bedingungen sind verschieden.
3. Ein Spieler passt, wenn seine Position stimmt **und** er die Bedingung erfüllt.
4. Jeder Spieler darf nur einmal aufgestellt werden. Aufgestellte Spieler lassen sich wieder
   entfernen — man kann sich also nicht dauerhaft blockieren.
5. Kein Zeitlimit. Fehlversuche werden gezählt, aber begrenzen nichts.
6. Gelöst ist das Rätsel, wenn alle elf Positionen besetzt sind.

## Lösbarkeitsgarantie

Das ist der Kern dieses Modus. Zwei Stufen:

**Stufe 1 — pro Position.** Eine Bedingung kommt für eine Position nur infrage, wenn im
Generierungspool (`sl >= 40`, Position gesetzt — 1.863 Spieler) mindestens **8 Kandidaten**
existieren. Gemessen erfüllen das bei `sl >= 40` je Position 48 (TW), 71 (ABW), 74 (MF) und
79 (ST) der 83 Attribute. Bei `sl >= 60` sind es für den Torwart nur noch 12 — deshalb `sl >= 40`.

**Stufe 2 — über alle elf.** Acht Kandidaten pro Position genügen nicht: Überschneiden sich die
Kandidatenmengen zu stark, gibt es trotzdem keine gültige Elf (Satz von Hall). Deshalb prüft
`hasPerfectMatching()` per bipartitem Matching (Kuhn), ob sich elf **paarweise verschiedene**
Spieler auf die elf Positionen verteilen lassen. Nur dann wird das Rätsel ausgegeben.

## Generierungspool ≠ erlaubte Antworten

`sl >= 40` gilt nur für die Generierung: Sie garantiert, dass eine Lösung aus allgemein bekannten
Spielern existiert. **Akzeptiert wird jeder Spieler des Datensatzes**, der Position und Bedingung
erfüllt — auch ein weniger bekannter. Wer mehr weiß, wird nicht bestraft.

## Determinismus

Wie beim Daily-Star: gleiches Datum ⇒ gleiches Rätsel. Der Seed ist `elf:<datum>`; daraus zieht
ein Mulberry32-Generator die elf Bedingungen. Schlägt die Matching-Prüfung fehl, erhöht sich der
Versuchszähler im Seed (`elf:<datum>#2`), das Ergebnis bleibt reproduzierbar.

Die Bedingungen stammen aus der stabilen `CHAIN_DEFS`-Liste, nicht aus dem Spielerdatensatz —
ein Datenupdate verändert das Tagesrätsel daher nicht.

## Module

- `src/eleven.js`
  - `ELEVEN_SL_MIN`, `ELEVEN_MIN_CANDIDATES`, `FORMATION`
  - `elevenPool(players)` → Indizes des Generierungspools
  - `slotCandidates(players, pos, def)` → passende Indizes
  - `hasPerfectMatching(candLists)` → Bool
  - `buildEleven(dateStr, players)` → `{ slots: [{ pos, def }] }`
  - `elevenAccepts(player, slot)` → Bool (Position + Bedingung)
- `src/eleven.test.js`
- `src/Eleven.jsx` — Aufstellung als Feld, Slot antippen und besetzen
- Route `?solo=eleven`, Kachel in der Lobby, CSS

## Speicherstand

`localStorage["pp:eleven:<datum>"] = { names: [11 Namen oder null], wrong, done }` — der
Tagesfortschritt überlebt einen Reload. `localStorage["pp:elevenStats"] = { played, solved }`.
