/* Spielfeld-Grafik für „Elf des Tages". Rein dekorativ (aria-hidden) — die Positionen
   liegen als echte Buttons darüber. Maße in einem 100×140-Koordinatensystem, das per
   preserveAspectRatio="none" auf den Container gezogen wird; dadurch bleiben die
   Prozent-Koordinaten der Slots und die Linien immer deckungsgleich. */
export default function Pitch() {
  return (
    <svg className="pitchSvg" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
      {/* Rasenstreifen — dieselbe Optik wie der Seitenhintergrund */}
      {[0, 2, 4, 6].map((i) => (
        <rect key={i} x="0" y={i * 17.5} width="100" height="17.5" fill="rgba(70,150,110,.10)" />
      ))}
      <g fill="none" stroke="rgba(148,178,208,.28)" strokeWidth="0.5" vectorEffect="non-scaling-stroke">
        <rect x="2" y="2" width="96" height="136" rx="1" />
        <line x1="2" y1="70" x2="98" y2="70" />
        <circle cx="50" cy="70" r="14" />
        {/* Strafraum + Torraum, oben und unten */}
        <rect x="24" y="2" width="52" height="18" />
        <rect x="38" y="2" width="24" height="7" />
        <rect x="24" y="120" width="52" height="18" />
        <rect x="38" y="131" width="24" height="7" />
      </g>
    </svg>
  );
}

/* Trikot für eine noch unbesetzte Position. Der Torwart trägt eine eigene Farbe —
   so ist die einzige Sonderposition auch ohne Text erkennbar. */
export function Jersey({ pos }) {
  const gk = pos === "TW";
  return (
    <svg className="jersey" viewBox="0 0 40 36" aria-hidden="true">
      <path
        d="M6 9 L14 4 Q20 8 26 4 L34 9 L31 15 L28 13.5 L28 32 L12 32 L12 13.5 L9 15 Z"
        fill={gk ? "rgba(244,201,93,.16)" : "rgba(45,212,191,.14)"}
        stroke={gk ? "rgba(244,201,93,.55)" : "rgba(45,212,191,.5)"}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
