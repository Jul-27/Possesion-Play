# Elf des Tages — echte Aufstellung auf dem Spielfeld (Design)

**Ziel:** Die Elf soll wie eine Fußball-Aufstellung aussehen (Spielfeld, gestaffelte Positionen,
Trikots/Spieler) statt wie eine Liste von Kästen — und die **Formation täglich wechseln**.

## Problem heute

`Eleven.jsx` rendert vier Reihen rechteckiger Buttons. Es fehlen Spielfeld, Staffelung und alles,
was nach Fußball aussieht. Die Bedingung steht als **langer Text** („Borussia Mönchengladbach"),
der die Kästen breit macht — genau der Platz, den eine Feldaufteilung braucht. Die Formation ist
fest 4-4-2.

## Formation = Liste von Linien

Statt 66 handgepflegter Koordinaten beschreibt eine Formation nur ihre Linien:

```js
{ name: "4-2-3-1", lines: [ {pos:"TW",n:1}, {pos:"ABW",n:4}, {pos:"MF",n:2}, {pos:"MF",n:3}, {pos:"ST",n:1} ] }
```

Daraus werden x/y **berechnet** (Prozent, Tor unten, Sturm oben):
`y = 92 − (lineIndex / (lineCount − 1)) × 84`, `x = (k + 1) / (n + 1) × 100`.

Damit sind auch mehrlinige Mittelfelder (4-2-3-1) darstellbar, ohne Sonderfall. Neue Formationen
kosten **eine Zeile**.

**Sechs Formationen, alle auf Lösbarkeit geprüft (20/20 Zufallsversuche):**
4-4-2 · 4-3-3 · 3-5-2 · 4-2-3-1 · 5-3-2 · 3-4-3

Die Positionsverteilung ändert sich damit pro Tag (z. B. 5 Mittelfeld-Slots bei 3-5-2). Die
bestehende Lösbarkeitsgarantie (`hasPerfectMatching`, ≥8 Kandidaten je Slot) greift unverändert —
sie prüft die tatsächliche Slot-Liste, egal wie sie zustande kommt.

## Auswahl der Formation

Deterministisch aus dem Datum, wie das Rätsel selbst: `hashStr("form:" + dateStr) % FORMATIONS.length`.
Gleicher Tag ⇒ gleiche Formation für alle. Die Formation gehört zum Rätsel, wird also in
`buildEleven()` mitbestimmt und zurückgegeben (`{ formation, slots }`).

## Darstellung — Hybrid

- **Unbesetzt:** SVG-**Trikot** mit dem **Emblem der Bedingung** (Vereinslogo, Flagge, Liga- oder
  Titel-Icon über die bestehende `Emblem`-Komponente) und der Positionsbezeichnung darunter.
  Das Emblem ersetzt den langen Text und schafft überhaupt erst Platz.
- **Besetzt:** **Foto-Kreis** des Spielers (`Avatar` aus PR #40) mit Nachnamen darunter, plus das
  Emblem als kleines Badge — der Fortschritt ist damit auf einen Blick sichtbar.
- **Spielfeld:** SVG-Hintergrund mit Rasenstreifen, Außenlinie, Mittellinie, Mittelkreis, Straf- und
  Torräumen — im bestehenden „Floodlit Pitch"-Farbschema (`--turf`, `--line`).

**Eindeutigkeit:** Emblem allein kann mehrdeutig sein (Flagge Spanien vs. Liga La Liga). Deshalb
zeigt das Eingabe-Panel beim Antippen weiterhin den **vollen Klartext** („Torwart · Liverpool"),
und der Slot trägt ein `title`-Attribut mit dem vollen Bedingungsnamen.

## Speicherstand

`pp:eleven:<datum>` bekommt die Formation mit (`{ names, wrong, done, form }`). Weicht die
gespeicherte Formation von der aktuellen ab (Deploy-Übergang), wird der Tagesstand verworfen statt
falsch zugeordnet.

## Nicht-Ziele

- Keine feineren Positionen (LV/IV/DM/…): der Datensatz kennt nur TW/ABW/MF/ST. Die Linien geben
  die Optik, die Positionsprüfung bleibt grob — sonst wäre die Lösbarkeit nicht haltbar.
- Keine Änderung an der Rätsel-Logik (Bedingungen, Matching, Garantie).

## Tests

- `formationFor(dateStr)` ist deterministisch und liefert immer 11 Slots.
- Jede Formation in `FORMATIONS` hat genau 11 Positionen und exakt einen Torwart.
- `slotLayout()` liefert für jede Formation 11 Koordinaten innerhalb 0–100 %, ohne Überlappung
  innerhalb einer Linie.
- Echtdaten: für 30 aufeinanderfolgende Tage ist das Rätsel lösbar (bestehender Test, jetzt über
  wechselnde Formationen).
