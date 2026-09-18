/* Die Gestalt jeder Trophäe — Zahlen und Pfade, ohne eine Zeile Anzeige.
   ═══════════════════════════════════════════════════════════════════════════

   ── WARUM GEZEICHNET UND NICHT ERZEUGT ──────────────────────────────────────
   Vier Pokale stammen als freigestellte Bilder aus dem Vorbild: Champions
   League, Europa League, Weltmeisterschaft, Europameisterschaft. Mehr liegen
   dort nicht auf dem Server; sein Code führt einundvierzig Wettbewerbe, die
   Dateien dazu fehlen. Für die übrigen 22 war der Auftrag, sie „im selben Stil"
   zu erzeugen.

   Der erste Versuch lief über ein Bildmodell und ist zweifach gescheitert: Die
   Formen stimmten nicht — aus der Meisterschale wurde ein Kelch, aus dem
   Hexagoal ein Glasring — und der Anstrich war falsch. Das Modell malt harte
   schwarze Schatten; die Vorbilder sind weich, einfarbig, ohne Kontur. Ein Satz
   aus vier stillen und zweiundzwanzig schreienden Pokalen ist kein Satz.

   Gezeichnet ist beides lösbar: Die Gestalt ist genau die, die hier steht, und
   der Anstrich kommt für alle aus denselben drei Farben. Nebenbei wiegt eine
   Zeichnung zwei Kilobyte statt zweihundert.

   ── WARUM DIESE DATEI OHNE JSX AUSKOMMT ─────────────────────────────────────
   `node --test` liest kein JSX. Stünden die Profile in der .jsx, könnte keine
   Prüfung sie anfassen — und dann fällt niemandem auf, wenn beim Nachtragen
   eines Wettbewerbs die Gestalt vergessen wird oder ein Profil nach oben statt
   nach unten läuft. Hier stehen darum alle Zahlen und alle Pfade; in der .jsx
   steht nur, was zwingend Auszeichnung ist: Farbeinlagen und die fünf Formen,
   die kein Drehkörper sind.

   ── WIE DIE FORMEN ENTSTEHEN ────────────────────────────────────────────────
   Ein Pokal ist fast immer drehsymmetrisch. Darum beschreibt ihn hier nur sein
   halbes Profil: [y, Halbbreite] von oben nach unten. `koerper` spiegelt das an
   der Mittelachse und legt eine weiche Kurve hindurch. Zehn Zahlenpaare ergeben
   einen Pokal — und weil alle durch dieselbe Kurve laufen, sehen sie zusammen
   aus wie ein Satz und nicht wie eine Sammlung.

   Wo eine Kante scharf bleiben soll — ein Schalenrand, eine Sockelplatte —
   trägt der Punkt ein drittes Feld `true`. Dann zieht `kurve` dorthin eine
   Gerade statt eines Bogens.

   Die Leinwand ist 200 × 300, also hochkant wie die Vorbilder; die Mittelachse
   liegt bei x = 100, der Boden bei y ≈ 282. */

export const BREITE = 200, HOEHE = 300, ACHSE = 100;

/** Weiche Kurve durch alle Punkte (Catmull-Rom als kubische Bezier).
 *  Ein Punkt mit `hart` bekommt eine Gerade statt eines Bogens. */
