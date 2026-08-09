import { test } from "node:test";
import assert from "node:assert/strict";
import {
  moveKind, moveOwner, freeClubs, isPlayerLegal, legalPlayers, startCandidates, pickStart,
  botClubMove, botPlayerMove, carouselHint, initCarousel, addMove, loseLife, burnedOf,
  currentKind, currentOwner, CAROUSEL_LIVES, BOT_LEVELS, botLevel,
} from "./carousel.js";

const P = (n, clubs, sl = 50) => ({ n, ln: n, by: 1990, nat: [], clubs, sl });
const S = (...a) => new Set(a);

test("die Kette wechselt zwischen Spieler und Verein", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(moveKind), ["player", "club", "player", "club", "player"]);
});

/* Das Muster A · B · B · A · A · B · B … ist der Kern der Fairness: nach dem
   Eröffnungszug übernimmt jeder abwechselnd ein ganzes Paar aus Verein und Spieler.
   Wer Vereine nennt, hat 2–5 Möglichkeiten, wer Spieler nennt, im Schnitt 700 —
   dieselbe Rolle eine ganze Runde lang wäre einseitig. */
test("nach dem Eröffnungszug übernimmt jeder ein ganzes Zugpaar", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => moveOwner(i, 0)), [0, 1, 1, 0, 0, 1, 1, 0, 0]);
});

/* Der eigentliche Fairness-Nachweis: egal wo die Runde endet und wer eröffnet hat,
   keine Seite hat mehr als einen Zug einer Art mehr gemacht als die andere. */
test("beide Rollen verteilen sich zu jedem Zeitpunkt gleichmäßig", () => {
  for (const starter of [0, 1]) {
    for (const laenge of [4, 7, 12, 25, 40, 93]) {
      const z = [{ player: 0, club: 0 }, { player: 0, club: 0 }];
      for (let i = 0; i < laenge; i++) z[moveOwner(i, starter)][moveKind(i)]++;
      for (const art of ["player", "club"]) {
        assert.ok(Math.abs(z[0][art] - z[1][art]) <= 1,
          `${art} nach ${laenge} Zügen (Eröffnung ${starter}): ${z[0][art]} zu ${z[1][art]}`);
      }
    }
  }
});

test("mit umgekehrter Eröffnung spiegelt sich das Muster", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => moveOwner(i, 1)), [1, 0, 0, 1, 1]);
});

test("freeClubs blendet verbrannte Vereine aus", () => {
  assert.deepEqual(freeClubs(P("X", ["FCB", "BVB", "S04"]), S("BVB")), ["FCB", "S04"]);
  assert.deepEqual(freeClubs(P("X", ["FCB"]), S("FCB")), []);
});

/* REGEL 2, die wichtigste: ohne sie gewinnt der Spieler-Nenner nach drei Zügen.
   25.720 der 31.565 Spieler haben nur einen Verein — wer so einen nennt, lässt dem
   Gegner keinen Zug. Ein genannter Spieler muss also einen freien Verein übrig lassen. */
test("ein Spieler ohne freien Verein darf nicht genannt werden", () => {
  const sackgasse = P("Nur Bayern", ["FCB"]);
  assert.equal(isPlayerLegal(sackgasse, "FCB", S("FCB"), S()), false, "würde den Gegner sofort ersticken");
  const weiter = P("Zwei Vereine", ["FCB", "BVB"]);
  assert.equal(isPlayerLegal(weiter, "FCB", S("FCB"), S()), true);
});

test("ein Spieler muss beim genannten Verein gespielt haben", () => {
  assert.equal(isPlayerLegal(P("X", ["BVB", "S04"]), "FCB", S("FCB"), S()), false);
});

test("verbrannte Spieler sind gesperrt", () => {
  const p = P("Doppelt", ["FCB", "BVB"]);
  assert.equal(isPlayerLegal(p, "FCB", S("FCB"), S("Doppelt")), false);
});

test("legalPlayers achtet auf die Bekanntheitsgrenze des Bots", () => {
  const list = [P("Star", ["FCB", "BVB"], 80), P("Unbekannt", ["FCB", "S04"], 5)];
  assert.deepEqual(legalPlayers(list, "FCB", S("FCB"), S(), 50).map((p) => p.n), ["Star"]);
  assert.equal(legalPlayers(list, "FCB", S("FCB"), S(), 0).length, 2, "ohne Grenze zählen beide");
});

