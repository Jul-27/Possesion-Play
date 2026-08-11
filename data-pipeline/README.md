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
| `wikidata_roster.mjs` | Baut `src/players.js` neu aus Wikidata: ergänzt Vereine vorhandener Spieler UND legt fehlende Spieler an (Name, Nachname, Geburtsjahr, Nation via P1532/P27→ISO-3, Vereine, Bekanntheit `sl`). Pool wächst auf ~27k. Lauf: `node data-pipeline/wikidata_roster.mjs` (Internet nötig). Matcht über Name + Geburtsjahr; nur Spiel-Vereine/-Nationen; idempotent. |
| `wikidata_honours.mjs` | Setzt das Feld `t` (Honours: CL, 5 Meister, 4 Pokale, WM) je Spieler komplett aus Wikidata (Saison-Sieger × Vereinszeitraum, gefenstert). Lauf **nach** dem Roster: `node data-pipeline/wikidata_honours.mjs` (Internet nötig). Idempotent. |
| `wikidata_positions.mjs` | Ergänzt das Feld `pos` (Gruppen TW/ABW/MF/ST) je Spieler aus Wikidata P413, fürs Autocomplete (Name · Position · Alter). Lauf: `node data-pipeline/wikidata_positions.mjs` (Internet nötig). Idempotent; lässt clubs/nat/t/sl unverändert. |
| `wikidata_label.mjs` | Gemeinsame Label-Auflösung: Sprach-Fallback-Kette (`LABEL_SERVICE`) statt nur `"en"` plus `cleanName()`, das QID-Rückfälle (`/^Q\d+$/`) verwirft. Von allen Wikidata-Skripten benutzt. |
| `name_overrides.mjs` | Kuratierte Tabellen `NAME_OVERRIDES` (falscher → belegter Name, je mit Wikidata-QID als Quelle) und `EXCLUDED_PLAYERS` (Nicht-Fußballer und Records ohne belegbaren Namen). Reine Daten, kein Netz. |
| `apply_name_overrides.mjs` | Wendet beide Tabellen auf `src/players.js` an und verschmilzt dabei entstehende Dubletten (Name + Geburtsjahr). Läuft als letzter Schritt in `refresh_all.mjs`. Idempotent, kein Netz. |
| `add_clubs.mjs` | Trägt einen oder mehrere Spielvereine additiv nach, ohne alles neu zu bauen: `node data-pipeline/add_clubs.mjs S04 HSV`. Der Weg, um einen Verein aufzunehmen. Anders als das abgelöste `add_salzburg.mjs` ist das Startdatum optional — bei Salzburg führen 76 von 436 Spielern keines, die fielen vorher still aus dem Kader. |
| `apply_title.mjs` | Holt **einen** Wettbewerbstitel gezielt nach, mit feinen Fenstern: `node data-pipeline/apply_title.mjs MBL --ab 1903`. Additiv. Löst `apply_msa.mjs` ab (gleiche Logik, aber mit der P831-Brücke). Für Reparaturen, wenn ein einzelner Wettbewerb im Gesamtlauf gescheitert ist. |
| `backfill_positions.mjs` | Füllt `pos` bei allen, die `wikidata_positions.mjs` nicht erreicht: löst die QID über Name + Geburtsjahr auf und liest `P413` direkt, statt über Vereins-Kader zu gehen. Ein Treffer zählt nur bei exakt passendem Geburtsjahr **und** Beruf Fußballspieler. |
| `position_overrides.mjs` | Kuratierte Positionen für Spieler ohne `P413`. Wie `HONOUR_OVERRIDES`: nur Belegtes, nichts Geratenes. |
| `wikidata_career_clubs.mjs` | Holt die **vollständige** Vereinsliste je Spieler nach `src/careerClubs.js` — die Grundlage für „Transferkarussell". Siehe „Zwei Vereins-Ebenen". |
| `audit_clubs.mjs` | **Diagnose, schreibt nichts.** Meldet Spieler, bei denen wir einen Verein führen, den Wikidata nicht kennt. Treffer sind Verdacht, kein Befund — siehe „Datenqualität". |
| `wikipedia_squads.mjs` | Ergänzt die **aktuellen Kader** aus der deutschen Wikipedia: `node data-pipeline/wikipedia_squads.mjs [KEY …] [--probe]`. Wikipedia liefert dabei nur die Vereinszugehörigkeit und das Jahr aus „im Verein seit"; alle Personendaten kommen weiter aus Wikidata. Siehe „Aktuelle Kader". |

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

## Falsche Namen aus Wikidata

Drei Fehlerbilder haben es in `src/players.js` geschafft:

