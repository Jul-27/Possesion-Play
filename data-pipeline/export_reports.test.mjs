import { test } from "node:test";
import assert from "node:assert/strict";
import { leseEnv, zuAusgabe, baueExport, istAbgelehnt } from "./export_reports.mjs";
import { norm } from "../src/gameData.js";

const zeile = (o = {}) => ({
  player_key: "fabio vieira|2000", player_name: "Fábio Vieira", player_by: 2000,
  club_key: "HSV", club_name: "Hamburger SV",
  reports: 3, reporters: ["a", "b"], modes: ["hex-duell", "heat"], game_codes: ["ABC123"],
  first_reported_at: "2026-08-17T10:00:00Z", last_reported_at: "2026-08-17T12:00:00Z",
  data_asof: "2026-08-04", status: "offen", ...o,
});
const P = (n, by, clubs = []) => ({ n, ln: n.split(" ").pop(), by, nat: [], clubs, sl: 50 });
// Schlüssel exakt wie im Code: norm() entfernt Diakritika, „Fábio" wird zu „fabio".
const karte = (players) => new Map(players.map((p) => [norm(p.n) + "|" + p.by, p]));

test("leseEnv holt Werte, ignoriert Kommentare und Anführungszeichen", () => {
  const env = leseEnv(`# Kommentar\nPP_REPORTS_SECRET="geheim"\nVITE_SUPABASE_URL=https://x.co\n\nkaputt\n`);
  assert.equal(env.PP_REPORTS_SECRET, "geheim");
  assert.equal(env.VITE_SUPABASE_URL, "https://x.co");
  assert.equal(env.kaputt, undefined);
});

/* Der Kern des Exports: eine anwendbare Meldung liefert den Eintrag fertig in der
   Form, die EXTRA_PLAYERS erwartet — übernehmen heißt Einfügen, nicht Übersetzen. */
test("eine anwendbare Meldung bringt den EXTRA_PLAYERS-Eintrag mit", () => {
  const a = zuAusgabe(zeile(), karte([P("Fábio Vieira", 2000, ["ARS"])]));
  assert.equal(a.anwendbar, true);
  assert.equal(a.ziel, "EXTRA_PLAYERS");
  assert.equal(a.grund, null);
  assert.deepEqual(a.eintrag, { n: "Fábio Vieira", by: 2000, clubs: ["HSV"] });
  assert.equal(a.clubKey, "HSV");
  assert.equal(a.reporters, 2, "Zahl der verschiedenen Melder, nicht die Liste");
  assert.equal(a.reports, 3);
});

test("steht der Verein schon beim Spieler, ist es kein Datenproblem", () => {
  const a = zuAusgabe(zeile(), karte([P("Fábio Vieira", 2000, ["HSV", "ARS"])]));
  assert.equal(a.bereitsBekannt, true);
  assert.equal(a.anwendbar, false);
  assert.match(a.grund, /bereits/);
  assert.equal(a.ziel, null);
  assert.equal(a.eintrag, null, "nichts zum Übernehmen");
});

/* Karrierevereine haben seit apply_extra_career_clubs.mjs einen eigenen Weg — der
   Export muss sie dorthin schicken statt sie als unlösbar abzutun. */
test("ein Karriereverein geht nach EXTRA_CAREER_CLUBS, mit Namen statt Schlüssel", () => {
  const a = zuAusgabe(zeile({ club_key: null, club_name: "SV Elversberg" }),
    karte([P("Fábio Vieira", 2000)]), { clubs: ["FC Bayern München"], byKey: {} });
  assert.equal(a.clubKey, null);
  assert.equal(a.clubName, "SV Elversberg", "der Name geht nicht verloren");
  assert.equal(a.anwendbar, true);
  assert.equal(a.ziel, "EXTRA_CAREER_CLUBS");
  assert.deepEqual(a.eintrag, { n: "Fábio Vieira", by: 2000, clubs: ["SV Elversberg"] });
  assert.equal(a.grund, null);
});