test("Eröffnungsspieler brauchen zwei Vereine und Bekanntheit", () => {
  const list = [P("Einer", ["FCB"], 90), P("Zwei", ["FCB", "BVB"], 90), P("Unbekannt", ["FCB", "BVB"], 3)];
  assert.deepEqual(startCandidates(list, 45).map((p) => p.n), ["Zwei"]);
  assert.equal(pickStart(list, () => 0, 45).n, "Zwei");
  assert.equal(pickStart([P("Einer", ["FCB"], 90)], () => 0, 45), null, "ohne Kandidat kommt null");
});

test("der Bot nennt nur unverbrannte Vereine", () => {
  const p = P("X", ["FCB", "BVB"]);
  assert.equal(botClubMove([], p, S("FCB"), S(), () => 0, "mittel"), "BVB");
  assert.equal(botClubMove([], p, S("FCB", "BVB"), S(), () => 0, "mittel"), null, "keine Option = null");
});

/* Auf „schwer" wählt der Bot den Verein, der dem Gegner die wenigsten Antworten
   lässt. Auf den leichteren Stufen bleibt er zufällig — ein optimal spielender Bot
   wäre unschlagbar und damit als Übungspartner wertlos. */
test("der schwere Bot wählt den Verein mit den wenigsten Antworten", () => {
  const ziel = P("Ziel", ["ENG", "KLEIN"]);
  const list = [ziel,
    P("A1", ["ENG", "BVB"]), P("A2", ["ENG", "S04"]), P("A3", ["ENG", "FCB"]),
    P("K1", ["KLEIN", "BVB"])];
  assert.equal(botClubMove(list, ziel, S(), S("Ziel"), () => 0, "schwer"), "KLEIN");
});

test("der Bot nennt nur erlaubte Spieler", () => {
  const list = [P("Sackgasse", ["FCB"], 90), P("Gut", ["FCB", "BVB"], 90)];
  const zug = botPlayerMove(list, "FCB", S("FCB"), S(), () => 0, "mittel");
  assert.equal(zug.n, "Gut", "die Sackgasse ist auch für den Bot verboten");
});

test("der Bot gibt null zurück, wenn er nichts weiß — dann verliert er ein Leben", () => {
  const list = [P("Unbekannt", ["FCB", "BVB"], 3)];
  assert.equal(botPlayerMove(list, "FCB", S("FCB"), S(), () => 0, "leicht"), null);
  assert.ok(botPlayerMove(list, "FCB", S("FCB"), S(), () => 0, "schwer"), "der schwere Bot kennt ihn");
});

test("die Bot-Stufen sind nach Wissen gestaffelt", () => {
  const sl = BOT_LEVELS.map((l) => l.minSl);
  assert.deepEqual([...sl].sort((a, b) => b - a), sl, "leicht weiß am wenigsten");
  assert.equal(botLevel("gibtsnicht").key, "mittel", "unbekannte Stufe fällt auf mittel zurück");
});

test("carouselHint nennt bei Spielern den bekanntesten Ausweg", () => {
  const list = [P("Klein", ["FCB", "BVB"], 10), P("Groß", ["FCB", "S04"], 90)];
  assert.equal(carouselHint(list, "player", "FCB", S("FCB"), S()).player.n, "Groß");
  assert.equal(carouselHint(list, "club", P("X", ["FCB", "BVB"]), S("FCB"), S()).club, "BVB");
  assert.equal(carouselHint(list, "player", "FCB", S("FCB"), S("Klein", "Groß")), null);
});

test("burnedOf trennt Vereine und Spieler", () => {
  let s = initCarousel(0);
  s = addMove(s, "player", "Messi");
  s = addMove(s, "club", "BAR");
  s = addMove(s, "player", "Xavi");
  const { clubs, players } = burnedOf(s);
  assert.deepEqual([...clubs], ["BAR"]);
  assert.deepEqual([...players], ["Messi", "Xavi"]);
});

test("currentKind und currentOwner folgen der Zugnummer", () => {
  let s = initCarousel(0);
  assert.equal(currentKind(s), "player");
  assert.equal(currentOwner(s), 0);
  s = addMove(s, "player", "Messi");
  assert.equal(currentKind(s), "club");
  assert.equal(currentOwner(s), 1, "der Gegner nennt den Verein");
  s = addMove(s, "club", "BAR");
  assert.equal(currentOwner(s), 1, "und danach auch gleich den nächsten Spieler");
});

