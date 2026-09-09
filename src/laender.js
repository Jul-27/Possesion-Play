/* Länder für die Charaktererstellung — jedes, nicht nur die mit Liga.

   ── WARUM NICHT DIE VORHANDENEN FLAGGEN ─────────────────────────────────────
   gameData.js führt neunzehn Nationen mit GEZEICHNETEN Flaggen (Streifen, Kreuze,
   Sonderfälle für Portugal, Brasilien, die USA). Die sind schön, aber neunzehn sind
   nicht „jedes beliebige Land", und die übrigen zweihundert nachzuzeichnen wäre
   Wochen Arbeit für Flaggen mit Wappen, Adlern und Schriftzügen.

   Emoji-Flaggen lösen das ohne eine einzige Datei: Zwei Buchstaben des Ländercodes
   werden zu zwei Regionalbuchstaben, und das Betriebssystem zeichnet die Flagge.
   Den Ländernamen liefert dieselbe Quelle, die auch das Datum formatiert.

   ── DIE SIEBEN MIT LIGA BEHALTEN IHREN SCHLÜSSEL ────────────────────────────
   Der Karriere-Modus sucht Jugendvereine über `liga.land`. Für Deutschland, England,
   Spanien, Italien, Frankreich, Portugal und die Niederlande muss deshalb weiterhin
   unser interner Schlüssel herauskommen (GER, ENG, …), sonst findet er nichts. Alle
   anderen Länder tragen ihren ISO-Code; dort beginnt die Laufbahn mit einer
   beliebigen Auswahl kleiner Vereine — so ist es gewollt. */

/* England, Schottland und Wales sind keine ISO-Länder, haben aber eigene Flaggen —
   und für England brauchen wir ohnehin einen eigenen Schlüssel. */
const SONDERFLAGGEN = {
  ENG: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
  SCO: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  WAL: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}",
};

/** Zwei Buchstaben werden zu zwei Regionalbuchstaben — daraus zeichnet das System die Flagge. */
export function flaggeVon(code) {
  if (SONDERFLAGGEN[code]) return SONDERFLAGGEN[code];
  if (!/^[A-Za-z]{2}$/.test(code)) return "\u{1F3F3}";
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1F1E6 + c.charCodeAt(0) - 65));
}

/* Unser interner Schlüssel -> ISO-Code, für die Länder mit eigener Liga. */
export const EIGENE = { GER: "DE", ENG: "ENG", ESP: "ES", ITA: "IT", FRA: "FR", PRT: "PT", NED: "NL" };

/* Alle übrigen Länder als ISO-Codes. Ob jeder davon wirklich existiert, prüft ein
   Test — ein Tippfehler ergäbe sonst still eine weiße Fahne und einen Code als
   Namen. */
const WEITERE = `AD AE AF AG AI AL AM AO AR AS AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT
BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DJ DK DM DO DZ EC EE EG ER ET FI FJ FK FM
FO GA GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MQ
MR MS MT MU MV MW MX MY MZ NA NC NE NG NI NO NP NR NZ OM PA PE PF PG PH PK PL PR PS PW PY QA RE RO RS
RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS SV SX SY SZ TC TD TG TH TJ TL TM TN TO TR TT TV TW TZ
UA UG US UY UZ VA VC VE VG VI VN VU WS YE ZA ZM ZW`.trim().split(/\s+/);

/** Der deutsche Name eines Landes — oder null, wenn der Code keiner ist. */
export function namenVon(code) {
  if (code === "ENG") return "England";
  if (code === "SCO") return "Schottland";
  if (code === "WAL") return "Wales";
  try {
    const n = new Intl.DisplayNames(["de"], { type: "region" }).of(code);
    return n && n !== code ? n : null;
  } catch { return null; }
}

/** Alle wählbaren Länder, nach Namen sortiert. Die mit Liga stehen zuerst. */
export function alleLaender() {
  const mitLiga = Object.keys(EIGENE).map((key) => ({
    key, name: namenVon(EIGENE[key]) || key, flagge: flaggeVon(EIGENE[key]), liga: true,
  }));
  const belegt = new Set(Object.values(EIGENE));
  const rest = [];
  for (const iso of [...WEITERE, "SCO", "WAL"]) {
    if (belegt.has(iso)) continue;
    const name = namenVon(iso);
    if (!name) continue;              // unbekannter Code — lieber weglassen
    rest.push({ key: iso, name, flagge: flaggeVon(iso), liga: false });
  }
  const nachNamen = (a, b) => a.name.localeCompare(b.name, "de");
  return [...mitLiga.sort(nachNamen), ...rest.sort(nachNamen)];
}

/** Sucht in der Liste — ohne Rücksicht auf Gross-/Kleinschreibung und Akzente. */
export const passtAufSuche = (land, suche) => {
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return !suche || norm(land.name).includes(norm(suche));
};
