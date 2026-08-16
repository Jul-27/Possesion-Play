import { test } from "node:test";
import assert from "node:assert/strict";
import {
  moveKind, moveOwner, freeClubs, isPlayerLegal, legalPlayers, startCandidates, pickStart,
  botClubMove, botPlayerMove, carouselHint, initCarousel, addMove, loseLife, burnedOf,
  currentKind, currentOwner, CAROUSEL_LIVES, BOT_LEVELS, botLevel, rematchState,
} from "./carousel.js";
import { createCareerIndex } from "./careerIndex.js";

const P = (n, by, sl = 50) => ({ n, ln: n.split(" ").pop(), by, nat: [], clubs: [], sl });
const S = (...a) => new Set(a);

/* Kleiner Index aus [Spieler, Vereinsnamen…]. Die Vereine sind frei erfundene Namen —
   der Index unterscheidet nicht zwischen den 47 Spielvereinen und dem langen Rest. */
function idxAus(paare) {
  const clubs = [...new Set(paare.flatMap(([, ...c]) => c))];
  const byKey = {};
  for (const [p, ...c] of paare) byKey[`${p.n.toLowerCase()}|${p.by}`] = c.map((x) => clubs.indexOf(x));
  return createCareerIndex(paare.map(([p]) => p), clubs, byKey);
}

test("die Kette wechselt zwischen Spieler und Verein", () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(moveKind), ["player", "club", "player", "club", "player"]);
});

/* Das Muster A · B · B · A · A · B · B … ist der Kern der Fairness: nach dem
   Eröffnungszug übernimmt jeder abwechselnd ein ganzes Paar aus Verein und Spieler.
   Wer Vereine nennt, hat wenige Möglichkeiten, wer Spieler nennt, sehr viele. */
test("nach dem Eröffnungszug übernimmt jeder ein ganzes Zugpaar", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => moveOwner(i, 0)), [0, 1, 1, 0, 0, 1, 1, 0, 0]);
});

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
  const p = P("Test Eins", 1990);
  const idx = idxAus([[p, "Alpha", "Beta", "Gamma"]]);
  assert.deepEqual(freeClubs(idx, p, S("Beta")), ["Alpha", "Gamma"]);
  assert.deepEqual(freeClubs(idx, p, S("Alpha", "Beta", "Gamma")), []);
});

/* REGEL 2, die wichtigste: ohne sie gewinnt der Spieler-Nenner nach drei Zügen —
   wer einen Spieler mit nur einer Station nennt, lässt dem Gegner keinen Zug. */
test("ein Spieler ohne freie Station darf nicht genannt werden", () => {
  const sack = P("Nur Einer", 1990), weiter = P("Hat Zwei", 1991);
  const idx = idxAus([[sack, "Alpha"], [weiter, "Alpha", "Beta"]]);
  assert.equal(isPlayerLegal(idx, sack, "Alpha", S("Alpha"), S()), false, "würde den Gegner ersticken");
  assert.equal(isPlayerLegal(idx, weiter, "Alpha", S("Alpha"), S()), true);
});

test("ein Spieler muss bei dem genannten Verein gespielt haben", () => {
  const p = P("Test Eins", 1990);
  const idx = idxAus([[p, "Beta", "Gamma"]]);
  assert.equal(isPlayerLegal(idx, p, "Alpha", S("Alpha"), S()), false);
});

test("verbrannte Spieler sind gesperrt", () => {
  const p = P("Test Eins", 1990);
  const idx = idxAus([[p, "Alpha", "Beta"]]);
  assert.equal(isPlayerLegal(idx, p, "Alpha", S("Alpha"), S("Test Eins")), false);
});

test("legalPlayers achtet auf die Bekanntheitsgrenze des Bots", () => {
  const star = P("Bekannt Eins", 1990, 80), klein = P("Klein Zwei", 1991, 5);
  const idx = idxAus([[star, "Alpha", "Beta"], [klein, "Alpha", "Gamma"]]);
  assert.deepEqual(legalPlayers(idx, "Alpha", S("Alpha"), S(), 50).map((p) => p.n), ["Bekannt Eins"]);
  assert.equal(legalPlayers(idx, "Alpha", S("Alpha"), S(), 0).length, 2, "ohne Grenze zählen beide");
});

test("Eröffnungsspieler brauchen zwei Stationen und Bekanntheit", () => {
  const einer = P("Einer Hat", 1990, 90), zwei = P("Zwei Hat", 1991, 90), unbek = P("Unbekannt Ist", 1992, 3);
  const idx = idxAus([[einer, "Alpha"], [zwei, "Alpha", "Beta"], [unbek, "Alpha", "Gamma"]]);
  const alle = [einer, zwei, unbek];
  assert.deepEqual(startCandidates(idx, alle, 45).map((p) => p.n), ["Zwei Hat"]);
  assert.equal(pickStart(idx, alle, () => 0, 45).n, "Zwei Hat");
  assert.equal(pickStart(idx, [einer], () => 0, 45), null, "ohne Kandidat kommt null");
});

test("der Bot nennt nur unverbrannte Vereine", () => {
  const p = P("Test Eins", 1990);
  const idx = idxAus([[p, "Alpha", "Beta"]]);
  assert.equal(botClubMove(idx, p, S("Alpha"), S(), () => 0, "mittel"), "Beta");
  assert.equal(botClubMove(idx, p, S("Alpha", "Beta"), S(), () => 0, "mittel"), null, "keine Option = null");
});

/* Auf „schwer" wählt der Bot den Verein, der dem Gegner die wenigsten Antworten
   lässt. Sonst bleibt er zufällig — ein optimaler Bot wäre kein Übungspartner. */
