import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/* Flaggen auf Windows (27.10.2026): Länderflaggen sind Emoji-Zeichen, und Windows
   zeichnet sie nicht — dort stand „DE" statt 🇩🇪. main.jsx meldet auf solchen Geräten
   eine Flaggenschrift an; wirken kann sie nur in Elementen mit der Klasse „flagge".
   Diese Prüfung hält beides zusammen, ohne Browser. */

const lies = (datei) => readFileSync(new URL(datei, import.meta.url), "utf8");

test("main.jsx meldet die Flaggenschrift an — selbst ausgeliefert, nicht vom fremden Server", () => {
  const main = lies("./main.jsx");
  assert.match(main, /polyfillCountryFlagEmojis\("Twemoji Country Flags", flaggenSchrift\)/);
  assert.match(main, /TwemojiCountryFlags\.woff2\?url/);
});

test(".flagge nennt die Flaggenschrift zuerst", () => {
  const css = lies("./styles.css");
  const regel = css.match(/\.flagge \{[^}]*\}/);
  assert.ok(regel, ".flagge fehlt in styles.css");
  assert.match(regel[0], /font-family: "Twemoji Country Flags",/);
});

test("Karriere: jede Flagge steht in einem .flagge-Element", () => {
  const src = lies("./Karriere.jsx");
  // landFlagge wird nur noch in der Flagge-Komponente aufgerufen …
  const aufrufe = [...src.matchAll(/landFlagge\(/g)].length;
  assert.equal(aufrufe, 1, "landFlagge nur in <Flagge> — sonst fehlt die Schrift");
  assert.match(src, /const Flagge = \(\{ land, className = "" \}\) => <span className=\{\("flagge " \+ className\)\.trim\(\)\}>\{landFlagge\(land\)\}<\/span>;/);
  // … und die Länderliste trägt die Klasse selbst.
  assert.match(src, /<span className="flagge kaLandFlagge">\{l\.flagge\}<\/span>/);
  assert.doesNotMatch(src, /flaggeVon\((?!EIGENE\[code\] \|\| code\))/, "flaggeVon direkt aufgerufen");
});
