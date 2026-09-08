import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

/* WOFÜR DIESE PRÜFUNG DA IST
   Der Karriere-Modus wurde einmal komplett ungestaltet ausgeliefert: Alle 23
   Klassennamen, die seine Ansicht benutzte, gab es in styles.css nicht — nicht
   einmal den Rahmen. Aufgefallen ist es erst beim Hinsehen im Browser, und das war
   Zufall: Ein falscher Klassenname wirft keinen Fehler, er tut einfach nichts.

   Dieselbe Falle steht bei den Symbolen: `<Icon name="home">` zeichnet nichts,
   wenn das Symbol „home" heißt und in Icons.jsx „leave" steht. Auch das war schon
   in der Karriere-Kopfzeile, dreimal.

   Beides prüft diese Datei — statisch aus dem Quelltext, ohne Browser. */

const SRC = new URL("./", import.meta.url);
const lies = (datei) => readFileSync(new URL(datei, SRC), "utf8");
const jsxDateien = readdirSync(SRC).filter((f) => f.endsWith(".jsx"));

/* Klassen, die absichtlich ohne Gestaltung auskommen. Jede braucht einen Grund. */
const OHNE_GESTALTUNG_ERLAUBT = new Set([
  "gcorner",  // leere Ecke eines Rasterlayouts: belegt nur eine Zelle
  "remis",    // Sieg ist gruen, Niederlage rot, das Unentschieden bewusst neutral
]);

/** Alle Klassennamen, die als Zeichenkette in einem className stehen. */
export function klassenAus(text) {
  const out = new Set();
  const re = /className=/g;
  let m;
  while ((m = re.exec(text))) {
    let i = m.index + m[0].length;
    let wert = null;
    if (text[i] === '"') {
      const ende = text.indexOf('"', i + 1);
      wert = ende < 0 ? "" : text.slice(i + 1, ende);
      /* Ein reiner Zeichenketten-Wert wird direkt zerlegt. */
      for (const c of wert.split(/\s+/).filter(Boolean)) out.add(c);
      continue;
    }
    if (text[i] !== "{") continue;
    /* Ein Ausdruck: geschweifte Klammern zählen, dann alle Zeichenketten darin
       einsammeln — `"kaOption" + (an ? " an" : "")` enthält zwei. */
    let tiefe = 0, j = i;
    for (; j < text.length; j++) {
      if (text[j] === "{") tiefe++;
      else if (text[j] === "}") { tiefe--; if (tiefe === 0) break; }
    }
    wert = text.slice(i + 1, j);
    /* EINGESETZTE AUSDRÜCKE ZUERST HERAUSLÖSEN. Ohne das zerfällt
       `clock ${low ? "low" : ""}` an den Anführungszeichen im Inneren, und die
       Prüfung hielt „${low", „?" und „}" für Klassennamen. Beide Teile werden
       getrennt gelesen: der Schablonentext und der Ausdruck darin. */
    const eingesetzt = [...wert.matchAll(/\$\{([^{}]*)\}/g)].map((m) => m[1]);
    const rumpf = wert.replace(/\$\{[^{}]*\}/g, " ");
    for (const stueck of [rumpf, ...eingesetzt]) {
      /* VERGLEICHSWERTE SIND KEINE KLASSEN. In `${art === "tag" ? "on" : ""}` ist
         „on" eine Klasse, „tag" aber der Wert, mit dem verglichen wird. Ohne diese
         Zeile meldete die Prüfung acht Fehlalarme quer durch vier Modi — und eine
         Prüfung, die falschen Alarm schlägt, wird abgeschaltet statt befolgt. */
      const ohneVergleich = stueck
        .replace(/(?:===|!==|==|!=)\s*(["'`])[^"'`]*\1/g, " ")
        .replace(/(["'`])[^"'`]*\1\s*(?:===|!==|==|!=)/g, " ");
      for (const s of ohneVergleich.matchAll(/["'`]([^"'`]*)["'`]/g))
        for (const c of s[1].split(/\s+/).filter(Boolean)) out.add(c);
    }
  }
  return out;
}

/** Alle Symbolnamen, die als Zeichenkette an <Icon name=…> stehen. */
export function symbolnamenAus(text) {
  const out = new Set();
  for (const m of text.matchAll(/<Icon\s[^>]*?name=(?:"([^"]*)"|\{([^}]*)\})/g)) {
    if (m[1]) { out.add(m[1]); continue; }
    for (const s of (m[2] || "").matchAll(/"([^"]*)"/g)) out.add(s[1]);
  }
  return out;
}

test("jede benutzte CSS-Klasse ist auch gestaltet", () => {
  const css = lies("styles.css");
  const gestaltet = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
  const fehlend = [];
  for (const datei of jsxDateien) {
    for (const c of klassenAus(lies(datei)))
      if (!gestaltet.has(c) && !OHNE_GESTALTUNG_ERLAUBT.has(c)) fehlend.push(`${datei}: .${c}`);
  }
  assert.deepEqual(fehlend, [], "Klassen ohne Gestaltung — sie tun nichts, ohne dass es auffällt");
});

test("jedes benutzte Symbol gibt es auch", () => {
  const icons = lies("Icons.jsx");
  /* Die Symbole stehen als Schlüssel eines Objektliterals. Großzügig gelesen: Ein
     zu viel erkannter Name macht die Prüfung nur nachsichtiger, nie falsch streng. */
  const bekannt = new Set([...icons.matchAll(/^\s{2,}(\w+):/gm)].map((m) => m[1]));
  assert.ok(bekannt.size > 20, `nur ${bekannt.size} Symbole erkannt — Leseregel prüfen`);
  const fehlend = [];
  for (const datei of jsxDateien) {
    if (datei === "Icons.jsx") continue;
    for (const n of symbolnamenAus(lies(datei)))
      if (!bekannt.has(n)) fehlend.push(`${datei}: <Icon name="${n}">`);
  }
  assert.deepEqual(fehlend, [], "Symbole, die es nicht gibt — sie zeichnen nichts");
});

/* Die Leseregeln selbst prüfen: Wäre der Auszug kaputt, fände die Prüfung oben
   nichts mehr und wäre still wertlos — genau der Fehler, den sie verhindern soll. */
test("die Leseregeln finden, was sie finden sollen", () => {
  const beispiel = `
    <div className="panel kaAnlage" />
    <button className={"kaPos" + (an ? " an" : "")} />
    <span className={\`clock \${low ? "low" : ""}\`} />
    <button className={\`chip \${art === "tag" ? "on" : ""}\`} />
    <Icon name="leave" size={18} />
    <Icon name={muted ? "mute" : "sound"} />`;
  assert.deepEqual([...klassenAus(beispiel)].sort(),
    ["an", "chip", "clock", "kaAnlage", "kaPos", "low", "on", "panel"],
    'tag ist ein Vergleichswert und darf nicht als Klasse gelten');
  assert.deepEqual([...symbolnamenAus(beispiel)].sort(), ["leave", "mute", "sound"]);
});
