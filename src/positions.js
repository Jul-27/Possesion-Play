/* Genaue Spielpositionen — das Vokabular, das Spiel und Pipeline teilen.

   BISHER kannte das Spiel vier Gruppen: Torwart, Abwehr, Mittelfeld, Sturm. Für die
   Hexfelder reicht das, für eine AUFSTELLUNG nicht — eine Elf ohne Innenverteidiger
   und Sechser ist keine Elf, sondern vier Haufen.

   WOHER DIE DATEN KOMMEN: aus dem Infobox-Feld „Position" der deutschen Wikipedia.
   Wikidatas P413 taugt dafür nicht — gemessen an allen 27.482 Spielern unserer
   Vereine: 82,4 % tragen dort nur eine der vier groben Gruppen, 11 % eine feine, und
   nur 3,7 % überhaupt mehr als eine Angabe. Die Wikipedia-Infobox liefert bei den
   ratbaren Spielern (sl ≥ 40) zu 93 % ein Positionsfeld, und bei den bekanntesten zu
   28 % mehrere Positionen.

   ADDITIV, NICHT ERSETZEND: `pos` (die grobe Gruppe) bleibt an jedem Spieler stehen.
   Die feinen Positionen kommen als `pp` dazu. Sonst verlören alle Spieler ohne
   Wikipedia-Artikel — bei sl < 20 über drei Viertel — ihre Hexfelder.

   Jede feine Position gehört zu genau einer groben Gruppe. Diese Zuordnung ist die
   Brücke: ein Innenverteidiger erfüllt das Hexfeld „Abwehr", ohne dass irgendwo eine
   zweite Liste gepflegt werden muss. */

export const POSITIONEN = [
  { key: "TW",  gruppe: "TW",  name: "Torwart",                kurz: "TW"  },

  { key: "IV",  gruppe: "ABW", name: "Innenverteidiger",       kurz: "IV"  },
  { key: "LV",  gruppe: "ABW", name: "Linksverteidiger",       kurz: "LV",  seite: "links"  },
  { key: "RV",  gruppe: "ABW", name: "Rechtsverteidiger",      kurz: "RV",  seite: "rechts" },
  { key: "AV",  gruppe: "ABW", name: "Außenverteidiger",       kurz: "AV",  offen: true },
  { key: "LIB", gruppe: "ABW", name: "Libero",                 kurz: "LIB" },

  { key: "DM",  gruppe: "MF",  name: "Defensives Mittelfeld",  kurz: "DM"  },
  { key: "ZM",  gruppe: "MF",  name: "Zentrales Mittelfeld",   kurz: "ZM"  },
  { key: "OM",  gruppe: "MF",  name: "Offensives Mittelfeld",  kurz: "OM"  },
  { key: "LM",  gruppe: "MF",  name: "Linkes Mittelfeld",      kurz: "LM",  seite: "links"  },
  { key: "RM",  gruppe: "MF",  name: "Rechtes Mittelfeld",     kurz: "RM",  seite: "rechts" },
  { key: "AM",  gruppe: "MF",  name: "Äußeres Mittelfeld",     kurz: "AM",  offen: true },

  { key: "LA",  gruppe: "ST",  name: "Linksaußen",             kurz: "LA",  seite: "links"  },
  { key: "RA",  gruppe: "ST",  name: "Rechtsaußen",            kurz: "RA",  seite: "rechts" },
  { key: "FL",  gruppe: "ST",  name: "Flügelstürmer",          kurz: "FL",  offen: true },
  { key: "HS",  gruppe: "ST",  name: "Hängende Spitze",        kurz: "HS"  },
  { key: "MS",  gruppe: "ST",  name: "Mittelstürmer",          kurz: "MS"  },
];

export const POS_BY_KEY = Object.fromEntries(POSITIONEN.map((p) => [p.key, p]));
export const posName = (key) => POS_BY_KEY[key]?.name || key;
export const posGruppe = (key) => POS_BY_KEY[key]?.gruppe || null;

/* `offen` heißt: die Seite ist unbekannt. „Außenverteidiger" ohne Zusatz deckt links
   UND rechts ab, weil die Quelle die Seite oft weglässt. Wer eine seitengenaue
   Position sucht, muss die offene Variante mitzählen — sonst fiele die Hälfte des
   Bestands durch, nur weil die Wikipedia sich nicht festgelegt hat. */
const OFFENE_ENTSPRECHUNG = { LV: "AV", RV: "AV", LM: "AM", RM: "AM", LA: "FL", RA: "FL" };

/**
 * Erfüllt ein Spieler eine gesuchte Position?
 *
 * @param pp       die feinen Positionen des Spielers (kann fehlen)
 * @param gesucht  Positionsschlüssel
 * @param grob     die grobe Gruppe des Spielers (`pos`) als Rückfall
 *
 * Ohne feine Angaben zählt die grobe Gruppe — ein Spieler, zu dem die Wikipedia
 * schweigt, soll nicht aus dem Spiel fallen. Er passt dann auf jede Position seiner
 * Gruppe. Das ist großzügig, aber die Alternative wäre, drei Viertel der weniger
 * bekannten Spieler auszusperren.
 */
export function passtAufPosition(pp, gesucht, grob = null) {
  const ziel = POS_BY_KEY[gesucht];
  if (!ziel) return false;
  const fein = Array.isArray(pp) ? pp : [];
  if (!fein.length) return grob === ziel.gruppe;
  if (fein.includes(gesucht)) return true;
  const offen = OFFENE_ENTSPRECHUNG[gesucht];
  return !!offen && fein.includes(offen);
}

/** Anzeigetext: „Innenverteidiger · Defensives Mittelfeld", sonst die grobe Gruppe. */
export function positionsText(pp, grobName = null) {
  const fein = (Array.isArray(pp) ? pp : []).map(posName).filter(Boolean);
  return fein.length ? fein.join(" · ") : grobName || "";
}
