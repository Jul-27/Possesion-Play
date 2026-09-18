import { GESTALTEN, METALL, koerper } from "./trophaeenFormen.js";
/* Die Anzeige einer gezeichneten Trophäe.
   ═══════════════════════════════════════════════════════════════════════════
   Alle Zahlen, Profile und Pfade stehen in trophaeenFormen.js — dort steht auch,
   warum gezeichnet und nicht erzeugt wird. Hier steht nur, was zwingend
   Auszeichnung ist: die fünf Formen, die keine Drehkörper sind, und die drei
   Farbeinlagen.

   ── DER ANSTRICH ────────────────────────────────────────────────────────────
   Ein waagerechter Verlauf über die ganze Figur: mittel, hell, mittel, dunkel.
   Das genügt, damit ein flacher Umriss rund wirkt, und es ist genau das, was die
   vier Bilder aus dem Vorbild tun. Keine Kontur, kein Schlagschatten im Bild
   selbst — der kommt aus dem Stylesheet und gilt dann auch für jene vier. */

/* Die fünf Formen, die kein Drehkörper sind: zwei Platten, ein Sechseck und
   zwei Kugeln. `f` ist der Verlauf des Metalls. */
const EIGEN = {
  /* Meisterschale: eine runde Platte, die auf der Kante steht. */
  MBL: (f) => (
    <>
      <ellipse cx="100" cy="128" rx="88" ry="88" fill={f} />
      <ellipse cx="100" cy="128" rx="70" ry="70" fill="none" stroke="#0000001f" strokeWidth="5" />
      <path d="M76 232h48l6 34H70z" fill={f} />
      <rect x="52" y="262" width="96" height="20" rx="7" fill={f} />
    </>
  ),

  /* Hexagoal: zwei Sechsecke in einem Pfad — `evenodd` stanzt das innere aus.
     Malte man es weiss, stünde auf jedem dunklen Grund ein heller Klecks. */
  ML1: (f) => (
    <>
      <path fillRule="evenodd" fill={f}
        d="M100 30l76 44v88l-76 44-76-44V74zM100 74l38 22v44l-38 22-38-22V96z" />
      <path d="M86 206h28v42H86z" fill={f} />
      <rect x="56" y="248" width="88" height="22" rx="6" fill={f} />
    </>
  ),

  /* Primeira Liga: ein Ball auf einer schlanken Säule. */
  MPT: (f) => (
    <>
      <circle cx="100" cy="86" r="64" fill={f} />
      <path d="M100 46l24 18-9 29H85l-9-29z" fill="#00000024" />
      <rect x="84" y="150" width="32" height="96" fill={f} />
      <rect x="50" y="246" width="100" height="26" rx="8" fill={f} />
    </>
  ),

  /* Eredivisie: eine glatte Schale ohne Henkel. */
  MNL: (f) => (
    <>
      <ellipse cx="100" cy="134" rx="92" ry="82" fill={f} />
      <ellipse cx="100" cy="134" rx="58" ry="50" fill="#0000001c" />
      <rect x="62" y="232" width="76" height="16" fill={f} />
      <rect x="46" y="248" width="108" height="22" rx="8" fill={f} />
    </>
  ),

  /* Österreichischer Meisterteller: goldene Platte mit breitem Rand. */
  MAT: (f) => (
    <>
      <ellipse cx="100" cy="126" rx="86" ry="86" fill={f} />
      <ellipse cx="100" cy="126" rx="74" ry="74" fill="none" stroke="#00000022" strokeWidth="9" />
      <ellipse cx="100" cy="126" rx="42" ry="42" fill="#00000018" />
      <path d="M78 224h44l8 36H70z" fill={f} />
      <rect x="52" y="256" width="96" height="20" rx="7" fill={f} />
    </>
  ),

  /* Ballon d'Or: eine Kugel mit angedeuteten Fünfecken auf einem Sockel. */
  BDO: (f) => (
    <>
      <circle cx="100" cy="112" r="76" fill={f} />
      <path d="M100 66l28 21-11 34H83l-11-34z" fill="#00000026" />
      <path d="M100 36l-14 24h28zM158 92l-8 28 26-8zM42 92l8 28-26-8zM66 168l22-14-18-20zM134 168l-22-14 18-20z" fill="#0000001a" />
      <path d="M70 202h60l14 52H56z" fill={f} />
    </>
  ),
};

