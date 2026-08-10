import { test } from "node:test";
import assert from "node:assert/strict";
import { createCareerIndex } from "./careerIndex.js";

const P = (n, by, clubs = [], sl = 50) => ({ n, ln: n.split(" ").pop(), by, nat: [], clubs, sl });

/* Der Index ist die Antwort auf die Meldung, dass „1. FC Nürnberg" und „Galatasaray"
   fehlten: Vereine sind hier NAMEN aus der vollen Karriere, nicht nur die 47
   Spielvereine mit Wappen. */
test("Karrierevereine und Spielvereine landen zusammen beim Spieler", () => {
  const gundo = P("İlkay Gündoğan", 1990, ["BVB", "MCI", "BAR"]);
  const idx = createCareerIndex([gundo], ["1. FC Nürnberg", "Galatasaray Istanbul"], {
    [`ilkay gundogan|1990`]: [0, 1],
  });
  const c = idx.clubsOf(gundo);
  assert.ok(c.includes("1. FC Nürnberg"), "Nürnberg fehlt");
  assert.ok(c.includes("Galatasaray Istanbul"), "Galatasaray fehlt");
  assert.ok(c.includes("Borussia Dortmund"), "der kuratierte Spielverein muss bleiben");
  assert.equal(c.length, 5);
});

/* Ohne Karrieredaten darf ein Spieler nicht unspielbar werden — die kuratierten 47
   Vereine (Salzburg, Matthäus, die Wikipedia-Kader) gelten immer. */
test("ein Spieler ohne Karrieredaten behält seine Spielvereine", () => {
  const p = P("Lothar Matthäus", 1961, ["BMG", "FCB", "INT"]);
  const idx = createCareerIndex([p], [], {});
  assert.deepEqual(idx.clubsOf(p), ["Borussia Mönchengladbach", "FC Bayern München", "Inter Mailand"]);
});

test("derselbe Verein wird nicht doppelt geführt", () => {
  const p = P("Test Spieler", 1990, ["FCB"]);
  const idx = createCareerIndex([p], ["FC Bayern München"], { "test spieler|1990": [0] });
  assert.deepEqual(idx.clubsOf(p), ["FC Bayern München"]);
  assert.equal(idx.playersOf("FC Bayern München").length, 1, "auch die Rückrichtung bleibt einfach");
});

test("die Rückrichtung liefert alle Spieler eines Vereins", () => {
  const a = P("A B", 1990, []), b = P("C D", 1991, []);
  const idx = createCareerIndex([a, b], ["1. FC Nürnberg"], { "a b|1990": [0], "c d|1991": [0] });
  assert.deepEqual(idx.playersOf("1. FC Nürnberg").map((p) => p.n), ["A B", "C D"]);
  assert.deepEqual(idx.playersOf("Gibt es nicht"), []);
});

test("Namensvettern werden über das Geburtsjahr getrennt", () => {
  const jung = P("Michael Owen", 1979, []), alt = P("Michael Owen", 1976, []);
  const idx = createCareerIndex([jung, alt], ["Stoke City"], { "michael owen|1979": [0] });
  assert.deepEqual(idx.clubsOf(jung), ["Stoke City"]);
  assert.deepEqual(idx.clubsOf(alt), [], "der andere Owen bleibt leer");
});

test("match erkennt Vollnamen, Kürzel und Kurzformen", () => {
  const idx = createCareerIndex([P("X Y", 1990, ["FCB"])], ["1. FC Nürnberg"], { "x y|1990": [0] });
  assert.equal(idx.match("FC Bayern München"), "FC Bayern München");
  assert.equal(idx.match("FCB"), "FC Bayern München");
  assert.equal(idx.match("bayern"), "FC Bayern München");
  assert.equal(idx.match("1. FC Nürnberg"), "1. FC Nürnberg");
  assert.equal(idx.match("1. fc nurnberg"), "1. FC Nürnberg", "ohne Umlaut getippt");
});

test("match lehnt Unbekanntes ab, statt irgendetwas zu treffen", () => {
  const idx = createCareerIndex([P("X Y", 1990, ["FCB"])], [], {});
  for (const x of ["", "   ", "Hansa Rostock", "Bayern2"]) assert.equal(idx.match(x), null, `„${x}"`);
});

/* Kürzel und Kurzformen gelten nur für Vereine, die im Index stehen. Sonst gäbe
   match() einen Verein zurück, zu dem playersOf() leer ist — und der Zug liefe ins
   Leere statt abgelehnt zu werden. */
test("Kurzformen greifen nur für Vereine mit Spielern im Index", () => {
  const idx = createCareerIndex([P("X Y", 1990, ["BVB"])], [], {});
  assert.equal(idx.match("dortmund"), "Borussia Dortmund", "steht im Index");
  assert.equal(idx.match("bayern"), null, "kein Spieler im Index — darf nicht treffen");
  assert.equal(idx.match("FCB"), null);
});

