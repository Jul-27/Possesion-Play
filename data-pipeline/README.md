# data-pipeline — Volle Spielerdatenbank erzeugen

Erzeugt das `PLAYERS`-Array für das Spiel aus dem Transfermarkt-Dataset
**`davidcariboo/player-scores`**. Der Lauf passiert komplett im Browser auf
Kaggle (kein lokales Setup, kein Admin-Recht nötig).

## Dateien

| Datei | Zweck |
|-------|-------|
| `kaggle_build.ipynb` | **Empfohlen.** Lauffähiges Kaggle-Notebook, das die Logik beider Skripte nacheinander ausführt und `players_game.js` schreibt. |
| `build_db.py` | Lokales Skript: wählt Spieler über Top-5-Einsätze seit 2000 aus und erfasst deren **volle** Vereinshistorie (auch Portugal/NL/Pokale). Schreibt Zwischen-CSVs nach `./out`. |
| `make_game_json.py` | Lokales Skript: mappt Spieler auf die 40 Spiel-Vereine und schreibt `./out/players_game.js`. |

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

## Caveats (aus den Skripten)

- Einsatz-Daten auf Spiel-Ebene reichen i.d.R. nur ~2012 zurück, nicht 2000.
  Für ältere Vereinszugehörigkeiten müsste Transferhistorie ergänzt werden.
- „seit 2000" bedeutet `games.season >= 2000`.
- Die TM-Vereinsnamen sind als normalisierte Teilstrings hinterlegt. Schreibt das
  Dataset einen Verein anders, den Teilstring in `GAME_CLUBS` anpassen.