/* Was über dem Körper liegt und ein anderes Metall trägt. */
const UEBER = {
  /* Die Kugel im brasilianischen Kelch ist golden, der Kelch silbern. */
  MBR: (f, gold) => <circle cx="100" cy="78" r="40" fill={gold} />,
};

/* Farbeinlagen. Sie sind der einzige Ort, an dem eine andere Farbe als das
   Metall vorkommt — und jede steht für etwas: die Steine im DFB-Pokal, die
   Landesfarben am italienischen, das Band am österreichischen. */
const ZIER = {
  DFB: (
    <g fill="#3f7d4a">
      <circle cx="76" cy="266" r="7" /><circle cx="100" cy="266" r="7" /><circle cx="124" cy="266" r="7" />
    </g>
  ),
  CIT: (
    <g>
      <rect x="34" y="58" width="44" height="11" fill="#2e7d4f" />
      <rect x="78" y="58" width="44" height="11" fill="#f2f4f6" />
      <rect x="122" y="58" width="44" height="11" fill="#c0392b" />
    </g>
  ),
  OFB: <rect x="44" y="76" width="112" height="14" fill="#c0392b" />,
  /* Der Sockel der Copa América ist keine Farbe, sondern Schatten — er bleibt
     darum auch in der Vitrine stehen, wo alles Ungewonnene grau ist. */
  CA: (
    <g fill="#00000018">
      <rect x="30" y="262" width="140" height="10" />
      <ellipse cx="100" cy="150" rx="46" ry="9" />
    </g>
  ),
};

/* Diese drei Einlagen sind echte Farbe. In der Vitrine, wo ein noch nicht
   gewonnener Titel grau steht, bleiben sie weg — ein graues Trumm mit einem
   leuchtend roten Band sähe nicht ungewonnen aus, sondern kaputt. */
const ZIER_FARBIG = new Set(["DFB", "CIT", "OFB"]);

/** Eine gezeichnete Trophäe als SVG-Inhalt. `id` macht die Verläufe eindeutig,
 *  weil auf einer Seite viele Trophäen gleichzeitig stehen. */
export function Gestalt({ titel, id, silber = false }) {
  const g = GESTALTEN[titel];
  if (!g) return null;
  const [hell, mittel, dunkel] = METALL[g.gold && !silber ? "gold" : "silber"];
  /* Der zweite Verlauf ist für die wenigen Trophäen, die zwei Metalle tragen.
     In der Vitrine, wo ungewonnene Titel grau stehen, wird auch er grau. */
  const [gh, gm, gd] = METALL[silber ? "silber" : "gold"];
  const fl = `url(#v${id})`, gold = `url(#g${id})`;
  return (
    <>
      <defs>
        <linearGradient id={`v${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={mittel} />
          <stop offset="22%" stopColor={hell} />
          <stop offset="58%" stopColor={mittel} />
          <stop offset="100%" stopColor={dunkel} />
        </linearGradient>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={gm} />
          <stop offset="22%" stopColor={gh} />
          <stop offset="58%" stopColor={gm} />
          <stop offset="100%" stopColor={gd} />
        </linearGradient>
      </defs>
      {g.griff ? (
        <g fill="none" stroke={fl} strokeWidth={g.griff[2]} strokeLinecap="round">
          <path d={g.griff[0]} /><path d={g.griff[1]} />
        </g>
      ) : null}
      {g.deckel ? <path d={g.deckel} fill={fl} /> : null}
      {g.profil ? <path d={koerper(g.profil)} fill={fl} /> : null}
      {g.eigen ? EIGEN[titel](fl) : null}
      {g.ueber ? UEBER[titel](fl, gold) : null}
      {g.zier && !(silber && ZIER_FARBIG.has(titel)) ? ZIER[titel] : null}
    </>
  );
}

/* Damit eine Prüfung merkt, wenn eine Gestalt zwar angekündigt, aber nicht
   gezeichnet ist: beide Listen müssen zu den Flags in trophaeenFormen.js passen. */
export const EIGEN_KEYS = Object.keys(EIGEN);
export const ZIER_KEYS = Object.keys(ZIER);
export const UEBER_KEYS = Object.keys(UEBER);
