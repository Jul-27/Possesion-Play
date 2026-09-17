import { useState, useEffect, useMemo, useRef } from "react";
import { CLUBS } from "./gameData.js";
import { alleLaender, passtAufSuche, namenVon, EIGENE, flaggeVon } from "./laender.js";
import { trikotVon, kontrast } from "./trikots.js";
import { WELT_LIGEN, WELT_VEREINE } from "./careerWorld.js";
import { baueZiehungen, baueKlassen, kader, DRAFT_AB_JAHR } from "./draft.js";
import { teamStaerke } from "./saison.js";
import * as K from "./karriere.js";
import { loadPlayers } from "./playersStore.js";
import { loadAppearances } from "./appearancesStore.js";
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
import DataStamp from "./DataStamp.jsx";
import ShareButton from "./ShareButton.jsx";
import { shareKarriere } from "./share.js";
import ReportButton from "./ReportButton.jsx";
import GameTop from "./GameTop.jsx";
import Icon from "./Icons.jsx";
import { Emblem } from "./Emblems.jsx";
import UrkundeKarriere from "./UrkundeKarriere.jsx";
import Trophaee from "./Trophaeen.jsx";

/* Titelnamen für die Vitrine. Die Schlüssel sind dieselben wie im Feld `t` der
   Spielerdaten — „CL" heißt in der Karriere dasselbe wie in jedem anderen Modus. */
/* Namen und Reihenfolge kommen aus karriere.js — dort stehen sie neben Form und
   Farbe, und dort werden sie auch gepflegt. */
const TITEL_NAME = Object.fromEntries(Object.entries(K.TITEL_DATEN).map(([key, d]) => [key, d.name]));
const TITEL_REIHE = K.TITEL_REIHE;

/* Der Name eines Landes. Die sieben mit eigener Liga tragen unseren internen
   Schlüssel (GER, ENG, …), alle übrigen ihren ISO-Code — beide löst laender.js auf. */
const landName = (code) => namenVon(EIGENE[code] || code) || code;
const landFlagge = (code) => flaggeVon(EIGENE[code] || code);

/* Ein Wappen braucht einen Schlüssel und Rückfallfarben. Für die 47 Spielvereine
   stehen die Farben in gameData; die übrigen 314 bekommen ein aus dem Schlüssel
   abgeleitetes Farbpaar, damit der gezeichnete Rückfall nicht bei allen gleich
   aussieht. Das echte Wappen kommt ohnehin aus public/logos/club/<KEY>.png —
   351 der 361 Vereine haben eines. */
const defVon = (v) => CLUBS.find((c) => c.key === v.key)
  || { key: v.key, name: v.name, label: v.key, c2: "#fff", pat: "solid",
       c1: `hsl(${K.hashStr(v.key) % 360} 52% 36%)` };

/* ── Die Verlaufskurve ────────────────────────────────────────────────────────
   Die Zeitleiste als Tabelle sagt alles, aber sie erzählt nichts. Dieselben Zahlen
   als Kurve zeigen auf einen Blick, was eine Laufbahn ausmacht: der Anstieg bis
   Mitte zwanzig, das Plateau, der Abfall — und wo dazwischen gewechselt und
   gewonnen wurde.

   Wappen stehen nur dort, wo der Verein WECHSELT. Eines je Schritt wäre eine
   Perlenkette; so markieren sie die Wendepunkte. */
