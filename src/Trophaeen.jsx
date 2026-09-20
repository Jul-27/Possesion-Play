import { useId, useState } from "react";
import { TITEL_DATEN } from "./karriere.js";
import { GESTALTEN, MIT_BILD } from "./trophaeenFormen.js";
import { Gestalt } from "./TrophaeenFormen.jsx";
/* Eine Trophäe je Wettbewerb — 26 Stück, ein Satz.

   ── WARUM ─────────────────────────────────────────────────────────────────────
   Vorher trug jeder Titel dasselbe Wappenzeichen in anderer Farbe. In der Vitrine
   standen dann fünf identische Formen nebeneinander, und die Titelfeier zeigte bei
   der Champions League dasselbe Bild wie beim DFB-Pokal. Ein Pokal, den man nicht
   erkennt, ist kein Pokal.

   ── WOHER DIE BILDER KOMMEN ───────────────────────────────────────────────────
   Fünf liegen als freigestellte Bilder unter /bilder/trophaee/titel/: Champions
   League, Europa League, WM, EM und Copa América, aus dem Vorbild übernommen.
   Mehr hat dessen Server nicht; sein Code führt einundvierzig Wettbewerbe, die
   Dateien dazu fehlen.

   Die übrigen 21 sind gezeichnet — siehe TrophaeenFormen.jsx, dort steht auch,
   warum nicht erzeugt. Beide Sätze sind hochkant, ohne Hintergrund, ohne Kontur
   und tragen denselben Schlagschatten aus dem Stylesheet. Nebeneinander sollen
   sie nicht auffallen.

   Weder die fünf Bilder noch die Fotos in jenem Ordner sind frei lizenziert;
   warum sie trotzdem hier liegen, steht dort in LIZENZ.md.

   ── DREI STUFEN ───────────────────────────────────────────────────────────────
   1. das freigestellte Bild, wenn es eines gibt,
   2. sonst die gezeichnete Gestalt des Wettbewerbs,
   3. sonst — für einen Titel, den beide Listen nicht kennen — die Grundform
      seiner Gattung.
   Jede Stufe fällt von selbst auf die nächste zurück. Löscht man den Bilderordner,
   sieht das Spiel wieder aus wie vorher; es bricht nichts. */

/* Welche Grundform ein Titel trägt, steht bei den Titeldaten in karriere.js —
   zusammen mit Name und Farbe. Zwei Listen, die man getrennt pflegen muss, laufen
   auseinander: Beim Nachtragen der acht neuen Meisterschaften hätte die eine die
   Namen bekommen und die andere nicht, und die Feier hätte einen Henkelpokal für
   eine Meisterschaft gezeigt. */
export const FORM_VON_TITEL = Object.fromEntries(
  Object.entries(TITEL_DATEN).map(([key, d]) => [key, d.form]));

/* Metall und Schattenseite der Grundformen. */
const GOLD = "#F0C040", GOLD_TIEF = "#9A6B12", SILBER = "#D8DEE6", SILBER_TIEF = "#8D97A4";

/* Die sieben Grundformen — eine je Gattung, nicht je Wettbewerb. Sie greifen nur
   noch für einen Titel ohne eigene Gestalt; solange beide Listen aus TITEL_DATEN
   gefüllt sind, kommt das nicht vor. */
