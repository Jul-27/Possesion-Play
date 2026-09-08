import { useState, useEffect, useMemo, useRef } from "react";
import { NATIONS, CLUBS } from "./gameData.js";
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

/* Titelnamen für die Vitrine. Die Schlüssel sind dieselben wie im Feld `t` der
   Spielerdaten — „CL" heißt in der Karriere dasselbe wie in jedem anderen Modus. */
const TITEL_NAME = {
  MBL: "Deutscher Meister", MPL: "Englischer Meister", MLL: "Spanischer Meister",
  MSA: "Italienischer Meister", ML1: "Französischer Meister",
  DFB: "DFB-Pokal", FAC: "FA Cup", CDR: "Copa del Rey", CIT: "Coppa Italia",
  CL: "Champions League", EL: "Europa League",
  WM: "Weltmeister", EM: "Europameister", BDO: "Ballon d'Or",
};
const TITEL_REIHE = ["BDO", "WM", "EM", "CL", "EL", "MBL", "MPL", "MLL", "MSA", "ML1", "DFB", "FAC", "CDR", "CIT"];

/* Die Länder, in denen unsere Welt spielt — aus der Ligatabelle abgeleitet, damit
   die Auswahl nicht veraltet, wenn Ligen dazukommen. */
const LAENDER = [...new Set(WELT_LIGEN.map((l) => l.land))];
const landName = (code) => NATIONS.find((n) => n.key === code)?.name || code;

/* Ein Wappen braucht einen Schlüssel und Rückfallfarben. Für die 47 Spielvereine
   stehen die Farben in gameData; die übrigen 314 bekommen ein aus dem Schlüssel
   abgeleitetes Farbpaar, damit der gezeichnete Rückfall nicht bei allen gleich
   aussieht. Das echte Wappen kommt ohnehin aus public/logos/club/<KEY>.png —
   351 der 361 Vereine haben eines. */
const defVon = (v) => CLUBS.find((c) => c.key === v.key)
  || { key: v.key, name: v.name, label: v.key, c2: "#fff", pat: "solid",
       c1: `hsl(${K.hashStr(v.key) % 360} 52% 36%)` };

const prozent = (p) => `${Math.round(p * 100)} %`;
/* Wie eine Wirkung auf der Karte steht. Ohne diese Zeile wäre die Entscheidung
   wieder ein Blindflug — sie ist der Kern des Modus. */
