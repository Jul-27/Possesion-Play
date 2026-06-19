# Possession Play — Online (Vite + React + Supabase)

Hex-Duell mit Fußball-Trivia, online gegen einen Freund. Vercel hostet die App,
Supabase hält den Spielstand in Echtzeit synchron. **Du brauchst keine Admin-Rechte
und nichts lokal zu installieren** – alles geht im Browser über GitHub + Vercel.

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

## Vollständige Spielerdatenbank einsetzen (optional)

Standardmäßig ist ein kuratierter Demo-Seed (~108 bekannte Spieler) in
`src/gameData.js` eingebettet. Für den vollen Datensatz:

1. In einem **Kaggle-Notebook** (Browser, kein Install) `build_db.py` und
   `make_game_json.py` laufen lassen – Anleitung dazu hast du separat.
2. Den Inhalt der erzeugten `players_game.js` kopieren.
3. In `src/gameData.js` das Array `export const PLAYERS = [ … ];` damit ersetzen
   (das `export const ` davor stehen lassen).
4. Änderung zu GitHub committen → Vercel deployt automatisch neu.

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
