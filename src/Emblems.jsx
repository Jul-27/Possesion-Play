import { useId, useState } from "react";
import { P, cname } from "./gameData.js";
import Icon from "./Icons.jsx";
import { imageUrlFor, initialsOf, avatarHue } from "./playerImage.js";

export function ClubBadge({ c1, c2, pat }) {
  const uid = useId().replace(/[:]/g, "");
  const cid = "c" + uid;
  let inner;
  if (pat === "halvesV") inner = (<><rect width="20" height="40" fill={c1} /><rect x="20" width="20" height="40" fill={c2} /></>);
  else if (pat === "halvesH") inner = (<><rect width="40" height="20" fill={c1} /><rect y="20" width="40" height="20" fill={c2} /></>);
  else if (pat === "stripesV") inner = [0, 1, 2, 3, 4].map((i) => <rect key={i} x={i * 8} width="8" height="40" fill={i % 2 ? c2 : c1} />);
  else if (pat === "stripesH") inner = [0, 1, 2, 3, 4].map((i) => <rect key={i} y={i * 8} width="40" height="8" fill={i % 2 ? c2 : c1} />);
  else inner = <rect width="40" height="40" fill={c1} />;
  return (
    <svg viewBox="0 0 40 40" className="emSvg">
      <defs><clipPath id={cid}><circle cx="20" cy="20" r="19" /></clipPath></defs>
      <g clipPath={`url(#${cid})`}>{inner}</g>
      <circle cx="20" cy="20" r="18.4" fill="none" stroke={c2} strokeWidth="2.4" />
      <circle cx="20" cy="20" r="19" fill="none" stroke="rgba(0,0,0,.3)" strokeWidth="1" />
    </svg>
  );
}

/* Fünfzackiger Stern um (cx, cy) mit Außenradius r. */
function stern(cx, cy, r, fill, stroke) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const w = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.4 : r;
    return `${(cx + rr * Math.cos(w)).toFixed(2)},${(cy + rr * Math.sin(w)).toFixed(2)}`;
  }).join(" ");
  return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={stroke ? 1.1 : undefined} strokeLinejoin="round" />;
}