function wirkungsText(w) {
  const teile = [];
  if (w.ovr) teile.push(`${w.ovr > 0 ? "+" : ""}${w.ovr} Stärke`);
  if (w.rolle) teile.push({ stamm: "Stammplatz", rotation: "Rotation", kader: "nur im Kader" }[w.rolle]);
  if (w.verletzt) teile.push(`${w.verletzt} Saison verletzt`);
  for (const [feld, name] of [["liga", "Meisterschaft"], ["pokal", "Pokal"], ["europa", "Europapokal"]])
    if (w[feld] !== undefined) teile.push(`${name} ${w[feld] > 1 ? "×" + w[feld] : "halbiert"}`);
  if (w.verbandswechsel) teile.push("neuer Verband");
  if (w.abschluss) teile.push("Schulabschluss");
  return teile.length ? teile.join(" · ") : "nichts ändert sich";
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

  // Lauf
  const [k, setK] = useState(null);
  const [karte, setKarte] = useState(null);   // { art: "jugend"|"ereignis"|"angebot"|"ende", ... }
  const [meldung, setMeldung] = useState([]); // was im letzten Schritt geschah
  const zufallRef = useRef(null);
  const modRef = useRef({ liga: 1, pokal: 1, europa: 1 });
  const verletztRef = useRef(0);
  const letzteRef = useRef([]);

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
    setK(neu);
    setMeldung([]);
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
    let spiele = 0, tore = 0, vorlagen = 0;

    for (let s = 0; s < saisons; s++) {
      if (verletztRef.current > 0) { verletztRef.current--; continue; }
      const l = K.saisonLeistung(k2, verein.stufe, zufall);
      spiele += l.spiele; tore += l.tore; vorlagen += l.vorlagen;
      for (const t of K.saisonTitel(verein, zufall, modRef.current)) neueTitel.push(t);
      for (const t of K.einzelTitel(k2, l, zufall)) { neueTitel.push(t); if (k2.bdoAlter === undefined) k2.bdoAlter = k2.alter; }
      k2.saisonNr = (k2.saisonNr || 0) + 1;
      for (const t of K.nationalTitel(k2, verein, zufall, k2.saisonNr)) neueTitel.push(t);
      k2.alter += 1;
      k2.ovr = K.grenze(k2.ovr + K.wachstum(k2.typ, k2.alter, zufall), K.OVR_MIN, K.OVR_MAX);
      /* Auf- und Abstieg am Saisonende. Wer aufsteigt, wird vermerkt — nur so kann
         später „Aus der Zweiten" überhaupt zutreffen. */
      const w = K.ligaWechsel(verein, zufall);
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
      },
      verlauf: [...k2.verlauf, { alter: k2.alter, verein: verein.name, key: verein.key, lg: verein.lg, ovr: k2.ovr, spiele, tore, vorlagen, titel: neueTitel }],
    };

    setK(k2);
    setMeldung([...neueTitel.map((t) => `🏆 ${TITEL_NAME[t] || t}`), ...ereignisse.map((e) => `↕ ${e}`)]);
    if (neueTitel.length) play("win");
    naechsteKarte(k2, verein);
  }

  /* Was kommt als Nächstes — eine Entscheidung oder ein Wechsel? Angebote dürfen
     nicht ausbleiben, sonst klebt man ewig am selben Verein; Ereignisse nicht
     dauernd kommen, sonst wird die Laufbahn zur Fragebogenaktion. */
  function naechsteKarte(k2, verein) {
    const zufall = zufallRef.current;
    if (k2.alter >= 40) return beende(k2);
    const offerten = K.angebote(welt, k2, zufall);
    const mussWechseln = k2.alter >= K.RUECKTRITT_AB && offerten.length === 0;
    if (mussWechseln) return beende(k2);

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

    const seitWechsel = k2.verlauf.filter((z) => z.verein === verein.name).length;
    if (seitWechsel >= 3 || zufall() < 0.45) {
      setKarte({ art: "angebot", vereine: offerten, bleiben: verein, rücktritt: k2.alter >= K.RUECKTRITT_AB });
    } else {
      const e = K.ziehEreignis(k2, zufall, letzteRef.current);
      letzteRef.current = [...letzteRef.current, e.key].slice(-4);
      setKarte({ art: "ereignis", ereignis: e, verein });
    }
  }

  function waehleOption(option) {
    const r = K.entscheide(k, option, zufallRef.current);
    modRef.current = r.mod;
    verletztRef.current += r.verletzt;
    play(r.gelungen ? "ok" : "err");
    spieleSchritt(r.karriere, karte.verein);
  }

  function beende(k2) {
    const fertig = { ...k2, beendet: true };
    setK(fertig);
    setKarte({ art: "ende", auszeichnungen: K.erreichteAuszeichnungen(fertig) });
    play("end");
  }

  // ── Ansichten ──────────────────────────────────────────────────────────────

  const kopf = (
    <GameTop icon="route" name="Karriere" ton="#34D399"
      zusatz={k ? <>{k.alter} Jahre · Stärke {k.ovr}</> : null}>
      <button className="ibtn" onClick={() => { toggleMute(); setMuted(isMuted()); }} title="Ton">
        <Icon name={muted ? "soundOff" : "soundOn"} size={18} />
      </button>
      <ReportButton mode="karriere" />
      <button className="ibtn" onClick={onLeave} title="Zur Lobby"><Icon name="home" size={18} /></button>
    </GameTop>
  );

  if (!bereit) return (<div className="ppRoot">{kopf}<div className="panel"><p>Die Vereinswelt wird gebaut …</p></div></div>);

  // Anlage
  if (!k) return (
    <div className="ppRoot">
      {kopf}
      <div className="panel kaAnlage">
        <h2>Wer wirst du?</h2>
        <div className="kaFeldreihe">
          <label>Name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Nachname" />
          </label>
          <label>Nummer
            <input type="number" min="1" max="99" value={nummer} onChange={(e) => setNummer(+e.target.value)} />
          </label>
        </div>
        <div className="kaFeldreihe">
          <label>Land
            <select value={land} onChange={(e) => setLand(e.target.value)}>
              {LAENDER.map((c) => <option key={c} value={c}>{landName(c)}</option>)}
            </select>
          </label>
          <label>Starker Fuß
            <select value={fuss} onChange={(e) => setFuss(e.target.value)}>
              <option value="rechts">rechts</option><option value="links">links</option>
            </select>
          </label>
        </div>

        <h3>Position</h3>
        <div className="kaPositionen">
          {K.POSITIONEN.map((p) => (
            <button key={p.key} className={"kaPos" + (pos === p.key ? " an" : "")}
              onClick={() => setPos(p.key)} title={p.name}>{p.key}</button>
          ))}
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

  const zeitleiste = (
    <div className="kaLeiste">
      <table>
        <thead><tr><th>Alter</th><th>Verein</th><th>Stärke</th><th>Sp</th><th>To</th><th>Vo</th></tr></thead>
        <tbody>
          {k.verlauf.map((z, i) => (
            <tr key={i}>
              <td>{z.alter}</td>
              <td><span className="kaZeilenWappen"><Emblem def={defVon({ key: z.key, name: z.verein })} /></span>{z.verein} <small>{z.lg}</small>{z.titel.length ? <em> · {z.titel.map((t) => TITEL_NAME[t] || t).join(", ")}</em> : null}</td>
              <td><b>{z.ovr}</b></td><td>{z.spiele}</td><td>{z.tore}</td><td>{z.vorlagen}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const vitrine = (() => {
    const eintraege = TITEL_REIHE.filter((t) => k.titel[t]);
    return (
      <div className="kaVitrine">
        {eintraege.length
          ? eintraege.map((t) => <span key={t} className="kaTitel">{TITEL_NAME[t]}{k.titel[t] > 1 ? ` ×${k.titel[t]}` : ""}</span>)
          : <span className="kaLeer">Vitrine leer</span>}
      </div>
    );
  })();

  const kopfzeile = (
    <div className="kaKopf">
      <div className="kaOvr"><b>{k.ovr}</b><small>Stärke</small></div>
      {k.verein && <span className="kaWappen"><Emblem def={defVon(k.verein)} /></span>}
      <div className="kaWer">
        <b>#{k.nummer} {k.name}</b>
        <small>{K.posDaten(k.pos).name} · {landName(k.land)} · {k.verein ? k.verein.name : "vereinslos"}</small>
      </div>
      <div className="kaWert"><b>{K.werteText(K.marktwert(k.ovr))}</b><small>Marktwert</small></div>
    </div>
  );

  return (
    <div className="ppRoot">
      {kopf}
      <div className="panel">
        {kopfzeile}
        {vitrine}

        {meldung.length > 0 && (
          <div className="kaMeldung">{meldung.map((m, i) => <span key={i}>{m}</span>)}</div>
        )}

        {karte?.art === "jugend" && (
          <div className="kaEntscheidung">
            <h3>Dein erster Verein</h3>
            <p>Drei Vereine aus {landName(land)} wollen dich in ihre Jugend holen.</p>
            <div className="kaOptionen">
              {karte.vereine.map((v) => (
                <button key={v.key} className="kaOption mitWappen" onClick={() => spieleSchritt(k, v)}>
                  <Emblem def={defVon(v)} />
                  <span><b>{v.name}</b><small>{v.liga.name} · Stufe {v.stufe}</small></span>
                </button>
              ))}
            </div>
          </div>
        )}

        {karte?.art === "leihe" && (
          <div className="kaEntscheidung">
            <h3>Leihe</h3>
            <p>Bei {karte.bleiben.name} kommst du nicht zum Zug. Eine Saison woanders bringt dir Spiele.</p>
            <div className="kaOptionen">
              {karte.vereine.map((v) => (
                <button key={v.key} className="kaOption mitWappen"
                  onClick={() => spieleSchritt({ ...k, leiheVon: karte.bleiben }, v)}>
                  <Emblem def={defVon(v)} />
                  <span><b>Leihe zu {v.name}</b>
                  <small>{v.liga.name} · Stufe {v.stufe} · dort {Math.round(K.einsatzAnteil(k.ovr, v.stufe, k.rolle) * K.SPIELE_JE_SAISON)} Spiele statt {Math.round(K.einsatzAnteil(k.ovr, karte.bleiben.stufe, k.rolle) * K.SPIELE_JE_SAISON)}</small></span>
                </button>
              ))}
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
            <div className="kaOptionen">
              <button className="kaOption mitWappen" onClick={() => spieleSchritt(k, karte.heim)}>
                <Emblem def={defVon(karte.heim)} />
                <span><b>Zurück zu {karte.heim.name}</b><small>{karte.heim.liga.name} · Stufe {karte.heim.stufe}</small></span>
              </button>
            </div>
          </div>
        )}

        {karte?.art === "ereignis" && (
          <div className="kaEntscheidung">
            <h3>{karte.ereignis.titel}</h3>
            <p>{karte.ereignis.text}</p>
            <div className="kaOptionen">
              {karte.ereignis.optionen.map((o, i) => (
                <button key={i} className="kaOption" onClick={() => waehleOption(o)}>
                  <b>{o.label}</b>
                  {o.chance === undefined
                    ? <small>{wirkungsText(o.wirkung)}</small>
                    : <>
                        <small className="gut">{wirkungsText(o.wirkung)} · {prozent(o.chance)}</small>
                        <small className="schlecht">{wirkungsText(o.sonst)} · {prozent(1 - o.chance)}</small>
                      </>}
                </button>
              ))}
            </div>
          </div>
        )}

        {karte?.art === "angebot" && (
          <div className="kaEntscheidung">
            <h3>Wie geht es weiter?</h3>
            <p>{karte.vereine.length ? "Andere Vereine klopfen an." : "Es klopft niemand an."}</p>
            <div className="kaOptionen">
              {karte.vereine.map((v) => (
                <button key={v.key} className="kaOption mitWappen" onClick={() => spieleSchritt(k, v)}>
                  <Emblem def={defVon(v)} />
                  <span><b>Wechseln zu {v.name}</b><small>{v.liga.name} · Stufe {v.stufe} · verlangt Stärke {K.STUFE_MINDEST_OVR[v.stufe]}</small></span>
                </button>
              ))}
              <button className="kaOption mitWappen" onClick={() => spieleSchritt(k, karte.bleiben)}>
                <Emblem def={defVon(karte.bleiben)} />
                <span><b>Bleiben bei {karte.bleiben.name}</b><small>{karte.bleiben.liga.name} · Stufe {karte.bleiben.stufe}</small></span>
              </button>
              {karte.rücktritt && (
                <button className="kaOption kaEnde" onClick={() => beende(k)}>
                  <b>Die Schuhe an den Nagel hängen</b>
                  <small>Laufbahn beenden</small>
                </button>
              )}
            </div>
          </div>
        )}

        {karte?.art === "ende" && (
          <div className="kaEnde">
            <Confetti an={karte.auszeichnungen.length > 1} />
            <h2>Laufbahn beendet</h2>
            <p className="kaBilanz">
              {k.verlauf.length ? `${k.verlauf[0].alter - K.TEMPO[k.tempo].saisons} bis ${k.alter}` : k.alter} ·{" "}
              {k.gesamt.spiele} Spiele · {k.gesamt.tore} Tore · {k.gesamt.vorlagen} Vorlagen ·{" "}
              {k.vereine.length} Verein{k.vereine.length === 1 ? "" : "e"}
            </p>
            <h3>Auszeichnungen</h3>
            {/* Die Auszeichnungen sind absichtlich schwer. Ohne diesen Satz stünde bei
                den meisten Laufbahnen eine leere Überschrift, und das sähe nach einem
                Fehler aus statt nach einem Ergebnis. */}
            <div className="kaAuszeichnungen">
              {karte.auszeichnungen.length
                ? karte.auszeichnungen.map((a) => (
                    <div key={a.key} className="kaAuszeichnung"><b>{a.name}</b><small>{a.text}</small></div>
                  ))
                : <p className="kaLeer">
                    Keine der {K.AUSZEICHNUNGEN.length} Auszeichnungen erreicht — sie verlangen mehr
                    als eine ordentliche Laufbahn.
                  </p>}
            </div>
            <div className="kaEndeKnoepfe">
              <ShareButton style={{ flex: 1, padding: "12px" }}
                text={() => shareKarriere({
                  name: k.name,
                  stufe: karte.auszeichnungen[0]?.name || "ohne Auszeichnung",
                  saisons: k.gesamt.spiele ? k.verlauf.length * K.TEMPO[k.tempo].saisons : 0,
                  tore: k.gesamt.tore, vorlagen: k.gesamt.vorlagen, overall: k.ovr,
                  titel: TITEL_REIHE.filter((t) => k.titel[t]).map((t) => TITEL_NAME[t]),
                })} />
              <button className="btn" onClick={() => { setK(null); setKarte(null); setMeldung([]); }}>Neue Laufbahn</button>
            </div>
          </div>
        )}

        {k.verlauf.length > 0 && zeitleiste}
        <DataStamp />
      </div>
    </div>
  );
}
