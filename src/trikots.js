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
  AT: ["#ED2939", "#FFFFFF", "#FFFFFF"],
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