export function Flag({ spec }) {
  const uid = useId().replace(/[:]/g, "");
  const fid = "f" + uid;
  const { kind, colors = [], weights } = spec;
  let content = null;
  if (kind === "v") { const w = 40 / colors.length; content = colors.map((c, i) => <rect key={i} x={i * w} width={w} height="28" fill={c} />); }
  else if (kind === "h") { const h = 28 / colors.length; content = colors.map((c, i) => <rect key={i} y={i * h} width="40" height={h} fill={c} />); }
  else if (kind === "hw") { const t = weights.reduce((a, b) => a + b, 0); let acc = 0; content = colors.map((c, i) => { const h = (28 * weights[i]) / t; const r = <rect key={i} y={acc} width="40" height={h} fill={c} />; acc += h; return r; }); }
  else if (kind === "cross") content = (<><rect width="40" height="28" fill={colors[0]} /><rect x="15" width="10" height="28" fill={colors[1]} /><rect y="9" width="40" height="10" fill={colors[1]} /></>);
  else if (kind === "circle") content = (<><rect width="40" height="28" fill={colors[0]} /><circle cx="20" cy="14" r="8" fill={colors[1]} /></>);
  else if (kind === "portugal") content = (<><rect width="16" height="28" fill="#006600" /><rect x="16" width="24" height="28" fill="#FF0000" /><circle cx="16" cy="14" r="5" fill="#FFD700" /><circle cx="16" cy="14" r="2.3" fill="#fff" /></>);
  else if (kind === "diamond") content = (<><rect width="40" height="28" fill="#009B3A" /><polygon points="20,3 37,14 20,25 3,14" fill="#FFDF00" /><circle cx="20" cy="14" r="5.2" fill="#002776" /></>);
  else if (kind === "canton") content = (<>{[0,1,2,3,4,5,6].map((i) => <rect key={i} y={i * 4} width="40" height="4" fill={i % 2 ? "#fff" : "#B22234"} />)}<rect width="18" height="16" fill="#3C3B6E" />{[0,1,2,3,4,5].map((i) => <circle key={"s"+i} cx={3 + (i % 3) * 6} cy={4 + Math.floor(i / 3) * 7} r="1.2" fill="#fff" />)}</>);
  /* Nordisches Kreuz, zur Stange versetzt; mit drei Farben (Norwegen) liegt ein
     schmaleres Kreuz im breiteren. */
  else if (kind === "nordic") content = (<><rect width="40" height="28" fill={colors[0]} />
    <rect x="11" width="7" height="28" fill={colors[1]} /><rect y="10.5" width="40" height="7" fill={colors[1]} />
    {colors[2] && <><rect x="12.75" width="3.5" height="28" fill={colors[2]} /><rect y="12.25" width="40" height="3.5" fill={colors[2]} /></>}</>);
  else if (kind === "swiss") content = (<><rect width="40" height="28" fill="#DA291C" /><rect x="17" y="5" width="6" height="18" fill="#fff" /><rect x="11" y="11" width="18" height="6" fill="#fff" /></>);
  else if (kind === "saltire") content = (<><rect width="40" height="28" fill="#005EB8" /><path d="M0 0L40 28M40 0L0 28" stroke="#fff" strokeWidth="5" /></>);
  else if (kind === "crescent") content = (<><rect width="40" height="28" fill="#E30A17" /><circle cx="15" cy="14" r="7" fill="#fff" /><circle cx="16.8" cy="14" r="5.6" fill="#E30A17" />{stern(24.5, 14, 3.2, "#fff")}</>);
  else if (kind === "czech") content = (<><rect width="40" height="14" fill="#fff" /><rect y="14" width="40" height="14" fill="#D7141A" /><polygon points="0,0 20,14 0,28" fill="#11457E" /></>);
  else if (kind === "greece") content = (<>{[0,1,2,3,4,5,6,7,8].map((i) => <rect key={i} y={(i * 28) / 9} width="40" height={28 / 9 + 0.05} fill={i % 2 ? "#fff" : "#0D5EAF"} />)}
    <rect width="15.6" height="15.6" fill="#0D5EAF" /><rect x="6.2" width="3.1" height="15.6" fill="#fff" /><rect y="6.2" width="15.6" height="3.1" fill="#fff" /></>);
  else if (kind === "uruguay") content = (<>{[0,1,2,3,4,5,6,7,8].map((i) => <rect key={i} y={(i * 28) / 9} width="40" height={28 / 9 + 0.05} fill={i % 2 ? "#0038A8" : "#fff"} />)}
    <rect width="15.6" height="15.6" fill="#fff" /><circle cx="7.8" cy="7.8" r="4.4" fill="#FCD116" stroke="#7B3F00" strokeWidth=".5" /></>);
  else if (kind === "korea") content = (<><rect width="40" height="28" fill="#fff" />
    <path d="M14 14a6 6 0 0 1 12 0z" fill="#CD2E3A" /><path d="M14 14a6 6 0 0 0 12 0z" fill="#0047A0" />
    {[[6, 5, 35], [34, 5, -35], [6, 23, -35], [34, 23, 35]].map(([x, y, r], i) => (
      <g key={i} transform={`rotate(${r} ${x} ${y})`}>{[-2, 0, 2].map((d) => <rect key={d} x={x - 3} y={y + d - 0.6} width="6" height="1.2" fill="#000" />)}</g>))}</>);
  else if (kind === "australia") content = (<><rect width="40" height="28" fill="#012169" />
    <rect width="18" height="14" fill="#012169" /><path d="M0 0L18 14M18 0L0 14" stroke="#fff" strokeWidth="2.4" /><path d="M0 0L18 14M18 0L0 14" stroke="#C8102E" strokeWidth=".9" />
    <rect x="7.3" width="3.4" height="14" fill="#fff" /><rect y="5.3" width="18" height="3.4" fill="#fff" /><rect x="8.1" width="1.8" height="14" fill="#C8102E" /><rect y="6.1" width="18" height="1.8" fill="#C8102E" />
    {stern(9, 21, 3, "#fff")}{[[31, 6], [26, 13], [35, 12], [31, 23]].map(([x, y], i) => <g key={i}>{stern(x, y, 1.8, "#fff")}</g>)}</>);
  else if (kind === "wales") content = (<><rect width="40" height="14" fill="#fff" /><rect y="14" width="40" height="14" fill="#00B140" />
    <path d="M9 18l4-6 5 1 3-5 2 3 5-1-2 4 5 3-6 1-2 5-3-3-5 3 1-4z" fill="#C8102E" /></>);
  /* Stern als Zusatz auf Streifen oder Fläche (Marokko, Ghana, Kamerun). */
  if (spec.star) content = (<>{content}{stern(20, 14, spec.star.r || 5.5, spec.star.outline ? "none" : spec.star.color, spec.star.outline ? spec.star.color : undefined)}</>);
  return (
    <svg viewBox="0 0 40 28" className="emSvg">
      <defs><clipPath id={fid}><rect width="40" height="28" rx="4" /></clipPath></defs>
      <g clipPath={`url(#${fid})`}>{content}</g>
      <rect x="0.5" y="0.5" width="39" height="27" rx="4" fill="none" stroke="rgba(0,0,0,.35)" />
    </svg>
  );
}

