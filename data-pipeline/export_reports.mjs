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
 * `anwendbar` trennt die zwei Sorten Meldung, und das ist die wichtigste Information
 * der Datei: Nur bei einem der 47 Spielvereine (club_key gesetzt) lässt sich die
 * Zuordnung über EXTRA_PLAYERS.clubs korrigieren. Karrierevereine wie „1. FC Nürnberg"
 * stammen unverändert aus Wikidata und haben bislang keinen kuratierten Korrekturweg —
 * die Meldung ist erfasst, aber noch nicht anwendbar.
 *
 * `bereitsBekannt` markiert Meldungen, bei denen der Verein längst im Datensatz steht.
 * Dann liegt es nicht an den Daten, sondern an der Regel des Feldes; solche Meldungen
 * sollen nicht als Datenkorrektur durchgereicht werden. */
export function zuAusgabe(zeile, spielerNachKey) {
  const key = zeile.club_key || null;
  const spieler = spielerNachKey.get(zeile.player_key) || null;
  const bekannt = !!(key && spieler?.clubs?.includes(key));
  return {
    playerKey: zeile.player_key,
    playerName: zeile.player_name,
    playerBy: zeile.player_by,
    clubKey: key,
    clubName: key ? NAME_VON_KEY.get(key) || zeile.club_name : zeile.club_name,
    reports: zeile.reports,
    reporters: (zeile.reporters || []).length,
    modes: zeile.modes || [],
    gameCodes: zeile.game_codes || [],
    firstReportedAt: zeile.first_reported_at,
    lastReportedAt: zeile.last_reported_at,
    dataAsof: zeile.data_asof,
    imDatensatz: !!spieler,
    bereitsBekannt: bekannt,
    anwendbar: !!key && !!spieler && !bekannt,
    grund: !key ? "Karriereverein — kein kuratierter Korrekturweg (EXTRA_PLAYERS kennt nur die 47 Spielvereine)"
      : !spieler ? "Spieler steht nicht in players.js — Name/Geburtsjahr prüfen"
      : bekannt ? "Verein steht bereits beim Spieler — vermutlich ein Regel-, kein Datenproblem"
      : null,
    // Direkt übernehmbar in EXTRA_PLAYERS (apply_extra_players.mjs)
    extraPlayersEntry: key && spieler && !bekannt
      ? { n: zeile.player_name, by: zeile.player_by, clubs: [key] }
      : null,
  };
}

export function baueExport(zeilen, players) {
  const spielerNachKey = new Map(players.map((p) => [norm(p.n) + "|" + p.by, p]));
  const reports = zeilen.map((z) => zuAusgabe(z, spielerNachKey));
  return {
    exportedAt: new Date().toISOString(),
    hinweis: "Offene Meldungen aus dem Spiel. `extraPlayersEntry` ist direkt in "
      + "data-pipeline/apply_extra_players.mjs (EXTRA_PLAYERS) übernehmbar. Nichts hiervon "
      + "wurde automatisch angewandt.",
    gesamt: reports.length,
    anwendbar: reports.filter((r) => r.anwendbar).length,
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
  const daten = baueExport(zeilen, PLAYERS);

  console.log(`${daten.gesamt} offene Meldung(en), davon ${daten.anwendbar} direkt anwendbar\n`);
  for (const r of daten.reports) {
    const marke = r.anwendbar ? "✓" : "·";
    console.log(`${marke} ${r.playerName} (${r.playerBy}) → ${r.clubName}`
      + `  ${r.reports}× von ${r.reporters} Melder(n) · ${r.modes.join(", ") || "?"}`
      + (r.grund ? `\n    ${r.grund}` : ""));
  }

  if (process.argv.includes("--print")) return console.log("\n--print: nichts geschrieben.");
  writeFileSync(OUT, JSON.stringify(daten, null, 2) + "\n");
  console.log(`\nGeschrieben: ${OUT}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
