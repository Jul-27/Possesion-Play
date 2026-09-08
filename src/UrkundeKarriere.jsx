import { UrkundeRahmen } from "./Urkunde.jsx";

/* Die Laufbahn-Urkunde — das Bild, das am Ende bleibt.

   SIE DARF NICHTS VON AUSSEN LADEN. Keine Wappen, keine Spielerfotos, keine
   Webschriften. Ein SVG, das als Bild in eine Leinwand gezeichnet wird, verliert
   externe Bilder und macht die Leinwand unauslesbar — der PNG-Export bräche genau
   dann, wenn er gebraucht wird. Deshalb steht hier nur, was sich zeichnen lässt:
   Namen, Zahlen, die Kurve.

   Dieselbe Regel und dasselbe Maß wie bei der Saisonurkunde der Traumelf; den
   Rahmen (Anzeigen und Speichern) teilen sich beide. */

const B = 900, H = 1240;
const GOLD = "#E7B84B", TINTE = "#0B1220", HELL = "#F4F7FB", MATT = "#9BB0C7", TEAL = "#4FD1E5";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/* Die Kurve als reine Linienzeichnung — ohne Wappen, siehe oben. */
function kurve(verlauf, x0, y0, w, h) {
  if (verlauf.length < 2) return null;
  const werte = verlauf.map((z) => z.ovr);
  const min = Math.min(...werte) - 4, max = Math.max(...werte) + 4;
  const px = (i) => x0 + (i / (verlauf.length - 1)) * w;
  const py = (v) => y0 + (1 - (v - min) / (max - min || 1)) * h;
  const linie = verlauf.map((z, i) => `${px(i)},${py(z.ovr)}`).join(" ");
  return (
    <g>
      <polygon points={`${px(0)},${y0 + h} ${linie} ${px(verlauf.length - 1)},${y0 + h}`} fill={TEAL} opacity=".14" />
      <polyline points={linie} fill="none" stroke={TEAL} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {verlauf.map((z, i) => (z.titel || []).length ? (
        <circle key={i} cx={px(i)} cy={py(z.ovr)} r="6" fill={GOLD} stroke={TINTE} strokeWidth="2" />
      ) : null)}
      <text x={x0} y={y0 + h + 22} fill={MATT} fontSize="16" fontFamily={SANS}>{verlauf[0].alter} Jahre</text>
      <text x={x0 + w} y={y0 + h + 22} textAnchor="end" fill={MATT} fontSize="16" fontFamily={SANS}>
        {verlauf.at(-1).alter} Jahre
      </text>
    </g>
  );
}

export function urkundeKarriereSvg({ name, nummer, position, land, verlauf, gesamt, hoechste, titel, auszeichnungen, vereine, datum }) {
  const zahl = (v) => new Intl.NumberFormat("de-DE").format(v);
  const kennzahlen = [
    ["Spiele", zahl(gesamt.spiele)], ["Tore", zahl(gesamt.tore)],
    ["Vorlagen", zahl(gesamt.vorlagen)], ["Höchste Stärke", String(hoechste)],
  ];

  return (
    <svg viewBox={`0 0 ${B} ${H}`} width="100%" xmlns="http://www.w3.org/2000/svg">
      <rect width={B} height={H} fill={TINTE} />
      <rect x="28" y="28" width={B - 56} height={H - 56} fill="none" stroke={GOLD} strokeWidth="2" opacity=".5" />

      <text x={B / 2} y="112" textAnchor="middle" fill={GOLD} fontSize="20" letterSpacing="7" fontFamily={SANS}>
        LAUFBAHN
      </text>
      <text x={B / 2} y="188" textAnchor="middle" fill={HELL} fontSize="58" fontWeight="700" fontFamily={SANS}>
        {name}
      </text>
      <text x={B / 2} y="228" textAnchor="middle" fill={MATT} fontSize="20" fontFamily={SANS}>
        #{nummer} · {position} · {land}
      </text>

      {/* Kennzahlen */}
      {kennzahlen.map(([k, v], i) => {
        const x = 96 + i * ((B - 192) / 4) + (B - 192) / 8;
        return (
          <g key={k}>
            <text x={x} y="316" textAnchor="middle" fill={HELL} fontSize="40" fontWeight="700" fontFamily={SANS}>{v}</text>
            <text x={x} y="344" textAnchor="middle" fill={MATT} fontSize="15" letterSpacing="1.5" fontFamily={SANS}>
              {k.toUpperCase()}
            </text>
          </g>
        );
      })}

      {/* Der Verlauf */}
      <text x="96" y="410" fill={GOLD} fontSize="15" letterSpacing="3" fontFamily={SANS}>STÄRKE ÜBER DIE JAHRE</text>
      {kurve(verlauf, 96, 430, B - 192, 170)}

      {/* Vitrine */}
      <text x="96" y="686" fill={GOLD} fontSize="15" letterSpacing="3" fontFamily={SANS}>VITRINE</text>
      {titel.length
        ? titel.slice(0, 12).map((t, i) => (
            <text key={t.name} x={96 + (i % 2) * ((B - 192) / 2)} y={720 + Math.floor(i / 2) * 30}
              fill={HELL} fontSize="19" fontFamily={SANS}>
              {t.name}{t.anzahl > 1 ? ` ×${t.anzahl}` : ""}
            </text>
          ))
        : <text x="96" y="720" fill={MATT} fontSize="19" fontFamily={SANS}>Keine Titel — auch das ist eine Laufbahn.</text>}

      {/* Auszeichnungen */}
      <text x="96" y="920" fill={GOLD} fontSize="15" letterSpacing="3" fontFamily={SANS}>AUSZEICHNUNGEN</text>
      {auszeichnungen.length
        ? auszeichnungen.slice(0, 4).map((a, i) => (
            <g key={a.name}>
              <text x="96" y={956 + i * 46} fill={GOLD} fontSize="22" fontWeight="700" fontFamily={SANS}>{a.name}</text>
              <text x="96" y={978 + i * 46} fill={MATT} fontSize="15" fontFamily={SANS}>{a.text}</text>
            </g>
          ))
        : <text x="96" y="956" fill={MATT} fontSize="19" fontFamily={SANS}>Keine — sie verlangen mehr als eine ordentliche Laufbahn.</text>}

      {/* Vereine */}
      <text x="96" y="1150" fill={MATT} fontSize="15" fontFamily={SANS}>
        {vereine.length} Verein{vereine.length === 1 ? "" : "e"}: {vereine.slice(0, 8).join(" · ")}{vereine.length > 8 ? " …" : ""}
      </text>
      <text x="96" y="1180" fill={MATT} fontSize="13" opacity=".7" fontFamily={SANS}>
        Possession Play · {datum}
      </text>
    </svg>
  );
}

export default function UrkundeKarriere(props) {
  const sauber = String(props.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "laufbahn";
  return <UrkundeRahmen kind={urkundeKarriereSvg(props)} breite={B} hoehe={H} dateiname={`laufbahn-${sauber}.png`} />;
}
