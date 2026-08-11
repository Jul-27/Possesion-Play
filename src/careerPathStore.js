/* Lädt die datierten Karrierestationen erst beim Start des Modus — wie
   playersStore und careerClubsStore. Schlägt das fehl, fällt careerPath.js auf das
   cp-Feld mit den 47 Spielvereinen zurück und der Modus bleibt spielbar. */
let cache = null;

export function loadCareerPath() {
  if (!cache) {
    cache = import("./careerPathClubs.js")
      .then((m) => ({ clubs: m.CAREER_PATH_CLUBS || [], byKey: m.CAREER_PATH_BY_KEY || {} }))
      .catch(() => null);
  }
  return cache;
}