// Echtes Logo mit automatischem Fallback auf die gezeichnete Variante.
function Logo({ src, fallback }) {
  const [err, setErr] = useState(false);
  return err ? fallback : <img className="emImg" src={src} alt="" onError={() => setErr(true)} />;
}

export function Emblem({ def }) {
  if (def.type === "nat") return <span className="emblem flag"><Flag spec={def.flag} /></span>;
  if (def.type === "spec") return <span className="emblem icon" style={{ background: `linear-gradient(150deg,${def.c1},${def.c2})` }}><Icon name={def.ic} /></span>;
  if (def.type === "league") return (
    <span className="emblem league" style={{ background: `linear-gradient(150deg,${def.c1},${def.c2})` }}>
      <Logo src={`/logos/league/${def.key}.png`} fallback={def.label} />
    </span>
  );
  if (def.type === "honour") return <span className="emblem icon" style={{ background: `linear-gradient(150deg,${def.c1},${def.c2})` }}><Icon name={def.ic} /></span>;
  return (
    <span className="emblem badge">
      <Logo src={`/logos/club/${def.key}.png`} fallback={<ClubBadge c1={def.c1} c2={def.c2} pat={def.pat} />} />
    </span>
  );
}

// Spielerfoto (Wikidata P18) mit Initialen-Fallback — greift auch, wenn das Bild 404t.
export function Avatar({ player, size = 34 }) {
  const [err, setErr] = useState(false);
  const url = imageUrlFor(player);
  const style = { width: size, height: size, flex: `0 0 ${size}px` };
  if (!url || err) {
    const h = avatarHue(player);
    return (
      <span className="avatar fallback" style={{ ...style, background: `linear-gradient(150deg, hsl(${h} 42% 34%), hsl(${h} 38% 20%))`, fontSize: Math.round(size * 0.36) }}>
        {initialsOf(player)}
      </span>
    );
  }
  return (
    <span className="avatar" style={style}>
      {/* Kein loading="lazy": die Thumbnails sind ~8 KB und stehen sofort im Blick;
          lazy laden sie in Containern ohne gemessene Höhe gar nicht erst. */}
      <img className="avatarImg" src={url} alt="" onError={() => setErr(true)} />
    </span>
  );
}

/* `paint` überschreibt die Besitzerfarben mit einer eigenen Vorschrift
   ({bg, border, txt, shadow, glow}). „Heatmap" färbt darüber nach Hitze statt nach
   Spieler; die Regel dafür bleibt in heatmap.js, hier steht nur das Malen. */
export function Cell({ cell, owner, paint, selected, adjHint, justClaimed, clickable, onClick }) {
  const def = cell.def;
  let bg, border, txt, shadow;
  if (paint) {
    ({ bg, border, txt, shadow } = paint);
  } else if (owner) {
    const pc = P[owner];
    bg = `linear-gradient(150deg, ${pc.c1}, ${pc.c2})`; border = `1px solid ${pc.c1}`; txt = "#fff";
    shadow = `0 0 18px ${pc.glow}, inset 0 1px 0 rgba(255,255,255,.25)`;
  } else {
    bg = "linear-gradient(155deg, rgba(30,42,58,.92), rgba(17,24,32,.96))";
    border = "1px solid rgba(148,178,208,.20)"; txt = "#DCE7F2"; shadow = "inset 0 1px 0 rgba(255,255,255,.10)";
  }
  return (
    <button
      type="button"
      title={`${cname(def)}${owner ? ` — erobert von ${P[owner].name}` : ""}`}
      onClick={clickable ? onClick : undefined}
      className={`hex ${justClaimed ? "claimed" : ""}`}
      style={{
        left: `${cell.left}%`, top: `${cell.top}%`, background: bg, border, color: txt, boxShadow: shadow,
        ...(!paint && owner ? { filter: `drop-shadow(0 3px 5px rgba(0,0,0,.5)) drop-shadow(0 0 8px ${P[owner].glow})` } : {}),
        cursor: clickable ? "pointer" : "default",
        outline: selected ? "3px solid #FACC15" : adjHint ? "2px dashed rgba(250,204,21,.6)" : "none",
        outlineOffset: "2px", zIndex: selected ? 5 : 1,
      }}
    >
      <span className="hexInner">
        <Emblem def={def} />
        <span className="hexLabel">{def.type === "league" || def.type === "honour" ? def.name : def.label}</span>
        {def.type === "club" && <span className="hexCountry">({def.country})</span>}
      </span>
    </button>
  );
}
