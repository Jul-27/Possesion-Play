# Design: Echte Vereins- & Liga-Logos

**Datum:** 2026-07-07
**Status:** Genehmigt (Design), bereit für Implementierungsplanung
**Scope:** Echte Wappen für 41 Vereine + Logos für 7 Ligen via TheSportsDB;
zentrale Einbindung in `Emblems.jsx` mit automatischem Fallback auf die
bestehenden gezeichneten Badges. Nationen behalten die SVG-Flaggen.

## Entscheidungen (aus dem Brainstorming)

- Quelle: TheSportsDB (kostenloser Test-Key „3"), per Skript reproduzierbar.
- Umfang: Vereine + Ligen; Nationen unverändert.
- Rechtlicher Rahmen: privater Freundeskreis — Entscheidung des Owners,
  Hinweis auf technisch öffentliche Vercel-URL gegeben.

## Nicht-Ziele (YAGNI)

- Keine Spielerfotos, keine Nationalflaggen-Ersetzung, keine
  Hell/Dunkel-Logo-Varianten, kein Runtime-API-Zugriff aus der App.

## Architektur

### A. `data-pipeline/fetch_logos.mjs` (neu, einmalig/wiederholbar)

- **Vereine:** `searchteams.php?t=<Suchname>`; da unsere `CLUBS`-Namen deutsch
  sind, explizite Tabelle `SEARCH_NAME` (Key → englischer API-Name).
  **Verifikation:** erster Treffer mit `strSport === "Soccer"` UND
  `strCountry === <erwartetes Land>` (aus `lg` → Land, wie `LG_COUNTRY`);
  sonst MISS (kein Download). Badge-URL: `strBadge`.
- **Ligen:** `lookupleague.php?id=<ID>` mit bekannter ID-Tabelle
  (PL 4328, BL 4331, SA 4332, L1 4334, LL 4335, NL 4337, PT 4344);
  **Verifikation:** `strLeague` muss erwarteten Namensbestandteil enthalten,
  sonst MISS. Logo-URL: `strBadge`.
- Download nach `public/logos/club/<KEY>.png` bzw.
  `public/logos/league/<KEY>.png`; 300 ms Pause zwischen Requests; Abschluss-
  Report mit OK-/MISS-Listen. Idempotent (überschreibt).
- Fehltreffer werden manuell nachkuratiert (Suchname anpassen, erneut laufen).

### B. `src/Emblems.jsx` — zentrale Einbindung

```jsx
function Logo({ src, fallback }) {
  const [err, setErr] = useState(false);
  return err ? fallback : <img className="emImg" src={src} alt="" onError={() => setErr(true)} />;
}
```

`Emblem`:
- `club` → `<span className="emblem badge"><Logo src={`/logos/club/${def.key}.png`} fallback={<ClubBadge …/>} /></span>`
- `league` → `<span className="emblem league …"><Logo src={`/logos/league/${def.key}.png`} fallback={<Label wie bisher>} /></span>`
  (Hintergrund-Gradient bleibt als Rahmen/Untergrund erhalten.)
- Hex-`Cell`, Raster-Header und Guess/Daily-Comboboxen profitieren automatisch
  (alle rendern über `Emblem`/`ClubBadge`-Pfad in Emblems.jsx).
- CSS: `.emImg { width: 100%; height: 100%; object-fit: contain; }`.

### C. Assets im Repo

`public/logos/**` wird committet (~2–3 MB PNGs); Vercel liefert statisch,
Browser lädt on-demand und cacht. Kein Einfluss aufs JS-Bundle.

## Fehlerfälle / Edge Cases

- PNG fehlt/404/kaputt → `onError` → gezeichnetes Badge (heutige Optik).
- API-Fehltreffer → MISS-Log, kein falsches Logo (Verifikationspflicht).
- API nicht erreichbar → Skript bricht mit Report ab; App unverändert lauffähig.

## Tests / Verifikation

- Skript-Report: 41+7 OK oder dokumentierte MISS-Liste; Stichprobe der PNGs.
- `npm test` (42) + `npm run build` grün (reine Darstellung, Engine unberührt).
- Manuell: Hex-Board/Raster/Combobox zeigen Logos; Datei wegnehmen → Fallback.

## Betroffene Dateien

- `data-pipeline/fetch_logos.mjs` (neu)
- `public/logos/**` (generiert, committet)
- `src/Emblems.jsx`, `src/styles.css`