function Verlaufskurve({ verlauf, defVon }) {
  if (verlauf.length < 2) return null;
  /* Links Platz für die Skala: Ohne sie war die Kurve eine hübsche Linie, an der
     sich nicht ablesen liess, WIE STARK der Spieler an einer Stelle war. */
  const B = 600, H = 132, RAND = { o: 14, u: 22, l: 30, r: 10 };
  const werte = verlauf.map((z) => z.ovr);
  /* Die Skala läuft auf runde Zehner, damit die Linien beschriftbar sind. */
  const min = Math.max(0, Math.floor((Math.min(...werte) - 4) / 10) * 10);
  const max = Math.ceil((Math.max(...werte) + 4) / 10) * 10;
  const linien = [];
  for (let v = min; v <= max; v += Math.max(10, Math.round((max - min) / 40) * 10)) linien.push(v);
  const x = (i) => RAND.l + (i / (verlauf.length - 1)) * (B - RAND.l - RAND.r);
  const y = (v) => RAND.o + (1 - (v - min) / (max - min || 1)) * (H - RAND.o - RAND.u);
  const punkte = verlauf.map((z, i) => `${x(i)},${y(z.ovr)}`).join(" ");
  const flaeche = `${x(0)},${H - RAND.u} ${punkte} ${x(verlauf.length - 1)},${H - RAND.u}`;

  return (
    /* KEIN `preserveAspectRatio="none"` MEHR. Damit wurde die Zeichnung auf die
       Kastenbreite gezerrt — Wappen wurden zu Ovalen, Punkte zu Strichen, und die
       Steigung log über die Entwicklung. Jetzt behält sie ihr Seitenverhältnis. */
    <svg className="kaKurve" viewBox={`0 0 ${B} ${H}`} preserveAspectRatio="xMidYMid meet" role="img"
      aria-label="Stärkeverlauf der Laufbahn">
      <defs>
        <linearGradient id="kaKurveF" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--teal)" stopOpacity=".35" />
          <stop offset="100%" stopColor="var(--teal)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Waagerechte Hilfslinien mit ihrem Wert — daran liest man die Stärke ab. */}
      {linien.map((v) => (
        <g key={v}>
          <line x1={RAND.l} y1={y(v)} x2={B - RAND.r} y2={y(v)} stroke="currentColor" strokeOpacity=".12" />
          <text x={RAND.l - 6} y={y(v) + 4} textAnchor="end" fill="var(--muted)" fontSize="10">{v}</text>
        </g>
      ))}
      <polygon points={flaeche} fill="url(#kaKurveF)" />
      <polyline points={punkte} fill="none" stroke="var(--teal)" strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {verlauf.map((z, i) => {
        const neuerVerein = i === 0 || verlauf[i - 1].key !== z.key;
        const titel = (z.titel || []).length;
        return (
          <g key={i}>
            {titel > 0 && <circle cx={x(i)} cy={y(z.ovr)} r="5.5" fill="var(--gold)" />}
            <circle cx={x(i)} cy={y(z.ovr)} r="2.6" fill={titel ? "var(--bg-1)" : "var(--teal)"} />
            {neuerVerein && z.key && (
              <image href={`/logos/club/${z.key}.png`} x={x(i) - 9} y={H - RAND.u + 4} width="18" height="18" />
            )}
            {/* Der Wert an jedem Punkt, nicht nur an den Enden: „wie hoch war es
                wann" war vorher nur an Anfang und Ende zu sehen. Bei vielen Punkten
                zeigt nur jeder zweite eine Zahl, sonst überlagern sie sich. */}
            {(verlauf.length <= 8 || i % 2 === 0 || i === verlauf.length - 1) && (
              <text x={x(i)} y={y(z.ovr) - 9} textAnchor="middle" fill="var(--kaText, #E8F3ED)"
                fontSize="10" fontWeight="700">{z.ovr}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ── Bilder mit Rückfall ──────────────────────────────────────────────────────
   Jedes Bild ist eine Zugabe, keine Bedingung: Fehlt die Datei, verschwindet nur
   das Bild und der Rest der Karte steht unverändert. So laesst sich der Bestand
   Stueck fuer Stueck fuellen, ohne dass zwischendurch etwas kaputt aussieht. */
function Bild({ pfad, klasse, alt = "" }) {
  const [fehlt, setFehlt] = useState(false);
  if (fehlt) return null;
  return <img className={klasse} src={pfad} alt={alt} loading="lazy" onError={() => setFehlt(true)} />;
}

/* ── Der Zähler ───────────────────────────────────────────────────────────────
   Das Rating ist die Zahl, um die sich alles dreht — deshalb springt sie nicht von
   60 auf 65, sondern läuft dorthin. Eine Zahl, die sich bewegt, wird gelesen; eine,
   die sich austauscht, wird übersehen.

   Der Wert läuft weich aus, damit die Endzahl steht statt zu zucken. Wie lange er
   dafür braucht, rechnet K.zaehlerDauer aus dem Sprung aus; `warten` hält ihn
   vorher an, damit die Tabelle rechts ihren Auftritt zuerst bekommt. */

function Zaehler({ wert, dauer, warten = 0 }) {
  const [zeige, setZeige] = useState(wert);
  const vonRef = useRef(wert);
  useEffect(() => {
    const von = vonRef.current;
    if (von === wert) { setZeige(wert); return; }
    const lauf = dauer ?? K.zaehlerDauer(wert - von);
    /* IM VERSTECKTEN TAB LÄUFT KEIN EINZELBILD. requestAnimationFrame ruht, solange
       die Seite nicht sichtbar ist — der Zähler blieb dann für immer auf dem alten
       Wert stehen. Gemessen: Kopfzeile 50, Zeitleiste 64. Wer waehrend einer Saison
       den Tab wechselt, saehe dauerhaft eine falsche Zahl. Deshalb springt der Wert
       dort direkt, und ein Sicherungsnetz setzt ihn in jedem Fall. */
    if (typeof document !== "undefined" && document.hidden) { setZeige(wert); vonRef.current = wert; return; }
    let bild, start = 0;
    const schritt = (t) => {
      if (!start) start = t;
      const anteil = Math.min(1, (t - start) / lauf);
      const weich = 1 - Math.pow(1 - anteil, 3);
      setZeige(Math.round(von + (wert - von) * weich));
      if (anteil < 1) bild = requestAnimationFrame(schritt);
      else vonRef.current = wert;
    };
    /* Während der Wartezeit steht der ALTE Wert — nicht der neue und auch kein
       Zwischenwert. Sonst wäre die Pause nur ein verzögerter Sprung. */
    setZeige(von);
    const los = setTimeout(() => { bild = requestAnimationFrame(schritt); }, warten);
    const netz = setTimeout(() => { setZeige(wert); vonRef.current = wert; }, warten + lauf + 300);
    return () => { clearTimeout(los); cancelAnimationFrame(bild); clearTimeout(netz); };
  }, [wert, dauer, warten]);
  return <>{zeige}</>;
}

/* ── Das Trikot ───────────────────────────────────────────────────────────────
   Der Blickfang der Anlage: Was man eingibt, steht sofort auf dem Rücken. Gezeichnet
   statt fotografiert — so trägt es jede Auflösung und braucht keine Datei. */
/* Die Silhouette. Runde Schultern, kurze Ärmel mit abgerundetem Bund, ein leicht
   nach unten gewölbter Saum — die alte Form hatte spitze Ärmelzipfel und einen
   schnurgeraden Abschluss und sah dadurch wie ein Kittel aus. Ein Pfad, im
   Uhrzeigersinn vom linken Kragenrand aus. */
/* Die Silhouette, nachgezeichnet nach den Verhältnissen des Vorbilds: Das Trikot
   ist etwa anderthalbmal so breit wie der Rumpf und knapp doppelt so hoch. Runde
   Schultern, kurze Ärmel mit schrägem Bund, ein flach gewölbter Saum. Die alte
   Form hatte spitze Ärmelzipfel und einen schnurgeraden Abschluss und sah dadurch
   wie ein Kittel aus; die Zwischenstufe war zu langärmelig und lief glockenförmig
   aus. Gemessen wurde am Bild, gezeichnet ist der Pfad hier — ein Umriss im
   Uhrzeigersinn, beginnend am linken Kragenrand. */
const TRIKOT_UMRISS = `
  M78 18 C66 19 58 22 52 27 C43 34 36 44 32 57 C30 60 30 65 32 69
  C36 77 42 85 48 92 C52 96 55 94 57 87 C58 83 58 78 58 74
  L56 166 C56 172 68 176 100 176 C132 176 144 172 144 166 L142 74
  C142 78 142 83 143 87 C145 94 148 96 152 92 C158 85 164 77 168 69
  C170 65 170 60 168 57 C164 44 157 34 148 27 C142 22 134 19 122 18
  C112 13 88 13 78 18 Z`;
/* DER KRAGEN SASS AN DER FALSCHEN STELLE. Kein Ausschnitt ist er schon länger, aber
   als eigener Bogen schwebte er UNTERHALB der Oberkante — darüber blieb ein Streifen
   Trikotstoff stehen, und das sieht kein Trikot so.

   Der Kragen IST die Oberkante. Deshalb ist er jetzt kein Strich mehr, sondern eine
   Fläche: oben die Schulterlinie des Umrisses, unten ein Bogen, der zur Mitte hin
   abfällt. Beide Kanten treffen sich exakt in den Schulterpunkten (78,18) und
   (122,18) — dieselben Werte wie im Umriss, sonst klafft eine Lücke. */
const TRIKOT_KRAGEN = `
  M78 18 C88 13 112 13 122 18
  C119 32 111 39 100 39 C89 39 81 32 78 18 Z`;

/* Die Muster liegen zwischen Grundfarbe und Schrift und werden auf den Umriss
   beschnitten — sonst stünden Streifen neben dem Trikot in der Luft. */
function TrikotMuster({ art, farbe }) {
  if (art === "streifen") {
    return [30, 54, 78, 102, 126, 150].map((x) => (
      <rect key={x} x={x} y="0" width="12" height="200" fill={farbe} />
    ));
  }
  if (art === "karo") {
    const felder = [];
    for (let r = 0; r < 14; r++) for (let s = 0; s < 14; s++)
      if ((r + s) % 2 === 0) felder.push(<rect key={`${r}-${s}`} x={s * 14} y={r * 14} width="14" height="14" fill={farbe} />);
    return felder;
  }
  if (art === "schraeg") return <path d="M42 0 L96 0 L158 200 L104 200 Z" fill={farbe} />;
  return null;
}

function Trikot({ name, nummer, land }) {
  const beschriftung = (name || "").trim().toUpperCase() || "NACHNAME";
  /* LANGE NAMEN WURDEN ABGESCHNITTEN. Vorher stand hier ein slice(0, 12) — aus
     „Schweinsteiger" wurde „SCHWEINSTEI". Ein Trikot schneidet keinen Namen ab, es
     staucht ihn. `textLength` zwingt die Schrift auf die Breite; damit kurze Namen
     nicht auseinandergezogen werden, greift es erst ab neun Zeichen. */
  const breit = beschriftung.length > 8;
  const t = trikotVon(land);
  /* AUF EINEM MUSTER VERSCHWINDET SCHRIFT. Perus Nummer ist rot, und die Schärpe,
     über die sie läuft, ist es auch — im Bild war die Neun nicht zu sehen. Bei
     Kroatien lag Blau auf roten Karos. Ein schmaler Rand in der Gegenrichtung löst
     das für jedes Muster, ohne die Farben zu verfälschen. */
  const rand = t.muster
    ? { stroke: kontrast(t.schrift, "#FFFFFF") > 2.5 ? "#FFFFFF" : "rgba(0,0,0,.6)",
        strokeWidth: 3, paintOrder: "stroke", strokeLinejoin: "round" }
    : {};
  return (
    /* Der Ausschnitt sitzt eng am Umriss — sonst schwebt das Trikot in einem Feld
       aus Luft und wirkt kleiner, als es ist. */
    <svg className="kaTrikot" viewBox="24 8 152 176" role="img"
      aria-label={`Trikot mit Name und Nummer, Farben von ${namenVon(EIGENE[land] || land) || land}`}>
      <defs>
        <clipPath id="kaTrikotSchnitt"><path d={TRIKOT_UMRISS} /></clipPath>
        {/* Licht von oben, Schatten unten — ohne das wirkt jede Fläche wie Papier. */}
        <linearGradient id="kaTrikotLicht" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".16" />
          <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity=".14" />
        </linearGradient>
      </defs>

      <g clipPath="url(#kaTrikotSchnitt)">
        <rect x="0" y="0" width="200" height="200" fill={t.grund} />
        {t.muster && <TrikotMuster art={t.muster} farbe={t.zweit} />}
        {/* Ärmelbund und Saum: breite Striche entlang der Kanten, am Umriss
            beschnitten — so liegt der Besatz innen an und steht nirgends über. */}
        <path d="M32 69 C36 77 42 85 48 92" fill="none" stroke={t.besatz} strokeWidth="12" />
        {/* Als Fläche, nicht als Strich: nur so liegt die Oberkante des Kragens auf der
            Schulterlinie statt darunter. */}
        <path d={TRIKOT_KRAGEN} fill={t.besatz} />
        <path d="M168 69 C164 77 158 85 152 92" fill="none" stroke={t.besatz} strokeWidth="12" />
        <path d="M56 166 C56 172 68 176 100 176 C132 176 144 172 144 166"
          fill="none" stroke={t.besatz} strokeWidth="7" />
        <rect x="0" y="0" width="200" height="200" fill="url(#kaTrikotLicht)" />
      </g>

      <path d={TRIKOT_UMRISS} fill="none" stroke="rgba(0,0,0,.32)" strokeWidth="2" strokeLinejoin="round" />
      {/* Nur die UNTERE Kante nachziehen — die obere ist schon die Umrisslinie. */}
      <path d="M78 18 C81 32 89 39 100 39 C111 39 119 32 122 18" fill="none"
        stroke="rgba(0,0,0,.22)" strokeWidth="1.2" />

      <text x="100" y="66" textAnchor="middle" fill={t.schrift} fontSize="14" fontWeight="700"
        letterSpacing={breit ? "0" : "1.5"} style={{ fontFamily: "inherit" }} {...rand}
        {...(breit ? { textLength: 74, lengthAdjust: "spacingAndGlyphs" } : {})}>
        {beschriftung}
      </text>
      <text x="100" y="126" textAnchor="middle" fill={t.schrift} fontSize="64" fontWeight="800"
        style={{ fontFamily: "inherit" }} {...rand} strokeWidth={rand.strokeWidth ? 5 : undefined}>
        {nummer || "0"}
      </text>
    </svg>
  );
}

/* ── Die Titelfeier ───────────────────────────────────────────────────────────
   Ein gewonnener Titel stand als Zeile Text zwischen zwei Karten — man hat ihn
   überlesen. Jetzt bekommt er einen eigenen Moment: Die Trophäe fährt heran, ein
   Lichtstrahl wandert darüber, der Name steht darunter. Mehrere Titel laufen
   nacheinander, und ein Klick überspringt.

   Gezeichnet wird sie aus unseren eigenen Titeldaten — Symbol und Farbpaar, die
   überall im Spiel dieselben sind. */
function Titelfeier({ titel, onFertig }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    /* setTimeout statt Einzelbildern: Der Takt läuft auch weiter, wenn der Tab
       verdeckt ist, und die Feier hängt dann nicht fest. */
    const t = setTimeout(() => (i + 1 < titel.length ? setI(i + 1) : onFertig()), 1900);
    return () => clearTimeout(t);
  }, [i, titel.length, onFertig]);

  const key = titel[i];
  const def = K.TITEL_DATEN[key];
  if (!def) return null;
  const weiter = () => (i + 1 < titel.length ? setI(i + 1) : onFertig());

  return (
    <div className="kaFeier" onClick={weiter} role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && weiter()}
      aria-label={`Titel gewonnen: ${def.name}`}>
      <div className="kaFeierInhalt">
        {/* Die Trophäe, nicht das Wappenzeichen: Champions League und DFB-Pokal
            sahen vorher identisch aus, nur in anderer Farbe. */}
        <div className="kaFeierPokal" key={key}
          style={{ "--pokalLicht": `${def.c1}cc` }}>
          <Trophaee titel={key} groesse={124} titelText={def.name} />
        </div>
        <div className="kaFeierName">{def.name}</div>
        <div className="kaFeierUnten">
          {titel.length > 1 ? `${i + 1} von ${titel.length} · zum Weiterklicken tippen` : "Zum Weiterklicken tippen"}
        </div>
        {titel.length > 1 && (
          <div className="kaFeierPunkte">
            {titel.map((_, n) => <span key={n} className={"kaFeierPunkt" + (n <= i ? " an" : "")} />)}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Die Vereinskarte ─────────────────────────────────────────────────────────
   Wer einen Verein wählt, will den Verein sehen. Vorher stand das Wappen als
   30-Pixel-Marke neben zwei Textzeilen — bei einer Entscheidung, die eine Laufbahn
   prägt, ist das zu wenig. Jetzt beherrscht es die Karte, wie im Vorbild.

   VIER DINGE, NICHT SIEBEN. Erst trug die Kachel zusätzlich fünf Stufenpunkte und
   eine Anforderungszeile, dann bei einer Leihe noch die zu erwartende Zahl der
   Spiele. Beides ist weg: Wer wählt, soll den Verein sehen, nicht eine Vorschau auf
   seine Statistik. Das Niveau steht ohnehin im Ligennamen. */
function VereinsKarte({ verein, anlass, onClick, breit = false, gesperrt = false }) {
  return (
    <button type="button" className={"kaVerein" + (breit ? " breit" : "")}
      disabled={gesperrt} onClick={onClick}>
      <span className="kaVereinAnlass">{anlass}</span>
      <b className="kaVereinName">{verein.name}</b>
      <span className="kaVereinWappen"><Emblem def={defVon(verein)} /></span>
      <span className="kaVereinLiga">{verein.liga.name}</span>
    </button>
  );
}

/* ── Das Spielfeld ────────────────────────────────────────────────────────────
   Zwölf Positionen dort, wo sie auf dem Platz stehen. Eine Reihe von Kürzeln sagt
   einem Fußballfan nichts; eine Aufstellungstafel sagt alles auf einen Blick. */
const FELD_PLATZ = {
  LA: [17, 13], ST: [50, 9], RA: [83, 13],
  OM: [50, 26],
  LM: [14, 38], ZM: [50, 41], RM: [86, 38],
  DM: [50, 55],
  LV: [14, 68], RV: [86, 68], IV: [50, 71],
  TW: [50, 88],
};

function Spielfeld({ pos, setPos }) {
  return (
    <div className="kaFeld">
      <svg className="kaFeldLinien" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect x="1" y="1" width="98" height="98" rx="2" fill="none" stroke="currentColor" strokeWidth=".5" />
        <line x1="1" y1="50" x2="99" y2="50" stroke="currentColor" strokeWidth=".4" />
        <circle cx="50" cy="50" r="11" fill="none" stroke="currentColor" strokeWidth=".4" />
        <rect x="28" y="1" width="44" height="14" fill="none" stroke="currentColor" strokeWidth=".4" />
        <rect x="28" y="85" width="44" height="14" fill="none" stroke="currentColor" strokeWidth=".4" />
        <rect x="40" y="1" width="20" height="6" fill="none" stroke="currentColor" strokeWidth=".4" />
        <rect x="40" y="93" width="20" height="6" fill="none" stroke="currentColor" strokeWidth=".4" />
      </svg>
      {K.POSITIONEN.map((p) => {
        const [x, y] = FELD_PLATZ[p.key] || [50, 50];
        return (
          <button key={p.key} type="button" title={p.name}
            className={"kaFeldPos" + (pos === p.key ? " an" : "")}
            style={{ left: `${x}%`, top: `${y}%` }}
            onClick={() => setPos(p.key)}>{p.key}</button>
        );
      })}
    </div>
  );
}

const prozent = (p) => `${Math.round(p * 100)} %`;
/* Wie eine Wirkung auf der Karte steht. Ohne diese Zeile wäre die Entscheidung
   wieder ein Blindflug — sie ist der Kern des Modus. */
/* Die Vorschau auf einer Option. Sie nennt nur Wettbewerbe, die der Verein spielt —
   bei Al-Hilal stand sonst „Pokal ×1.5" für einen Pokal, den es dort nicht gibt.
   Und sie nennt Faktoren, wie sie sind: „halbiert" stand vorher für JEDEN Wert unter
   eins, auch für 0,6 und 0,4. */
function wirkungsText(w, verein) {
  const teile = [];
  const hat = K.wettbewerbe(verein);
  if (w.ovr) teile.push(`${w.ovr > 0 ? "+" : ""}${w.ovr} Stärke`);
  if (w.rolle) teile.push({ stamm: "Stammplatz", rotation: "Rotation", kader: "nur im Kader" }[w.rolle]);
  if (w.verletzt) teile.push(`${w.verletzt} Saison verletzt`);
  for (const [feld, name] of [["liga", "Meisterschaft"], ["pokal", "Pokal"], ["europa", "Europapokal"]]) {
    const f = w[feld];
    if (f === undefined || f === 1 || !hat[feld]) continue;
    teile.push(`${name} ${f > 1 ? "×" + K.faktorText(f) : f === 0.5 ? "halbiert" : `auf ${Math.round(f * 100)} %`}`);
  }
  if (w.verbandswechsel) teile.push("neuer Verband");
  if (w.abschluss) teile.push("Schulabschluss");
  return teile.length ? teile.join(" · ") : "nichts ändert sich";
}

/* ── Die Ereigniskarte ────────────────────────────────────────────────────────
   VORHER WAREN ES ZWEI SCHALTFLÄCHEN MIT TEXT, und nach dem Klick stand das
   Ergebnis da. Damit war die Wette eine Zeile Text: Man las eine Quote, drückte und
   las eine Zahl. Nichts daran fühlte sich nach einer Entscheidung an.

   JETZT SIND ES ZWEI KACHELN mit je einem Bild und ihren möglichen Ausgängen als
   eigene Felder — eine sichere Wahl hat eines, eine Wette zwei (Gelingen und
   Rückschlag). Nach dem Klick springt die Auswahl zwischen den beiden Feldern der
   gewählten Kachel hin und her, wird langsamer und bleibt auf einem stehen. Dieses
   Stehenbleiben IST das Ergebnis; erst danach erscheint, was es bedeutet.

   ── WARUM setTimeout UND KEIN requestAnimationFrame ──────────────────────────
   In einem verdeckten Tab ruht rAF. Der Lauf bliebe dann mitten im Sprung stehen
   und die Laufbahn hinge. setTimeout läuft weiter; zusätzlich springt der Lauf
   sofort ans Ende, wenn die Seite beim Klick schon verdeckt ist. */
function Ereigniskarte({ ereignis, verein, bewerte, onFertig, folge, onWeiter, gesperrt }) {
  const [wahl, setWahl] = useState(null);      // { i, ergebnis }
  const [feld, setFeld] = useState(null);      // welches Ausgangsfeld gerade leuchtet
  const [steht, setSteht] = useState(false);   // Lauf beendet
  const uhren = useRef([]);

  useEffect(() => () => uhren.current.forEach(clearTimeout), []);

  function waehle(option, i) {
    if (wahl || gesperrt) return;               // ein Klick, nicht zwei — und nicht zu früh
    const ergebnis = bewerte(option);
    setWahl({ i, ergebnis, option });
    /* Ohne Wette gibt es nichts zu springen — ein Feld, sofort. */
    const ziel = option.chance === undefined ? 0 : (ergebnis.gelungen ? 0 : 1);
    const ruhig = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (option.chance === undefined || ruhig || (typeof document !== "undefined" && document.hidden)) {
      setFeld(ziel); setSteht(true);
      uhren.current.push(setTimeout(() => onFertig(option, ergebnis), 450));
      return;
    }
    let t = 0;
    for (const schritt of K.wahlLauf(ziel)) {
      t += schritt.dauer;
      uhren.current.push(setTimeout(() => setFeld(schritt.feld), t));
    }
    uhren.current.push(setTimeout(() => setSteht(true), t + 40));
    uhren.current.push(setTimeout(() => onFertig(option, ergebnis), t + 620));
  }

  return (
    <div className="kaEntscheidung">
      <p className="kaKartenArt">Ereignis</p>
      <h3>{ereignis.titel}</h3>
      <p>{ereignis.text}</p>
      <div className="kaKacheln">
        {ereignis.optionen.map((o, i) => {
          const gewaehlt = wahl?.i === i;
          const ausgaenge = o.chance === undefined
            ? [{ art: "neutral", text: wirkungsText(o.wirkung, verein) }]
            : [{ art: "gut", text: wirkungsText(o.wirkung, verein) },
               { art: "schlecht", text: wirkungsText(o.sonst, verein) }];
          return (
            <button key={i} type="button"
              className={"kaKachel" + (gewaehlt ? " gewaehlt" : "") + (wahl && !gewaehlt ? " matt" : "")}
              disabled={!!wahl || gesperrt} onClick={() => waehle(o, i)}>
              <Bild pfad={`/bilder/wahl/${o.bild || "platz"}.jpg`} klasse="kaKachelBild" alt="" />
              <b className="kaKachelName">{o.label}</b>
              {o.chance !== undefined && (
                <span className="kaQuote">
                  {/* Der Balken zeigt dieselbe Quote, die daneben steht — aber
                      sichtbar. Eine Wette erfasst man schneller, als man sie liest. */}
                  <span className="kaQuoteBalken"><i style={{ width: `${Math.round(o.chance * 100)}%` }} /></span>
                  <span className="kaQuoteZahl">{prozent(o.chance)}</span>
                </span>
              )}
              <span className="kaAusgaenge">
                {ausgaenge.map((a2, n) => (
                  <span key={n}
                    className={"kaAusgang " + a2.art
                      + (gewaehlt && feld === n ? " leuchtet" : "")
                      + (gewaehlt && steht && feld === n ? " steht" : "")}>
                    {a2.art === "gut" ? "▲ " : a2.art === "schlecht" ? "▼ " : ""}{a2.text}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      {/* Solange gesprungen wird, steht hier, worauf man wartet — ein stummer
          Bildschirm wirkt wie ein Hänger. */}
      <p className="kaKachelFuss" aria-live="polite">
        {gesperrt ? "Die Saison läuft noch ein …"
          : !wahl ? "Wähle — bei einer Wette entscheidet danach der Zufall."
          : !steht ? "Es entscheidet sich …"
          : wahl.ergebnis.gewagt ? (wahl.ergebnis.gelungen ? "Es ist aufgegangen." : "Es ist schiefgegangen.")
          : "Entschieden."}
      </p>
      {/* DIE FOLGE STEHT UNTER DEN KACHELN, nicht an ihrer Stelle. Vorher tauschte
          der Bildschirm die Karte gegen eine Ergebnistafel — und damit war genau das
          Feld verschwunden, auf dem die Auswahl gerade stehen geblieben war. Was
          hier steht, ist deshalb nur noch, was die Entscheidung bewirkt hat; DASS
          sie aufging, sieht man oben. */}
      {folge && (
        <div className="kaFolgeUnten">
          <ul className="kaFolgen">
            {folge.ergebnis.folgen.map((f, i) => <li key={i} className={f.art}>{f.text}</li>)}
          </ul>
          <button className="btn primary" onClick={onWeiter}>Weiter zur Saison</button>
        </div>
      )}
    </div>
  );
}

export default function Karriere({ onLeave }) {
  const [players, setPlayers] = useState(null);
  const [einsaetze, setEinsaetze] = useState(undefined);
  const [muted, setMuted] = useState(isMuted());

  // Anlage
  const [name, setName] = useState("");
  const [land, setLand] = useState("GER");
  const [nummer, setNummer] = useState(9);
  const [pos, setPos] = useState("ST");
  const [fuss, setFuss] = useState("rechts");
  const [tempo, setTempo] = useState("normal");
  const [landSuche, setLandSuche] = useState("");

  // Lauf
  const [k, setK] = useState(null);
  const [karte, setKarte] = useState(null);   // { art: "jugend"|"ereignis"|"angebot"|"ende", ... }
  const [meldung, setMeldung] = useState([]); // was im letzten Schritt geschah
  const [saison, setSaison] = useState(null);  // die Bilanz des letzten Schritts
  const [feier, setFeier] = useState(null);   // Titel, die gerade gefeiert werden
  /* Gesperrt, solange die Saison noch einläuft: Zeilen, Bilanz und Ratingkachel
     brauchen ihre Zeit, und wer vorher klickt, sieht nichts davon. */
  const [sperre, setSperre] = useState(false);
  const sperrUhr = useRef(null);
  const zufallRef = useRef(null);
  const modRef = useRef({ liga: 1, pokal: 1, europa: 1 });
  const verletztRef = useRef(0);
  const letzteRef = useRef([]);
  const seitAngebotRef = useRef(0);
  const ereignisZahlRef = useRef(0);
  const seitEreignisRef = useRef(Infinity);

  useEffect(() => () => clearTimeout(sperrUhr.current), []);
  useEffect(() => { loadPlayers().then(setPlayers); }, []);
  useEffect(() => { loadAppearances().then((e) => setEinsaetze(e || null)); }, []);

  /* Die Welt einmal bauen: 362 Vereine, jeder mit einer Stärke aus seinen echten
     Kadern — dieselbe Rechnung wie in der Traumelf. Daraus wird die Rufstufe.
     Gemessen einige Sekunden, deshalb nur einmal je Sitzung. */
  const welt = useMemo(() => {
    if (!players || einsaetze === undefined) return null;
    const jahre = Array.from({ length: 2026 - DRAFT_AB_JAHR + 1 }, (_, i) => DRAFT_AB_JAHR + i);
    /* Die Klassen — also wie stark jeder Spieler war — brauchen Ziehungen je Liga.
       Sie werden hier über die ganze Welt gebaut, damit ein Zweitligist an
       derselben Skala gemessen wird wie Bayern. */
    const ziehungen = [];
    for (const liga of WELT_LIGEN) {
      const vs = WELT_VEREINE.filter((v) => v.lg === liga.key);
      if (vs.length) ziehungen.push(...baueZiehungen(players, vs, liga.key));
    }
    const klassen = baueKlassen(players, ziehungen, einsaetze);
    const staerkeVon = (v) => {
      const w = [];
      for (const j of jahre) {
        const kd = kader(players, v.key, j, 5);
        if (kd.length >= 8) w.push(teamStaerke({ spieler: kd, jahr: j }, players, klassen));
      }
      if (!w.length) return NaN;
      w.sort((a, b) => a - b);
      return w[Math.floor(w.length / 2)];
    };
    return K.baueWelt(staerkeVon);
  }, [players, einsaetze]);

  const bereit = welt && welt.vereine.length > 0;

  // ── Ablauf ─────────────────────────────────────────────────────────────────

  function starte() {
    const seed = Date.now() >>> 0;
    const neu = K.neueKarriere({ name: name.trim() || "Namenlos", land, nummer, pos, fuss, tempo, seed });
    zufallRef.current = K.rng(K.hashStr(`${neu.name}|${seed}`));
    modRef.current = { liga: 1, pokal: 1, europa: 1 };
    verletztRef.current = 0;
    letzteRef.current = [];
    seitAngebotRef.current = 0;
    ereignisZahlRef.current = 0;
    seitEreignisRef.current = Infinity;
    setK(neu);
    setMeldung([]);
    setSaison(null);
    setFeier(null);
    setKarte({ art: "jugend", vereine: K.jugendAngebote(welt, land, zufallRef.current) });
    play("start");
  }

  /* Ein Schritt: so viele Saisons, wie das Tempo vorgibt. Danach steht fest, was
     passiert ist — und die nächste Karte liegt an. */
  function spieleSchritt(basis, startVerein) {
    const zufall = zufallRef.current;
    const saisons = K.TEMPO[basis.tempo].saisons;
    let verein = startVerein;
    let k2 = { ...basis, verein };
    const neueTitel = [];
    const ereignisse = [];
    let spiele = 0, tore = 0, vorlagen = 0, ausgefallen = 0;
    /* Nur beim Torwart gefüllt — bei allen anderen bleiben beide null und die
       Spalten werden gar nicht erst angezeigt. */
    let gegentore = 0, westen = 0;
    /* EINE ZEILE JE SAISON, nicht je Schritt. Die Zeitleiste zeigt jetzt jedes
       Lebensjahr von 16 bis 40 als eigene Zeile und füllt sie nacheinander; ein
       Schritt über zwei Saisons hätte sonst jede zweite Zeile leer gelassen. */
    const zeilen = [];

    for (let s = 0; s < saisons; s++) {
      /* Schluss ist Schluss — MITTEN im Schritt. Die Pruefung stand danach, und weil
         ein Schritt zwei Saisons umfasst, endeten Laufbahnen mit 39 statt 38. */
      if (k2.alter >= K.ALTERSGRENZE) break;
      /* EINE VERLETZUNG KOSTET AUCH LEBENSZEIT. Vorher sprang `continue` über das
         Altern mit — wer zweimal verletzt war, spielte zwei Jahre länger, und in der
         Zeitleiste stand ein Einerschritt (28, 29) mitten zwischen Zweierschritten.
         Das Jahr vergeht jetzt. Fortschritt bringt es keinen; der altersbedingte
         Abbau kommt trotzdem, denn der hört im Krankenstand nicht auf. */
      if (verletztRef.current > 0) {
        verletztRef.current--;
        ausgefallen++;
        const alterVorher = k2.alter;
        k2.alter += 1;
        const ab = K.wachstumGanz(k2, verein.stufe, zufall);
        if (ab.zuwachs < 0) { k2.rest = ab.rest; k2.ovr = K.grenze(k2.ovr + ab.zuwachs, K.OVR_MIN, K.OVR_MAX); }
        zeilen.push({ alter: alterVorher, verein: verein.name, key: verein.key, lg: verein.lg, ovr: k2.ovr,
          spiele: 0, tore: 0, vorlagen: 0, gegentore: 0, westen: 0, titel: [], verletzt: true });
        continue;
      }
      const l = K.saisonLeistung(k2, verein.stufe, zufall);
      spiele += l.spiele; tore += l.tore; vorlagen += l.vorlagen;
      gegentore += l.gegentore || 0; westen += l.westen || 0;
      const saisonTitel = [];
      const alterVorher = k2.alter, vereinVorher = verein;
      for (const t of K.saisonTitel(verein, zufall, modRef.current)) { neueTitel.push(t); saisonTitel.push(t); }
      for (const t of K.einzelTitel(k2, l, zufall)) { neueTitel.push(t); saisonTitel.push(t); if (k2.bdoAlter === undefined) k2.bdoAlter = k2.alter; }
      k2.saisonNr = (k2.saisonNr || 0) + 1;
      /* Die Auswahl zählt auch ohne Turnier: Wer stark genug ist, spielt jede Saison
         Länderspiele, und ohne sie stünde ein Weltmeistertitel ohne einen einzigen
         Einsatz da. */
      const nl = K.nationalLeistung(k2, zufall);
      k2.national = {
        spiele: (k2.national?.spiele || 0) + nl.spiele,
        tore: (k2.national?.tore || 0) + nl.tore,
        vorlagen: (k2.national?.vorlagen || 0) + nl.vorlagen,
      };
      for (const t of K.nationalTitel(k2, verein, zufall, k2.saisonNr)) { neueTitel.push(t); saisonTitel.push(t); }
      k2.alter += 1;
      const g = K.wachstumGanz(k2, verein.stufe, zufall);
      k2.rest = g.rest;
      k2.ovr = K.grenze(k2.ovr + g.zuwachs, K.OVR_MIN, K.OVR_MAX);
      /* Die Zeile trägt das Alter, in dem gespielt wurde, und den Wert danach. */
      zeilen.push({ alter: alterVorher, verein: vereinVorher.name, key: vereinVorher.key, lg: vereinVorher.lg,
        ovr: k2.ovr, spiele: l.spiele, tore: l.tore, vorlagen: l.vorlagen,
        gegentore: l.gegentore || 0, westen: l.westen || 0, titel: saisonTitel });
      /* Auf- und Abstieg am Saisonende. Wer aufsteigt, wird vermerkt — nur so kann
         später „Aus der Zweiten" überhaupt zutreffen. */
      /* welt.ligen statt der Standardliste: Nur diese Kopien tragen das Titelfeld,
         und ohne sie stünde ein Aufsteiger ohne Gegner da. */
      const w = K.ligaWechsel(verein, zufall, welt.ligen);
      if (w.richtung) {
        ereignisse.push(`${verein.name} ${w.richtung === "auf" ? "steigt auf" : "steigt ab"}`);
        if (w.richtung === "auf") k2.aufgestiegenMit = verein.key;
        verein = w.verein;
      }
    }
    modRef.current = { liga: 1, pokal: 1, europa: 1 };

    const titel = { ...k2.titel };
    for (const t of neueTitel) titel[t] = (titel[t] || 0) + 1;
    /* Auszeichnungen, die einen Verlauf brauchen, werden hier mitgeschrieben —
       nachträglich ließe sich nicht mehr feststellen, WANN etwas zusammenfiel. */
    const ligaKey = K.LIGA_TITEL[verein.lg], pokalKey = K.POKAL_TITEL[verein.lg];
    const triple = ligaKey && pokalKey && neueTitel.includes(ligaKey) && neueTitel.includes(pokalKey)
      && (neueTitel.includes("CL") || neueTitel.includes("EL"));
    const europaKlein = verein.stufe <= 3 && (neueTitel.includes("CL") || neueTitel.includes("EL"));
    const aufstieg = !!ligaKey && neueTitel.includes(ligaKey) && k2.aufgestiegenMit === verein.key;

    k2 = {
      ...k2, verein, titel,
      triple: k2.triple || triple,
      europaMitKleinem: k2.europaMitKleinem || europaKlein,
      aufstiegMitMeister: k2.aufstiegMitMeister || aufstieg,
      vereine: k2.vereine.includes(verein.key) ? k2.vereine : [...k2.vereine, verein.key],
      laender: k2.laender.includes(verein.liga.land) ? k2.laender : [...k2.laender, verein.liga.land],
      gesamt: {
        spiele: k2.gesamt.spiele + spiele,
        tore: k2.gesamt.tore + tore,
        vorlagen: k2.gesamt.vorlagen + vorlagen,
        gegentore: (k2.gesamt.gegentore || 0) + gegentore,
        westen: (k2.gesamt.westen || 0) + westen,
      },
      verlauf: [...k2.verlauf, ...zeilen],
    };

    setK(k2);
    /* Die Sperre hängt am Ratingsprung: Ein Sprung von zwölf Punkten läuft länger
       als einer von zweien, und so lange bleibt die nächste Entscheidung zu. */
    clearTimeout(sperrUhr.current);
    setSperre(true);
    sperrUhr.current = setTimeout(() => setSperre(false), K.sperrDauer(k2.ovr - basis.ovr));
    setMeldung([...neueTitel.map((t) => `🏆 ${TITEL_NAME[t] || t}`), ...ereignisse.map((e) => `↕ ${e}`)]);
    /* DIE SAISON HATTE KEINEN MOMENT. Man klickte, und die Tabelle rechts hatte eine
       Zeile mehr — 66 Spiele, 13 Tore, 15 Vorlagen liefen unsichtbar vorbei. Jetzt
       steht die Bilanz über der nächsten Entscheidung. */
    setSaison({ saisons, bis: k2.alter, verein: verein.name, spiele, tore, vorlagen, gegentore, westen, verletzt: ausgefallen });
    /* Jeder Titel bekommt seinen Moment — auch wenn in einem Schritt mehrere fallen.
       Doppelte werden zusammengefasst, sonst liefe dieselbe Trophaee zweimal. */
    if (neueTitel.length) { setFeier([...new Set(neueTitel)]); play("win"); }
    naechsteKarte(k2, verein);
  }

  /* Was kommt als Nächstes — eine Entscheidung oder ein Wechsel? Angebote dürfen
     nicht ausbleiben, sonst klebt man ewig am selben Verein; Ereignisse nicht
     dauernd kommen, sonst wird die Laufbahn zur Fragebogenaktion. */
  function naechsteKarte(k2, verein) {
    const zufall = zufallRef.current;
    /* Schluss ist Schluss. Die Grenze lag bei 40 und wurde VOR dem naechsten Schritt
       geprueft — ein Schritt umfasst aber zwei Saisons, also endeten Laufbahnen bei
       41. Auf der Urkunde stand dann „bis 41 Jahre", und so lange spielt niemand. */
    if (k2.alter >= K.ALTERSGRENZE) return beende(k2);
    const offerten = K.angebote(welt, k2, zufall);
    const mussWechseln = k2.alter >= K.RUECKTRITT_AB && offerten.length === 0;
    if (mussWechseln) return beende(k2, "Es rief kein Verein mehr an.");
    /* Nicht jede Laufbahn läuft bis zur Altersgrenze — vorher taten es 299 von 300. */
    if (K.ruecktrittFaellig(k2, zufall)) return beende(k2, "Der Körper hat entschieden.");

    /* Eine Leihe endet immer nach einem Schritt — man kehrt zu seinem Verein zurück
       und entscheidet dort neu. */
    if (k2.leiheVon) {
      const heim = k2.leiheVon;
      setK({ ...k2, leiheVon: null });
      return setKarte({ art: "rueckkehr", heim, verein });
    }
    /* Wer jung ist und bei seinem Verein nicht spielt, bekommt eine Leihe angeboten.
       Genau dafür gibt es die zweite Spielklasse. */
    if (K.leiheMoeglich(k2, verein)) {
      const ziele = K.leihAngebote(welt, k2, verein, zufall);
      if (ziele.length) return setKarte({ art: "leihe", vereine: ziele, bleiben: verein });
    }

    /* WER BLEIBT, SAH KEINE EREIGNISSE MEHR. Gezaehlt wurden alle Zeilen mit
       diesem Verein — ab drei Schritten kippte die Wahl dauerhaft auf "Angebot",
       und ein treuer Spieler bekam in achtzehn Saisons ein einziges Ereignis.
       Gezaehlt werden jetzt die Schritte SEIT DEM LETZTEN Angebot. */
    seitAngebotRef.current += 1;
    seitEreignisRef.current += 1;
    /* Das Angebot hat Vorrang: Wer drei Schritte lang keines gesehen hat, bekommt
       eines — sonst klebt man ewig am selben Verein. Erst danach entscheidet die
       Ereignisregel, und die ist ihrerseits gedeckelt. */
    const ereignis = seitAngebotRef.current < 3
      && K.ereignisFaellig({ gespielt: ereignisZahlRef.current, seitLetztem: seitEreignisRef.current }, zufall);
    if (!ereignis) {
      seitAngebotRef.current = 0;
      setKarte({ art: "angebot", vereine: offerten, bleiben: verein, rücktritt: k2.alter >= K.RUECKTRITT_AB });
    } else {
      const e = K.ziehEreignis(k2, zufall, letzteRef.current);
      letzteRef.current = [...letzteRef.current, e.key].slice(-4);
      ereignisZahlRef.current += 1;
      seitEreignisRef.current = 0;
      setKarte({ art: "ereignis", ereignis: e, verein });
    }
  }

  /* DIE FOLGE WURDE ÜBERSPRUNGEN. Vorher lief hier sofort die naechste Saison an —
     man waehlte den Privattrainer und erfuhr nie, ob er angeschlagen hat. Die Wahl
     wirkt wie gehabt, aber dazwischen steht jetzt eine Karte, die es ausspricht. */
  /* Nur rechnen, nichts anwenden: Die Karte braucht den Ausgang, BEVOR sie ihn
     zeigt — sonst wüsste der Lauf nicht, wo er stehen bleiben soll. */
  function bewerteOption(option) {
    return K.entscheide(k, option, zufallRef.current);
  }

  function waehleOption(option, r) {
    modRef.current = r.mod;
    verletztRef.current += r.verletzt;
    play(r.gelungen ? "ok" : "err");
    setKarte((v) => ({ ...v, folge: { option, ergebnis: r } }));
    /* DIE KACHEL BLIEB AUF DEM ALTEN WERT. Die Folge sagte „Stärke 70 → 73", die
       Ratingkachel daneben zeigte weiter 70 — die Zahl sprang erst nach dem Klick
       auf „Weiter zur Saison", zusammen mit dem Saisonwachstum, und damit war nicht
       mehr zu sehen, was die Entscheidung gebracht hat. Jetzt läuft sie sofort hoch;
       spieleSchritt bekommt denselben Stand weiterhin ausdrücklich übergeben. */
    setK(r.karriere);
  }

  function beende(k2, grund = null) {
    const fertig = { ...k2, beendet: true };
    setK(fertig);
    setKarte({ art: "ende", auszeichnungen: K.erreichteAuszeichnungen(fertig), grund });
    play("end");
  }

  // ── Ansichten ──────────────────────────────────────────────────────────────

  const kopf = (
    <GameTop icon="route" name="Karriere" ton="#34D399"
      zusatz={k ? <>{k.alter} Jahre · Stärke {k.ovr}</> : null}>
      <button className="iconbtn" onClick={() => { toggleMute(); setMuted(isMuted()); }} title="Ton">
        <Icon name={muted ? "mute" : "sound"} size={18} />
      </button>
      <ReportButton mode="karriere" />
      <button className="iconbtn" onClick={onLeave} title="Zur Lobby"><Icon name="leave" size={18} /></button>
    </GameTop>
  );

  if (!bereit) return (<div className="ppRoot weit karriere">{kopf}<div className="panel"><p>Die Vereinswelt wird gebaut …</p></div></div>);

  // Anlage
  if (!k) return (
    <div className="ppRoot weit karriere">
      {kopf}
      <div className="panel kaAnlage">
        <Bild pfad="/bilder/karriere-kopf.jpg" klasse="kaKopfbild" alt="" />
        <h2>Definiere deine Identität</h2>

        <div className="kaAnlageSpalten">
          {/* Wer bist du */}
          <section className="kaSpalte">
            <h3>Identität</h3>
            <Trikot name={name} nummer={nummer} land={land} />
            <div className="kaFeldreihe">
              <label>Nachname
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Nachname" />
              </label>
              <label>Nummer
                <input type="number" min="1" max="99" value={nummer}
                  onChange={(e) => setNummer(Math.max(1, Math.min(99, +e.target.value || 1)))} />
              </label>
            </div>
            {/* Zwei Schaltflächen statt einer Auswahlliste — wie im Vorbild, und damit
                sind beide Angaben so gross wie die Felder darüber. */}
            <label className="kaFussLabel">Starker Fuß</label>
            <div className="kaFuss">
              {[["links", "Links"], ["rechts", "Rechts"]].map(([wert, text]) => (
                <button key={wert} type="button" className={"kaFussKnopf" + (fuss === wert ? " an" : "")}
                  onClick={() => setFuss(wert)}>{text}</button>
              ))}
            </div>
          </section>

          {/* Woher kommst du — jedes Land, nicht nur die mit Liga */}
          <section className="kaSpalte">
            <h3>Nationalität</h3>
            <input className="kaLandSuche" value={landSuche} placeholder="Land suchen"
              onChange={(e) => setLandSuche(e.target.value)} />
            <div className="kaLandListe">
              {alleLaender().filter((l) => passtAufSuche(l, landSuche)).map((l) => (
                <button key={l.key} type="button" className={"kaLand" + (land === l.key ? " an" : "")}
                  onClick={() => setLand(l.key)}>
                  <span className="kaLandFlagge">{l.flagge}</span>
                  <span className="kaLandName">{l.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Wo spielst du */}
          <section className="kaSpalte">
            <h3>Position</h3>
            <Spielfeld pos={pos} setPos={setPos} />
            <p className="kaFeldName">{K.posDaten(pos).name}</p>
          </section>
        </div>

        <h3>Tempo</h3>
        <div className="kaTempo">
          {Object.entries(K.TEMPO).map(([key, t]) => (
            <button key={key} className={"kaWahl" + (tempo === key ? " an" : "")} onClick={() => setTempo(key)}>
              <b>{t.name}</b><small>{t.text}</small>
            </button>
          ))}
        </div>

        <button className="btn primary" onClick={starte}>Laufbahn beginnen</button>
        <DataStamp />
      </div>
    </div>
  );

  /* Eine Position, zwei Statistiken: Für den Torwart tauschen Tabelle, Saisonbilanz
     und Urkunde die Spalten Tore/Vorlagen gegen Gegentore/weiße Westen. Die
     Deklaration steht VOR der Zeitleiste, nicht dahinter — sonst greift die
     Tabelle auf eine Konstante zu, die es an dieser Stelle noch nicht gibt, und der
     ganze Modus stürzt beim ersten Rendern ab. */
  const torwart = K.istTorwart(k?.pos);

  /* ── Die Laufbahn als vollständige Tabelle ────────────────────────────────
     VORHER WUCHS SIE MIT: Nach jeder Saison kam eine Zeile dazu, davor war da
     nichts. Damit fehlte das, was eine Laufbahn ausmacht — zu sehen, wie viel
     noch vor einem liegt. Jetzt stehen alle Jahre von 16 bis 40 von Anfang an
     da und füllen sich eines nach dem anderen.

     Die Zeile nach der zuletzt gespielten trägt die Marke „naechste" und zeigt,
     dass es dort weitergeht. */
  const jahre = [];
  for (let a2 = K.START_ALTER; a2 <= K.ALTERSGRENZE; a2++) jahre.push(a2);
  const nachAlter = new Map(k.verlauf.map((z) => [z.alter, z]));
  const letztesGespielt = k.verlauf.length ? k.verlauf.at(-1).alter : K.START_ALTER - 1;

  const zeitleiste = (
    <div className="kaLeiste">
      <Verlaufskurve verlauf={k.verlauf} defVon={defVon} />
      <table>
        <thead><tr><th>Alter</th><th>Verein</th><th>Stärke</th><th>Sp</th>
          {torwart ? <><th title="Gegentore">GT</th><th title="weiße Westen">WW</th></>
                   : <><th title="Tore">To</th><th title="Vorlagen">Vo</th></>}
        </tr></thead>
        <tbody>
          {jahre.map((alter) => {
            const z = nachAlter.get(alter);
            /* Die zuletzt gefüllte Zeile bekommt einen kurzen Auftritt: Sie ist der
               Grund, warum der Ratingzähler daneben eine halbe Sekunde wartet. */
            const klasse = !z ? (alter === letztesGespielt + 1 ? "naechste" : "leer")
              : alter === letztesGespielt ? "neu" : undefined;
            return (
              <tr key={alter} className={klasse}>
                <td>{alter}</td>
                {z ? (
                  <>
                    <td>
                      <span className="kaZeilenWappen"><Emblem def={defVon({ key: z.key, name: z.verein })} /></span>
                      {z.verein} <small>{z.lg}</small>
                      {z.verletzt ? <small className="kaAus">verletzt</small> : null}
                      {z.titel.length ? <em>{z.titel.map((t, n) => <Trophaee key={n} titel={t} groesse={16} titelText={TITEL_NAME[t] || t} />)}</em> : null}
                    </td>
                    <td><span className="kaRatingMarke">{z.ovr}</span></td>
                    <td>{z.spiele}</td>
                    {torwart ? <><td>{z.gegentore ?? 0}</td><td>{z.westen ?? 0}</td></>
                             : <><td>{z.tore}</td><td>{z.vorlagen}</td></>}
                  </>
                ) : (
                  <td colSpan={5} />
                )}
              </tr>
            );
          })}
        </tbody>
        {/* Die Auswahl schliesst die Tabelle ab — sie gehört zur Laufbahn, hat aber
            kein Lebensjahr und deshalb keine eigene Zeile im Raster. */}
        <tfoot>
          <tr>
            <td><span className="kaZeilenFlagge">{landFlagge(k.land)}</span></td>
            <td>{landName(k.land)} <small>Auswahl</small></td>
            <td />
            <td>{k.national?.spiele || 0}</td>
            {torwart
              ? <><td>—</td><td>—</td></>
              : <><td>{k.national?.tore || 0}</td><td>{k.national?.vorlagen || 0}</td></>}
          </tr>
        </tfoot>
      </table>
    </div>
  );

  /* ── Die Laufbahn nach Vereinen ──────────────────────────────────────────
     Der Verlauf steht je SCHRITT, die Zusammenfassung will es je VEREIN: Wer
     dreimal hintereinander bei Freiburg war, hat dort eine Station mit der Summe
     aus drei Schritten, nicht drei Karten. Aufeinanderfolgende Schritte beim
     selben Verein werden deshalb zusammengefasst — eine Rückkehr Jahre später
     bleibt eine eigene Station, so wie man sie auch erzählen würde. */
  const stationen = (() => {
    const out = [];
    for (const z of k?.verlauf || []) {
      const letzte = out[out.length - 1];
      if (letzte && letzte.key === z.key) {
        letzte.spiele += z.spiele; letzte.tore += z.tore; letzte.vorlagen += z.vorlagen;
        letzte.gegentore += z.gegentore || 0; letzte.westen += z.westen || 0;
        letzte.titel.push(...(z.titel || []).filter((x) => x !== "BDO"));
        continue;
      }
      const def = defVon({ key: z.key, name: z.verein });
      out.push({
        key: z.key, name: z.verein, label: def.label || z.key, c1: def.c1, c2: def.c2, pat: def.pat,
        spiele: z.spiele, tore: z.tore, vorlagen: z.vorlagen,
        gegentore: z.gegentore || 0, westen: z.westen || 0,
        titel: (z.titel || []).filter((x) => x !== "BDO"),
      });
    }
    return out;
  })();

  const vitrine = (() => {
    const eintraege = TITEL_REIHE.filter((t) => k.titel[t]);
    return (
      <div className="kaVitrine">
        {eintraege.length
          ? eintraege.map((t) => (
              <span key={t} className="kaTitel" title={TITEL_NAME[t]}>
                <Trophaee titel={t} groesse={34} titelText={TITEL_NAME[t]} />
                <small>{TITEL_NAME[t]}{k.titel[t] > 1 ? ` ×${k.titel[t]}` : ""}</small>
              </span>
            ))
          : <span className="kaLeer">Vitrine leer</span>}
      </div>
    );
  })();

  const kopfzeile = (
    <div className="kaKopf">
      {/* Die Kachel wartet, bis die neue Zeile in der Zeitleiste steht. */}
      <div className="kaOvr" data-rang={K.rangVon(k.ovr)}>
        <small>RATING</small><b><Zaehler wert={k.ovr} warten={K.ZAEHLER_WARTEN} /></b>
      </div>
      {k.verein && <span className="kaWappen"><Emblem def={defVon(k.verein)} /></span>}
      <div className="kaWer">
        <b>#{k.nummer} {k.name}</b>
        <small>
          {K.posDaten(k.pos).name} · {landName(k.land)} · {k.verein ? k.verein.name : "vereinslos"}
          {k.national?.spiele
            ? <em className="kaNational">
                {landFlagge(k.land)} {k.national.spiele} {k.national.spiele === 1 ? "Länderspiel" : "Länderspiele"}
                {/* Beim Torwart blieben hier zwei Nullen stehen — „0 Tore · 0 Vorlagen"
                    ist keine Bilanz, sondern eine Positionsbeschreibung. */}
                {torwart ? null : <>
                  {" · "}{k.national.tore} {k.national.tore === 1 ? "Tor" : "Tore"}
                  {" · "}{k.national.vorlagen} {k.national.vorlagen === 1 ? "Vorlage" : "Vorlagen"}
                </>}
              </em>
            : null}
        </small>
      </div>
      <div className="kaWert"><b>{K.werteText(K.marktwert(k.ovr))}</b><small>Marktwert</small></div>
    </div>
  );

  /* DIE ZEITLEISTE STAND UNTER DEM SPIEL. Auf 600 Pixel Breite hing die ganze
     Laufbahn unterhalb der Entscheidung — wer sie ansehen wollte, scrollte an der
     Karte vorbei und wieder zurück. Bei genug Platz steht sie jetzt daneben und
     bleibt beim Scrollen stehen; darunter faellt das Raster auf eine Spalte
     zurueck und alles steht wieder untereinander. */
  return (
    <div className="ppRoot weit karriere">
      {feier && <Titelfeier titel={feier} onFertig={() => setFeier(null)} />}
      {kopf}
      {/* AM ENDE DIE VOLLE BREITE. Die Zusammenfassung ist 1240 Pixel breit gedacht;
          in der schmalen Aktionsspalte schrumpfte sie auf ein Drittel, und die
          Vereinskarten wurden unleserlich. Die Laufbahn rutscht dafür darunter. */}
      <div className={"kaBuehne" + (karte?.art === "ende" ? " einspaltig" : "")}>
      <div className="panel kaAktion">
        {kopfzeile}

        {saison && (
          <div className="kaSaison">
            <span className="kaSaisonKopf">
              {saison.saisons === 1 ? "Eine Saison" : `${saison.saisons} Saisons`} bei {saison.verein}
              {/* Ohne diesen Zusatz stünde bei einer durchverletzten Spielzeit nur
                  „0 Spiele" da, und niemand wüsste, warum. */}
              {saison.verletzt > 0 && (
                <i className="kaSaisonAus">
                  {saison.verletzt === saison.saisons ? "verletzt ausgefallen"
                    : `${saison.verletzt} Saison verletzt`}
                </i>
              )}
            </span>
            <span className="kaSaisonZahlen">
              {/* Die Zahlen laufen hoch statt zu stehen — dieselbe Regel wie beim
                  Rating: Eine Zahl, die sich bewegt, wird gelesen. Sie starten
                  sofort, damit die Bilanz VOR dem Rating fertig ist. */}
              {/* „1 Vorlagen" liest sich falsch, und die Zahl eins kommt oft genug vor. */}
              <b><Zaehler wert={saison.spiele} dauer={K.ZAEHLER_WARTEN - 120} /></b><small>{saison.spiele === 1 ? "Spiel" : "Spiele"}</small>
              {torwart ? (
                <>
                  <b><Zaehler wert={saison.gegentore} dauer={K.ZAEHLER_WARTEN - 120} /></b><small>{saison.gegentore === 1 ? "Gegentor" : "Gegentore"}</small>
                  <b><Zaehler wert={saison.westen} dauer={K.ZAEHLER_WARTEN - 120} /></b><small>{saison.westen === 1 ? "weiße Weste" : "weiße Westen"}</small>
                </>
              ) : (
                <>
                  <b><Zaehler wert={saison.tore} dauer={K.ZAEHLER_WARTEN - 120} /></b><small>{saison.tore === 1 ? "Tor" : "Tore"}</small>
                  <b><Zaehler wert={saison.vorlagen} dauer={K.ZAEHLER_WARTEN - 120} /></b><small>{saison.vorlagen === 1 ? "Vorlage" : "Vorlagen"}</small>
                </>
              )}
            </span>
          </div>
        )}

        {meldung.length > 0 && (
          <div className="kaMeldung">{meldung.map((m, i) => <span key={i}>{m}</span>)}</div>
        )}

        {karte?.art === "jugend" && (
          <div className="kaEntscheidung">
            <h3>Dein erster Verein</h3>
            {/* Bei Laendern ohne eigene Liga greift der Rueckfall auf beliebige kleine
                Vereine — dann darf hier nicht das Gegenteil stehen. */}
            <p>{karte.vereine.every((v) => v.liga.land === land)
              ? `Drei Vereine aus ${landName(land)} wollen dich in ihre Jugend holen.`
              : `In ${landName(land)} spielt keiner unserer Vereine — diese drei würden dich trotzdem nehmen.`}</p>
            <div className="kaVereine">
              {karte.vereine.map((v) => (
                <VereinsKarte key={v.key} verein={v} anlass="Anfangen bei"
                  gesperrt={sperre} onClick={() => spieleSchritt(k, v)} />
              ))}
            </div>
          </div>
        )}

        {karte?.art === "leihe" && (
          <div className="kaEntscheidung">
            <h3>Leihe</h3>
            <p>Bei {karte.bleiben.name} kommst du nicht zum Zug. Eine Saison woanders bringt dir Spiele.</p>
            <div className="kaVereine">
              {karte.vereine.map((v) => (
                <VereinsKarte key={v.key} verein={v} anlass="Leihe zu"
                  gesperrt={sperre} onClick={() => spieleSchritt({ ...k, leiheVon: karte.bleiben }, v)} />
              ))}
            </div>
            <div className="kaOptionen">
              <button className="kaOption" onClick={() => spieleSchritt(k, karte.bleiben)}>
                <b>Bleiben und kämpfen</b>
                <small>Wenig Einsatzzeit bei {karte.bleiben.name}</small>
              </button>
            </div>
          </div>
        )}

        {karte?.art === "rueckkehr" && (
          <div className="kaEntscheidung">
            <h3>Zurück von der Leihe</h3>
            <p>Die Zeit bei {karte.verein.name} ist vorbei — {karte.heim.name} holt dich zurück.</p>
            <div className="kaVereine einer">
              <VereinsKarte verein={karte.heim} anlass="Zurück zu"
                gesperrt={sperre} onClick={() => spieleSchritt(k, karte.heim)} />
            </div>
          </div>
        )}

        {karte?.art === "ereignis" && (
          <Ereigniskarte
            key={karte.ereignis.key + (karte.verein?.key || "")}
            ereignis={karte.ereignis}
            verein={karte.verein ?? k.verein}
            bewerte={bewerteOption}
            gesperrt={sperre}
            onFertig={waehleOption}
            folge={karte.folge}
            onWeiter={() => spieleSchritt(karte.folge.ergebnis.karriere, karte.verein)} />
        )}


        {karte?.art === "angebot" && (
          <div className="kaEntscheidung">
            <h3>Wie geht es weiter?</h3>
            <p>{karte.vereine.length ? "Andere Vereine klopfen an." : "Es klopft niemand an."}</p>
            {karte.vereine.length > 0 && (
              <div className="kaVereine">
                {karte.vereine.map((v) => (
                  <VereinsKarte key={v.key} verein={v} anlass="Wechseln zu"
                    gesperrt={sperre} onClick={() => spieleSchritt(k, v)} />
                ))}
              </div>
            )}
            {/* BLEIBEN IST KEINE FUSSNOTE. Es stand als schmale Zeile unter den drei
                Vereinskacheln und ging unter — dabei ist es genauso eine
                Entscheidung wie ein Wechsel. Jetzt ist es eine Kachel derselben
                Bauart, nur über die ganze Breite. */}
            <VereinsKarte verein={karte.bleiben} anlass="Bleiben bei" breit
              gesperrt={sperre} onClick={() => spieleSchritt(k, karte.bleiben)} />
            {karte.rücktritt && (
              <div className="kaOptionen" style={{ marginTop: 10 }}>
                <button className="kaOption kaEnde" disabled={sperre} onClick={() => beende(k)}>
                  <b>Die Schuhe an den Nagel hängen</b>
                  <small>Laufbahn beenden</small>
                </button>
              </div>
            )}
          </div>
        )}

        {karte?.art === "ende" && (
          <div className="kaEnde">
            <Confetti farben={["#F5B301", "#4ADE80", "#E8F3ED", "#D98A02", "#7DF3C0"]} />
            <h2>Laufbahn beendet</h2>
            {karte.grund && <p className="kaGrund">{karte.grund}</p>}
            <p className="kaBilanz">
              {k.verlauf.length ? `${k.verlauf[0].alter} bis ${k.alter}` : k.alter} ·{" "}
              {k.gesamt.spiele} Spiele ·{" "}
              {torwart
                ? <>{k.gesamt.gegentore ?? 0} Gegentore · {k.gesamt.westen ?? 0} weiße Westen · </>
                : <>{k.gesamt.tore} Tore · {k.gesamt.vorlagen} Vorlagen · </>}
              {k.vereine.length} Verein{k.vereine.length === 1 ? "" : "e"}
            </p>
            {/* ERST JETZT WIRD DAS TALENT GENANNT. Es wird beim Anlegen verdeckt
                gezogen und entscheidet, wie weit eine Laufbahn tragen kann — währenddessen
                wäre es eine Vorhersage und keine Laufbahn mehr. Am Ende erklärt es,
                warum es so gekommen ist: Nicht jeder wird Weltklasse. */}
            <p className="kaTalent">Veranlagung: {K.talentName(k.talent)}</p>
            <h3>Auszeichnungen</h3>
            {/* Die Auszeichnungen sind absichtlich schwer. Ohne diesen Satz stünde bei
                den meisten Laufbahnen eine leere Überschrift, und das sähe nach einem
                Fehler aus statt nach einem Ergebnis. */}
            <div className="kaAuszeichnungen">
              {karte.auszeichnungen.length
                ? karte.auszeichnungen.map((a) => (
                    <div key={a.key} className="kaAuszeichnung">
                      <Bild pfad={`/bilder/auszeichnung/${a.key}.png`} klasse="kaAbzeichen" alt="" />
                      <span><b>{a.name}</b><small>{a.text}</small></span>
                    </div>
                  ))
                : <p className="kaLeer">
                    Keine der {K.AUSZEICHNUNGEN.length} Auszeichnungen erreicht — sie verlangen mehr
                    als eine ordentliche Laufbahn.
                  </p>}
            </div>
            {/* Die Urkunde: das Bild, das die Laufbahn überdauert. Seit sie nicht mehr
                als PNG gespeichert wird, darf sie laden, was sie will — also stehen
                dort die echten Wappen. */}
            <UrkundeKarriere
              name={k.name}
              nummer={k.nummer}
              position={K.posDaten(k.pos).name}
              land={landName(k.land)}
              gesamt={k.gesamt}
              hoechste={Math.max(...k.verlauf.map((z) => z.ovr), k.ovr)}
              marktwert={K.werteText(K.marktwert(Math.max(...k.verlauf.map((z) => z.ovr), k.ovr)))}
              titel={TITEL_REIHE.filter((x) => k.titel[x]).map((x) => ({ key: x, name: TITEL_NAME[x], anzahl: k.titel[x] }))}
              auszeichnungen={karte.auszeichnungen}
              stationen={stationen}
              national={k.national}
              torwart={torwart}
              datum={new Date().toLocaleDateString("de-DE")}
            />

            <div className="kaEndeKnoepfe">
              <ShareButton style={{ flex: 1, padding: "12px" }}
                text={() => shareKarriere({
                  name: k.name,
                  stufe: karte.auszeichnungen[0]?.name || "ohne Auszeichnung",
                  saisons: k.verlauf.length,
                  tore: k.gesamt.tore, vorlagen: k.gesamt.vorlagen, overall: k.ovr,
                  titel: TITEL_REIHE.filter((t) => k.titel[t]).map((t) => TITEL_NAME[t]),
                })} />
              <button className="btn" onClick={() => { setK(null); setKarte(null); setMeldung([]); setSaison(null); }}>Neue Laufbahn</button>
            </div>
          </div>
        )}

        <DataStamp />
      </div>

      <aside className="panel kaLaufbahn">
        <h3>Laufbahn</h3>
        {vitrine}
        {/* Die Tabelle steht von der ersten Sekunde an da, auch leer: Sie zeigt,
            wie viel Laufbahn noch vor einem liegt. */}
        {zeitleiste}
      </aside>
      </div>
    </div>
  );
}
