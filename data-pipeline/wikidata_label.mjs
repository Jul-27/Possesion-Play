/*
 * wikidata_label.mjs — gemeinsame Label-Auflösung für alle Wikidata-Skripte.
 *
 * Hintergrund: `SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }`
 * liefert die QID als "Label" zurück, wenn kein englisches Label existiert. So
 * sind 43 Records der Form {"n":"Q113704154", …} in src/players.js gelandet.
 * Zwei Absicherungen:
 *   1) Sprach-Fallback-Kette statt nur "en"
 *   2) Labels der Form /^Q\d+$/ werden verworfen (nie als Name speichern)
 */

// Reihenfolge = Priorität. "mul" (sprachunabhängiges Label) am Ende als letzter Halt.
export const LABEL_LANGS = "en,de,es,fr,pt,it,nl,ca,eu,pl,sv,mul";

export const LABEL_SERVICE = `SERVICE wikibase:label { bd:serviceParam wikibase:language "${LABEL_LANGS}". }`;

/** true, wenn der Label-Service auf die QID zurückgefallen ist. */
export function isQidLabel(label) {
  return typeof label === "string" && /^Q\d+$/.test(label);
}

/** Name oder null — null heißt: kein brauchbares Label, Record überspringen. */
export function cleanName(label) {
  if (typeof label !== "string") return null;
  const s = label.trim();
  if (!s || isQidLabel(s)) return null;
  return s;
}
