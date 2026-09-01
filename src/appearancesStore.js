/* Lädt die Einsatzzahlen erst beim Start der Traumelf — wie playersStore und
   careerPathStore. 235 KB gehören nicht ins Hauptbündel, das jeder Modus mitlädt.

   Schlägt der Nachladen fehl, liefert die Funktion null. Das ist KEIN Fehlerfall,
   den die Ansicht behandeln müsste: `baueKlassen` behandelt fehlende Einsätze
   ohnehin neutral, weil Wikidata sie auch bei vorhandener Datei nur für 69 % der
   Stationen führt. Ohne die Datei fällt lediglich die Verfeinerung weg, mit der ein
   Stammspieler von einem Gast unterschieden wird — der Jahresanteil aus `cp` bleibt. */
let cache = null;

export function loadAppearances() {
  if (!cache) {
    cache = import("./appearances.js").then((m) => m.EINSAETZE || null).catch(() => null);
  }
  return cache;
}
