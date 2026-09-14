import { UrkundeRahmen } from "./Urkunde.jsx";
import { FORM_VON_TITEL } from "./Trophaeen.jsx";
import { istHell } from "./trikots.js";

/* Die Laufbahn-Zusammenfassung — das Bild, das am Ende bleibt.

   ── WAS SIE ZEIGT UND WARUM SO ──────────────────────────────────────────────
   Vorher war sie eine hochformatige Urkunde: Name, vier Zahlen, eine Kurve, drei
   Listen. Sie sagte, WIE GUT die Laufbahn war, aber nicht, WORAUS sie bestand.

   Jetzt steht oben die Person und darunter eine Karte je Verein — in den Farben des
   Vereins, mit Wappen, Spielen, Toren, Vorlagen und den dort gewonnenen Trophäen.
   Damit liest sie sich, wie man eine Laufbahn erzählt: „Erst Sandhausen, dann drei
   Jahre Freiburg, dann Sevilla — und in Sevilla der Pokal."

   ── SIE DARF NICHTS VON AUSSEN LADEN ────────────────────────────────────────
   Keine Wappenfotos, keine Trophäenbilder, keine Webschriften. Ein SVG, das als Bild
   in eine Leinwand gezeichnet wird, verliert externe Bilder und macht die Leinwand
   unauslesbar — der PNG-Export bräche genau dann, wenn er gebraucht wird. Deshalb
   sind Wappen und Trophäen hier GEZEICHNET: das Wappen als Scheibe in den
   Vereinsfarben mit dem Kürzel, die Trophäe in derselben Form wie im Spiel. */

const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";
/* Dieselben Farben wie der Modus: Rasen-Dunkelgrün, Bernstein als einziger Akzent. */
const TINTE = "#06130F", KARTE = "#0E241C", RAND = "#1F4034";
const HELL = "#E8F3ED", MATT = "#8CA89A", GOLD = "#F5B301";

const B = 1240;
const KOPF_H = 210, KARTE_H = 190, SPALTEN = 4, LUECKE = 16, RAHMEN = 28;
const KARTE_B = (B - 2 * RAHMEN - (SPALTEN - 1) * LUECKE) / SPALTEN;
const hoeheFuer = (n) => KOPF_H + RAHMEN + Math.max(1, Math.ceil(n / SPALTEN)) * (KARTE_H + LUECKE) + 26;

/* ── Trophäen, klein und gezeichnet ──────────────────────────────────────────
   Dieselben sieben Formen wie im Spiel (src/Trophaeen.jsx), hier als ein einzelner
   Pfad je Form: In einer Vereinskarte geht es nur darum, dass man Schale,
   Henkelpokal und die grossen Ohren auseinanderhält. */
const POKAL_PFAD = {
  schale: "M18 26 C18 44 30 54 50 54 C70 54 82 44 82 26 Z M14 20 h72 v7 h-72 Z M28 64 h44 v10 h-44 Z M44 54 h12 v10 h-12 Z",
  pokal: "M36 12 h28 l-2 8 h-24 Z M32 22 h36 C68 44 60 54 50 54 C40 54 32 44 32 22 Z M32 64 h36 v11 h-36 Z M45 54 h10 v10 h-10 Z",
  ohren: "M34 14 L66 14 C66 42 60 54 50 54 C40 54 34 42 34 14 Z M34 16 C12 12 8 38 24 50 L29 44 C20 36 22 22 34 24 Z M66 16 C88 12 92 38 76 50 L71 44 C80 36 78 22 66 24 Z M31 63 h38 v12 h-38 Z M45 54 h10 v9 h-10 Z",
  amphore: "M38 10 C30 24 30 40 42 52 L58 52 C70 40 70 24 62 10 Z M36 8 h28 v6 h-28 Z M33 64 h34 v11 h-34 Z M45 52 h10 v12 h-10 Z",
  globus: "M30 28 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0 M38 48 C40 58 44 62 50 62 C56 62 60 58 62 48 Z M32 62 h36 v12 h-36 Z",
  kelch: "M22 16 C22 40 34 52 50 52 C66 52 78 40 78 16 Z M20 12 h60 v6 h-60 Z M46 52 h8 l2 12 h-12 Z M34 64 h32 v11 h-32 Z",
  ball: "M33 26 a17 17 0 1 0 34 0 a17 17 0 1 0 -34 0 M45 43 h10 v20 h-10 Z M34 63 h32 v12 h-32 Z",
};
const pokal = (titel, x, y, s, schluessel) => (
  <path key={schluessel} d={POKAL_PFAD[FORM_VON_TITEL[titel] || "pokal"]} fill={GOLD}
    transform={`translate(${x} ${y}) scale(${s / 100})`} />
);

