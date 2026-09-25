import { test } from "node:test";
import assert from "node:assert/strict";
import {
  playerKey, clubKeyOf, REPORT_MODES, modeName, isDuel,
  reportFehlt, reportPayload, bereitsBekannt,
  REPORT_KINDS, zieleFuer, vorbelegungAus, kontextAus,
} from "./reports.js";
import { CLUBS, norm, lookupDef } from "./gameData.js";

const P = (n, by, clubs = []) => ({ n, ln: n.split(" ").pop(), by, nat: [], clubs, sl: 50, pos: "MF" });

/* Spieler haben keine ID — der Schlüssel muss exakt der sein, unter dem auch
   EXTRA_PLAYERS, die Namenskorrekturen und die Bildkarte verschlüsselt sind. */
test("der Spielerschlüssel ist norm(name)|geburtsjahr", () => {
  assert.equal(playerKey(P("Fábio Vieira", 2000)), "fabio vieira|2000");
  assert.equal(playerKey(P("İlkay Gündoğan", 1990)), norm("İlkay Gündoğan") + "|1990");
  assert.equal(playerKey(null), "", "ohne Spieler kein Schlüssel");
});

test("die Vereins-ID gibt es nur für die 47 Spielvereine", () => {
  assert.equal(clubKeyOf("Hamburger SV"), "HSV");
  assert.equal(clubKeyOf("hamburger sv"), "HSV", "Schreibweise egal");
  assert.equal(clubKeyOf("FC Bayern München"), "FCB");
  assert.equal(clubKeyOf("1. FC Nürnberg"), null, "Karriereverein, kein Spielverein");
  assert.equal(clubKeyOf(""), null);
  assert.equal(clubKeyOf(null), null);
});

test("jeder Spielverein ist über seinen Namen auflösbar", () => {
  for (const c of CLUBS) assert.equal(clubKeyOf(c.name), c.key, c.name);
});

/* Die Schlüssel wandern unverändert in die Datenbank — ein Tippfehler wäre in der
   Auswertung nicht mehr von einem echten Modus zu unterscheiden. Fünfzehn Modi sind
   spielbar, „daily" ist der sechzehnte: der abgelöste Daily-Star, dessen bereits
   eingegangene Meldungen weiter unter ihrem damaligen Namen erscheinen sollen. */
test("alle Spielmodi sind erfasst und eindeutig", () => {
  const keys = Object.keys(REPORT_MODES);
  assert.equal(keys.length, 16);
  assert.equal(new Set(keys).size, 16);
  assert.equal(keys.filter((k) => isDuel(k)).length, 4, "vier Duell-Modi");
  assert.equal(keys.filter((k) => !isDuel(k)).length, 12, "elf Solo-/Tagesmodi plus den abgelösten");
  for (const k of keys) assert.ok(REPORT_MODES[k].name, `${k} braucht einen Namen`);
});

test("modeName fällt auf den Schlüssel zurück statt zu krachen", () => {
  assert.equal(modeName("heat"), "Heatmap");
  assert.equal(modeName("gibtsnicht"), "gibtsnicht");
  assert.equal(modeName(undefined), "unbekannt");
});

test("Senden bleibt gesperrt, solange etwas fehlt", () => {
  assert.match(reportFehlt(null, null), /Spieler/);
  assert.match(reportFehlt(null, "Hamburger SV"), /Spieler/);
  assert.match(reportFehlt(P("X Y", 1990), null), /Verein/);
  assert.match(reportFehlt(P("X Y", 1990), ""), /Verein/);
  assert.equal(reportFehlt(P("X Y", 1990), "Hamburger SV"), null, "vollständig ⇒ erlaubt");
});

/* Die Feldnamen müssen exakt zur Datenbankfunktion pc_report_submit passen —
   ein Tippfehler fiele sonst erst beim Absenden im Browser auf. */
test("die Nutzlast trägt genau die Argumente der Datenbankfunktion", () => {
  const nutz = reportPayload({
    player: P("Fábio Vieira", 2000), clubName: "Hamburger SV",
    mode: "hex-duell", gameCode: "ABC123", clientId: "client-1", dataAsof: "2026-08-04",
  });
  assert.deepEqual(Object.keys(nutz).sort(), [
    "p_client", "p_club_key", "p_club_name", "p_context", "p_data_asof",
    "p_game_code", "p_kind", "p_mode", "p_player_by", "p_player_key", "p_player_name",
  ]);
  assert.equal(nutz.p_kind, "verein", "ohne Angabe eine Vereinsmeldung — wie bisher");
  assert.equal(nutz.p_context, null);
  assert.equal(nutz.p_player_key, "fabio vieira|2000");
  assert.equal(nutz.p_player_name, "Fábio Vieira");
  assert.equal(nutz.p_player_by, 2000);
  assert.equal(nutz.p_club_key, "HSV", "die ID, nicht nur der Name");
  assert.equal(nutz.p_club_name, "Hamburger SV");
  assert.equal(nutz.p_game_code, "ABC123");
});

test("ein Karriereverein wird ohne ID, aber mit Namen gemeldet", () => {
  const nutz = reportPayload({ player: P("İlkay Gündoğan", 1990), clubName: "1. FC Nürnberg", mode: "carousel" });
  assert.equal(nutz.p_club_key, null);
  assert.equal(nutz.p_club_name, "1. FC Nürnberg");
});

