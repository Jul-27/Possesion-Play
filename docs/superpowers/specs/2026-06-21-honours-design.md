# Design: Titel/Honours-Hexfelder (Teil B)

**Datum:** 2026-06-21
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** 12 Honour-Felder (Titel/Siege). Baut auf Teil A (Liga-Felder) auf.

## Ziel

Zwölf neue Hexfeld-Typen („Honours"), erfüllt, wenn ein Spieler den jeweiligen
Titel gewonnen hat:

| Key   | Honour                     | Ermittlung |
|-------|----------------------------|------------|
| `CL`  | Champions-League-Sieger    | Finalspiel (Elfmeter → Override) |
| `WM`  | Weltmeister                | kuratierte WM-Kader 2002–2022 (Namensabgleich) |
| `MBL` | Deutscher Meister          | Punktetabelle Bundesliga |
| `MPL` | Englischer Meister         | Punktetabelle Premier League |
| `MLL` | Spanischer Meister         | Punktetabelle La Liga |
| `MSA` | Italienischer Meister      | Punktetabelle Serie A |
| `ML1` | Französischer Meister      | Punktetabelle Ligue 1 |
| `DFB` | DFB-Pokal-Sieger           | Finalspiel (Elfmeter → Override) |
| `FAC` | FA-Cup-Sieger              | Finalspiel (Elfmeter → Override) |
| `CDR` | Copa-del-Rey-Sieger        | Finalspiel (Elfmeter → Override) |
| `CIT` | Coppa-Italia-Sieger        | Finalspiel (Elfmeter → Override) |
| `CDF` | Coupe-de-France-Sieger     | Finalspiel (Elfmeter → Override) |

## Entscheidungen (aus dem Brainstorming)

1. **Hybrid-Datenquelle:** Meister automatisch aus Punkten; Pokal/CL aus
   Finalspielen mit kleiner kuratierter Override-Liste für Elfmeter-Finals;
   Weltmeister über kuratierte Siegerkader.
2. **Strenge Kader-Definition:** Ein Spieler erhält einen club-Honour nur, wenn
   er in der Titelsaison **mindestens ein Pflichtspiel in genau diesem
   Wettbewerb für den Sieger** bestritten hat (aus `appearances`). Folge:
   club-Honours reichen praktisch nur **~2012+** zurück.
3. **Weltmeister einbeziehen:** kuratierte WM-Siegerkader der Turniere 2002,
   2006, 2010, 2014, 2018, 2022; Zuordnung per normalisiertem Namensabgleich auf
   das Feld `n` der Spieler. Reicht bis 2002.
4. **Brett:** pro Brett **2–4** zufällige Honour-Felder (zusätzlich zu den 1–3
   Liga-Feldern aus Teil A). Gesamtzahl bleibt 31.

## Nicht-Ziele (YAGNI)

- Keine weiteren Wettbewerbe (Europa League, Supercups, nationale Zweitpokale …).
- Keine Titel-Anzahl/Mehrfachzählung — `t` enthält jeden Honour-Key höchstens 1×
  (gewonnen ja/nein, nicht „wie oft").
- Keine Änderung an der bestehenden Liga-/Club-/Nation-/Spezial-Logik.

## Architektur

### Datenmodell

Neues, optionales Feld pro Spieler in `src/players.js`: `t: ["CL", "MBL", ...]`
(Honour-Keys). Wird **weggelassen, wenn leer** (Platzersparnis); das Matching
nutzt `(player.t || [])`. Alle Honour-Keys werden in der Pipeline berechnet und
eingebacken — die Spiel-Logik bleibt trivial (Mitgliedschaftsprüfung).

### Pipeline (data-pipeline/)

Erweiterung um einen Honours-Schritt. Eingaben aus dem Kaggle-Dataset:
`games.csv` (competition_id, season, round, home/away club + goals,
aggregate_score, competition_type), `appearances.csv`, `clubs.csv`.

1. **Meister (MBL/MPL/MLL/MSA/ML1):** Für jede der 5 Ligen und jede Saison aus
   `games` eine Punktetabelle bilden (3/1/0), Sieger = höchste Punkte,
   Tie-Break Tordifferenz, dann Tore. Meister-Klub je Saison bestimmt.
2. **Pokal/CL-Sieger (CL/DFB/FAC/CDR/CIT/CDF):** Pro Wettbewerb+Saison das
   Finale identifizieren (über `round`/letzte Runde). Sieger aus den Toren;
   ist das Finale unentschieden (Elfmeterschießen), **kuratierte Override-Liste**
   `PENALTY_FINALS[(competition, season)] = winner_club_id` verwenden.
3. **Kader-Zuordnung (streng):** Für jeden so bestimmten (Sieger-Klub, Saison,
   Wettbewerb): alle Spieler mit ≥1 `appearances`-Eintrag in diesem Wettbewerb
   für diesen Klub in dieser Saison erhalten den Honour-Key.
4. **Weltmeister (WM):** kuratierte Liste der 6 Siegerkader (Spielernamen) →
   normalisierter Namensabgleich (lowercase, Akzente entfernt) gegen `players.n`.
5. Ergebnis: Map `tm_player_id -> Set(honour_keys)`. Beim Bauen von
   `players_game.js` (siehe `make_game_json.py`) wird `t: [...]` ergänzt
   (nur wenn nicht leer).

**Wichtig — Machbarkeits-Probe zuerst:** Vor der finalen Pipeline ein kleiner
Kaggle-Probe-Lauf, der bestätigt: Saison-Abdeckung von `games`; die exakten
`competition_id`s für die 5 Ligen, 5 Pokale und die Champions League; das Format
der `round`-Werte (insb. wie das Finale heißt) und wie unentschiedene
Finals/Elfmeter dargestellt sind. Erst danach werden die `competition_id`s und
die Finale-Erkennung in der Pipeline fixiert und die `PENALTY_FINALS`-Override-
Liste befüllt.

### Spiel-Logik (`src/gameData.js`)

- Neuer Export `HONOURS` (Typ `"honour"`), 12 Einträge mit `key`, `label`
  (kurz), `name` (voll), `icon` (Emoji), `c1`/`c2` (Farbverlauf).
- `playerMatchesHex`: Zweig `if (def.type === "honour") return (player.t || []).includes(def.key);`
- `DEF_BY_KEY`: um `honour` ergänzt.
- `buildBoardSerial`: zusätzlich `nHonour = 2 + floor(random*3)` (2–4) Honour-
  Felder; `rest = 31 - 3 - 4 - 6 - nLeague - nHonour`. Invariante: Summe = 31.

### Rendering (`src/Emblems.jsx`, `src/styles.css`)

- `Emblem`: Zweig `honour` → Icon/Emoji auf Farbverlauf (wie `spec`).
- `Cell`: `hexLabel` zeigt für `honour` den vollen `name`.
- Optik: 🏆 für CL, 🌍 für WM, Meisterschale-/Pokal-Emoji für die Liga-Meister
  und Pokale (konkrete Emoji-Wahl bei der Umsetzung). CSS ggf. Wiederverwendung
  von `.emblem.icon`.

## Datenfluss

1. Pipeline berechnet `t`-Keys je Spieler → `players_game.js` (Feld `t`).
2. `players.js` ersetzt (Ein-Datei-Tausch, wie gehabt).
3. `buildBoardSerial` wählt u. a. 2–4 `{ t:"honour", k }`.
4. `lookupDef("honour", k)` / `hydrateBoard` lösen auf.
5. `playerMatchesHex` prüft `player.t`.
6. `Emblem`/`Cell` rendern das Honour-Feld.

Kein Supabase-Schema-Wechsel (`{t,k}`-Serialisierung unverändert).

## Fehlerfälle / Edge Cases

- Spieler ohne Honours: kein `t`-Feld → `(player.t || [])` ⇒ matcht nichts.
- Unentschiedenes Finale ohne Override-Eintrag: Honour wird für diese
  Saison **nicht** vergeben (lieber fehlend als falsch); Prüfbericht listet
  solche Fälle, damit die Override-Liste ergänzt werden kann.
- Punktgleichheit beim Meister: Tordifferenz, dann erzielte Tore; bleibt es
  gleich, Prüfbericht-Warnung (manuell entscheiden).
- WM-Namensabgleich verfehlt einen Spieler: Honour fehlt (kein falscher Treffer).

## Tests / Verifikation

- **Logik (node:test):** `playerMatchesHex` honour (Spieler mit `t:["CL"]`
  erfüllt CL, ohne nicht); `HONOURS` hat 12 Einträge/Keys; `lookupDef("honour",…)`;
  `buildBoardSerial` liefert 31 Felder mit 1–3 Liga- **und** 2–4 Honour-Feldern,
  alle auflösbar.
- **Pipeline-Prüfberichte:** je Liga+Saison der ermittelte Meister; je Pokal/CL
  +Saison der Finalsieger (inkl. Liste der unentschiedenen/Override-Finals);
  Anzahl WM-Namenstreffer pro Turnier — alles zur manuellen Kontrolle.
- **Build:** `npm run build` fehlerfrei.
- **Datencheck:** Honour-Keys in `players.js` ⊆ `HONOURS`-Keys; Stichproben
  (z. B. ein bekannter CL-Sieger hat `CL`).

## Betroffene Dateien

- `data-pipeline/` (Honours-Berechnung: `build_db.py`/`make_game_json.py` bzw.
  Notebook; Probe-Zelle; Override-Liste; WM-Kaderliste)
- `src/players.js` (neues Feld `t`, via Kaggle-Lauf)
- `src/gameData.js` (`HONOURS`, `playerMatchesHex`, `DEF_BY_KEY`, `buildBoardSerial`)
- `src/Emblems.jsx` (`Emblem`/`Cell`)
- `src/styles.css` (optional Honour-Optik)