export function kurve(punkte, beginnen = true) {
  const p = punkte;
  let d = beginnen ? `M${p[0][0]} ${p[0][1]}` : `L${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p1 = p[i], p2 = p[i + 1];
    if (p1[2] || p2[2]) { d += `L${p2[0]} ${p2[1]}`; continue; }
    const p0 = p[i - 1] || p1, p3 = p[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

/** Halbes Profil [[y, halbeBreite, hart?], …] → geschlossener Umriss. */
export function koerper(profil) {
  const rechts = profil.map(([y, b, h]) => [ACHSE + b, y, h]);
  const links = [...profil].reverse().map(([y, b, h]) => [ACHSE - b, y, h]);
  return kurve(rechts) + kurve(links, false) + "Z";
}

/* ── Henkel ────────────────────────────────────────────────────────────────
   Als Strich gezeichnet, nicht als Fläche: ein Henkel ist ein gebogener Stab,
   und ein Strich mit runden Enden ist genau das. `st` ist seine Dicke.
   `yo` ist die Höhe, auf der er am Körper ansetzt, `b` dessen Halbbreite dort. */
export const henkel = {
  /* Kleine Ösen dicht am Rand. */
  klein: (yo, b, st = 7) => [
    `M${ACHSE + b} ${yo}c14 0 16 22 2 26`, `M${ACHSE - b} ${yo}c-14 0-16 22-2 26`, st],
  /* Weit ausgestellte Bügel. */
  gross: (yo, b, st = 8) => [
    `M${ACHSE + b} ${yo}c30-4 36 40 8 54`, `M${ACHSE - b} ${yo}c-30-4-36 40-8 54`, st],
  /* Hohe Schwünge, die über den Rand hinausragen. */
  hoch: (yo, b, st = 7) => [
    `M${ACHSE + b} ${yo + 34}c34-6 30-48 4-52`, `M${ACHSE - b} ${yo + 34}c-34-6-30-48-4-52`, st],
  /* Eckige, kräftige Griffe. */
  eckig: (yo, b, st = 11) => [
    `M${ACHSE + b} ${yo}h18v42h-14`, `M${ACHSE - b} ${yo}h-18v42h14`, st],
};

/* Diese vier liegen als freigestelltes Bild vor. Die Liste steht ausgeschrieben,
   statt sich auf einen fehlgeschlagenen Ladeversuch zu verlassen: Sonst blitzt
   bei jeder gezeichneten Trophäe erst ein kaputtes Bild auf, und das Netzwerk-
   protokoll ist voll mit 404ern.
   Die Copa América stand hier auch einmal — das Bild dazu war aber ein Foto samt
   Vitrinenscheibe, kein freigestelltes; auf dem Server des Vorbilds liegt zu ihr
   nichts. Sie ist jetzt gezeichnet wie die anderen. */
export const MIT_BILD = new Set(["CL", "EL", "WM", "EM"]);

/* ── Die 22 Gestalten ──────────────────────────────────────────────────────
   Je Wettbewerb: `gold` (sonst Silber), `profil`, optional `griff` und `deckel`
   (ein eigener Pfad über dem Körper). `eigen` markiert die fünf Formen, die
   keine Drehkörper sind — ihre Pfade stehen in TrophaeenFormen.jsx, weil sie
   aus mehreren Kreisen und Platten bestehen; `zier` eine Farbeinlage ebendort.
   Beides steht hier trotzdem als Flag, damit eine Prüfung sieht, dass der
   Wettbewerb versorgt ist. */
export const GESTALTEN = {
  /* ── Meisterschaften ──────────────────────────────────────────────────── */

  /* Meisterschale: eine runde Platte, die auf der Kante steht. */
  MBL: { eigen: true, griff: ["M188 112c18 6 18 36 0 42", "M12 112c-18 6-18 36 0 42", 9] },

  /* Premier League: hoher Kelch, weit ausgestellte Bügel, Deckel mit Knauf. */
  MPL: {
    profil: [[62, 52, true], [70, 50], [120, 44], [166, 30], [196, 16], [210, 13, true],
    [246, 13, true], [252, 30, true], [258, 52, true], [282, 56, true]],
    griff: henkel.gross(70, 52),
    deckel: "M100 14c-9 0-9 12 0 12s9-12 0-12M64 30h72l-6 30H70z",
  },

  /* LaLiga: flache Schale auf schlankem Fuß. */
  MLL: {
    profil: [[70, 62, true], [78, 60], [108, 52], [130, 34], [140, 16], [200, 12, true],
    [216, 22, true], [250, 26, true], [258, 44, true], [282, 50, true]],
    griff: henkel.klein(74, 60),
  },

  /* Coppa Campioni: ein weiter Trichter auf kurzem Schaft. */
  MSA: {
    gold: true,
    profil: [[40, 66, true], [52, 62, true], [120, 40], [176, 20], [200, 16, true],
    [232, 18, true], [240, 34, true], [276, 40, true], [282, 54, true]],
  },

  /* Hexagoal: ein Sechseck auf einer Platte — die einzige ohne Kelch. */
  ML1: { eigen: true },

  /* Primeira Liga: ein Ball auf einer schlanken Säule. */
  MPT: { eigen: true },

  /* Eredivisie: eine glatte Schale, flacher als die Meisterschale, ohne Henkel. */
  MNL: { eigen: true },

  /* Österreichischer Meisterteller: goldene Platte mit breitem Rand. */
  MAT: { gold: true, eigen: true },

  /* Brasilien: ein weit geöffneter Kelch mit einer goldenen Kugel darin. */
  MBR: {
    profil: [[34, 70, true], [44, 64, true], [96, 40], [150, 24], [196, 20, true],
    [230, 22, true], [238, 40, true], [272, 46, true], [282, 60, true]],
    ueber: true,
  },

  /* MLS: ein gedrungener, schwerer Becher. */
  MML: {
    profil: [[44, 62, true], [54, 64], [96, 62], [140, 48], [172, 30], [196, 22, true],
    [228, 22, true], [238, 46, true], [268, 54, true], [282, 68, true]],
  },

  /* Saudi Pro League: schlanker goldener Becher mit dünnen Griffen. */
  MSP: {
    gold: true,
    profil: [[50, 46, true], [60, 44], [120, 40], [172, 28], [208, 20, true],
    [238, 22, true], [246, 40, true], [272, 44, true], [282, 56, true]],
    griff: henkel.hoch(52, 44, 6),
  },

  /* J1 League: runde Schale mit kleinen Ösen. */
  MJP: {
    profil: [[58, 56, true], [68, 58], [112, 56], [154, 40], [182, 24, true],
    [216, 24, true], [226, 42, true], [262, 48, true], [282, 58, true]],
    griff: henkel.klein(64, 56),
  },

  /* ── Pokale ──────────────────────────────────────────────────────────────
     Sie sind sich untereinander notgedrungen ähnlicher als die Meister-
     trophäen: Ein Landespokal ist fast immer ein Henkelpokal mit Deckel. Die
     Unterschiede liegen in der Höhe, der Form des Deckels und den Griffen. */

  /* DFB-Pokal: goldene Schale, eckige Griffe, grüne Steine im Fuß. */
  DFB: {
    gold: true,
    profil: [[54, 60, true], [64, 58], [112, 54], [150, 36], [182, 24, true],
    [218, 24, true], [228, 44, true], [264, 50, true], [280, 62, true]],
    griff: henkel.eckig(60, 58),
    zier: true,
  },

  /* FA Cup: flache Schale, hoher Deckel mit einer kleinen Figur. */
  FAC: {
    profil: [[128, 62, true], [136, 60], [162, 52], [180, 36], [192, 22, true],
    [222, 22, true], [232, 40, true], [266, 46, true], [280, 58, true]],
    griff: henkel.gross(132, 60, 7),
    deckel: "M100 16c-8 0-8 14 0 14s8-14 0-14M96 30h8v18h-8M56 48h88c0 46-20 72-44 72S56 94 56 48",
  },

  /* Copa del Rey: hoch, schmal, mit spitzem Deckel. */
  CDR: {
    profil: [[74, 46, true], [84, 46], [152, 42], [194, 26], [214, 18, true],
    [242, 20, true], [250, 38, true], [272, 42, true], [282, 54, true]],
    griff: henkel.klein(80, 46, 6),
    deckel: "M100 10l34 50H66zM58 60h84v14H58z",
  },

  /* Coppa Italia: offener Trichter mit dem Ring in den Landesfarben. */
  CIT: {
    gold: true,
    profil: [[46, 68, true], [58, 62, true], [130, 36], [186, 20], [212, 16, true],
    [240, 18, true], [248, 36, true], [274, 42, true], [282, 56, true]],
    zier: true,
  },

  /* Coupe de France: tiefe Schale, hohe Schwünge, gestufter Deckel. */
  CDF: {
    profil: [[110, 58, true], [120, 56], [158, 50], [188, 34], [206, 22, true],
    [234, 22, true], [244, 42, true], [270, 48, true], [282, 60, true]],
    griff: henkel.hoch(106, 56, 7),
    deckel: "M100 28c-7 0-7 12 0 12s7-12 0-12M86 40h28v14H86M66 54h68v16H66M48 70h104v42H48z",
  },

  /* Taça de Portugal: runde Schale, Griffe über dem Rand. */
  TDP: {
    profil: [[116, 58, true], [126, 60], [164, 54], [194, 36], [212, 24, true],
    [240, 24, true], [250, 42, true], [272, 48, true], [282, 58, true]],
    griff: henkel.hoch(112, 58),
  },

  /* KNVB-Beker: breite Schale unter einer Kuppel. */
  KNV: {
    profil: [[120, 62, true], [130, 60], [166, 52], [194, 34], [210, 22, true],
    [238, 22, true], [248, 40, true], [270, 46, true], [282, 58, true]],
    griff: henkel.klein(124, 60, 6),
    deckel: "M100 16c-7 0-7 12 0 12s7-12 0-12M96 28h8v36h-8M44 122h112c0-34-25-58-56-58s-56 24-56 58z",
  },

  /* ÖFB-Cup: goldener Becher mit rotem Band. */
  OFB: {
    gold: true,
    profil: [[62, 54, true], [72, 52], [126, 46], [176, 30], [206, 20, true],
    [236, 22, true], [244, 40, true], [270, 46, true], [282, 58, true]],
    griff: henkel.klein(66, 52, 6),
    zier: true,
  },

  /* ── Kontinent ───────────────────────────────────────────────────────────
     Eine hohe Urne mit weit ausgestelltem Rand, engem Hals und dem breiten,
     gestuften Sockel, der die Copa América unverwechselbar macht. */
  CA: {
    profil: [[24, 40, true], [32, 38, true], [42, 46, true], [56, 42], [80, 30],
    [116, 44], [154, 52], [182, 44], [200, 30], [210, 20, true], [222, 24],
    [232, 22, true], [240, 28, true], [246, 48, true], [256, 52, true],
    [260, 66, true], [276, 70, true], [282, 72, true]],
    griff: henkel.klein(60, 36, 6),
    zier: true,
  },

  /* ── Auszeichnung ─────────────────────────────────────────────────────────
     Der Ballon d'Or: eine goldene Kugel auf einem Sockel — die einzige Trophäe
     für eine Person statt für eine Mannschaft. */
  BDO: { gold: true, eigen: true },
};

/* Metall und Schattenseite: Glanz, Fläche, abgewandte Seite. Den vier Bildern
   aus dem Vorbild abgesehen — dort liegt das Licht links, und der dunkelste Rand
   ist nie schwarz, sondern nur ein satteres Grau. */
export const METALL = {
  silber: ["#F6F8FA", "#D3D9E0", "#98A1AC"],
  gold: ["#FFE59A", "#F2C33F", "#B3821A"],
};