/* Das Wappen als Scheibe: Vereinsfarbe, Ring in der zweiten Farbe, Kürzel darin.
   Das echte Wappen ist eine PNG-Datei und darf hier nicht hinein.

   Die Schriftfarbe richtet sich nach der Helligkeit des Vereins (istHell) — Real
   Madrid ist weiss, und weisse Buchstaben auf weisser Scheibe sind keine. */
const wappen = (cx, cy, r, c1, c2, kuerzel) => (
  <g>
    <circle cx={cx} cy={cy} r={r} fill={c1} stroke={c2} strokeWidth={Math.max(2, r * 0.12)} />
    <text x={cx} y={cy + r * 0.3} textAnchor="middle" fontFamily={SANS} fontWeight="700"
      fontSize={r * 0.7} fill={istHell(c1) ? "#15201A" : "#FFFFFF"} opacity=".95">
      {String(kuerzel || "").slice(0, 4)}
    </text>
  </g>
);

const zahl = (x, y, wert, name) => (
  <g>
    <text x={x} y={y} textAnchor="middle" fontFamily={SANS} fontWeight="700" fontSize="24" fill={HELL}>{wert}</text>
    <text x={x} y={y + 14} textAnchor="middle" fontFamily={SANS} fontSize="9" letterSpacing="1.2" fill={MATT}>{name}</text>
  </g>
);

/* Nationaltitel gehören ins Länderfeld, Vereinstitel auf die Vereinskarten. */
const NATIONAL = new Set(["WM", "EM", "CA"]);

