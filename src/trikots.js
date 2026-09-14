/* Trikotfarben nach Nation.

   ── WAS HIER DRINSTEHT UND WAS NICHT ────────────────────────────────────────
   Die Liste führt Heimtrikots von Nationalmannschaften — Grundfarbe, Besatz an
   Kragen und Ärmeln, Schriftfarbe, dazu bei einigen ein Muster. Aufgenommen ist
   nur, was ich sicher weiss. Ein Land, das hier fehlt, bekommt das neutrale
   Trikot des Spiels; das ist ehrlicher als eine geratene Farbe. Wer eine fehlende
   Nation vermisst, trägt sie nach — die Prüfung nebenan verlangt dabei gültige
   Farbwerte und genug Kontrast zwischen Grund und Schrift.

   Diese Farben sind Zierde, keine Spielerdaten: Sie stehen auf keiner Urkunde
   und in keiner Statistik. Trotzdem gilt dieselbe Regel — lieber neutral als
   falsch.

   ── AUFBAU EINES EINTRAGS ───────────────────────────────────────────────────
   [grund, besatz, schrift] oder [grund, besatz, schrift, muster, zweitfarbe]

   muster: "streifen" senkrecht (Argentinien), "karo" (Kroatien),
           "schraeg" eine Schärpe (Peru). Ohne Muster einfarbig. */

/* Das neutrale Trikot: die Hausfarben des Spiels. */
export const NEUTRAL = { grund: "#E8EEF6", besatz: "#1B2733", schrift: "#16202C", muster: null, zweit: null };

