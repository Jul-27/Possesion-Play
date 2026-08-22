/* Lädt die aktuellen Kader erst beim Start von „Steckbrief" — wie playersStore und
   careerPathStore. Ohne die Datei ist der Modus nicht spielbar (anders als beim
   Karriere-Pfad gibt es keinen Ersatz in players.js: Rückennummer und genaue
   Nationalität stehen nirgends sonst), deshalb liefert der Fehlerfall null und die
   Ansicht sagt das offen, statt ein halbes Spiel anzubieten. */
let cache = null;

export function loadSquads() {
  if (!cache) {
    cache = import("./squads.js")
      .then((m) => ({
        stand: m.SQUAD_STAND || null,
        clubs: m.SQUAD_CLUBS || [],
        nationen: m.SQUAD_NATIONS || [],
        spieler: m.SQUAD_PLAYERS || [],
      }))
      .catch(() => null);
  }
  return cache;
}
