import { useRef, useState } from "react";
import { POS_BY_KEY } from "./positions.js";

/* Die Saisonurkunde — eine Grafik, die man wegschicken kann.

   WARUM ALS SVG UND NICHT ALS ABFOTOGRAFIERTE HTML-KARTE: Ein SVG ist in jeder
   Auflösung scharf, braucht keine Bibliothek und lässt sich mit drei Zeilen in ein
   PNG verwandeln. `html2canvas` hätte die bestehende Karte abgelichtet — weniger
   Arbeit, aber unschärfer, und es greift bei Schriften und Emojis regelmäßig daneben.

   KEINE GESICHTER, NUR NAMEN. Spielerfotos liegen bei Wikimedia; ein SVG, das sie
   verlinkt, verliert sie beim Umwandeln ins PNG (die Leinwand wäre außerdem
   „getaint" und ließe sich gar nicht mehr auslesen). Sie müssten also einzeln
   nachgeladen und als Daten eingebettet werden — viel Aufwand für eine Urkunde, die
   von Namen lebt.

   SCHRIFTEN: Ein als Bild geladenes SVG sieht die Webfonts des Dokuments NICHT. Die
   Urkunde nutzt deshalb bewusst nur Systemschriften — sonst stünde im PNG etwas
   anderes als auf dem Bildschirm. */

const B = 900, H = 1240;                    // Urkundenmaß, Hochformat
const GOLD = "#E7B84B", TINTE = "#0B1220", HELL = "#F4F7FB", MATT = "#9BB0C7";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/* Das Feld sitzt in einem eigenen Kasten; die Slot-Koordinaten kommen in Prozent. */
const FELD = { x: 96, y: 470, w: 708, h: 470 };

export function urkundeSvg({ liga, saison, formation, abzeichen, zeile, teams, elf, hoehen, wertung, datum }) {
  const px = (x) => FELD.x + (x / 100) * FELD.w;
  const py = (y) => FELD.y + (y / 100) * FELD.h;
  const kopf = (s) => String(s).toUpperCase();

  const fakten = [
    hoehen?.bestes && ["Höchster Sieg", `${hoehen.bestes.eigene}:${hoehen.bestes.fremde} ${hoehen.bestes.heim ? "gegen" : "bei"} ${hoehen.bestes.gegner}`],
    hoehen?.schlimmstes && ["Bitterste Pleite", `${hoehen.schlimmstes.eigene}:${hoehen.schlimmstes.fremde} ${hoehen.schlimmstes.heim ? "gegen" : "bei"} ${hoehen.schlimmstes.gegner}`],
    hoehen && ["Längste Serie ohne Niederlage", `${hoehen.serie} Spiele`],
    wertung && ["Stärke der Elf", `${wertung.wertung} · ${wertung.paare} Verbund-Paare`],
  ].filter(Boolean);

  return (
    <svg viewBox={`0 0 ${B} ${H}`} width={B} height={H} xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", display: "block" }}>
      <rect width={B} height={H} fill={TINTE} />
      {/* Doppelrahmen — das Merkmal, das eine Urkunde zur Urkunde macht. */}
      <rect x="22" y="22" width={B - 44} height={H - 44} fill="none" stroke={GOLD} strokeWidth="3" />
      <rect x="34" y="34" width={B - 68} height={H - 68} fill="none" stroke={GOLD} strokeWidth="1" opacity="0.55" />

      <text x={B / 2} y="104" textAnchor="middle" fill={GOLD} fontFamily={SANS} fontSize="19" letterSpacing="7">{kopf("Possession Play")}</text>
      <text x={B / 2} y="168" textAnchor="middle" fill={HELL} fontFamily={SANS} fontSize="54" fontWeight="700" letterSpacing="3">{kopf("Traumelf")}</text>
      <line x1="300" y1="196" x2="600" y2="196" stroke={GOLD} strokeWidth="1" />
      <text x={B / 2} y="232" textAnchor="middle" fill={MATT} fontFamily={SANS} fontSize="21">{liga} · Saison {saison} · {formation}</text>

      {/* Das Abzeichen ist die Aussage der Urkunde und steht deshalb groß. */}
      <text x={B / 2} y="310" textAnchor="middle" fill={GOLD} fontFamily={SANS} fontSize="46" fontWeight="700">{abzeichen}</text>
      <text x={B / 2} y="350" textAnchor="middle" fill={HELL} fontFamily={SANS} fontSize="23">Platz {zeile.platz} von {teams}</text>

      {/* Bilanz in vier Spalten. */}
      {[["Siege", zeile.s], ["Unent.", zeile.u], ["Nieder.", zeile.n], ["Punkte", zeile.punkte]].map(([label, wert], i) => {
        const x = 150 + i * 200;
        return (
          <g key={label}>
            <text x={x} y="410" textAnchor="middle" fill={HELL} fontFamily={SANS} fontSize="38" fontWeight="700">{wert}</text>
            <text x={x} y="434" textAnchor="middle" fill={MATT} fontFamily={SANS} fontSize="14" letterSpacing="1">{kopf(label)}</text>
          </g>
        );
      })}

      {/* Das Spielfeld mit der Elf. */}
      <rect x={FELD.x} y={FELD.y} width={FELD.w} height={FELD.h} fill="#0E1826" stroke={GOLD} strokeWidth="1" opacity="0.9" />
      <line x1={FELD.x} y1={FELD.y + FELD.h / 2} x2={FELD.x + FELD.w} y2={FELD.y + FELD.h / 2} stroke={GOLD} strokeWidth="0.6" opacity="0.35" />
      <circle cx={FELD.x + FELD.w / 2} cy={FELD.y + FELD.h / 2} r="46" fill="none" stroke={GOLD} strokeWidth="0.6" opacity="0.35" />
      {elf.map((s, k) => (
        <g key={k}>
          <circle cx={px(s.x)} cy={py(s.y)} r="14" fill={s.pos === "TW" ? GOLD : "#1D3A54"} stroke={GOLD} strokeWidth="1" />
          <text x={px(s.x)} y={py(s.y) + 4} textAnchor="middle" fill={s.pos === "TW" ? TINTE : HELL} fontFamily={SANS} fontSize="10" fontWeight="700">
            {POS_BY_KEY[s.pos]?.kurz || s.pos}
          </text>
          {/* Der Name unter dem Punkt. Nachname genügt — Vornamen sprengen die Reihe. */}
          <text x={px(s.x)} y={py(s.y) + 30} textAnchor="middle" fill={HELL} fontFamily={SANS} fontSize="13">{s.name}</text>
          <text x={px(s.x)} y={py(s.y) + 45} textAnchor="middle" fill={MATT} fontFamily={SANS} fontSize="11">{s.jahr}</text>
        </g>
      ))}

      {/* Die Höhepunkte als Zeilenpaare. */}
      {fakten.map(([label, wert], i) => (
        <g key={label}>
          <text x="96" y={1000 + i * 34} fill={MATT} fontFamily={SANS} fontSize="14">{label}</text>
          <text x={B - 96} y={1000 + i * 34} textAnchor="end" fill={HELL} fontFamily={SANS} fontSize="15" fontWeight="700">{wert}</text>
          <line x1="96" y1={1010 + i * 34} x2={B - 96} y2={1010 + i * 34} stroke={GOLD} strokeWidth="0.5" opacity="0.18" />
        </g>
      ))}

      <text x={B / 2} y={H - 56} textAnchor="middle" fill={MATT} fontFamily={SANS} fontSize="13">Ausgestellt am {datum}</text>
    </svg>
  );
}