const FARBEN = {
  /* Europa */
  GER: ["#FFFFFF", "#141414", "#141414"],
  ENG: ["#FFFFFF", "#17255A", "#17255A"],
  SCO: ["#0B2C5E", "#FFFFFF", "#FFFFFF"],
  WAL: ["#C8102E", "#FFFFFF", "#FFFFFF"],
  ESP: ["#C60B1E", "#14213D", "#FFD100"],
  ITA: ["#1B4F9C", "#FFFFFF", "#FFFFFF"],
  FRA: ["#1A2C5B", "#FFFFFF", "#FFFFFF"],
  NED: ["#F36C21", "#14213D", "#14213D"],
  PRT: ["#B4152B", "#1BA84A", "#FFFFFF"],
  BE: ["#E30613", "#F5C400", "#FFFFFF"],
  CH: ["#DA291C", "#FFFFFF", "#FFFFFF"],
  AUT: ["#ED2939", "#FFFFFF", "#FFFFFF"],   // Schlüssel AUT, seit Österreich eine eigene Liga hat
  PL: ["#FFFFFF", "#DC143C", "#DC143C"],
  CZ: ["#D7141A", "#FFFFFF", "#FFFFFF"],
  SK: ["#0B4EA2", "#FFFFFF", "#FFFFFF"],
  HU: ["#CE2939", "#FFFFFF", "#FFFFFF"],
  RO: ["#FCD116", "#002B7F", "#002B7F"],
  RS: ["#C6363C", "#FFFFFF", "#FFFFFF"],
  HR: ["#FFFFFF", "#1B4F9C", "#1B4F9C", "karo", "#E4181C"],
  SI: ["#FFFFFF", "#00843D", "#00843D"],
  BA: ["#002395", "#F7D117", "#F7D117"],
  MK: ["#D20000", "#F7D117", "#F7D117"],
  AL: ["#E41B17", "#141414", "#141414"],
  GR: ["#FFFFFF", "#0D5EAF", "#0D5EAF"],
  TR: ["#E30A17", "#FFFFFF", "#FFFFFF"],
  UA: ["#FFD500", "#005BBB", "#005BBB"],
  RU: ["#D52B1E", "#FFFFFF", "#FFFFFF"],
  SE: ["#FFCD00", "#005293", "#005293"],
  NO: ["#BA0C2F", "#FFFFFF", "#FFFFFF"],
  DK: ["#C60C30", "#FFFFFF", "#FFFFFF"],
  FI: ["#FFFFFF", "#003580", "#003580"],
  IS: ["#003897", "#FFFFFF", "#FFFFFF"],
  IE: ["#009A44", "#FFFFFF", "#FFFFFF"],
  BG: ["#FFFFFF", "#00966E", "#00966E"],
  LV: ["#9E3039", "#FFFFFF", "#FFFFFF"],
  LT: ["#FDB913", "#006A44", "#006A44"],
  EE: ["#0072CE", "#FFFFFF", "#FFFFFF"],
  MD: ["#0046AE", "#FFD100", "#FFD100"],
  GE: ["#FFFFFF", "#D0021B", "#D0021B"],
  AM: ["#D90012", "#F2A800", "#FFFFFF"],
  AZ: ["#0092BC", "#FFFFFF", "#FFFFFF"],
  KZ: ["#FEC50C", "#00AFCA", "#00587C"],
  IL: ["#FFFFFF", "#0038B8", "#0038B8"],
  CY: ["#0046AE", "#FFFFFF", "#FFFFFF"],
  MT: ["#C8102E", "#FFFFFF", "#FFFFFF"],
  LU: ["#DA291C", "#00A3E0", "#FFFFFF"],
  ME: ["#C8102E", "#D4AF37", "#FFFFFF"],
  FO: ["#FFFFFF", "#0065BD", "#0065BD"],
  GI: ["#C8102E", "#FFFFFF", "#FFFFFF"],
  AD: ["#C8102E", "#FFD100", "#FFD100"],
  SM: ["#5EB6E4", "#FFFFFF", "#14213D"],
  LI: ["#002B7F", "#C8102E", "#FFFFFF"],
  BY: ["#C8102E", "#00A650", "#FFFFFF"],

  /* Amerika */
  BR: ["#FFDF00", "#009739", "#00693C"],
  AR: ["#75AADB", "#FFFFFF", "#0B2C5E", "streifen", "#FFFFFF"],
  UY: ["#5CBFEB", "#14213D", "#14213D"],
  CL: ["#D52B1E", "#FFFFFF", "#FFFFFF"],
  CO: ["#FCD116", "#003087", "#003087"],
  PE: ["#FFFFFF", "#D91023", "#D91023", "schraeg", "#D91023"],
  EC: ["#FFDD00", "#0033A0", "#0033A0"],
  PY: ["#D52B1E", "#0038A8", "#FFFFFF", "streifen", "#FFFFFF"],
  BO: ["#007A33", "#FFFFFF", "#FFFFFF"],
  VE: ["#7B1E23", "#FFFFFF", "#FFFFFF"],
  MX: ["#006847", "#FFFFFF", "#FFFFFF"],
  US: ["#FFFFFF", "#0A3161", "#0A3161"],
  CA: ["#D80621", "#FFFFFF", "#FFFFFF"],
  CR: ["#C8102E", "#002B7F", "#FFFFFF"],
  JM: ["#FFB81C", "#141414", "#141414"],
  HN: ["#FFFFFF", "#0073CF", "#0073CF"],
  PA: ["#DA121A", "#FFFFFF", "#FFFFFF"],
  TT: ["#C8102E", "#141414", "#FFFFFF"],
  SV: ["#0F47AF", "#FFFFFF", "#FFFFFF"],
  GT: ["#4997D0", "#FFFFFF", "#14213D"],
  CU: ["#C8102E", "#FFFFFF", "#FFFFFF"],
  HT: ["#0038A8", "#D21034", "#FFFFFF"],
  DO: ["#0F47AF", "#FFFFFF", "#FFFFFF"],

  /* Afrika */
  NG: ["#008751", "#FFFFFF", "#FFFFFF"],
  GH: ["#FFFFFF", "#141414", "#141414"],
  CI: ["#FF7900", "#FFFFFF", "#0F3D2E"],
  SN: ["#FFFFFF", "#00853F", "#00853F"],
  CM: ["#009639", "#FCD116", "#FFFFFF"],
  MA: ["#C1272D", "#1FBF63", "#FFFFFF"],
  EG: ["#CE1126", "#FFFFFF", "#FFFFFF"],
  TN: ["#FFFFFF", "#E70013", "#E70013"],
  DZ: ["#FFFFFF", "#006233", "#006233"],
  ZA: ["#FFB81C", "#007749", "#007749"],
  ML: ["#0B7A2A", "#FCD116", "#FFFFFF"],
  BF: ["#009639", "#FFD100", "#FFFFFF"],
  CD: ["#007FFF", "#F7D618", "#FFFFFF"],
  GN: ["#CE1126", "#FCD116", "#FCD116"],
  AO: ["#CE1126", "#141414", "#141414"],
  ZM: ["#198A00", "#F7941E", "#FFFFFF"],
  KE: ["#BB0000", "#FFFFFF", "#FFFFFF"],
  ET: ["#078930", "#FCDD09", "#FCDD09"],
  UG: ["#FCDC04", "#141414", "#141414"],
  GA: ["#FCD116", "#3A75C4", "#003087"],
  CV: ["#003893", "#FFFFFF", "#FFFFFF"],
  MZ: ["#C8102E", "#FCD116", "#FFFFFF"],
  CG: ["#009543", "#FBDE4A", "#FFFFFF"],
  TG: ["#006A4E", "#FFCE00", "#FFCE00"],
  BJ: ["#008751", "#FCD116", "#FCD116"],
  NE: ["#E05206", "#FFFFFF", "#FFFFFF"],
  MR: ["#006233", "#FFC400", "#FFC400"],
  LY: ["#141414", "#239E46", "#FFFFFF"],
  SD: ["#C8102E", "#FFFFFF", "#FFFFFF"],
  MG: ["#FFFFFF", "#007E3A", "#007E3A"],
  MW: ["#C8102E", "#141414", "#FFFFFF"],
  ZW: ["#009739", "#FFD200", "#FFFFFF"],
  NA: ["#003580", "#D21034", "#FFFFFF"],
  BW: ["#75AADB", "#141414", "#14213D"],
  RW: ["#00A1DE", "#FAD201", "#14213D"],
  BI: ["#C8102E", "#FFFFFF", "#FFFFFF"],
  SL: ["#0E8A2C", "#FFFFFF", "#FFFFFF"],
  LR: ["#C8102E", "#FFFFFF", "#FFFFFF"],
  GM: ["#C8102E", "#0C1C8C", "#FFFFFF"],
  GQ: ["#3E9A00", "#FFFFFF", "#FFFFFF"],
  CF: ["#003082", "#FFCE00", "#FFCE00"],
  TD: ["#002664", "#FECB00", "#FECB00"],

  /* Asien und Ozeanien */
  JP: ["#0A1E6E", "#FFFFFF", "#FFFFFF"],
  KR: ["#C8102E", "#FFFFFF", "#FFFFFF"],
  CN: ["#DE2910", "#FFDE00", "#FFDE00"],
  AU: ["#FFCD00", "#00843D", "#00843D"],
  NZ: ["#FFFFFF", "#141414", "#141414"],
  SA: ["#FFFFFF", "#006C35", "#006C35"],
  IR: ["#FFFFFF", "#DA0000", "#DA0000"],
  IQ: ["#FFFFFF", "#007A3D", "#007A3D"],
  QA: ["#8A1538", "#FFFFFF", "#FFFFFF"],
  AE: ["#FFFFFF", "#00732F", "#00732F"],
  KW: ["#0033A0", "#FFFFFF", "#FFFFFF"],
  JO: ["#FFFFFF", "#CE1126", "#CE1126"],
  UZ: ["#FFFFFF", "#0099B5", "#0072A0"],
  IN: ["#0072CE", "#FF9933", "#FFFFFF"],
  TH: ["#241D4F", "#FFFFFF", "#FFFFFF"],
  VN: ["#DA251D", "#FFFF00", "#FFFF00"],
  ID: ["#CE1126", "#FFFFFF", "#FFFFFF"],
  MY: ["#FDDA24", "#141414", "#141414"],
  PH: ["#0038A8", "#FCD116", "#FFFFFF"],
  SG: ["#C8102E", "#FFFFFF", "#FFFFFF"],
  KP: ["#C8102E", "#FFFFFF", "#FFFFFF"],
  HK: ["#C8102E", "#FFFFFF", "#FFFFFF"],
  LB: ["#C8102E", "#FFFFFF", "#FFFFFF"],
  SY: ["#C8102E", "#FFFFFF", "#FFFFFF"],
  PS: ["#C8102E", "#141414", "#FFFFFF"],
  OM: ["#C8102E", "#FFFFFF", "#FFFFFF"],
  BH: ["#C8102E", "#FFFFFF", "#FFFFFF"],
  PK: ["#01411C", "#FFFFFF", "#FFFFFF"],
  BD: ["#006A4E", "#F42A41", "#FFFFFF"],
  NP: ["#DC143C", "#003893", "#FFFFFF"],
  MN: ["#C4272F", "#FFD100", "#FFFFFF"],
  KH: ["#032EA1", "#E00025", "#FFFFFF"],
  FJ: ["#FFFFFF", "#68BFE5", "#0B4EA2"],
  PG: ["#C8102E", "#141414", "#FFFFFF"],
  NC: ["#0033A0", "#ED2939", "#FFFFFF"],
  TO: ["#C8102E", "#FFFFFF", "#FFFFFF"],
  WS: ["#0072CE", "#FFFFFF", "#FFFFFF"],
  SB: ["#0051BA", "#FCD116", "#FFFFFF"],
  VU: ["#009543", "#FDCE12", "#FFFFFF"],

  /* ── AUS DER FLAGGE GEMESSEN ────────────────────────────────────────────────
     Bis hierher stehen Heimtrikots, die ich sicher weiss. Für die übrigen 67
     Länder — Amerikanisch-Samoa, Kiribati, Turks- und Caicos — weiss ich sie
     nicht, und ein geratenes Trikot wäre schlechter als gar keines.

     Diese Zeilen sind deshalb kein Trikot-Wissen, sondern eine MESSUNG:
     data-pipeline/flaggenfarben.mjs holt die Flagge von der Wikidata-Entität des
     Landes (P41), entpackt das Bild und zählt die Pixel. Grund ist die grösste
     Fläche, Besatz die zweitgrösste mit mindestens sechs Prozent Anteil, die
     Schrift wird nach Lesbarkeit gewählt. Der Kommentar nennt die Bilddatei.

     „Trikot in den Landesfarben" ist damit eine Aussage, die stimmt — anders als
     „so spielt Kiribati".

     AFGHANISTAN FEHLT BEWUSST: Wikidata führt dort derzeit die Flagge der Taliban.
     Daraus ein Trikot abzuleiten wäre weder sinnvoll noch neutral; das Land behält
     das neutrale Trikot, bis jemand die Trikotfarbe belegt nachträgt. */
  AG:   ["#D81830", "#000000", "#FFFFFF"],   // Antigua und Barbuda, aus Flag of Antigua and Barbuda.svg (#D81830 49%, #000000 25%, #0078C0 10%)
  AI:   ["#001860", "#FFFFFF", "#FFFFFF"],   // Anguilla, aus Flag of Anguilla.svg (#001860 73%, #FFFFFF 9%, #C01830 8%)
  AS:   ["#001860", "#FFFFFF", "#FFFFFF"],   // Amerikanisch-Samoa, aus Flag of American Samoa.svg (#001860 48%, #FFFFFF 29%, #C00030 7%)
  AW:   ["#4890D8", "#FFD800", "#141414"],   // Aruba, aus Flag of Aruba.svg (#4890D8 85%, #FFD800 8%)
  BB:   ["#183078", "#F0A800", "#FFFFFF"],   // Barbados, aus Flag of Barbados.svg (#183078 67%, #F0A800 29%, #000000 3%)
  BM:   ["#C01830", "#FFFFFF", "#FFFFFF"],   // Bermuda, aus Flag of Bermuda.svg (#C01830 71%, #FFFFFF 10%, #001860 6%)
  BN:   ["#F0D818", "#000000", "#141414"],   // Brunei Darussalam, aus Flag of Brunei.svg (#F0D818 53%, #FFFFFF 19%, #000000 16%)
  BS:   ["#007890", "#000000", "#FFFFFF"],   // Bahamas, aus Flag of the Bahamas.svg (#007890 56%, #000000 21%, #FFC030 21%)
  BT:   ["#FFD800", "#FF6018", "#141414"],   // Bhutan, aus Flag of Bhutan.svg (#FFD800 42%, #FF6018 38%, #F0F0F0 5%)
  BZ:   ["#181890", "#D81818", "#FFFFFF"],   // Belize, aus Flag of Belize.svg (#181890 61%, #D81818 19%)
  CK:   ["#001860", "#C01830", "#FFFFFF"],   // Cookinseln, aus Flag of the Cook Islands.svg (#001860 73%, #C01830 8%, #FFFFFF 8%)
  CW:   ["#003078", "#F0F018", "#FFFFFF"],   // Curaçao, aus Flag of Curaçao.svg (#003078 86%, #F0F018 13%)
  DJ:   ["#18A830", "#FFFFFF", "#141414"],   // Dschibuti, aus Flag of Djibouti.svg (#18A830 35%, #60A8F0 35%, #FFFFFF 26%)
  DM:   ["#006030", "#FFFFFF", "#FFFFFF"],   // Dominica, aus Flag of Dominica.svg (#006030 63%, #FFFFFF 7%, #FFD800 7%)
  ER:   ["#F00030", "#FFFFFF", "#FFFFFF"],   // Eritrea, aus Flag of Eritrea.svg (#F00030 40%, #48A830 24%, #4890D8 24%)
  FK:   ["#001860", "#C01830", "#FFFFFF"],   // Falklandinseln, aus Flag of the Falkland Islands.svg (#001860 68%, #C01830 8%, #FFFFFF 7%)
  FM:   ["#78A8D8", "#FFFFFF", "#141414"],   // Mikronesien, aus Flag of the Federated States of Micronesia.svg (#78A8D8 96%)
  GD:   ["#D81830", "#FFD818", "#FFFFFF"],   // Grenada, aus Flag of Grenada.svg (#D81830 39%, #007860 26%, #FFD818 26%)
  GF:   ["#003060", "#FFFFFF", "#FFFFFF"],   // Französisch-Guayana, aus Flag of France.svg (#003060 33%, #FFFFFF 33%, #D81830 33%)
  GG:   ["#FFFFFF", "#F01830", "#141414"],   // Guernsey, aus Flag of Guernsey.svg (#FFFFFF 63%, #F01830 28%, #F0D818 8%)
  GL:   ["#C01830", "#FFFFFF", "#FFFFFF"],   // Grönland, aus Flag of Greenland.svg (#C01830 49%, #FFFFFF 49%)
  GP:   ["#003060", "#FFFFFF", "#FFFFFF"],   // Guadeloupe, aus Flag of France.svg (#003060 33%, #FFFFFF 33%, #D81830 33%)
  GU:   ["#003078", "#C01830", "#FFFFFF"],   // Guam, aus Flag of Guam.svg (#003078 78%, #C01830 10%, #C01848 3%)
  GW:   ["#FFD818", "#00A848", "#141414"],   // Guinea-Bissau, aus Flag of Guinea-Bissau.svg (#FFD818 33%, #00A848 33%, #D81830 31%)
  GY:   ["#309060", "#FFC018", "#141414"],   // Guyana, aus Flag of Guyana.svg (#309060 48%, #C01830 21%, #FFC018 17%)
  IM:   ["#D81830", "#FFFFFF", "#FFFFFF"],   // Isle of Man, aus Flag of the Isle of Man.svg (#D81830 93%)
  KG:   ["#FF0000", "#FFFFFF", "#141414"],   // Kirgisistan, aus Flag of Kyrgyzstan.svg (#FF0000 86%)
  KI:   ["#C01818", "#183078", "#FFFFFF"],   // Kiribati, aus Flag of Kiribati.svg (#C01818 43%, #183078 20%, #FFFFFF 19%)
  KM:   ["#0048A8", "#FFD800", "#FFFFFF"],   // Komoren, aus Flag of the Comoros.svg (#0048A8 22%, #FFD800 22%, #009030 19%)
  KN:   ["#000000", "#009030", "#FFFFFF"],   // St. Kitts und Nevis, aus Flag of Saint Kitts and Nevis.svg (#000000 28%, #009030 28%, #C01830 28%)
  KY:   ["#001860", "#C01830", "#FFFFFF"],   // Kaimaninseln, aus Flag of the Cayman Islands.svg (#001860 70%, #C01830 9%, #FFFFFF 7%)
  LA:   ["#D81830", "#003060", "#FFFFFF"],   // Laos, aus Flag of Laos.svg (#D81830 50%, #003060 41%, #FFFFFF 8%)
  LC:   ["#60D8FF", "#141414", "#141414"],   // St. Lucia, aus Flag of Saint Lucia.svg (#60D8FF 85%, #FFD818 6%)
  LK:   ["#FFC030", "#901830", "#141414"],   // Sri Lanka, aus Flag of Sri Lanka.svg (#FFC030 36%, #901830 28%, #004848 10%)
  LS:   ["#FFFFFF", "#001890", "#141414"],   // Lesotho, aus Flag of Lesotho.svg (#FFFFFF 36%, #001890 30%, #009048 30%)
  MC:   ["#D81830", "#FFFFFF", "#FFFFFF"],   // Monaco, aus Flag of Monaco.svg (#D81830 50%, #FFFFFF 50%)
  MH:   ["#003090", "#FFFFFF", "#FFFFFF"],   // Marshallinseln, aus Flag of the Marshall Islands.svg (#003090 71%, #FFFFFF 10%, #D87800 9%)
  MM:   ["#FFC000", "#F03030", "#141414"],   // Myanmar, aus Flag of Myanmar.svg (#FFC000 32%, #F03030 30%, #30A830 24%)
  MO:   ["#187860", "#FFFFFF", "#FFFFFF"],   // Sonderverwaltungsregion Macau, aus Flag of Macau.svg (#187860 89%, #FFFFFF 4%)
  MQ:   ["#00A848", "#181818", "#141414"],   // Martinique, aus Flag-of-Martinique.svg (#00A848 37%, #181818 37%, #F01818 24%)
  MS:   ["#001860", "#C01830", "#FFFFFF"],   // Montserrat, aus Flag of Montserrat.svg (#001860 70%, #C01830 8%, #FFFFFF 6%)
  MU:   ["#D81818", "#303060", "#FFFFFF"],   // Mauritius, aus Flag of Mauritius.svg (#D81818 25%, #303060 25%, #F0C018 25%)
  MV:   ["#D81830", "#FFFFFF", "#FFFFFF"],   // Malediven, aus Flag of Maldives.svg (#D81830 67%, #007830 31%)
  NI:   ["#0060C0", "#FFFFFF", "#FFFFFF"],   // Nicaragua, aus Flag of Nicaragua.svg (#0060C0 67%, #FFFFFF 31%)
  NR:   ["#001860", "#FFC030", "#FFFFFF"],   // Nauru, aus Flag of Nauru.svg (#001860 87%, #FFC030 7%, #787848 3%)
  PF:   ["#D81830", "#FFFFFF", "#FFFFFF"],   // Französisch-Polynesien, aus Flag of French Polynesia.svg (#D81830 51%, #FFFFFF 40%)
  PR:   ["#F00000", "#FFFFFF", "#FFFFFF"],   // Puerto Rico, aus Flag of Puerto Rico.svg (#F00000 44%, #FFFFFF 27%, #0048FF 25%)
  PW:   ["#0090FF", "#FFFF00", "#141414"],   // Palau, aus Flag of Palau.svg (#0090FF 82%, #FFFF00 17%)
  RE:   ["#3060FF", "#FFFF00", "#FFFFFF"],   // Réunion, aus Proposed flag of Réunion (VAR).svg (#3060FF 61%, #FF0000 24%, #FFFF00 7%)
  SC:   ["#D83030", "#003078", "#FFFFFF"],   // Seychellen, aus Flag of Seychelles.svg (#D83030 32%, #003078 16%, #007830 16%)
  SO:   ["#4890D8", "#FFFFFF", "#141414"],   // Somalia, aus Flag of Somalia.svg (#4890D8 95%, #FFFFFF 3%)
  SR:   ["#307848", "#FFFFFF", "#FFFFFF"],   // Suriname, aus Flag of Suriname.svg (#307848 40%, #C00030 36%, #FFFFFF 20%)
  SS:   ["#000000", "#009048", "#FFFFFF"],   // Südsudan, aus Flag of South Sudan.svg (#000000 25%, #009048 25%, #00C0F0 19%)
  SX:   ["#D81818", "#003090", "#FFFFFF"],   // Sint Maarten, aus Flag of Sint Maarten.svg (#D81818 38%, #003090 38%, #FFFFFF 16%)
  SZ:   ["#4860C0", "#FFD800", "#FFFFFF"],   // Eswatini, aus Flag of Eswatini.svg (#4860C0 38%, #A81818 32%, #FFD800 13%)
  TC:   ["#003060", "#D81830", "#FFFFFF"],   // Turks- und Caicosinseln, aus Flag of the Turks and Caicos Islands.svg
  TC:   ["#003060", "#D81830", "#FFFFFF"],   // Turks- und Caicosinseln, aus Flag of the Turks and Caicos Islands.svg (#003060 74%, #D81830 9%, #FFFFFF 6%)
  TJ:   ["#FFFFFF", "#D81818", "#141414"],   // Tadschikistan, aus Flag of Tajikistan.svg (#FFFFFF 37%, #D81818 28%, #187830 28%)
  TL:   ["#D83018", "#000000", "#FFFFFF"],   // Timor-Leste, aus Flag of East Timor.svg (#D83018 74%, #000000 14%, #FFC030 7%)
  TM:   ["#009048", "#FFFFFF", "#141414"],   // Turkmenistan, aus Flag of Turkmenistan.svg (#009048 80%, #D83030 4%)
  TV:   ["#00A8D8", "#C01830", "#141414"],   // Tuvalu, aus Flag of Tuvalu.svg (#00A8D8 69%, #C01830 8%, #FFFFFF 6%)
  TW:   ["#FF0000", "#000090", "#141414"],   // Taiwan, aus Flag of the Republic of China.svg (#FF0000 75%, #000090 20%)
  TZ:   ["#000000", "#18C030", "#FFFFFF"],   // Tansania, aus Flag of Tanzania.svg (#000000 28%, #18C030 28%, #00A8D8 28%)
  VA:   ["#FFF000", "#141414", "#141414"],   // Vatikanstadt, aus Flag of Vatican City (2023–present).svg (#FFF000 50%, #FFFFFF 41%)
  VC:   ["#FFD818", "#007830", "#141414"],   // St. Vincent und die Grenadinen, aus Flag of Saint Vincent and the Grenadines.svg (#FFD818 43%, #007830 30%, #003078 25%)
  VG:   ["#001860", "#C01830", "#FFFFFF"],   // Britische Jungferninseln, aus Flag of the British Virgin Islands.svg (#001860 68%, #C01830 8%, #FFFFFF 6%)
  VI:   ["#FFFFFF", "#F0C048", "#141414"],   // Amerikanische Jungferninseln, aus Flag of the United States Virgin Islands.svg (#FFFFFF 64%, #F0C048 8%)
  YE:   ["#D81830", "#FFFFFF", "#FFFFFF"],   // Jemen, aus Flag of Yemen.svg (#D81830 33%, #FFFFFF 33%, #000000 33%)
};

/** Das Trikot einer Nation — oder das neutrale, wenn wir sie nicht führen. */
export function trikotVon(land) {
  const e = FARBEN[land];
  if (!e) return NEUTRAL;
  const [grund, besatz, schrift, muster = null, zweit = null] = e;
  return { grund, besatz, schrift, muster, zweit };
}

/** Nur für die Prüfung: alle geführten Länder. */
export const gefuehrteLaender = () => Object.keys(FARBEN);

/* ── Kontrast ────────────────────────────────────────────────────────────────
   Weisse Nummer auf gelbem Trikot ist unlesbar, und im Kleinen fällt es beim
   Bauen nicht auf. Die Rechnung ist die übliche relative Helligkeit; die Prüfung
   verlangt daraus ein Verhältnis von mindestens 3:1 zwischen Grund und Schrift. */
export function helligkeit(hex) {
  const teil = (i) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * teil(0) + 0.7152 * teil(1) + 0.0722 * teil(2);
}

export function kontrast(a, b) {
  const [h, d] = [helligkeit(a), helligkeit(b)].sort((x, y) => y - x);
  return (h + 0.05) / (d + 0.05);
}
