# data-pipeline — Volle Spielerdatenbank erzeugen

Erzeugt das `PLAYERS`-Array für das Spiel aus dem Transfermarkt-Dataset
**`davidcariboo/player-scores`**. Der Lauf passiert komplett im Browser auf
Kaggle (kein lokales Setup, kein Admin-Recht nötig).

## Dateien

| Datei | Zweck |
|-------|-------|
| `kaggle_build.ipynb` | **Empfohlen.** Lauffähiges Kaggle-Notebook, das die Logik beider Skripte nacheinander ausführt und `players_game.js` schreibt. |
| `build_db.py` | Lokales Skript: wählt Spieler über Top-5-Einsätze seit 2000 aus und erfasst deren **volle** Vereinshistorie aus Einsätzen (auch Portugal/NL/Pokale) **plus** Transfers (`player_transfers.csv`, deckt auch Stationen vor ~2012 ab). Schreibt Zwischen-CSVs nach `./out`. |
| `make_game_json.py` | Lokales Skript: mappt Spieler (Einsätze + Transfers) auf die 40 Spiel-Vereine, ergänzt Titel/Honours (Feld `t`) und schreibt `./out/players_game.js`. |
| `honours.py` | Honours-Logik: Meister aus Punkten, Pokal/CL-Sieger aus dem Finale, Kader aus Einsätzen, kuratierte WM-Siegerkader. Enthält außerdem `CLUB_OVERRIDES` — belegte Vereinsstationen, die im Datensatz fehlen (alte Transfers vor ~2012), z. B. Cristiano Ronaldo → Sporting (SCP). Werden mit den abgeleiteten Vereinen gemerged. |
| `honours_probe.ipynb` | Einmalige Kaggle-Probe zur Wettbewerbs-/Finals-Struktur. |
| `wikidata_enrich.mjs` | Ergänzt fehlende Vereine in `src/players.js` aus Wikidata (volle Vereinshistorie, deckt auch Stationen vor ~2012 ab). Lauf: `node data-pipeline/wikidata_enrich.mjs` (Internet nötig). Matcht über Name + Geburtsjahr; nur Spiel-Vereine; idempotent. |

Das Notebook ist die browserbasierte Zusammenführung der beiden `.py`-Skripte.
Die Skripte selbst sind als Referenz / für lokale Läufe enthalten.

Datensatz-Anzeigetitel auf Kaggle: **„Football Data from Transfermarkt"**
(Slug `davidcariboo/player-scores`, Autor `davidcariboo`) — nicht „Player Scores".

## Schritt für Schritt (Kaggle, empfohlen)

1. Auf https://www.kaggle.com einloggen → **Create → New Notebook**.
2. Rechts **Add Input → Datasets** → nach **`davidcariboo/player-scores`** suchen
   und hinzufügen. Das Dataset mountet je nach Kaggle-Version unter
   `/kaggle/input/player-scores/` **oder** `/kaggle/input/datasets/davidcariboo/player-scores/`.
   `DATA` in Zelle 1 ist auf letzteren Pfad gesetzt — stimmt der Pfad nicht, mit
   `os.walk("/kaggle/input")` prüfen und `DATA` entsprechend anpassen.
3. `kaggle_build.ipynb` hochladen (**File → Upload Notebook**) oder seinen Inhalt
   in ein neues Notebook kopieren.
4. Oben **Run All**.
5. **Vereins-Prüfbericht** in der Ausgabe kontrollieren: Jeder der 40 Spiel-Vereine
   sollte **genau einen, korrekten** TM-Namen matchen. Bei `⚠️ KEIN TREFFER` oder
   einem falschen/mehrfachen Treffer den Teilstring in `GAME_CLUBS` (Zelle 1)
   anpassen und erneut **Run All**.
6. Rechts unter **Output → `/kaggle/working/`** die Datei **`players_game.js`**
   herunterladen.

## Ergebnis ins Spiel übernehmen

Die erzeugte `players_game.js` beginnt bereits mit `export const PLAYERS = [ … ];`.

- **Variante A (am einfachsten):** Den **gesamten Inhalt** von `players_game.js`
  in `src/players.js` einfügen und damit den kompletten alten Inhalt ersetzen.
- **Variante B:** In `src/players.js` nur das Array ersetzen — also alles von
  `export const PLAYERS = [` bis zum abschließenden `];` durch den Inhalt von
  `players_game.js` austauschen.

Danach lokal prüfen und committen:

```bash
npm install
npm run build      # muss fehlerfrei nach dist/ bauen
git add src/players.js
git commit -m "Vollständige Spielerdatenbank einsetzen"
git push
```

Vercel deployt nach dem Push (auf `main`) automatisch neu.

> **Wichtig:** Die Spiel-Logik (`src/gameData.js`, `Game.jsx` …) bleibt
> unangetastet — sie importiert `PLAYERS` aus `src/players.js`. Es ist ein
> reiner Daten-Tausch in **einer** Datei.

## Lokaler Lauf (optional, statt Kaggle)

Falls du Python lokal hast und das Dataset selbst herunterlädst:

```bash
pip install kaggle pandas
kaggle datasets download -d davidcariboo/player-scores -p ./data --unzip
python build_db.py            # -> ./out/*.csv
python make_game_json.py      # -> ./out/players_game.js  (schreibt "export const PLAYERS")
```

Sowohl Notebook als auch lokales Skript schreiben `export const PLAYERS = …`,
sodass `players_game.js` 1:1 nach `src/players.js` übernommen werden kann.

## Titel/Honours (Feld `t`)

Das Notebook berechnet zusätzlich pro Spieler die gewonnenen Titel (Feld `t`):
Meister (MBL/MPL/MLL/MSA/ML1) aus der Punktetabelle, Pokal-/CL-Sieger
(DFB/FAC/CDR/CIT/CL) aus dem Finalspiel (`round == "Final"`; Elfmeter sind in den
Toren eingerechnet), Kader-Zuordnung streng über ≥1 Einsatz im Wettbewerb für den
Sieger in der Saison. Weltmeister (WM) über kuratierte Siegerkader 2002–2022
(Namensabgleich). Coupe de France ist nicht im Datensatz und entfällt.
Honours decken praktisch ~2012+ ab (Finals/Einsätze). Prüfberichte im Notebook
listen Meister/Sieger je Saison sowie die WM-Trefferquote.

## Vereinszugehörigkeiten: zwei Quellen

- **Einsätze** (`appearances.csv`): präzise, reichen aber nur ~2012 zurück.
- **Transferhistorie** (`transfers.csv`): ergänzt Stationen auch **vor 2012**
  über die von-/zu-Vereinsnamen der Transfers.

## Caveats

- Auch mit der Transferhistorie sind sehr alte / Jugend- / Leihstationen nicht
  garantiert lückenlos.
- „seit 2000" bedeutet `games.season >= 2000`.
- Die TM-Vereinsnamen sind als normalisierte Teilstrings in `GAME_CLUBS`
  hinterlegt. Der Prüfbericht deckt jetzt Einsatz- **und** Transfer-Namen ab;
  bei Abweichungen den Teilstring anpassen.