const FORMEN = {
  /* Flache Schale mit zwei Griffen — die Meisterschaft. */
  schale: (h, d) => (
    <>
      <path d="M18 26 C18 44 30 54 50 54 C70 54 82 44 82 26 Z" fill={h} />
      <path d="M50 54 C70 54 82 44 82 26 L68 26 C68 40 60 48 50 48 Z" fill={d} />
      <path d="M18 26 C8 26 6 38 16 40 M82 26 C92 26 94 38 84 40" fill="none" stroke={h} strokeWidth="5" strokeLinecap="round" />
      <rect x="44" y="54" width="12" height="10" fill={d} />
      <rect x="28" y="64" width="44" height="10" rx="3" fill={h} />
      <rect x="28" y="69" width="44" height="5" rx="2" fill={d} />
      <rect x="14" y="20" width="72" height="7" rx="3" fill={h} />
    </>
  ),
  /* Henkelpokal mit Deckel — der Landespokal. */
  pokal: (h, d) => (
    <>
      <path d="M36 12 L64 12 L62 20 L38 20 Z" fill={h} />
      <circle cx="50" cy="8" r="4" fill={h} />
      <path d="M32 22 L68 22 C68 44 60 54 50 54 C40 54 32 44 32 22 Z" fill={h} />
      <path d="M50 54 C60 54 68 44 68 22 L56 22 C56 42 54 50 50 50 Z" fill={d} />
      <path d="M32 26 C20 26 18 42 30 46 M68 26 C80 26 82 42 70 46" fill="none" stroke={h} strokeWidth="5" strokeLinecap="round" />
      <rect x="45" y="54" width="10" height="10" fill={d} />
      <rect x="32" y="64" width="36" height="11" rx="3" fill={h} />
      <rect x="32" y="70" width="36" height="5" rx="2" fill={d} />
    </>
  ),
  /* Der Pokal mit den grossen Ohren — Champions League. */
  ohren: (h, d) => (
    <>
      <path d="M34 14 L66 14 C66 42 60 54 50 54 C40 54 34 42 34 14 Z" fill={h} />
      <path d="M50 54 C60 54 66 42 66 14 L55 14 C55 42 54 50 50 50 Z" fill={d} />
      {/* Die Ohren: weit ausgestellt und fast so hoch wie der Kelch. */}
      <path d="M34 16 C12 12 8 38 24 50 C28 52 32 48 29 44 C20 36 22 22 34 24 Z" fill={h} />
      <path d="M66 16 C88 12 92 38 76 50 C72 52 68 48 71 44 C80 36 78 22 66 24 Z" fill={h} />
      <rect x="45" y="54" width="10" height="9" fill={d} />
      <rect x="31" y="63" width="38" height="12" rx="3" fill={h} />
      <rect x="31" y="69" width="38" height="6" rx="2" fill={d} />
    </>
  ),
  /* Hoch, schlank, ohne Henkel — Europa League. */
  amphore: (h, d) => (
    <>
      <path d="M38 10 C30 24 30 40 42 52 L58 52 C70 40 70 24 62 10 Z" fill={h} />
      <path d="M50 52 L58 52 C70 40 70 24 62 10 L52 10 C58 26 58 40 50 50 Z" fill={d} />
      <rect x="36" y="8" width="28" height="6" rx="3" fill={h} />
      <rect x="45" y="52" width="10" height="12" fill={d} />
      <rect x="33" y="64" width="34" height="11" rx="3" fill={h} />
      <rect x="33" y="70" width="34" height="5" rx="2" fill={d} />
    </>
  ),
  /* Kugel auf Sockel — die Weltmeisterschaft. */
  globus: (h, d) => (
    <>
      <circle cx="50" cy="28" r="20" fill={h} />
      <path d="M50 8 A20 20 0 0 1 50 48 Z" fill={d} />
      <ellipse cx="50" cy="28" rx="20" ry="7" fill="none" stroke={d} strokeWidth="2" opacity=".7" />
      <ellipse cx="50" cy="28" rx="8" ry="20" fill="none" stroke={d} strokeWidth="2" opacity=".7" />
      <path d="M38 48 C40 58 44 62 50 62 C56 62 60 58 62 48 Z" fill={h} />
      <rect x="32" y="62" width="36" height="12" rx="3" fill={h} />
      <rect x="32" y="68" width="36" height="6" rx="2" fill={d} />
    </>
  ),
  /* Breite Schale auf schmalem Fuss — Kontinentalmeisterschaft. */
  kelch: (h, d) => (
    <>
      <path d="M22 16 C22 40 34 52 50 52 C66 52 78 40 78 16 Z" fill={h} />
      <path d="M50 52 C66 52 78 40 78 16 L62 16 C62 38 58 46 50 46 Z" fill={d} />
      <rect x="20" y="12" width="60" height="6" rx="3" fill={h} />
      <path d="M46 52 L54 52 L56 64 L44 64 Z" fill={d} />
      <rect x="34" y="64" width="32" height="11" rx="3" fill={h} />
      <rect x="34" y="70" width="32" height="5" rx="2" fill={d} />
    </>
  ),
  /* Kugel auf Säule — der Ballon d'Or, als einzige Auszeichnung für eine Person. */
  ball: (h, d) => (
    <>
      <circle cx="50" cy="26" r="17" fill={h} />
      <path d="M50 9 A17 17 0 0 1 50 43 Z" fill={d} />
      {/* Angedeutete Fünfecke, damit es ein Ball bleibt und keine Kugel wird. */}
      <path d="M50 17 L56 22 L54 30 L46 30 L44 22 Z" fill={d} opacity=".55" />
      <rect x="45" y="43" width="10" height="20" fill={h} />
      <rect x="50" y="43" width="5" height="20" fill={d} />
      <rect x="34" y="63" width="32" height="12" rx="3" fill={h} />
      <rect x="34" y="69" width="32" height="6" rx="2" fill={d} />
    </>
  ),
};

/**
 * Eine Trophäe. `titel` ist der Titelschlüssel (CL, MBL, DFB …), `groesse` die
 * Kantenlänge in Pixeln — das Bild wird darin eingepasst, nicht verzerrt.
 * `silber` zeichnet eine goldene Trophäe in Metallgrau; das nutzt die Vitrine
 * für Titel, die der Spieler noch nicht gewonnen hat.
 */
export default function Trophaee({ titel, groesse = 40, silber = false, titelText }) {
  const id = useId().replace(/:/g, "");
  const [bildWeg, setBildWeg] = useState(false);

  if (MIT_BILD.has(titel) && !silber && !bildWeg) {
    return (
      <img className="trophaee" src={`/bilder/trophaee/titel/${titel}.png`}
        width={groesse} height={groesse} alt={titelText || titel} title={titelText}
        loading="lazy" onError={() => setBildWeg(true)} />
    );
  }

  if (titel in GESTALTEN) {
    return (
      <svg className="trophaee" viewBox="0 0 200 300" width={groesse} height={groesse}
        role="img" aria-label={titelText || titel}>
        {titelText ? <title>{titelText}</title> : null}
        <Gestalt titel={titel} id={id} silber={silber} />
      </svg>
    );
  }

  const form = FORMEN[FORM_VON_TITEL[titel] || "pokal"];
  const [h, d] = silber ? [SILBER, SILBER_TIEF] : [GOLD, GOLD_TIEF];
  return (
    <svg className="trophaee" viewBox="0 0 100 82" width={groesse} height={groesse * 0.82}
      role="img" aria-label={titelText || titel}>
      {titelText ? <title>{titelText}</title> : null}
      {form(h, d)}
    </svg>
  );
}
