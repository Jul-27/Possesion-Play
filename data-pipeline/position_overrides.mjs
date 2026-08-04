/* Kuratierte Positionen für Spieler, die Wikidata ohne P413 führt.
   Schlüssel: `norm(name)|geburtsjahr` — derselbe Schlüssel wie überall in der Pipeline.
   Wert: "TW" | "ABW" | "MF" | "ST".

   Regel wie bei HONOUR_OVERRIDES: hier steht ausschließlich, was vom Owner bestätigt
   oder anderweitig belegt ist. Geraten wird nichts — ein Spieler ohne Position taucht
   in „Elf des Tages" schlicht nicht auf, und das ist deutlich besser als ein Torwart
   im Sturm. backfill_positions.mjs meldet am Ende, welche bekannten Spieler noch offen
   sind; von dort wandern bestätigte Fälle hier herein. */
export const POSITION_OVERRIDES = {
  /* Michael Owen: Wikidata (Q128829) führt P413 = Q280658 „forward", nur steht dort
     1976-12-14 als Geburtsdatum. Tag und Monat stimmen, das Jahr ist falsch — er ist
     Jahrgang 1979. Der automatische Abgleich verlangt ein exakt passendes Jahr und
     lässt ihn deshalb liegen. Die Position selbst ist damit belegt, nicht geraten. */
  "michael owen|1979": "ST",

  // Vom Owner bestätigt; Wikidata führt bei diesen vieren gar kein P413.
  "dani carvajal|1992": "ABW",
  "henrikh mkhitaryan|1989": "MF",
  "darwin nunez|1999": "ST",
  "nicolas jackson|2001": "ST",
};
