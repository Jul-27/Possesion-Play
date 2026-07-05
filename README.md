# Possession Play — Online (Vite + React + Supabase)

Fußball-Trivia online: **vier Spielmodi** — Hex-Duell (31 Felder erobern),
Raster-Duell (3×3-Tic-Tac-Toe), „Errate den Star" (Deduktions-Duell mit
Ja/Nein-Fragen) und der tägliche **Daily-Star** (solo, mit Emoji-Share &
Streaks). Vercel hostet die App, Supabase hält Duelle in Echtzeit synchron,
alle Duelle laufen mit 4:00-Schachuhr. ~27.000 Spieler aus Wikidata mit
Vereinen, Nationen, 15 Titeln, Positionen und Karrierezeiträumen.

---

## 1. Supabase einrichten (5 Min)

1. Auf https://supabase.com ein kostenloses Projekt anlegen.
2. Links **SQL Editor** öffnen, den Inhalt von `supabase/schema.sql` einfügen, **Run**.
3. Unter **Project Settings → API** zwei Werte kopieren:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

## 2. Code zu GitHub (browserbasiert)

1. Auf https://github.com ein neues, leeres Repository erstellen.
2. **Add file → Upload files**, den gesamten Projektordner per Drag & Drop hochladen, commit.
   (Den Ordner `node_modules` gibt es hier nicht – Vercel installiert das selbst.)

## 3. Auf Vercel deployen (browserbasiert)

1. Auf https://vercel.com mit GitHub anmelden → **Add New → Project** → dein Repo importieren.
2. Vercel erkennt Vite automatisch (Build `vite build`, Output `dist`).
3. Unter **Environment Variables** beide Werte aus Schritt 1 eintragen
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. **Deploy.** Du bekommst eine öffentliche URL.

## 4. Spielen

- URL öffnen → Name eingeben → **Neues Spiel erstellen** → Code/Link teilen.
- Dein Freund öffnet den Link (oder gibt den Code ein) → ihr spielt in Echtzeit.

---

## Spielerdatenbank aktualisieren

Die Spielerdaten (`src/players.js`) kommen aus **Wikidata** über die Pipeline
in `data-pipeline/` (Basis-Roster einmalig via Kaggle-Notebook, siehe
`data-pipeline/README.md`). Aktualisieren:

- **Automatisch:** Die GitHub Action „Wikidata Daten-Refresh" läuft monatlich
  am 1. und öffnet einen PR mit frischen Daten — nur noch mergen.
  Manuell anstoßbar über den Actions-Tab (`workflow_dispatch`).
- **Lokal:** `npm run data:refresh` führt alle fünf Skripte in der korrekten
  Reihenfolge aus (roster → honours → honours_extra → positions → careers).

Das Datum des letzten Laufs steht in `src/dataInfo.js` (`DATA_ASOF`) und wird
in der Lobby sowie den Regel-Modals angezeigt.

---

## Lokal entwickeln (nur falls du Node hast)

```bash
npm install
cp .env.example .env   # Werte eintragen
npm run dev
```

## Hinweise

- Die RLS-Policies sind bewusst offen (Spiel unter Freunden). Willst du es
  absichern, kopple die Tabelle an Supabase-Auth und schränke die Policies auf
  `host_id`/`guest_id` ein.
- Die Zugprüfung läuft im Client (deterministisch aus den eingebetteten Daten).
  Für Manipulationsschutz könntest du sie später in eine Supabase Edge Function
  verlagern.