export function urkundeKarriereSvg({
  name, nummer, position, land, gesamt = {}, hoechste = 0, marktwert = "",
  titel = [], auszeichnungen = [], stationen = [], datum = "",
}) {
  const H = hoeheFuer(stationen.length);
  const nationalTitel = titel.filter((t) => NATIONAL.has(t.key));
  const bdo = titel.find((t) => t.key === "BDO");

  return (
    <svg viewBox={`0 0 ${B} ${H}`} width="100%" role="img" aria-label={`Laufbahn von ${name}`}>
      <rect width={B} height={H} fill={TINTE} />

      {/* ── Kopf: die Person ──────────────────────────────────────────────── */}
      <rect x={RAHMEN} y={RAHMEN} width={640} height={KOPF_H - RAHMEN} rx="16" fill={KARTE} stroke={RAND} />
      <text x={RAHMEN + 26} y={RAHMEN + 34} fontFamily={SANS} fontSize="11" letterSpacing="3" fill={MATT}>LAUFBAHN BEENDET</text>
      <text x={RAHMEN + 26} y={RAHMEN + 80} fontFamily={SANS} fontWeight="800" fontSize="44" fill={HELL}>{name}</text>
      <text x={RAHMEN + 26} y={RAHMEN + 104} fontFamily={SANS} fontSize="14" fill={MATT}>#{nummer} · {position} · {land}</text>
      {zahl(RAHMEN + 62, RAHMEN + 158, gesamt.spiele ?? 0, "SPIELE")}
      {zahl(RAHMEN + 182, RAHMEN + 158, gesamt.tore ?? 0, "TORE")}
      {zahl(RAHMEN + 302, RAHMEN + 158, gesamt.vorlagen ?? 0, "VORLAGEN")}
      {zahl(RAHMEN + 422, RAHMEN + 158, stationen.length, "VEREINE")}
      {/* Die Rating-Kachel wie im Spiel — der Höchstwert der Laufbahn. */}
      <rect x={RAHMEN + 522} y={RAHMEN + 38} width={92} height={92} rx="16" fill={GOLD} />
      <text x={RAHMEN + 568} y={RAHMEN + 68} textAnchor="middle" fontFamily={SANS} fontWeight="700" fontSize="11" letterSpacing="2" fill="#1B1401">RATING</text>
      <text x={RAHMEN + 568} y={RAHMEN + 114} textAnchor="middle" fontFamily={SANS} fontWeight="800" fontSize="42" fill="#1B1401">{hoechste}</text>
      {marktwert ? <text x={RAHMEN + 568} y={RAHMEN + 152} textAnchor="middle" fontFamily={SANS} fontSize="12" fill={GOLD}>{marktwert}</text> : null}

      {/* ── Auswahl ───────────────────────────────────────────────────────── */}
      <rect x={RAHMEN + 656} y={RAHMEN} width={262} height={KOPF_H - RAHMEN} rx="16" fill={KARTE} stroke={RAND} />
      <text x={RAHMEN + 680} y={RAHMEN + 34} fontFamily={SANS} fontSize="11" letterSpacing="3" fill={MATT}>AUSWAHL</text>
      <text x={RAHMEN + 680} y={RAHMEN + 64} fontFamily={SANS} fontWeight="700" fontSize="21" fill={HELL}>{land}</text>
      {nationalTitel.length
        ? nationalTitel.slice(0, 3).map((t, i) => (
            <g key={t.key}>
              {pokal(t.key, RAHMEN + 682 + i * 74, RAHMEN + 82, 54, t.key)}
              <text x={RAHMEN + 709 + i * 74} y={RAHMEN + 152} textAnchor="middle" fontFamily={SANS} fontSize="9" fill={MATT}>
                {t.anzahl > 1 ? `${t.name} ×${t.anzahl}` : t.name}
              </text>
            </g>
          ))
        : <text x={RAHMEN + 680} y={RAHMEN + 106} fontFamily={SANS} fontSize="12" fill={MATT}>Vitrine leer</text>}

      {/* ── Einzelauszeichnungen ──────────────────────────────────────────── */}
      <rect x={RAHMEN + 934} y={RAHMEN} width={B - 2 * RAHMEN - 934} height={KOPF_H - RAHMEN} rx="16" fill={KARTE} stroke={RAND} />
      <text x={RAHMEN + 958} y={RAHMEN + 34} fontFamily={SANS} fontSize="11" letterSpacing="3" fill={MATT}>EINZELAUSZEICHNUNGEN</text>
      {bdo ? pokal("BDO", RAHMEN + 954, RAHMEN + 44, 50, "bdo") : null}
      {bdo ? <text x={RAHMEN + 979} y={RAHMEN + 104} textAnchor="middle" fontFamily={SANS} fontSize="9" fill={GOLD}>
          {bdo.anzahl > 1 ? `Ballon d'Or ×${bdo.anzahl}` : "Ballon d'Or"}</text> : null}
      {auszeichnungen.slice(0, 4).map((a, i) => (
        <text key={a.key} x={RAHMEN + (bdo ? 1014 : 958)} y={RAHMEN + (bdo ? 58 : 62) + i * 18}
          fontFamily={SANS} fontSize="12" fill={HELL}>{a.name}</text>
      ))}
      {!bdo && !auszeichnungen.length
        ? <text x={RAHMEN + 958} y={RAHMEN + 62} fontFamily={SANS} fontSize="12" fill={MATT}>keine</text>
        : null}

      {/* ── Eine Karte je Verein ──────────────────────────────────────────── */}
      {stationen.map((s, i) => {
        const x = RAHMEN + (i % SPALTEN) * (KARTE_B + LUECKE);
        const y = KOPF_H + RAHMEN + Math.floor(i / SPALTEN) * (KARTE_H + LUECKE);
        const mitte = x + KARTE_B / 2;
        const pokale = (s.titel || []).slice(0, 5);
        return (
          <g key={`${s.key}-${i}`}>
            {/* Die Karte trägt die Farbe des Vereins, gedämpft, damit die Zahlen
                darauf lesbar bleiben. */}
            <rect x={x} y={y} width={KARTE_B} height={KARTE_H} rx="14" fill={s.c1} opacity={istHell(s.c1) ? 0.1 : 0.22} />
            <rect x={x} y={y} width={KARTE_B} height={KARTE_H} rx="14" fill="none" stroke={s.c1} strokeOpacity=".55" />
            {wappen(mitte, y + 46, 26, s.c1, s.c2 || "#FFFFFF", s.label || s.key)}
            <text x={mitte} y={y + 94} textAnchor="middle" fontFamily={SANS} fontWeight="700" fontSize="14" fill={HELL}>
              {s.name.length > 22 ? s.name.slice(0, 21) + "…" : s.name}
            </text>
            <line x1={x + 16} y1={y + 106} x2={x + KARTE_B - 16} y2={y + 106} stroke={RAND} />
            {zahl(x + KARTE_B * 0.22, y + 130, s.spiele, "SP")}
            {zahl(x + KARTE_B * 0.5, y + 130, s.tore, "TO")}
            {zahl(x + KARTE_B * 0.78, y + 130, s.vorlagen, "VO")}
            {pokale.map((tk, n) => pokal(tk, mitte - (pokale.length * 32) / 2 + n * 32, y + 152, 32, `${tk}-${n}`))}
          </g>
        );
      })}

      <text x={B - RAHMEN} y={H - 12} textAnchor="end" fontFamily={SANS} fontSize="10" fill={MATT}>
        Possession Play · Karriere · {datum}
      </text>
    </svg>
  );
}

export default function UrkundeKarriere(props) {
  const sauber = String(props.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "laufbahn";
  return (
    <UrkundeRahmen kind={urkundeKarriereSvg(props)} breite={B} hoehe={hoeheFuer((props.stationen || []).length)}
      dateiname={`laufbahn-${sauber}.png`} />
  );
}
