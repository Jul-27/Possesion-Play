import { useState } from "react";
/* Gezeichnete Trophäen — eine eigene Form je Wettbewerb.

   ── WARUM ─────────────────────────────────────────────────────────────────────
   Vorher trug jeder Titel dasselbe Wappenzeichen in anderer Farbe. In der Vitrine
   standen dann fünf identische Formen nebeneinander, und die Titelfeier zeigte bei
   der Champions League dasselbe Bild wie beim DFB-Pokal. Ein Pokal, den man nicht
   erkennt, ist kein Pokal.

   Das Vorbild löst das mit Fotos je Wettbewerb. Fotos der echten Pokale gibt es
   dafür nicht: Wikidata und Commons führen zu keinem der vierzehn Wettbewerbe ein
   freies Bild, und die Trophäen selbst sind geschützte Entwürfe. Also stehen unter
   /bilder/trophaee/ eigene Aufnahmen — je Form ein Pokal, kein Nachbau einer
   bestimmten Trophäe. Die gezeichneten Formen bleiben als Rückfall, damit nichts
   von einer Datei abhängt; verwendet wird beides überall gleich: Feier, Vitrine,
   Zeitleiste, Urkunde.

   ── DIE SIEBEN FORMEN ─────────────────────────────────────────────────────────
   schale   Meisterschaft — eine flache Schale mit Griffen, wie sie für eine über
            eine ganze Saison erspielte Meisterschaft steht.
   pokal    Landespokal — der klassische Henkelpokal mit Deckel.
   ohren    Champions League — der Pokal mit den grossen Ohren; seine Henkel sind
            das Erkennungszeichen schlechthin.
   amphore  Europa League — hoch, schlank, henkellos.
   globus   Weltmeisterschaft — eine Kugel auf einem Sockel.
   kelch    Europameisterschaft — breite Schale auf schmalem Fuss.
   ball     Ballon d'Or — eine Kugel auf einer Säule, als einzige Auszeichnung für
            eine Person statt für eine Mannschaft.

   Jede gezeichnete Form ist ein reiner Pfad ohne Verlauf — das lässt sie in jeder
   Grösse gleich aussehen. */

/* Welcher Titel trägt welche Form. Die Schlüssel sind dieselben wie überall. */
export const FORM_VON_TITEL = {
  MBL: "schale", MPL: "schale", MLL: "schale", MSA: "schale", ML1: "schale",
  DFB: "pokal", FAC: "pokal", CDR: "pokal", CIT: "pokal",
  CL: "ohren", EL: "amphore",
  WM: "globus", EM: "kelch", CA: "kelch",
  BDO: "ball",
};

/* Metall und Schattenseite. Gold für alles, was eine Trophäe ist; die zweite Farbe
   zeichnet die abgewandte Seite, damit die Form plastisch wirkt. */
const GOLD = "#F0C040", GOLD_TIEF = "#9A6B12", SILBER = "#D8DEE6", SILBER_TIEF = "#8D97A4";

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
 * Kantenlänge in Pixeln. `silber` zeichnet sie in Metallgrau statt Gold.
 *
 * ── ERST DAS BILD, DANN DIE ZEICHNUNG ───────────────────────────────────────
 * Liegt unter /bilder/trophaee/<form>.png ein Bild, wird es genommen; fehlt es,
 * bleibt die gezeichnete Form. Dieselbe Regel wie bei den Ereigniskarten: Jedes
 * Bild ist eine Zugabe, keine Bedingung — ohne Datei sieht man die Zeichnung, und
 * nichts bricht.
 */
export default function Trophaee({ titel, groesse = 40, silber = false, titelText }) {
  const formKey = FORM_VON_TITEL[titel] || "pokal";
  const [fehlt, setFehlt] = useState(false);
  if (!silber && !fehlt) {
    return (
      <img className="trophaee" src={`/bilder/trophaee/${formKey}.png`}
        width={groesse} height={groesse} alt={titelText || titel} title={titelText}
        loading="lazy" onError={() => setFehlt(true)} />
    );
  }
  const form = FORMEN[formKey];
  const [h, d] = silber ? [SILBER, SILBER_TIEF] : [GOLD, GOLD_TIEF];
  return (
    <svg className="trophaee" viewBox="0 0 100 82" width={groesse} height={groesse * 0.82}
      role="img" aria-label={titelText || titel}>
      {titelText ? <title>{titelText}</title> : null}
      {form(h, d)}
    </svg>
  );
}
