# Fußball-Kette (Solo) — Design

**Ziel:** Eine möglichst lange Kette aus Spielern bauen. Jeder genannte Spieler muss mit dem
vorherigen mindestens eine Eigenschaft teilen. Genutzte Verbindungen sind danach verbraucht.

## Regeln

1. Das Spiel gibt einen **Startspieler** vor (aus `sl >= 40`, also allgemein bekannt).
2. Der Spieler nennt einen weiteren Spieler. Gültig ist er, wenn er mit dem aktuellen letzten
   Kettenglied mindestens ein **noch freies** Attribut teilt: Verein, Nation, Liga oder Titel.
3. Bei einem gültigen Zug **verbrennt genau eine** Verbindung — die spezifischste in der
   Reihenfolge `Verein > Titel > Liga > Nation`. Sie kann im Rest der Partie nicht mehr genutzt
   werden. Die anderen gemeinsamen Attribute bleiben frei.
4. Kein Spieler darf zweimal vorkommen.
5. **Uhr:** 90 Sekunden Startzeit, jeder gültige Zug gibt **+8 Sekunden**. Ungültige Eingaben
   kosten keine Zeit, aber die Uhr läuft weiter.
6. Das Spiel endet bei Zeitablauf, bei Aufgabe oder wenn der aktuelle Spieler **kein freies
   Attribut** mehr hat (Sackgasse). Punktzahl = Länge der Kette.

## Warum „genau eine Verbindung verbrennt"

Gemessen am echten Datensatz (6.829 Spieler mit `sl >= 20`, Ø 4,7 Attribute pro Spieler,
40 simulierte Partien je Variante):

| Verbrennlimit | planloses Spiel (Median) | kluges Spiel (Median) |
|---|---|---|
| 1× pro Attribut | 15 | 73 |
| 2× pro Attribut | 45 | über 120 |
| 3× pro Attribut | 86 | über 120 |

Bei Limit 1 trennt das Spiel gutes von schlechtem Spiel am deutlichsten: Wer Spieler mit vielen
offenen Anschlüssen wählt, kommt sehr weit; wer den erstbesten Namen nennt, steckt schnell fest.
Ab Limit 2 verliert die Verbrennmechanik ihre Wirkung — die Kette endet praktisch nur noch an der
Uhr. Deshalb Limit 1.

## Sackgassen sind fair, aber nicht überraschend

Damit das Steckenbleiben eine Folge von Entscheidungen ist und nicht von fehlender Information,
zeigt die Oberfläche **die noch freien Attribute des aktuellen Kettenglieds** an. Das ist kein
Spoiler: Der Spieler ist sichtbar, seine Vereine sind der Spielgegenstand.

Endet die Partie in einer Sackgasse, nennt die Engine über `chainHint()` einen Zug, der noch
möglich gewesen wäre — der Lerneffekt des Modus.

## Module

- `src/chain.js` — reine Logik, kein React
  - `CHAIN_DEFS` — Verein, Nation, Liga, Titel (83 Attribute; bewusst ohne Ära/Jahrgang)
  - `playerAttrs(player)` → `["club:FCB", "nat:GER", …]`
  - `linkBetween(a, b, burned)` → das verbrennende Attribut oder `null`
  - `openAttrs(player, burned)` → noch freie Attribute des Spielers
  - `pickChainStart(players, rnd)` → Index eines bekannten Startspielers
  - `chainHint(players, current, burned, usedNames)` → ein möglicher Zug oder `null`
- `src/chain.test.js` — Tests inkl. Echtdaten-Lauf
- `src/Chain.jsx` — Oberfläche
- Route `?solo=chain`, Kachel in der Lobby, CSS

## Statistik

`localStorage["pp:chainStats"] = { played, best, total }` — gespielte Partien, längste Kette,
Summe aller Kettenglieder.
