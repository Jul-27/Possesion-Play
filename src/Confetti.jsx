import { useState } from "react";

const COLORS = ["#2DD4BF", "#FB7185", "#FACC15", "#60A5FA", "#F472B6"];
const makeParts = () => Array.from({ length: 40 }, (_, i) => ({
  left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2 + Math.random() * 2,
  color: COLORS[i % COLORS.length], size: 6 + Math.random() * 6, rot: Math.random() * 360,
}));

// Sieg-Konfetti: rein dekorativ, CSS-animiert, kein Pointer-Target.
export default function Confetti() {
  const [parts] = useState(makeParts);
  return (
    <div className="confetti">
      {parts.map((p, i) => (
        <span key={i} style={{ left: `${p.left}%`, background: p.color, width: p.size, height: p.size * 0.5,
          animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, transform: `rotate(${p.rot}deg)` }} />
      ))}
    </div>
  );
}