/* Im Solo gibt es keinen Spielcode. Würde einer durchrutschen, stünde in der
   Auswertung eine Spielzuordnung, die es nie gab. */
test("der Spielcode wird nur bei Duellen mitgeschickt", () => {
  const solo = reportPayload({ player: P("X Y", 1990), clubName: "Hamburger SV", mode: "heat", gameCode: "ABC123" });
  assert.equal(solo.p_game_code, "", "Solo trägt keinen Spielcode");
  const duell = reportPayload({ player: P("X Y", 1990), clubName: "Hamburger SV", mode: "grid-duell", gameCode: "ABC123" });
  assert.equal(duell.p_game_code, "ABC123");
});

test("fehlende Angaben werden zu leeren Feldern, nicht zu undefined", () => {
  const nutz = reportPayload({ player: P("X Y", 1990), clubName: "Hamburger SV", mode: "hex" });
  assert.equal(nutz.p_client, "");
  assert.equal(nutz.p_game_code, "");
  assert.equal(nutz.p_data_asof, null);
});

/* Kennt das Spiel die Zuordnung schon, ist die Meldung kein Datenloch — der Dialog
   sagt das vor dem Absenden, statt eine wertlose Meldung zu sammeln. */
test("bereits bekannte Zuordnungen werden erkannt", () => {
  const vieira = P("Fábio Vieira", 2000, ["HSV", "ARS"]);
  assert.equal(bereitsBekannt(vieira, "Hamburger SV"), true);
  assert.equal(bereitsBekannt(vieira, "FC Bayern München"), false);
  assert.equal(bereitsBekannt(vieira, "1. FC Nürnberg"), false, "ohne ID nicht prüfbar");
  assert.equal(bereitsBekannt(null, "Hamburger SV"), false);
  assert.equal(bereitsBekannt(P("Ohne Vereine", 1990), "Hamburger SV"), false);
});

/* ── Meldearten (seit 25.09.2026) ─────────────────────────────────────────── */

test("drei Meldearten; Titel und Nationen kommen aus HONOURS und NATIONS", () => {
  assert.deepEqual(Object.keys(REPORT_KINDS), ["verein", "titel", "nation"]);
  assert.ok(zieleFuer("titel").some((z) => z.key === "WM" && z.name === "Weltmeister"));
  assert.ok(zieleFuer("nation").some((z) => z.key === "GER" && z.name === "Deutschland"));
  assert.deepEqual(zieleFuer("verein"), []);
});

test("eine Titelmeldung trägt Schlüssel und Namen des Titels, Art und Zusammenhang", () => {
  const nutz = reportPayload({
    player: P("Ferran Torres", 2000), kind: "titel", ziel: { key: "WM", name: "Weltmeister" },
    kontext: kontextAus(lookupDef("honour", "WM")), mode: "hex-duell", gameCode: "ABC123",
  });
  assert.equal(nutz.p_kind, "titel");
  assert.equal(nutz.p_club_key, "WM");
  assert.equal(nutz.p_club_name, "Weltmeister");
  assert.deepEqual(nutz.p_context, { feld: "honour:WM", feldName: "Weltmeister" });
  assert.ok(JSON.stringify(nutz.p_context).length < 2000, "die Datenbank nimmt höchstens 2000 Zeichen");
});

test("Senden bleibt gesperrt, bis das Ziel der jeweiligen Art gewählt ist", () => {
  assert.match(reportFehlt(P("X Y", 1990), null, "titel"), /Titel/);
  assert.match(reportFehlt(P("X Y", 1990), null, "nation"), /Nation/);
  assert.equal(reportFehlt(P("X Y", 1990), { key: "WM", name: "Weltmeister" }, "titel"), null);
});

test("bereits bekannt: bei Titeln über t, bei Nationen über nat", () => {
  const torres = { ...P("Ferran Torres", 2000), t: ["WM"], nat: ["ESP"] };
  assert.equal(bereitsBekannt(torres, { key: "WM", name: "Weltmeister" }, "titel"), true);
  assert.equal(bereitsBekannt(torres, { key: "CL", name: "Champions-League-Sieger" }, "titel"), false);
  assert.equal(bereitsBekannt(torres, { key: "ESP", name: "Spanien" }, "nation"), true);
  assert.equal(bereitsBekannt(torres, { key: "SWE", name: "Schweden" }, "nation"), false);
});

test("ein abgelehntes Feld belegt die Meldung vor — nur, wo es Daten dafür gibt", () => {
  assert.deepEqual(vorbelegungAus(lookupDef("honour", "WM")), { kind: "titel", ziel: { key: "WM", name: "Weltmeister" } });
  assert.deepEqual(vorbelegungAus(lookupDef("nat", "GER")), { kind: "nation", ziel: { key: "GER", name: "Deutschland" } });
  const hsv = vorbelegungAus(lookupDef("club", "HSV"));
  assert.equal(hsv.kind, "verein");
  assert.equal(reportPayload({ player: P("X Y", 1990), ziel: hsv.ziel, mode: "hex" }).p_club_key, "HSV");
  assert.equal(vorbelegungAus(lookupDef("league", "BL")), null, "Liga: nichts zu melden");
  assert.equal(vorbelegungAus(null), null);
});