test("der schwere Bot wählt den Verein mit den wenigsten Antworten", () => {
  const ziel = P("Ziel Spieler", 1990);
  const idx = idxAus([
    [ziel, "Gross", "Klein"],
    [P("A Eins", 1991), "Gross", "Beta"], [P("A Zwei", 1992), "Gross", "Gamma"],
    [P("A Drei", 1993), "Gross", "Delta"], [P("K Eins", 1994), "Klein", "Beta"],
  ]);
  assert.equal(botClubMove(idx, ziel, S(), S("Ziel Spieler"), () => 0, "schwer"), "Klein");
});

test("der Bot nennt nur erlaubte Spieler", () => {
  const sack = P("Sackgasse Ist", 1990, 90), gut = P("Gut Ist", 1991, 90);
  const idx = idxAus([[sack, "Alpha"], [gut, "Alpha", "Beta"]]);
  assert.equal(botPlayerMove(idx, "Alpha", S("Alpha"), S(), () => 0, "mittel").n, "Gut Ist");
});

test("der Bot gibt null zurück, wenn er nichts weiß — dann verliert er ein Leben", () => {
  const unbek = P("Unbekannt Ist", 1990, 3);
  const idx = idxAus([[unbek, "Alpha", "Beta"]]);
  assert.equal(botPlayerMove(idx, "Alpha", S("Alpha"), S(), () => 0, "leicht"), null);
  assert.ok(botPlayerMove(idx, "Alpha", S("Alpha"), S(), () => 0, "schwer"), "der schwere Bot kennt ihn");
});

test("die Bot-Stufen sind nach Wissen gestaffelt", () => {
  const sl = BOT_LEVELS.map((l) => l.minSl);
  assert.deepEqual([...sl].sort((a, b) => b - a), sl, "leicht weiß am wenigsten");
  assert.equal(botLevel("gibtsnicht").key, "mittel", "unbekannte Stufe fällt auf mittel zurück");
});

test("carouselHint nennt bei Spielern den bekanntesten Ausweg", () => {
  const klein = P("Klein Ist", 1990, 10), gross = P("Gross Ist", 1991, 90);
  const idx = idxAus([[klein, "Alpha", "Beta"], [gross, "Alpha", "Gamma"]]);
  assert.equal(carouselHint(idx, "player", "Alpha", S("Alpha"), S()).player.n, "Gross Ist");
  assert.equal(carouselHint(idx, "club", klein, S("Alpha"), S()).club, "Beta");
  assert.equal(carouselHint(idx, "player", "Alpha", S("Alpha"), S("Klein Ist", "Gross Ist")), null);
});

test("burnedOf trennt Vereine und Spieler", () => {
  let s = initCarousel(0);
  s = addMove(s, "player", "Messi");
  s = addMove(s, "club", "FC Barcelona");
  s = addMove(s, "player", "Xavi");
  const { clubs, players } = burnedOf(s);
  assert.deepEqual([...clubs], ["FC Barcelona"]);
  assert.deepEqual([...players], ["Messi", "Xavi"]);
});

test("currentKind und currentOwner folgen der Zugnummer", () => {
  let s = initCarousel(0);
  assert.equal(currentKind(s), "player");
  assert.equal(currentOwner(s), 0);
  s = addMove(s, "player", "Messi");
  assert.equal(currentKind(s), "club");
  assert.equal(currentOwner(s), 1, "der Gegner nennt den Verein");
  s = addMove(s, "club", "FC Barcelona");
  assert.equal(currentOwner(s), 1, "und danach auch gleich den nächsten Spieler");
});

/* Owner-Regel: „Immer wenn ein Leben verloren wurde, wechselt die Startreihenfolge." */
test("ein verlorenes Leben beendet die Runde und dreht die Eröffnung", () => {
  let s = initCarousel(0);
  s = addMove(s, "player", "Messi");
  s = addMove(s, "club", "FC Barcelona");
  s = loseLife(s, 1, "time");
  assert.deepEqual(s.lives, [CAROUSEL_LIVES, CAROUSEL_LIVES - 1]);
  assert.equal(s.starter, 1, "jetzt eröffnet der andere");
  assert.equal(s.round, 2);
  assert.deepEqual(s.moves, [], "die Kette startet neu");
  assert.equal(s.over, null);
  assert.equal(s.lastRound.laenge, 2, "die gespielte Kette bleibt für die Auflösung erhalten");
});

test("verbrannte Vereine gelten nur innerhalb einer Runde", () => {
  let s = initCarousel(0);
  s = addMove(s, "player", "Messi");
  s = addMove(s, "club", "FC Barcelona");
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

test("die Revanche startet leer und führt die wechselnde Eröffnung fort", () => {
  let s = initCarousel(0);
  for (let i = 0; i < 3; i++) s = loseLife(s, 1, "time");
  assert.deepEqual(s.over, { loser: 1, winner: 0 }, "Ausgangslage: Partie entschieden");
  const neu = rematchState(s);
  assert.deepEqual(neu.lives, [CAROUSEL_LIVES, CAROUSEL_LIVES], "beide starten wieder mit vollen Leben");
  assert.deepEqual(neu.moves, []);
  assert.equal(neu.round, 1);
  assert.equal(neu.over, null);
  assert.equal(neu.starter, 1, "nicht wieder derselbe Eröffner wie in der letzten Runde");
  assert.equal(neu.starter, s.starter, "die Reihenfolge läuft über die Partie hinaus weiter");
});

test("die Revanche funktioniert auch ohne verwertbaren Vorzustand", () => {
  assert.equal(rematchState(null).starter, 0, "z. B. nach einem Abbruch vor dem ersten Zug");
});
