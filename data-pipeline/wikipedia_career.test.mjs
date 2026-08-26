import { test } from "node:test";
import assert from "node:assert/strict";
import { geburtsjahr, istNebenteam, istNationalteam, stationenAusInfobox } from "./wikipedia_career.mjs";

/* Der Feldname schwankt zwischen den Infoboxen. Solange nur `geburtsdatum` geprüft
   wurde, fielen 7 % der Spieler durch die Jahresprüfung des Positionslaufs — nicht
   weil das Jahr fehlte, sondern weil das Feld `geburtstag` heißt. */
test("geburtsjahr kennt beide Feldnamen und die Vorlage", () => {
  assert.equal(geburtsjahr("| geburtstag = 3. Mai 1990"), 1990);
  assert.equal(geburtsjahr("| geburtsdatum = 12. Januar 1985"), 1985);
  assert.equal(geburtsjahr("{{Geburtsdatum|1978|4|2}}"), 1978);
  assert.equal(geburtsjahr("| geburtstag = 27.03.1986"), 1986);
});

test("geburtsjahr liefert null statt einer beliebigen Zahl", () => {
  assert.equal(geburtsjahr("| geburtstag ="), null, "leeres Feld");
  assert.equal(geburtsjahr("| geburtsort = Berlin"), null);
  assert.equal(geburtsjahr(""), null);
  assert.equal(geburtsjahr(null), null);
  assert.equal(geburtsjahr("| geburtstag = 3. Mai 90"), null, "zweistellig ist kein Jahr");
});

test("Neben- und Nationalteams werden erkannt", () => {
  for (const n of ["SC Freiburg II", "FC Bayern München II", "VfB Stuttgart Amateure", "TSG U19"]) {
    assert.equal(istNebenteam(n), true, n);
  }
  assert.equal(istNebenteam("Hamburger SV"), false);
  assert.equal(istNationalteam("Deutsche Nationalmannschaft"), true);
  assert.equal(istNationalteam("SK Rapid Wien"), false);
});

/* Der Vereinsname kommt aus dem ANZEIGEnamen des Wikilinks, nicht aus dem
   Artikeltitel: „[[Hamburger SV#Zweite Mannschaft|Hamburger SV II]]" ist die zweite
   Mannschaft und liefe sonst als Profistation durch. */
test("stationenAusInfobox liest den Anzeigenamen, nicht den Artikel", () => {
  const box = "| vereine_tabelle =\n"
    + "{{Team-Station|2018–2020|[[Hamburger SV#Zweite Mannschaft|Hamburger SV II]]}}\n"
    + "{{Team-Station|2020–|[[Hamburger SV]]}}\n"
    + "| nationalmannschaft_tabelle =\n";
  assert.deepEqual(stationenAusInfobox(box).map((s) => s.name), ["Hamburger SV II", "Hamburger SV"]);
});

/* Häufige Namen führen zu einer Begriffsklärungsseite statt zum Spieler. Die
   Geburtsjahrprüfung fängt das richtig ab, aber ohne zweiten Anlauf verlöre der
   Positionslauf rund 9 % des Rätselpools. */
test("bkAufloesen findet die Variante mit unserem Geburtsjahr", async () => {
  const { bkAufloesen } = await import("./wikipedia_positions.mjs");
  const seite = `<onlyinclude>* [[Bruno Fernandes de Souza]] (* 1984), brasilianischer Fußballspieler
* [[Bruno Fernandes (Fußballspieler, 1974)]] (* 1974), portugiesischer Fußballspieler
* [[Bruno Fernandes (Fußballspieler, 1994)]] (* 1994), portugiesischer Fußballspieler
* [[Bruno Fernandes (Politiker)]] (* 1994), brasilianischer Politiker
</onlyinclude>{{Begriffsklärung}}`;
  assert.equal(bkAufloesen(seite, 1994), "Bruno Fernandes (Fußballspieler, 1994)", "der Politiker zählt nicht");
  assert.equal(bkAufloesen(seite, 1974), "Bruno Fernandes (Fußballspieler, 1974)");
  assert.equal(bkAufloesen(seite, 1999), null, "kein Treffer ist besser als der falsche");
  assert.equal(bkAufloesen("{{Infobox Fußballspieler}}\n| geburtstag = 1990", 1990), null, "keine BK-Seite");
});

test("bkAufloesen nimmt nichts, wenn zwei Fußballer dasselbe Jahr haben", async () => {
  const { bkAufloesen } = await import("./wikipedia_positions.mjs");
  const seite = `{{Begriffsklärung}}
* [[Max Mustermann (Fußballspieler, Deutschland)]] (* 1990), deutscher Fußballspieler
* [[Max Mustermann (Fußballspieler, Österreich)]] (* 1990), österreichischer Fußballspieler`;
  assert.equal(bkAufloesen(seite, 1990), null, "echt mehrdeutig — dann lieber gar nichts");
});
