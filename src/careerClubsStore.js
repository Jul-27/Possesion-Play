/* Lädt die Karrierevereine erst, wenn sie gebraucht werden — genau wie playersStore.
   Die Datei ist groß und nur für „Transferkarussell" nötig; im Hauptbundle würde sie
   jeden anderen Modus mitbelasten.

   Fehlschlag ist kein Grund abzubrechen: ohne Karrieredaten fällt das Karussell auf
   die 47 kuratierten Spielvereine zurück und bleibt spielbar, nur kleiner. */
let cache = null;

export function loadCareerClubs() {
  if (!cache) {
    cache = import("./careerClubs.js")
      .then((m) => ({ clubs: m.CAREER_CLUBS || [], byKey: m.CAREER_BY_KEY || {} }))
      .catch(() => ({ clubs: [], byKey: {} }));
  }
  return cache;
}
