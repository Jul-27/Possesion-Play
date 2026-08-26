/* Die eine Stelle, an der ein Spielerdatensatz nach players.js geschrieben wird.

   WARUM ZENTRAL: Diese Funktion stand fünfzehnmal wortgleich in der Pipeline — in
   jedem Skript, das players.js neu schreibt. Solange sich die Felder nie änderten,
   fiel das nicht auf. Beim Feld `pp` (genaue Positionen) wäre es sofort aufgefallen,
   und zwar auf die unangenehme Art: Der Positionslauf hätte es geschrieben, und der
   nächste beliebige Lauf — Titel, Namen, Kader — hätte es stillschweigend wieder
   gelöscht, weil seine eigene Kopie das Feld nicht kennt.

   REIHENFOLGE UND WEGLASSREGEL sind Teil des Vertrags: Felder erscheinen immer in
   derselben Folge, und leere werden weggelassen. Beides hält den Diff eines
   Datenlaufs auf das beschränkt, was sich wirklich geändert hat. */

export function recToString(r) {
  let s = `{"n": ${JSON.stringify(r.n)}, "ln": ${JSON.stringify(r.ln)}, "by": ${r.by}`
    + `, "nat": ${JSON.stringify(r.nat)}, "clubs": ${JSON.stringify(r.clubs)}`;
  if (r.t && r.t.length) s += `, "t": ${JSON.stringify(r.t)}`;
  if (r.sl) s += `, "sl": ${r.sl}`;
  if (r.pos) s += `, "pos": ${JSON.stringify(r.pos)}`;
  /* `pp` = genaue Positionen (siehe src/positions.js). Steht bewusst NEBEN `pos`,
     nicht an dessen Stelle: die grobe Gruppe trägt alle Spieler, zu denen die
     Wikipedia schweigt — bei den wenig bekannten über drei Viertel. */
  if (r.pp && r.pp.length) s += `, "pp": ${JSON.stringify(r.pp)}`;
  if (r.cp && r.cp.length) s += `, "cp": ${JSON.stringify(r.cp)}`;
  if (r.lg && r.lg.length) s += `, "lg": ${JSON.stringify(r.lg)}`;
  if (r.span && r.span.length) s += `, "span": ${JSON.stringify(r.span)}`;
  return s + "}";
}

/** Alle Felder, die ein Datensatz tragen kann — für Prüfungen und Tests. */
export const FELDER = ["n", "ln", "by", "nat", "clubs", "t", "sl", "pos", "pp", "cp", "lg", "span"];
