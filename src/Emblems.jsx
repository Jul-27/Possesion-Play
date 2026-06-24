import { useId } from "react";
import { P, cname } from "./gameData.js";

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
  return (
    <svg viewBox="0 0 40 28" className="emSvg">
      <defs><clipPath id={fid}><rect width="40" height="28" rx="4" /></clipPath></defs>
      <g clipPath={`url(#${fid})`}>{content}</g>
      <rect x="0.5" y="0.5" width="39" height="27" rx="4" fill="none" stroke="rgba(0,0,0,.35)" />
    </svg>
  );
}

export function Emblem({ def }) {
  if (def.type === "nat") return <span className="emblem flag"><Flag spec={def.flag} /></span>;
  if (def.type === "spec") return <span className="emblem icon" style={{ background: `linear-gradient(150deg,${def.c1},${def.c2})` }}>{def.icon}</span>;
  if (def.type === "league") return <span className="emblem league" style={{ background: `linear-gradient(150deg,${def.c1},${def.c2})` }}>{def.label}</span>;
  if (def.type === "honour") return <span className="emblem icon" style={{ background: `linear-gradient(150deg,${def.c1},${def.c2})` }}>{def.icon}</span>;
  return <span className="emblem badge"><ClubBadge c1={def.c1} c2={def.c2} pat={def.pat} /></span>;
}

export function Cell({ cell, owner, selected, adjHint, justClaimed, clickable, onClick }) {
  const def = cell.def;
  let bg, border, txt, shadow;
  if (owner) {
    const pc = P[owner];
    bg = `linear-gradient(150deg, ${pc.c1}, ${pc.c2})`; border = `1px solid ${pc.c1}`; txt = "#fff";
    shadow = `0 0 18px ${pc.glow}, inset 0 1px 0 rgba(255,255,255,.25)`;
  } else {
    bg = "linear-gradient(155deg, rgba(20,40,33,.72), rgba(8,20,15,.85))";
    border = "1px solid rgba(176,224,200,.22)"; txt = "#dfeee7"; shadow = "inset 0 1px 0 rgba(255,255,255,.10)";
  }
  return (
    <button
      type="button"
      title={`${cname(def)}${owner ? ` — erobert von ${P[owner].name}` : ""}`}
      onClick={clickable ? onClick : undefined}
      className={`hex ${justClaimed ? "claimed" : ""}`}
      style={{
        left: `${cell.left}%`, top: `${cell.top}%`, background: bg, border, color: txt, boxShadow: shadow,
        ...(owner ? { filter: `drop-shadow(0 3px 5px rgba(0,0,0,.5)) drop-shadow(0 0 8px ${P[owner].glow})` } : {}),
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
