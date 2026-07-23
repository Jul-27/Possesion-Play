# Karriere jenseits der 42 Vereine — Liga- & Ära-Credits (Design)

**Ziel:** Liga-Hexfelder (La Liga, Premier League, …) und Ära-Specials („Aktiv in den
2000ern") sollen auch Stationen bei Vereinen **außerhalb der 42 Spielvereine** berücksichtigen.

## Problem

`cp` (Karrierezeiträume) und `clubs` werden ausschließlich aus den 42 Spielvereinen gebaut
(`wikidata_careers.mjs` iteriert `CLUB_QID`). Folgen:

- **Liga:** `playerMatchesHex` (league) matcht `clubs × CLUB_LG`. Ein Spieler, der eine Liga nur
  bei einem Nicht-Spielverein gespielt hat, zählt nicht — **Ricardo Rodríguez → La Liga via Real
  Betis** fehlt (Betis ist kein Spielverein; belegt: Betis `P118` → La Liga Q324867).
- **Ära:** `activeInRange` liest `cp`. Aktivität bei einem Nicht-Spielverein ist unsichtbar —
  **Yann Sommer → „Aktiv in den 2000ern" via FC Basel** fehlt (belegt: Basel 2005–2014, Swiss
  Super League).

## Datenmodell — zwei neue optionale Record-Felder

```
lg:   ["LL", "SA", …]     // alle Ligen, in denen der Spieler gespielt hat (Spiel-Codes)
span: [erstesJahr, letztesJahr]  // Karriere-Spanne; letztesJahr 0 = laufend
```

Beide optional. Fehlt eines, greift das heutige Verhalten (Fallback) — bestehende Spieler ohne
neue Felder verhalten sich unverändert.

## Datenpipeline — `data-pipeline/wikidata_player_careers.mjs`

Zwei Pässe, jeder für seine Aufgabe richtig dimensioniert:

### Pass 1 — `lg` (gespielte Ligen), pro Liga

Für jede der 7 Spielligen eine Abfrage: Liga → alle Mitgliedsklubs (`?club wdt:P118 <ligaQID>`) →
alle Spieler dieser Klubs (`?p p:P54/ps:P54 ?club`). **Kein Startdatum nötig** → maximale
Abdeckung. Verifizierte Liga-QIDs (aus Klub-`P118`):

```
BL Q82595 · PL Q9448 · LL Q324867 · SA Q15804 · L1 Q13394 · PT Q182994 · NL Q167541
```

Match auf die DB über `norm(name)|geburtsjahr`. Ergebnis wird mit den **verlässlichen**
Spielverein-Ligen vereinigt: `lg = {non-game via P118} ∪ {CLUB_LG[c] für c in clubs}`. Grund für
den Vorrang von `CLUB_LG` bei Spielvereinen: P118 ist teils falsch (Wolfsburgs P118 zeigt „2.
Bundesliga", obwohl WOB in der Bundesliga spielt).

### Pass 2 — `span` (Karriere-Spanne), fenstergestützt nach Geburtsjahr

Über alle Fußballer, gefenstert nach Geburtsjahr: Ligaklub-Stationen mit Datum
(`?st ps:P54 ?club ; pq:P580 ?from`; `?club wdt:P118 ?any`). `span = [min(from), max(to|0)]`.
Nur Stationen **mit** Liga (P118) zählen → **Jugend- und Nationalteams fallen automatisch raus**,
„aktiv" heißt sauber „bei einem Ligaklub unter Vertrag".

**Kostenrealität (gemessen):** ~12.400 Zeilen für drei Geburtsjahrgänge in ~31 s. Über ~140
Jahrgänge braucht es **feine Fenster** (pro Jahr, dichte Jahrgänge ggf. weiter geteilt),
429/Timeout-Retries, Idempotenz und Resume. Der Lauf ist **lang (30–60+ min)** und wird — wie der
Bilder-Download — **separat** ausgeführt (nicht Teil des schnellen Standard-Refreshs), aber ans
Ende der `refresh_all`-Kette gehängt.

`recToString` in **allen** Pipeline-Skripten um `lg`/`span` erweitern (mechanisch, wie `t`/`cp`).

## Matching in `src/gameData.js`

- **Liga-Feld:** `(player.lg || []).includes(def.key) || (player.clubs||[]).some(ck => CLUB_LG[ck] === def.key)`
  — `lg` zuerst, Fallback auf die bisherige Klub-Logik.
- **Ära-Special (`activeInRange`):** wenn `player.span` vorhanden, prüfe Überlappung
  `span[0] <= to && (span[1] === 0 ? aktuellesJahr : span[1]) >= from`; sonst Fallback auf `cp`.
- **T5L** („3+ Top-5-Ligen") nutzt `lg`, falls vorhanden (sonst `clubs × CLUB_LG`).
- **Guess-Spiel** (`answerGuessQuestion` league) analog zum Liga-Feld.

## Nicht-Ziele

- **`cp` bleibt unangetastet.** Basel/Betis erscheinen bewusst **nicht** als Karriere-Stationen im
  Solo-Modus „Karriere-Pfad" (keine Logos, keine Spielvereine). Die neuen Felder dienen nur
  Liga- und Ära-Feldern.
- Keine neuen Liga-Hexfelder — nur die 7 bestehenden werden korrekt befüllt.

## Tests (`src/careerLeagues.test.js` + Ergänzungen in `gameData.test.js`)

- `activeInRange` mit `span`: Überlappung, laufende Karriere (bis 0), Fallback auf `cp` ohne span.
- Liga-Matching: `lg`-Treffer, Fallback auf `clubs` ohne `lg`, kein falsch-positiver Treffer.
- Echtdaten: **Sommer** erfüllt A00; **Rodríguez** erfüllt das La-Liga-Feld.
- Kein Record trägt einen `lg`-Code außerhalb der 7 Spiel-Codes.

## Datenstand

`wikidata_player_careers.mjs` ist ein echter Wikidata-Abruf → setzt `DATA_ASOF` (via
`stampDataInfo`). Bei einem gezielten Einzellauf gilt dieselbe Überlegung wie sonst: nur stempeln,
wenn der Kerndatenstand tatsächlich frisch ist.