/* Owner-Regel: „Immer wenn ein Leben verloren wurde, wechselt die Startreihenfolge." */
test("ein verlorenes Leben beendet die Runde und dreht die Eröffnung", () => {
  let s = initCarousel(0);
  s = addMove(s, "player", "Messi");
  s = addMove(s, "club", "BAR");
  s = loseLife(s, 1, "time");
  assert.deepEqual(s.lives, [CAROUSEL_LIVES, CAROUSEL_LIVES - 1]);
  assert.equal(s.starter, 1, "jetzt eröffnet der andere");
  assert.equal(s.round, 2);
  assert.deepEqual(s.moves, [], "die Kette startet neu");
  assert.equal(s.over, null);
  assert.equal(s.lastRound.reason, "time");
  assert.equal(s.lastRound.laenge, 2, "die gespielte Kette bleibt für die Auflösung erhalten");
});

test("verbrannte Vereine gelten nur innerhalb einer Runde", () => {
  let s = initCarousel(0);
  s = addMove(s, "player", "Messi");
  s = addMove(s, "club", "BAR");
  s = loseLife(s, 1, "wrong");
  assert.equal(burnedOf(s).clubs.size, 0, "die neue Runde beginnt mit leerem Brett");
});

test("beim dritten verlorenen Leben ist das Spiel entschieden", () => {
  let s = initCarousel(0);
  s = loseLife(s, 1, "time");
  s = loseLife(s, 1, "time");
  assert.equal(s.over, null, "nach zwei Leben läuft es weiter");
  s = loseLife(s, 1, "time");
  assert.deepEqual(s.over, { loser: 1, winner: 0 });
  assert.deepEqual(s.lives, [3, 0]);
});

test("die Eröffnung wechselt über mehrere Runden hin und her", () => {
  let s = initCarousel(0);
  const folge = [s.starter];
  for (let i = 0; i < 4; i++) { s = loseLife(s, i % 2, "time"); folge.push(s.starter); }
  assert.deepEqual(folge, [0, 1, 0, 1, 0]);
});

import { CLUBS, norm } from "./gameData.js";
import { matchClub, suggestClubs } from "./carousel.js";

test("matchClub erkennt vollen Namen, Kürzel und Kurzform", () => {
  for (const eingabe of ["FC Bayern München", "FCB", "Bayern", "bayern münchen"]) {
    assert.equal(matchClub(eingabe, CLUBS, norm), "FCB", `„${eingabe}" sollte Bayern treffen`);
  }
  assert.equal(matchClub("Barca", CLUBS, norm), "BAR");
  assert.equal(matchClub("Spurs", CLUBS, norm), "TOT");
  assert.equal(matchClub("Salzburg", CLUBS, norm), "RBS");
});

test("matchClub ist unempfindlich gegen Umlaute und Groß-/Kleinschreibung", () => {
  assert.equal(matchClub("MONCHENGLADBACH", CLUBS, norm), "BMG");
  assert.equal(matchClub("Mönchengladbach", CLUBS, norm), "BMG");
  assert.equal(matchClub("atletico madrid", CLUBS, norm), "ATM");
});

test("matchClub lehnt Unbekanntes ab, statt irgendetwas zu treffen", () => {
  for (const x of ["", "   ", "Hansa Rostock", "Bayern2"]) {
    assert.equal(matchClub(x, CLUBS, norm), null, `„${x}" darf nicht treffen`);
  }
});

/* Jeder Verein muss über mindestens eine Eingabe erreichbar sein — sonst kann man
   ihn im Spiel nicht nennen, obwohl er auf dem Feld steht. */
test("jeder Spielverein ist über seinen Namen und sein Kürzel erreichbar", () => {
  for (const c of CLUBS) {
    assert.equal(matchClub(c.name, CLUBS, norm), c.key, `Name greift nicht: ${c.name}`);
    assert.equal(matchClub(c.key, CLUBS, norm), c.key, `Kürzel greift nicht: ${c.key}`);
  }
});

test("jede Kurzform zeigt auf genau ihren Verein", () => {
  for (const c of CLUBS) {
    const treffer = CLUBS.filter((x) => matchClub(c.name, CLUBS, norm) === x.key);
    assert.equal(treffer.length, 1, `mehrdeutig: ${c.name}`);
  }
});

test("suggestClubs schlägt beim Tippen vor", () => {
  const s = suggestClubs("bay", CLUBS, norm).map((c) => c.key);
  assert.ok(s.includes("FCB") && s.includes("B04"), `Bayern und Bayer erwartet, kam ${s}`);
  assert.equal(suggestClubs("", CLUBS, norm).length, 0, "leere Eingabe schlägt nichts vor");
  assert.ok(suggestClubs("man", CLUBS, norm).length >= 2, "Manchester City und United");
});
