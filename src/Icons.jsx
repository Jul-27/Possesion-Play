/* Gezeichnete Icons statt Emoji.

   WARUM ÜBERHAUPT: Emoji sehen auf jedem Gerät anders aus — auf dem iPhone
   plastisch und bunt, auf Android flach, auf Windows wieder anders. In einer App,
   deren Farben sonst genau gesetzt sind, wirken sie wie Platzhalter und ziehen die
   Aufmerksamkeit auf sich, ohne etwas zu erklären.

   ENTWURFSREGELN, damit der Satz zusammenpasst:
   · 24×24-Raster, Strichstärke 1.75, runde Enden und Ecken
   · alles in `currentColor` — die Farbe kommt vom Modus, nicht vom Icon
   · keine Füllungen außer dort, wo eine Form sonst nicht lesbar ist
   · inline als SVG, keine Bibliothek und keine Schriftdatei */

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" };

const FORMEN = {
  // Daily-Star — der Tagesstern
  star: <path {...P} d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,

  // Elf des Tages — Trikot
  jersey: <path {...P} d="M8.5 3.5L5 5.2 3.5 9l2.7 1.1V20a.5.5 0 00.5.5h10.6a.5.5 0 00.5-.5v-9.9L20.5 9 19 5.2l-3.5-1.7a3.5 3.5 0 01-7 0z" />,

  // Karriere-Pfad — Weg mit Stationen
  route: <>
    <circle {...P} cx="6" cy="6" r="2.4" />
    <circle {...P} cx="18" cy="18" r="2.4" />
    <path {...P} d="M8.4 6h5.1a3.5 3.5 0 010 7h-3a3.5 3.5 0 000 7h5.1" />
  </>,

  // Wer passt nicht? — drei gleiche, einer anders
  odd: <>
    <circle {...P} cx="7" cy="7" r="2.6" /><circle {...P} cx="17" cy="7" r="2.6" />
    <circle {...P} cx="7" cy="17" r="2.6" />
    <path {...P} d="M14.4 14.4h5.2v5.2h-5.2z" />
  </>,

  // Fußball-Kette — zwei Glieder
  chain: <>
    <path {...P} d="M10 14a4 4 0 010-5.7l2.1-2.1a4 4 0 015.7 5.7l-1 1" />
    <path {...P} d="M14 10a4 4 0 010 5.7l-2.1 2.1a4 4 0 01-5.7-5.7l1-1" />
  </>,

  // Heatmap — Flamme
  flame: <>
    <path {...P} d="M12 3s5.2 4 5.2 8.6A5.2 5.2 0 0112 17a5.2 5.2 0 01-5.2-5.4C6.8 8.6 9 6.7 9 6.7s.3 2 1.6 2.6C11 7.6 12 5.4 12 3z" />
    <path {...P} d="M9.6 20.5h4.8" />
  </>,

  // Hex-Training — Hexfeld mit Mittelpunkt
  hex: <>
    <path {...P} d="M12 2.8l7.4 4.3v8.6L12 20l-7.4-4.3V7.1z" />
    <circle {...P} cx="12" cy="11.4" r="2.4" />
  </>,

  // Transferkarussell — Wechsel im Kreis
  carousel: <>
    <path {...P} d="M20 12a8 8 0 01-13.3 6" /><path {...P} d="M4 12a8 8 0 0113.3-6" />
    <path {...P} d="M4 14.5V18h3.5" /><path {...P} d="M20 9.5V6h-3.5" />
  </>,

  // Bestenliste — Pokal
  trophy: <>
    <path {...P} d="M7.5 4h9v5a4.5 4.5 0 01-9 0z" />
    <path {...P} d="M7.5 5.5H5A2.5 2.5 0 007.6 9M16.5 5.5H19A2.5 2.5 0 0116.4 9" />
    <path {...P} d="M12 13.5V17M9 20h6M10 17h4" />
  </>,

  // Statistik — Balken
  chart: <><path {...P} d="M5 20V11M12 20V4M19 20v-6" /><path {...P} d="M3.5 20h17" /></>,

  // Duell — zwei Figuren
  duel: <>
    <circle {...P} cx="8.5" cy="8" r="2.8" /><circle {...P} cx="16.5" cy="9.5" r="2.3" />
    <path {...P} d="M3.5 19.5c0-2.8 2.2-5 5-5s5 2.2 5 5" />
    <path {...P} d="M14.8 14.9a4.4 4.4 0 015.7 4.6" />
  </>,

  /* Serie — Flamme für KLEINE Größen (12–15 px). Bewusst eine andere, gröbere Form
     als `flame`: die detaillierte Kontur zerfällt dort zu einem Kringel, weil die
     Strichstärke mitskaliert. Gefüllt statt gestrichelt, damit sie trägt. */
  streak: <path d="M12 2.5c.6 3.2 2.4 4.4 3.8 6 1.2 1.4 1.9 2.8 1.9 4.5A5.7 5.7 0 0112 18.8a5.7 5.7 0 01-5.7-5.8c0-2.6 1.7-4.2 2.7-5.6.3 1.1.9 1.9 1.7 2.4.3-2.6.8-5 1.3-7.3z"
    fill="currentColor" />,

  // ── Bedienelemente ───────────────────────────────────────────────────────
  sound: <>
    <path {...P} d="M4 9.5h3l4.5-3.6v12.2L7 14.5H4z" />
    <path {...P} d="M15.5 9.2a4 4 0 010 5.6M18 6.8a7.5 7.5 0 010 10.4" />
  </>,
  mute: <>
    <path {...P} d="M4 9.5h3l4.5-3.6v12.2L7 14.5H4z" />
    <path {...P} d="M16 9.5l4.5 5M20.5 9.5l-4.5 5" />
  </>,
  help: <>
    <circle {...P} cx="12" cy="12" r="9" />
    <path {...P} d="M9.6 9.3a2.5 2.5 0 114.4 2c-.9.8-1.8 1.3-1.8 2.6" />
    <path {...P} d="M12 17.3h.01" strokeWidth="2.2" />
  </>,
  leave: <>
    <path {...P} d="M14 4.5h3.5a2 2 0 012 2v11a2 2 0 01-2 2H14" />
    <path {...P} d="M9.5 8L5.5 12l4 4M5.5 12h9" />
  </>,
  flag: <><path {...P} d="M6 21V4" /><path {...P} d="M6 4.8h10.5l-2.2 3.8 2.2 3.9H6" /></>,

  // Raster-Duell — 3×3-Feld
  grid: <>
    <path {...P} d="M3.8 3.8h16.4v16.4H3.8z" />
    <path {...P} d="M9.3 3.8v16.4M14.7 3.8v16.4M3.8 9.3h16.4M3.8 14.7h16.4" />
  </>,
  // Errate den Star — Suche nach dem Unbekannten
  guess: <>
    <circle {...P} cx="10.8" cy="10.8" r="6.5" /><path {...P} d="M15.6 15.6L20.5 20.5" />
    <path {...P} d="M9 9.2a2 2 0 113.4 1.6c-.7.6-1.4 1-1.4 2" />
  </>,

  check: <path {...P} d="M4.5 12.5l5 5 10-11" />,
  pfeil: <><path {...P} d="M4.5 12h15" /><path {...P} d="M13.5 6l6 6-6 6" /></>,
  chevron: <path {...P} d="M6 9.5l6 6 6-6" />,
};

export const ICON_NAMEN = Object.keys(FORMEN);

/** <Icon name="flame" /> — Größe über `size`, Farbe erbt von der Umgebung. */
export default function Icon({ name, size = 22, className = "", title }) {
  const form = FORMEN[name];
  if (!form) return null;
  return (
    <svg className={`ic ${className}`} width={size} height={size} viewBox="0 0 24 24"
      role={title ? "img" : "presentation"} aria-hidden={title ? undefined : "true"} focusable="false">
      {title && <title>{title}</title>}
      {form}
    </svg>
  );
}