test("ein Karriereverein, den wir schon führen, ist kein Datenproblem", () => {
  const a = zuAusgabe(zeile({ club_key: null, club_name: "SV Elversberg" }),
    karte([P("Fábio Vieira", 2000)]),
    { clubs: ["SV Elversberg"], byKey: { "fabio vieira|2000": [0] } });
  assert.equal(a.bereitsBekannt, true);
  assert.equal(a.anwendbar, false);
  assert.match(a.grund, /bereits/);
});

test("ein unbekannter Spieler wird gemeldet, nicht stillschweigend übernommen", () => {
  const a = zuAusgabe(zeile(), karte([]));
  assert.equal(a.imDatensatz, false);
  assert.equal(a.anwendbar, false);
  assert.match(a.grund, /players\.js/);
});

/* Der Vereinsname kommt aus CLUBS, nicht aus der Meldung: hätte jemand mit einer
   älteren App gemeldet, stünde sonst eine veraltete Schreibweise in der Datei. */
test("der Vereinsname wird aus der Vereinsliste aufgefrischt", () => {
  const a = zuAusgabe(zeile({ club_name: "HSV (alte Schreibweise)" }), karte([P("Fábio Vieira", 2000)]));
  assert.equal(a.clubName, "Hamburger SV");
});

test("der Export zählt anwendbare Meldungen getrennt", () => {
  const players = [P("Fábio Vieira", 2000, ["ARS"]), P("Marin Pongracic", 1997), P("İlkay Gündoğan", 1990)];
  const daten = baueExport([
    zeile(),
    zeile({ player_key: "marin pongracic|1997", player_name: "Marin Pongracic", player_by: 1997,
      club_key: "RBS", club_name: "FC Red Bull Salzburg" }),
    zeile({ player_key: "ilkay gundogan|1990", player_name: "İlkay Gündoğan", player_by: 1990,
      club_key: null, club_name: "1. FC Nürnberg" }),
  ], players);
  assert.equal(daten.gesamt, 3);
  assert.equal(daten.anwendbar, 3, "auch der Karriereverein hat jetzt ein Ziel");
  assert.equal(daten.extraPlayers.length, 2);
  assert.equal(daten.extraCareerClubs.length, 1);
  assert.deepEqual(daten.extraCareerClubs[0], { n: "İlkay Gündoğan", by: 1990, clubs: ["1. FC Nürnberg"] });
  assert.ok(daten.exportedAt, "Zeitstempel für die Nachvollziehbarkeit");
});

test("ein leerer Export ist gültig und leer, kein Fehler", () => {
  const daten = baueExport([], []);
  assert.equal(daten.gesamt, 0);
  assert.equal(daten.anwendbar, 0);
  assert.deepEqual(daten.reports, []);
  assert.deepEqual(daten.extraPlayers, []);
  assert.deepEqual(daten.extraCareerClubs, []);
});

/* Eine widerlegte Meldung verschwindet nicht von selbst: der Verein steht ja gerade
   NICHT beim Spieler, sie gilt also beim nächsten Export wieder als anwendbar.
   Ohne die Ablehnliste würde derselbe falsche Eintrag immer wieder vorgeschlagen. */
test("eine geprüft abgelehnte Meldung wird nicht mehr als anwendbar geführt", () => {
  const spieler = { n: "Raheem Sterling", by: 1994, clubs: ["MCI"] };
  const nachKey = new Map([["raheem sterling|1994", spieler]]);
  const zeile = {
    player_key: "raheem sterling|1994", player_name: "Raheem Sterling", player_by: 1994,
    club_key: null, club_name: "PSV Eindhoven", reports: 1, reporters: ["x"], modes: ["hex-duell"],
  };
  const a = zuAusgabe(zeile, nachKey, { clubs: [], byKey: {} });
  assert.equal(a.anwendbar, false);
  assert.equal(a.ziel, null);
  assert.match(a.grund, /Geprüft und abgelehnt/);
  assert.match(a.grund, /Feyenoord/);
});

test("istAbgelehnt trifft nur das gemeldete Paar", () => {
  assert.equal(istAbgelehnt("raheem sterling|1994", "PSV Eindhoven"), true);
  assert.equal(istAbgelehnt("raheem sterling|1994", "Feyenoord Rotterdam"), false, "nur dieser Verein");
  assert.equal(istAbgelehnt("harry kane|1993", "PSV Eindhoven"), false, "nur dieser Spieler");
});