test("keyOf liefert nur für die 47 Spielvereine ein Kürzel", () => {
  const idx = createCareerIndex([P("X Y", 1990, ["FCB"])], ["1. FC Nürnberg"], { "x y|1990": [0] });
  assert.equal(idx.keyOf("FC Bayern München"), "FCB", "hat ein Wappen");
  assert.equal(idx.keyOf("1. FC Nürnberg"), null, "wird als schlichtes Namensfeld gezeigt");
});

test("suggest schlägt beim Tippen vor und bevorzugt kurze Namen", () => {
  const p = P("X Y", 1990, []);
  const idx = createCareerIndex([p], ["Inter Mailand", "Internacional Porto Alegre", "1. FC Nürnberg"],
    { "x y|1990": [0, 1, 2] });
  const s = idx.suggest("inter");
  assert.equal(s[0], "Inter Mailand", "der kürzere Treffer zuerst");
  assert.ok(s.includes("Internacional Porto Alegre"));
  assert.deepEqual(idx.suggest("n"), [], "ein einzelner Buchstabe schlägt nichts vor");
});

test("alleVereine enthält Karriere- und Spielvereine zusammen", () => {
  const idx = createCareerIndex([P("X Y", 1990, ["FCB", "BVB"])], ["1. FC Nürnberg"], { "x y|1990": [0] });
  assert.deepEqual(idx.alleVereine, ["1. FC Nürnberg", "Borussia Dortmund", "FC Bayern München"]);
});

/* Ein Index ohne Karrieredatei muss funktionieren — die Datei wird faul geladen und
   kann beim ersten Rendern noch fehlen. */
test("der Index funktioniert auch ganz ohne Karrieredatei", () => {
  const p = P("X Y", 1990, ["FCB"]);
  const idx = createCareerIndex([p]);
  assert.deepEqual(idx.clubsOf(p), ["FC Bayern München"]);
  assert.equal(idx.match("bayern"), "FC Bayern München");
});

/* Bei 8158 Vereinen kann keine Kurzformen-Tabelle mehr alles abdecken. Im Spiel tippt
   niemand „1. FC Nürnberg" — man tippt „Nürnberg". Mehrdeutigkeit entscheidet die
   Bekanntheit, gemessen an der Zahl der Spieler im Index. */
test("match trifft auch über den Wortanfang", () => {
  const p = P("X Y", 1990, []);
  const idx = createCareerIndex([p], ["1. FC Nürnberg", "Galatasaray Istanbul"], { "x y|1990": [0, 1] });
  assert.equal(idx.match("Nürnberg"), "1. FC Nürnberg");
  assert.equal(idx.match("nurnberg"), "1. FC Nürnberg", "ohne Umlaut getippt");
  assert.equal(idx.match("Galatasaray"), "Galatasaray Istanbul");
});

test("bei Mehrdeutigkeit gewinnt der deutlich bekanntere Verein", () => {
  const gross = Array.from({ length: 12 }, (_, i) => P(`Gross ${i}`, 1990 + i, []));
  const klein = [P("Klein Eins", 1970, []), P("Klein Zwei", 1971, [])];
  const byKey = {};
  for (const p of gross) byKey[`${p.n.toLowerCase()}|${p.by}`] = [0];
  for (const p of klein) byKey[`${p.n.toLowerCase()}|${p.by}`] = [1];
  const idx = createCareerIndex([...gross, ...klein], ["1. FC Nürnberg", "Post SV Nürnberg"], byKey);
  assert.equal(idx.match("Nürnberg"), "1. FC Nürnberg", "12 Spieler gegen 2 — eindeutig genug");
  assert.equal(idx.suggest("nürnberg")[0], "1. FC Nürnberg", "und steht auch im Vorschlag oben");
});

test("bei ähnlich großen Vereinen lehnt match ab, statt zu raten", () => {
  const a = [P("A Eins", 1990, []), P("A Zwei", 1991, [])];
  const b = [P("B Eins", 1992, []), P("B Zwei", 1993, [])];
  const byKey = {};
  for (const p of a) byKey[`${p.n.toLowerCase()}|${p.by}`] = [0];
  for (const p of b) byKey[`${p.n.toLowerCase()}|${p.by}`] = [1];
  const idx = createCareerIndex([...a, ...b], ["Rapid Wien", "Rapid Bukarest"], byKey);
  assert.equal(idx.match("Rapid"), null, "hier muss die Vorschlagsliste entscheiden");
  assert.equal(idx.suggest("rapid").length, 2, "beide werden vorgeschlagen");
});

test("der exakte Name sticht die Bekanntheit", () => {
  const gross = Array.from({ length: 9 }, (_, i) => P(`G ${i}`, 1990 + i, []));
  const byKey = {};
  for (const p of gross) byKey[`${p.n.toLowerCase()}|${p.by}`] = [0];
  byKey["g 0|1990"] = [0, 1];
  const idx = createCareerIndex(gross, ["1. FC Nürnberg", "Nürnberg"], byKey);
  assert.equal(idx.match("Nürnberg"), "Nürnberg", "wer den Verein exakt nennt, meint ihn auch");
});
