# Design: Hex-Feinschliff Runde 2 (5 User-Reports)

**Datum:** 2026-07-07
**Status:** Genehmigt (User-Report), bereit für Implementierungsplanung

## Befunde & Fixes

### 1. Falscher Spieler soll den Zug kosten (Hex)

Bisher: Fehlversuch im Hex-Duell erlaubt beliebige weitere Versuche (nur im
Raster verfällt der Zug). Fix in `Game.jsx` `handleSubmit`: Nicht-passender
Spieler ⇒ Feedback + `err`-Sound + Auswahl zurücksetzen + **`writeMove` mit
Zugwechsel** (Uhr wie bei jedem Zug umgebucht, `last_move`-Text
„… passt nicht — Zug verfällt."). Regel-Modal ergänzt den Satz.

### 2. Untere Hex-Reihe wirkt abgeschnitten/dunkel

Der „Flutlicht"-Gradient (`.board::before`) ist bei 38 % Höhe zentriert und
endet bei 70 % — die unterste Reihe liegt außerhalb des Lichtkegels. Fix:
Lichtpool größer/tiefer (`inset: -12% -8% -14%`, Zentrum ~46 %, Ausklang 78 %)
+ etwas mehr `margin-bottom` am Board.

### 3. PSG-Logo falsch

Die Namenssuche „Paris SG" liefert als ersten France/Soccer-Treffer „Torcy"
(Vorstadtklub) — dessen Badge wurde geladen. Fix in `fetch_logos.mjs`:
optionale **Team-ID** pro Eintrag (`PSG: 133714`, per `lookupteam.php`
verifiziert: Name muss „Paris" enthalten + Land passen); falsches PNG löschen
und neu laden.

### 4. Hex-Texte abgeschnitten/nicht zentriert

`.hexLabel` hat keine Umbruch-/Begrenzungsregeln — Ein-Wort-Namen wie
„Europameister" laufen über die Hex-Breite hinaus (Clip-Path schneidet ab).
Fix: `overflow-wrap: anywhere` + 2-Zeilen-Clamp (`-webkit-line-clamp`) +
Maximalgröße leicht reduziert (`clamp(7.5px, 2.6vw, 11px)`).

### 5. DFB-Pokal-Daten unvollständig (Wirtz, Kane)

Ursache strukturell: Die Honours-Query verlangt `wdt:P580` (Startzeit) am
Saison-Item — viele Pokal-Saisons haben stattdessen `P585`/nichts ⇒ ganze
Jahrgänge fehlen still. Zwei Maßnahmen:
- **Query-Fix** in `wikidata_honours.mjs`: Saisonjahr aus `P580` ODER `P585`
  (COALESCE); greift beim nächsten Refresh-Lauf (monatliche Action).
- **Sofort-Fix:** exportierte `HONOUR_OVERRIDES`-Tabelle in
  `wikidata_honours.mjs` (kuratierte, vom Owner bestätigte Fakten:
  `florian wirtz|2003 → DFB`, `harry kane|1993 → DFB`), die (a) das
  Honours-Skript bei jedem Lauf additiv anwendet und (b) ein neues Mini-Skript
  `apply_honour_overrides.mjs` JETZT direkt auf `players.js` anwendet
  (Match über `norm(name)|by`, `t`-Union, alle Felder erhalten).

## Nicht-Ziele (YAGNI)

- Kein kompletter Honours-Rerun jetzt (übernimmt die monatliche Action mit
  dem Query-Fix); keine weiteren Override-Einträge ohne Owner-Bestätigung.

## Tests / Verifikation

- Bestehende 42 Tests grün; Build grün.
- `apply_honour_overrides.mjs`-Lauf: Log zeigt 2 Treffer; Diff nur `t` bei
  Wirtz/Kane; danach Verifikation via Node-Import.
- PSG: neues PNG, `lookupteam`-Verifikation im Log.
- Manuell: Fehlversuch im Hex wechselt den Zug; untere Reihe im Licht;
  „Europameister" zweizeilig zentriert.

## Betroffene Dateien

- `src/Game.jsx`, `src/styles.css`
- `data-pipeline/fetch_logos.mjs`, `public/logos/club/PSG.png`
- `data-pipeline/wikidata_honours.mjs`, `data-pipeline/apply_honour_overrides.mjs` (neu)
- `src/players.js` (generiert)