/**
 * Die Urkunde samt Knopf zum Speichern.
 *
 * Der Umweg über die Leinwand ist nötig, weil ein SVG zwar scharf ist, aber niemand
 * ein SVG in einen Nachrichtenverlauf zieht. Gerendert wird in doppelter Auflösung
 * — auf einem Telefonbildschirm sieht ein 1:1 gerastertes PNG matschig aus.
 */
export default function Urkunde(props) {
  const huelle = useRef(null);
  const [stand, setStand] = useState(null);   // null | "laeuft" | "fertig" | "fehler"

  async function speichern() {
    const svg = huelle.current?.querySelector("svg");
    if (!svg) return;
    setStand("laeuft");
    try {
      const xml = new XMLSerializer().serializeToString(svg);
      const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
      const bild = new Image();
      await new Promise((fertig, fehler) => {
        bild.onload = fertig;
        bild.onerror = () => fehler(new Error("SVG nicht ladbar"));
        bild.src = url;
      });
      const skala = 2;
      const leinwand = document.createElement("canvas");
      leinwand.width = B * skala;
      leinwand.height = H * skala;
      const ctx = leinwand.getContext("2d");
      ctx.drawImage(bild, 0, 0, leinwand.width, leinwand.height);
      URL.revokeObjectURL(url);
      /* Die Leinwand bleibt sauber, weil das SVG NICHTS Externes lädt — keine Fotos,
         keine Wappen, keine Webfonts. Genau deshalb funktioniert toBlob hier. */
      const png = await new Promise((r) => leinwand.toBlob(r, "image/png"));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(png);
      a.download = `traumelf-${props.saison.replace("/", "-")}-${props.abzeichen.toLowerCase().replace(/[^a-z]+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setStand("fertig");
    } catch {
      setStand("fehler");
    }
  }

  return (
    <div className="tmUrkunde">
      <div className="tmUrkundeBild" ref={huelle}>{urkundeSvg(props)}</div>
      <div className="closeline">
        <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={speichern} disabled={stand === "laeuft"}>
          {stand === "laeuft" ? "Erzeuge Bild…" : stand === "fertig" ? "Gespeichert ✓" : stand === "fehler" ? "Noch einmal versuchen" : "Urkunde als Bild speichern"}
        </button>
      </div>
    </div>
  );
}