1. **QID statt Name.** `SERVICE wikibase:label` mit `wikibase:language "en"` gibt
   die QID zurück, wenn kein englisches Label existiert — so entstanden Records
   wie `{"n":"Q113704154", …}` (Lamine Yamal). Seit `wikidata_label.mjs` greifen
   zwei Sicherungen: die Fallback-Kette `en,de,es,fr,pt,it,nl,ca,eu,pl,sv,mul`
   und `cleanName()`, das ein verbliebenes `/^Q\d+$/` verwirft (der Record wird
   dann übersprungen statt mit QID als Namen gespeichert).
2. **Vandalismus in Wikidata.** Zum Zeitpunkt eines Laufs manipulierte Labels
   („Divock Origi kolman", „João Moutinh0", „Romelu Lukaku LA CAKA"). Die Labels
   sind inzwischen meist zurückgesetzt, die alten Records blieben aber liegen.
   Korrektur über `NAME_OVERRIDES`.
3. **Falsche Entitäten.** Personen mit `P106` „Fußballspieler" und einer
   `P54`-Zuordnung, die nie Profifußball gespielt haben (Jason Statham).
   Korrektur über `EXCLUDED_PLAYERS`.

**Regel: keine Namen erfinden.** Jeder Eintrag in `NAME_OVERRIDES` trägt in `src`
die belegende Wikidata-QID; Quelle ist das Label bzw. der Wikipedia-Artikeltitel
dieser Entität. Wo sich kein lateinschriftlicher Name belegen ließ (nur ru/ka/ar/
zh-Label), wird der Record ausgeschlossen statt transliteriert — fehlend ist
besser als falsch.

Neue Fälle finden:

```bash
# QID-Namen
node -e "import('./src/players.js').then(m=>console.log(m.PLAYERS.filter(p=>/^Q\d+\$/.test(p.n)).map(p=>p.n).join('\n')))"
node --test src/players.test.js
```

## Caveats

- Auch mit der Transferhistorie sind sehr alte / Jugend- / Leihstationen nicht
  garantiert lückenlos.
- „seit 2000" bedeutet `games.season >= 2000`.
- Die TM-Vereinsnamen sind als normalisierte Teilstrings in `GAME_CLUBS`
  hinterlegt. Der Prüfbericht deckt jetzt Einsatz- **und** Transfer-Namen ab;
  bei Abweichungen den Teilstring anpassen.


## Datenqualität — was eine Lücke ist und was nicht

**Fehlende Nation ist meist KEINE Lücke.** Das Spiel kennt 19 Nationen. Ein Spieler ohne
`nat` ist in aller Regel schlicht kein Angehöriger einer davon. Gemessen an den bekannten
Spielern (sl≥60): von 55 Spielern ohne Nation hatten **2** überhaupt eine Spiel-Nation in
Wikidata — und beide zweifelhaft (Aaron Ramsey ist Waliser, „England" wäre falsch; Luis
Suárez ist Uruguayer mit zusätzlicher spanischer Staatsbürgerschaft). Also nicht versuchen,
diese „Lücke" zu schließen — sie ist korrektes Verhalten.

**Fehlende Position IST eine Lücke.** Jeder Fußballer hat eine; fehlt `pos`, ist er für
„Elf des Tages" unbrauchbar. Sie hat zwei getrennte Ursachen, die verschiedene Mittel
brauchen — gemessen am 03.08.2026 an den 62 Spielern mit sl≥20 ohne Position:

| Ursache | Anteil | Mittel |
|---|---|---|
| Wikidata **hat** `P413`, unsere Kader-Abfrage findet den Spieler nicht | 31 von 62 | `backfill_positions.mjs` |
| Wikidata hat **kein** `P413` | 26 von 62 | `position_overrides.mjs` (nur Belegtes) |
| QID über Name + Geburtsjahr nicht auflösbar | 5 von 62 | offen, wird gemeldet |

Der erste Fall entsteht auf zwei Wegen, die beide real vorkommen: der `P54`-Link zum
Spielverein wurde gelöscht (Vandalismus), oder das Geburtsjahr weicht ab — Michael Owen
steht in Wikidata mit 1976 im Liverpool-Kader, bei uns korrekt mit 1979, und der
Schlüssel `norm(name)|by` trifft dann nie. `backfill_positions.mjs` geht deshalb nicht
über Kader, sondern löst die QID direkt auf.

**Eine schweigende Quelle widerlegt nichts.** Dass Wikidata einen Verein nicht führt,
heißt nicht, dass unser Wert falsch ist — es heißt nur, dass Wikidata nichts weiß.
Dieser Fehlschluss ist hier schon einmal passiert: Merlin Röhls Wikidata-Eintrag hat
gar keinen Verein, woraufhin sein Everton als Falscheintrag entfernt wurde. Er spielt
dort tatsächlich; dass Freiburg fehlte, lag allein daran, dass Freiburg damals kein
Spielverein war. `audit_clubs.mjs` überspringt solche Fälle deshalb, und in
`WRONG_CLUBS` kommt nur, was **positiv widerlegt** ist.

**Messung vom 04.08.2026** (`audit_clubs.mjs --min-sl 40`, 1873 Spieler eindeutig
auflösbar): **1833 deckungsgleich (97,9 %)**, 40 Spieler mit zusammen 45 Vereinen, die
Wikidata nicht führt. Die Richtung lässt sich daraus **nicht** ableiten — darunter sind
zweifelsfrei echte Stationen, die Wikidata verloren hat (De Bruyne bei Chelsea und City,
Felix Magath bei Bayern/Stuttgart/Werder/Frankfurt/Wolfsburg), und ebenso Kandidaten, die
nach einem Fehleintrag aussehen. Nichts davon wird automatisch geändert.

Beim Bau des Werkzeugs war `wdt:P54` die naheliegende Abfrage — und falsch: sie liefert
nur Aussagen mit dem besten Rang, sodass bei gesetztem Vorzugsrang die ganze
Vereinshistorie fehlt. Das erzeugte 4 Falschmeldungen unter 25 Spielern. Richtig ist
`p:P54/ps:P54`; ein Test hält es fest.

## Zwei Vereins-Ebenen — und warum

`clubs[]` in `players.js` kennt nur die **47 Spielvereine**. Das ist Absicht: sie tragen
die Hexfelder, brauchen Wappen und ein Kürzel, also muss die Menge klein und kuratiert
bleiben.

Für „Transferkarussell" ist genau das falsch. Der Reiz des Modus besteht darin, dem
Gegner einen schwierigen Verein zuzuwerfen — und Gündoğan ohne Nürnberg und
Galatasaray oder Klose ohne Kaiserslautern nimmt dem Spiel die Tiefe. Gemessen:
Wikidata führt **Ø 8,3 Vereine je Spieler**, wir 1,9.

Deshalb gibt es eine zweite Ebene daneben, nicht statt:

| | `players.js` → `clubs[]` | `careerClubs.js` |
|---|---|---|
| Umfang | 47 kuratierte Vereine | **8434 Vereine**, Ø 5,4 je Spieler |
| Genutzt von | Hex, Raster, Guess, Kette, Elf, Karriere-Pfad | nur Transferkarussell |
| Wappen | ja | nein — schlichtes Namensfeld |
| Geladen | mit den Spielerdaten | **erst beim Start des Modus** (0,65 MB gzip) |

`createCareerIndex()` in `src/careerIndex.js` führt beide zusammen und liefert beide
Richtungen: Stationen eines Spielers und Spieler eines Vereins. Die zweite ist der
Grund für den Index — ohne ihn wäre jeder Bot-Zug eine Suche über 31.565 Spieler.
Aufbau dauert 53 ms.

Drei Fallen beim Abruf, alle gemessen:

1. **`charset=utf-8` im POST-Header ist Pflicht.** Ohne die Angabe liest WDQS den Body
   nicht als UTF-8, und jeder Name mit Sonderzeichen findet nichts: „İlkay Gündoğan"
   lieferte 0 statt 13 Zeilen. Bei einem Fußball-Datensatz wäre das lautlos der größere
   Teil aller Spieler gewesen.
2. **Nicht nach Geburtsjahrgang abfragen** — das läuft zuverlässig in den WDQS-Timeout.
   Der Weg über den Label-Index (Namen direkt in `VALUES`) schafft 400 Namen in ~25 s.
   Per GET scheitert das ab ~250 Namen an HTTP 431, deshalb POST.
3. **Zweitmannschaften brauchen zwei Prüfungen.** Der Typ „Zweitmannschaft" (Q2412834)
   erwischt Real Madrid Castilla und Juventus Next Gen, aber *nicht* Borussia Dortmund II
   — das trägt nur „Fußballmannschaft". Deshalb zusätzlich ein enges Namensmuster. Eng,
   weil Willem II Tilburg, Athletic Bilbao und Bishop Auckland echte Vereine sind.
4. **`rdfs:label` allein trifft zu wenig.** Unsere Namen sind teils diakritikfrei
   („Marko Arnautovic"), Wikidata trägt die Zeichen („Marko Arnautović") — und
   `rdfs:label` vergleicht exakt. Ohne `skos:altLabel` fehlten **5251 Spielern (17 %)**
   sämtliche Stationen, darunter Arnautović ohne Stoke City, Hakimi, Adriano, Golovin.
   Wen auch der Alias nicht findet (Wikidata führt „Adriano" als „Adriano Leite
   Ribeiro"), holt ein zweiter Lauf über die QID — der fand nochmals 1681 Spieler.
   Zusammen sank die Lücke auf 4000, fast durchweg unbekannte Spieler.

## Aktuelle Kader: warum Wikidata dafür nicht reicht

Wikidata hinkt bei Transfers hinterher, und zwar sehr ungleichmäßig. Gemessen am
04.08.2026 gegen die Kaderlisten der deutschen Wikipedia:

| | Kader | bei uns mit Station |
|---|--:|--:|
| Liverpool, Arsenal, Tottenham, Newcastle, Everton, Villa, Napoli, Lazio | je 19–27 | **100 %** |
| TSG Hoffenheim | 31 | 9 |
| FC Schalke 04 | 29 | 6 |
| Hamburger SV | 26 | 6 |
| FC Red Bull Salzburg | 33 | 2 |

Bei den 19 fehlenden Hoffenheimern führte **Wikidata die Station bei keinem einzigen**.
Fisnik Asllani und Leon Avdullahu haben dort überhaupt keinen Verein (`P54` leer), Tim
Lemperle nur Köln. Die Roster-Pipeline ist der Quelle also treu — die Quelle ist lückenhaft.

`wikipedia_squads.mjs` schließt das. Entscheidend ist die **Aufgabenteilung**:

- **Wikipedia** liefert ausschließlich die Behauptung „gehört zum Kader" plus das Jahr
  aus der Spalte „im Verein seit".
- **Wikidata** liefert weiterhin Name, Geburtsjahr, Nation, Position und Bekanntheit,
  aufgelöst über die QID des verlinkten Artikels.

Der Abgleich läuft über die Artikel-Verlinkung (`pageprops.wikibase_item`), nicht über
Namensähnlichkeit — deshalb gibt es keine Verwechslung zwischen Fisnik und Kristjan
Asllani, beide Jahrgang 2002.

Zwei Fallen, die beim Bau zugeschnappt sind:

1. **Der Abschnitt.** Beim VfB heißt der Kader der *zweiten* Mannschaft schlicht
   „Kader in der Saison 2026/27" — am Titel nicht vom Profikader zu unterscheiden.
   Erkennbar ist er nur an der Elternüberschrift „Zweite Mannschaft". Die Auswahl prüft
   deshalb die ganze Überschriften-Hierarchie; eine frühere, titelbasierte Fassung hat
   bei Stuttgart die Reserve importiert und Leverkusen („Mannschaftskader") und PSV
   („Eredivisie-Kader") ganz übersehen. Zusätzlich gilt eine Plausibilitätsgrenze von
   10–45 Spielern: reißt ein Verein sie, wird er ausgelassen und gemeldet.
2. **Die kuratierten Namen.** Der erste Lauf legte „Calvin Ramsey" neben den bereits
   korrigierten „Calvin Ramsay" — `NAME_OVERRIDES` und `EXCLUDED_PLAYERS` müssen auch
   hier gelten, genau wie in `wikidata_images.mjs`.

Vorhandene Zeiträume werden nie überschrieben: Wikidata datiert genauer als eine
Kadertabelle, und sonst überschriebe jeder Jahreslauf echte Anfangsjahre.

## WDQS-Fenster: warum 4 Jahre

Die Honours-Abfragen sind nach Saison-Startjahr gefenstert. Die Fenster waren früher bis
zu 70 Jahre breit; das kippt inzwischen zuverlässig ins Timeout. Gemessen am 03.08.2026:
von fünf Wettbewerben scheiterten **vier**, dieselbe Abfrage in 4-Jahres-Schritten
antwortete mit 200. Ursache ist die gewachsene Datenmenge — allein die fünf neuen
Bundesligisten bringen ~1300 Spieler mit.

Ein gescheitertes Fenster ist gefährlich, nicht nur ärgerlich: `wikidata_honours.mjs`
setzt `t` standardmäßig **neu**. Ein übersprungener Wettbewerb löschte damit jeden Titel
dieser Art bei jedem Spieler. Das Skript bricht deshalb ab, statt weiterzulaufen. Wer nur
neu aufgenommene Spieler versorgen will, nimmt `--additiv`.

## Nach jedem Refresh prüfen

```bash
node data-pipeline/verify_refresh.mjs src/.players.before.js
```

`refresh_all.mjs` sichert den Stand vorher automatisch und ruft die Prüfung am Ende auf.
Sie meldet, wenn Spieler verschwinden oder **ein bekannter Spieler mehrere Werte auf einmal
verliert** — das typische Vandalismus-Muster. Wikidata wird aktiv manipuliert; in diesem
Projekt sind bereits De Bruynes Vereinszeiten, Nianzous Bayern-Zeit und mehrere Spielernamen
betroffen gewesen. Ohne diese Prüfung gingen solche Verluste still live.
