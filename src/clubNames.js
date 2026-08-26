/* Ein Verein, ein Name — die Auflösung von Schreibvarianten auf unsere 47 Spielvereine.

   DAS PROBLEM: Unsere Vereine heißen im Spiel so, wie sie auf den Hexfeldern stehen
   („Liverpool", „Arsenal", „AC Mailand"). Wikidata nennt dieselben Vereine anders
   („FC Liverpool", „FC Arsenal", „AC Milan"). Beide Namen kommen in den generierten
   Karrieredateien vor, und beide meinen denselben Verein. Das hatte zwei sichtbare
   Folgen:

   1. KEIN WAPPEN IM KARRIERE-PFAD. careerPathClubs.js führt ausschließlich die
      Wikidata-Schreibweise. Gerrards Liverpool, Lampards Chelsea, Pirlos Milan und
      Juventus, Rooneys Everton — allesamt ohne Wappen, weil der Name nicht zum
      Spielverein aufgelöst werden konnte.
   2. DIE VERBRANNTE-VEREINE-REGEL DES KARUSSELLS WAR AUSHEBELBAR. Wer „Arsenal"
      genannt hatte, konnte danach „FC Arsenal" nennen — für das Spiel zwei Vereine.
      4.119 Spieler tragen zwei Formen desselben Vereins.

   DIE TABELLE ist nicht geraten: Jede Zeile ist ein deutsches Label oder ein Alias
   der jeweiligen Wikidata-Entität, und jede kommt in unseren Dateien tatsächlich vor.
   Von 47 Vereinen betrifft es elf.

   NICHT AUFGENOMMEN wurde „Salzburg" (Alias von Q994811). Der Name steht bei genau
   EINEM Spieler, und unsere Vereinsliste kennt sieben Salzburger Vereine — darunter
   SV Austria Salzburg. Bei dieser Ausgangslage ist eine Lücke besser als eine
   womöglich falsche Zusammenlegung. */
import { CLUBS, norm } from "./gameData.js";

/** Alternativschreibweise -> Spielverein-Kürzel. Der Kommentar nennt den Beleg. */
export const VEREINS_ALIASE = {
  "AFC Ajax":               "AJA",  // Ajax Amsterdam · Q81888
  "FC Arsenal":             "ARS",  // Arsenal · Q9617
  "FC Chelsea":             "CHE",  // Chelsea · Q9616
  "FC Everton":             "EVE",  // Everton · Q5794
  "Juventus Turin":         "JUV",  // Juventus · Q1422
  "Olympique Lillois":      "LIL",  // OSC Lille · Q19516
  "FC Liverpool":           "LIV",  // Liverpool · Q1130849
  "AC Milan":               "MIL",  // AC Mailand · Q1543
  "Olympique de Marseille": "OM",   // Olympique Marseille · Q132885
  "A.S. Roma":              "ROM",  // AS Rom · Q2739
};

const KEY_VON_NAME = new Map([
  ...CLUBS.map((c) => [norm(c.name), c.key]),
  ...Object.entries(VEREINS_ALIASE).map(([alias, key]) => [norm(alias), key]),
]);
const NAME_VON_KEY = new Map(CLUBS.map((c) => [c.key, c.name]));

/** Vereinsname -> Kürzel eines Spielvereins, oder null. Kennt die Alternativnamen. */
export const clubKeyFuer = (name) => KEY_VON_NAME.get(norm(String(name || ""))) || null;

/**
 * Der Name, unter dem ein Verein im Spiel erscheint.
 * „FC Liverpool" -> „Liverpool". Alles Unbekannte bleibt, wie es ist — die 8.435
 * Karrierevereine sollen nicht durch diese Tabelle laufen müssen.
 */
export function kanonischerVereinsname(name) {
  const key = clubKeyFuer(name);
  return key ? NAME_VON_KEY.get(key) || name : name;
}
