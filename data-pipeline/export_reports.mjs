#!/usr/bin/env node
/*
 * export_reports.mjs — offene Fehlermeldungen holen und als Datei ablegen.
 *
 *   npm run reports:export            # schreibt data-pipeline/player-club-reports.json
 *   npm run reports:export -- --print # nur anzeigen, nichts schreiben
 *
 * WOZU: Spieler melden im Spiel fehlende Spieler→Verein-Zuordnungen. Diese Datei ist
 * die Übergabe an die Durchsicht. Sie erfindet KEIN neues Format, sondern liefert zu
 * jeder Meldung direkt den Eintrag, wie ihn EXTRA_PLAYERS in apply_extra_players.mjs
 * erwartet — übernehmen heißt dann Einfügen, nicht Übersetzen.
 *
 * Die Meldungen liegen in Supabase (Tabelle pc_reports, für den öffentlichen
 * Schlüssel gesperrt). Gelesen wird über pc_reports_open, das ein Geheimnis verlangt;
 * es steht in .env unter PP_REPORTS_SECRET und ist NICHT Teil des Browser-Bundles.
 *
 * Nichts hier verändert players.js. Der Export ist eine Leseoperation.
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { norm, CLUBS } from "../src/gameData.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "player-club-reports.json");

/** .env einlesen — ohne Zusatzpaket, es sind drei Zeilen. */
export function leseEnv(text) {
  const out = {};
  for (const zeile of String(text).split("\n")) {
    const m = zeile.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const NAME_VON_KEY = new Map(CLUBS.map((c) => [c.key, c.name]));

/* Eine Datenbankzeile in den Ausgabesatz übersetzen.
 *
 * `ziel` ist die wichtigste Information der Datei — es sagt, WOHIN die Korrektur
 * gehört. Es gibt zwei kuratierte Tabellen, weil es zwei Vereinsebenen gibt:
 *   · einer der 47 Spielvereine (club_key gesetzt) -> EXTRA_PLAYERS.clubs
 *   · ein Karriereverein (kein Schlüssel)          -> EXTRA_CAREER_CLUBS
 * `eintrag` liefert den fertigen Datensatz für die jeweilige Tabelle.
 *
 * `bereitsBekannt` markiert Meldungen, bei denen der Verein längst im Datensatz steht.
 * Dann liegt es nicht an den Daten, sondern an der Regel des Feldes; solche Meldungen
 * sollen nicht als Datenkorrektur durchgereicht werden. */
export function zuAusgabe(zeile, spielerNachKey, karriere) {
  const key = zeile.club_key || null;
  const spieler = spielerNachKey.get(zeile.player_key) || null;
  const name = key ? NAME_VON_KEY.get(key) || zeile.club_name : zeile.club_name;

  const bekannt = key
    ? !!spieler?.clubs?.includes(key)
    : (karriere?.byKey?.[zeile.player_key] || []).some((i) => karriere.clubs[i] === name);

  const ziel = !spieler || bekannt ? null : key ? "EXTRA_PLAYERS" : "EXTRA_CAREER_CLUBS";
  return {
    playerKey: zeile.player_key,
    playerName: zeile.player_name,
    playerBy: zeile.player_by,
    clubKey: key,
    clubName: name,
    reports: zeile.reports,
    reporters: (zeile.reporters || []).length,
    modes: zeile.modes || [],
    gameCodes: zeile.game_codes || [],
    firstReportedAt: zeile.first_reported_at,
    lastReportedAt: zeile.last_reported_at,
    dataAsof: zeile.data_asof,
    imDatensatz: !!spieler,
    bereitsBekannt: bekannt,
    anwendbar: !!ziel,
    ziel,
    grund: !spieler ? "Spieler steht nicht in players.js — Name/Geburtsjahr prüfen"
      : bekannt ? "Verein steht bereits beim Spieler — vermutlich ein Regel-, kein Datenproblem"
      : null,
    /* Fertig zum Einfügen in die jeweilige Tabelle. Die Form unterscheidet sich nur
       im Vereinsfeld: Spielvereine über ihren Schlüssel, Karrierevereine über den
       Namen, weil sie keinen Schlüssel haben. */
    eintrag: ziel
      ? { n: zeile.player_name, by: zeile.player_by, clubs: [key || name] }
      : null,
  };
}

export function baueExport(zeilen, players, karriere = null) {
  const spielerNachKey = new Map(players.map((p) => [norm(p.n) + "|" + p.by, p]));
  const reports = zeilen.map((z) => zuAusgabe(z, spielerNachKey, karriere));
  const nachZiel = (z) => reports.filter((r) => r.ziel === z).map((r) => r.eintrag);
  return {
    exportedAt: new Date().toISOString(),
    hinweis: "Offene Meldungen aus dem Spiel. `ziel` nennt die kuratierte Tabelle, "
      + "`eintrag` den fertigen Datensatz dafür: EXTRA_PLAYERS in apply_extra_players.mjs "
      + "(die 47 Spielvereine) oder EXTRA_CAREER_CLUBS in extra_career_clubs.mjs (alle "
      + "übrigen). Nichts hiervon wurde automatisch angewandt — jede Zeile gehört vor der "
      + "Übernahme geprüft.",
    gesamt: reports.length,
    anwendbar: reports.filter((r) => r.anwendbar).length,
    // Blockweise zum Einfügen, damit nichts von Hand zusammengeklaubt werden muss.
    extraPlayers: nachZiel("EXTRA_PLAYERS"),
    extraCareerClubs: nachZiel("EXTRA_CAREER_CLUBS"),
    reports,
  };
}

async function main() {
  const env = { ...leseEnv(readFileSync(join(HERE, "..", ".env"), "utf8")), ...process.env };
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anon, PP_REPORTS_SECRET: secret } = env;
  if (!url || !anon) throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen in .env");
  if (!secret) throw new Error("PP_REPORTS_SECRET fehlt in .env");

  const res = await fetch(`${url}/rest/v1/rpc/pc_reports_open`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: secret }),
  });
  if (!res.ok) throw new Error(`Abruf fehlgeschlagen: HTTP ${res.status} ${await res.text()}`);
  const zeilen = await res.json();

  const { PLAYERS } = await import(new URL("../src/players.js", import.meta.url).href);
  const { CAREER_CLUBS, CAREER_BY_KEY } = await import(new URL("../src/careerClubs.js", import.meta.url).href);
  const daten = baueExport(zeilen, PLAYERS, { clubs: CAREER_CLUBS, byKey: CAREER_BY_KEY });

  console.log(`${daten.gesamt} offene Meldung(en), davon ${daten.anwendbar} anwendbar`
    + ` (${daten.extraPlayers.length}× EXTRA_PLAYERS, ${daten.extraCareerClubs.length}× EXTRA_CAREER_CLUBS)\n`);
  for (const r of daten.reports) {
    const marke = r.anwendbar ? "✓" : "·";
    console.log(`${marke} ${r.playerName} (${r.playerBy}) → ${r.clubName}`
      + `  ${r.reports}× von ${r.reporters} Melder(n) · ${r.modes.join(", ") || "?"}`
      + (r.ziel ? `  → ${r.ziel}` : "")
      + (r.grund ? `\n    ${r.grund}` : ""));
  }

  if (process.argv.includes("--print")) return console.log("\n--print: nichts geschrieben.");
  writeFileSync(OUT, JSON.stringify(daten, null, 2) + "\n");
  console.log(`\nGeschrieben: ${OUT}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
