import { useState, useEffect, useMemo, useRef } from "react";
import { CLUBS, NATIONS } from "./gameData.js";
import { LIGA_VEREINE, LIGA_AB_JAHR } from "./leagueClubs.js";
import { baueZiehungen, baueKlassen, kader, DRAFT_AB_JAHR, LIGA_NAME, VERBUND_MAX } from "./draft.js";
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

const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Speicherstand weiter */ } },
};
const BESTEN_KEY = "pp:karriere:best";

/* Titelnamen für die Vitrine. Die Schlüssel sind dieselben wie im Feld `t` der
   Spielerdaten — dadurch heißt „CL" in der Karriere dasselbe wie in jedem anderen
   Modus, und die Wappen passen ohne Übersetzungstabelle. */
const TITEL_NAME = {
  MBL: "Deutscher Meister", MPL: "Englischer Meister", MLL: "Spanischer Meister",
  MSA: "Italienischer Meister", ML1: "Französischer Meister",
  DFB: "DFB-Pokal", FAC: "FA Cup", CDR: "Copa del Rey", CIT: "Coppa Italia",
  CL: "Champions League", EL: "Europa League",
  WM: "Weltmeister", EM: "Europameister", CA: "Copa América",
  BDO: "Ballon d'Or", TSK: "Torschützenkönig", VLK: "Vorlagenkönig",
};
const TITEL_REIHE = ["BDO", "WM", "CL", "EM", "CA", "MBL", "MPL", "MLL", "MSA", "ML1", "EL", "DFB", "FAC", "CDR", "CIT", "TSK", "VLK"];

/* Wie stark ist eine Nation? Aus der Zahl ihrer Spieler im Bestand — mehr Spieler
   heißt mehr Konkurrenz um einen Platz und ein stärkeres Team. Gerechnet, nicht
   gesetzt, damit die Liste nicht veraltet, wenn die Daten wachsen. */
function nationsStaerken(players) {
  const zahl = new Map();
  for (const p of players) for (const n of p.nat || []) zahl.set(n, (zahl.get(n) || 0) + 1);
  const werte = [...zahl.values()].sort((a, b) => a - b);
  const max = werte.at(-1) || 1;
  const out = new Map();
  for (const [n, c] of zahl) out.set(n, Math.round(40 + 55 * Math.sqrt(c / max)));
  return out;
}

export default function Karriere({ onLeave }) {
  const [players, setPlayers] = useState(null);
  const [einsaetze, setEinsaetze] = useState(undefined);
  const [muted, setMuted] = useState(isMuted());
  const [regeln, setRegeln] = useState(false);
  const [best, setBest] = useState(() => store.get(BESTEN_KEY) || null);

  // Anlage
  const [name, setName] = useState("");
  const [nation, setNation] = useState("GER");
  const [nummer, setNummer] = useState(9);
  const [pos, setPos] = useState("ST");
  const [tempo, setTempo] = useState("normal");

  // Lauf
  const [k, setK] = useState(null);
  const [frage, setFrage] = useState(null);       // offenes Ereignis
  const [angebote, setAngebote] = useState(null); // offene Transferwahl
  const [bericht, setBericht] = useState([]);     // Saisonmeldungen
  const zufallRef = useRef(null);
  const vorplatzRef = useRef(null);
  const endeRef = useRef(null);

  useEffect(() => { loadPlayers().then(setPlayers); }, []);
  useEffect(() => { loadAppearances().then((e) => setEinsaetze(e || null)); }, []);

  /* Die Welt einmal bauen — 125 Vereine, jeder mit einem Niveau aus seinen echten
     Kadern. Gemessen rund zwei Sekunden, deshalb nur einmal je Sitzung. */
  const welt = useMemo(() => {
    if (!players || einsaetze === undefined) return null;
    const roh = [
      ...CLUBS.map((c) => ({ key: c.key, name: c.name, lg: c.lg })),
      ...Object.entries(LIGA_VEREINE).flatMap(([lg, v]) => v.map((x) => ({ ...x, lg }))),
    ];
    const eindeutig = [...new Map(roh.map((c) => [c.key, c])).values()];
    const ziehungen = [];
    for (const lg of [...new Set(eindeutig.map((c) => c.lg))]) {
      ziehungen.push(...baueZiehungen(players, eindeutig.filter((c) => c.lg === lg), lg));
    }
    const klassen = baueKlassen(players, ziehungen, einsaetze);
    const staerkeVon = (v) => {
      const jahre = v.jahre || Array.from({ length: 2026 - DRAFT_AB_JAHR + 1 }, (_, i) => DRAFT_AB_JAHR + i);
      const w = [];
      for (const j of jahre) {
        const kd = kader(players, v.key, j, 5);
        if (kd.length >= 8) w.push(teamStaerke({ spieler: kd, jahr: j }, players, klassen));
      }
      if (!w.length) return NaN;
      w.sort((a, b) => a - b);
      return w[Math.floor(w.length / 2)];
    };
    return K.baueWelt(eindeutig, staerkeVon, VERBUND_MAX);
  }, [players, einsaetze]);

  const nationStaerke = useMemo(() => (players ? nationsStaerken(players) : new Map()), [players]);

  /* Startvereine: das untere Drittel. Copero fängt bei einem lokalen Verein an, und
     bei Real Madrid zu beginnen nähme der Laufbahn ihren Bogen. */
  const startVereine = useMemo(() => {
    if (!welt) return [];
    const schwelle = welt.vereine.at(-1).niveau + (welt.vereine[0].niveau - welt.vereine.at(-1).niveau) * 0.35;
    return welt.vereine.filter((v) => v.niveau <= schwelle);
  }, [welt]);

  function starte() {
    const seed = Math.floor(Math.random() * 1e9);
    zufallRef.current = K.rng(K.hashStr("kar:" + seed));
    vorplatzRef.current = null;
    endeRef.current = null;
    const verein = startVereine[Math.floor(zufallRef.current() * startVereine.length)];
    setK(K.neueKarriere({ name: name.trim() || "Dein Spieler", nation, nummer, pos, verein, tempo, seed }));
    setBericht([]);
    setAngebote(null);
    setFrage(null);
    play("click");
  }

  /* ── Eine Saison ────────────────────────────────────────────────────────────
     Erst die Entscheidungen, dann die Saison, dann die Angebote. Genau diese
     Reihenfolge macht eine Wahl spürbar: Wer hart trainiert, sieht es im selben
     Jahr auf dem Platz. */
  function naechsteSaison(stand = k) {
    const t = K.TEMPO[stand.tempo] || K.TEMPO.normal;
    const zufall = zufallRef.current;
    let cur = stand;
    const meldungen = [];

    for (let s = 0; s < t.saisonsJeSchritt && !cur.beendet; s++) {
      const leistung = K.saisonLeistung(cur, cur.verein.niveau, zufall);
      const platz = K.ligaPlatz(cur.verein, cur, zufall);
      const titel = [
        ...K.vereinsTitel(cur.verein, platz, cur, zufall),
        ...K.europaTitel(cur.verein, vorplatzRef.current, cur, zufall),
      ];
      const turnier = K.turnierIn(cur.saison, cur.nation);
      const nStaerke = nationStaerke.get(cur.nation) || 60;
      const berufen = cur.overall >= K.nationsSchwelle(nStaerke);
      if (berufen && turnier) titel.push(...K.nationalTitel(turnier, nStaerke, cur, zufall));
      titel.push(...K.einzelTitel(cur, leistung, titel, zufall));

      const titelZaehler = { ...cur.titel };
      for (const x of titel) titelZaehler[x] = (titelZaehler[x] || 0) + 1;

      meldungen.push({
        saison: cur.saison, alter: cur.alter, verein: cur.verein, platz,
        overall: Math.round(cur.overall), ...leistung, titel, berufen, turnier,
      });
      vorplatzRef.current = platz;

      const nachher = K.alterePlayer(cur, leistung, zufall, cur.verein.niveau);
      cur = {
        ...nachher,
        titel: titelZaehler,
        gesamt: {
          spiele: cur.gesamt.spiele + leistung.spiele,
          tore: cur.gesamt.tore + leistung.tore,
          vorlagen: cur.gesamt.vorlagen + leistung.vorlagen,
        },
        hoechsterOverall: Math.max(cur.hoechsterOverall || cur.overall, nachher.overall),
      };
      if (K.trittZurueck(cur, zufall)) cur = { ...cur, beendet: true };
    }

    setBericht(meldungen);
    setK(cur);
    if (cur.beendet) { play("ok"); return; }

    /* Erst fragen, dann Angebote — sonst entscheidet man über einen Wechsel, bevor
       man weiß, wie man trainiert hat. */
    const gesehen = [];
    const fragen = [];
    for (let e = 0; e < t.ereignisse; e++) {
      const ev = K.ziehEreignis(cur, gesehen);
      gesehen.push(ev.key);
      fragen.push(ev);
    }
    setFrage({ liste: fragen, index: 0 });
    play("click");
  }

  function waehle(w) {
    const nach = K.entscheide(k, w);
    setK(nach);
    const naechster = frage.index + 1;
    if (naechster < frage.liste.length) { setFrage({ ...frage, index: naechster }); return; }
    setFrage(null);
    /* Verträge laufen aus, und dann kommen Angebote. Ohne die Bedingung würde in
       jeder Saison der Markt aufgehen und der Modus zur Wechselbörse. */
    const ang = K.angebote(nach, welt, zufallRef.current, 3);
    if (ang.length && (nach.vertragBis <= 0 || zufallRef.current() < 0.5)) setAngebote(ang);
  }

  function wechsle(a) {
    setK({ ...k, verein: a.verein, vertragBis: a.jahre, ruf: Math.min(100, k.ruf + 4) });
    setAngebote(null);
    play("ok");
  }

  /* Bestleistung festhalten, sobald die Laufbahn endet. */
  useEffect(() => {
    if (!k?.beendet || endeRef.current) return;
    endeRef.current = true;
    const punkte = K.karrierePunkte(k);
    if (!best || punkte > best.punkte) {
      const neu = { punkte, stufe: K.stufeFuer(k).name, name: k.name, tore: k.gesamt.tore, saisons: k.saison };
      setBest(neu);
      store.set(BESTEN_KEY, neu);
    }
  }, [k?.beendet]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ansicht ────────────────────────────────────────────────────────────────

  const kopf = (
    <GameTop icon="route" name="Karriere" ton="#34D399" zusatz={k ? <>Saison {k.saison} · {k.alter} Jahre</> : null}>
      <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}><Icon name={muted ? "mute" : "sound"} size={18} /></button>
      <button className="iconbtn" title="Regeln" onClick={() => setRegeln(true)}><Icon name="help" size={18} /></button>
      <ReportButton mode="karriere" />
      <button className="iconbtn" title="Zur Lobby" onClick={onLeave}><Icon name="leave" size={18} /></button>
    </GameTop>
  );

  const regelModal = regeln && (
    <div className="overlay" onClick={() => setRegeln(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Karriere</h2>
        <p className="ruleP">Du steuerst keinen Spieler auf dem Platz, sondern eine <b>Laufbahn</b>. Mit sechzehn geht es bei einem kleinen Verein los, mit Mitte dreißig ist Schluss. Dazwischen entscheidest du über Training, Ernährung, Presse, Feiern — und über jeden Wechsel.</p>
        <p className="ruleP">Die Vereine sind <b>echt</b>, und ihre Stärke ist gerechnet: Sie kommt aus denselben Kadern, aus denen der Draft zieht. Real Madrid steht bei 90, Heidenheim bei 65. Danach richtet sich, wer dich haben will — und wie viel du dort spielst.</p>
        <p className="ruleP">Der <b>Wechsel nach oben ist ein Wagnis</b>: Wer deutlich unter dem Niveau seines neuen Vereins liegt, sitzt auf der Bank und entwickelt sich langsamer. Wer klein bleibt, spielt immer, kommt aber an keinen Titel. Beide Wege sind gangbar, keiner ist geschenkt.</p>
        <p className="ruleP">Am Ende steht ein Urteil von <b>Gescheitertes Talent</b> bis <b>Legende</b>. Gemessen an je 300 simulierten Laufbahnen erreicht die Legende gut ein Zehntel derer, die jede Entscheidung optimal treffen — und keine, die durchklickt.</p>
        <DataStamp />
        <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setRegeln(false)}>Los geht's</button></div>
      </div>
    </div>
  );

  if (!players || einsaetze === undefined || !welt) {
    return <div className="ppRoot">{kopf}<div className="qlogEmpty">Baue die Fußballwelt…</div>{regelModal}</div>;
  }

  // Schritt 1: Anlage
  if (!k) {
    return (
      <div className="ppRoot">
        {kopf}
        <div className="panel">
          <div className="prompt">Wer wirst du?</div>
          <div className="karAnlage">
            <label>Name
              <input className="field" value={name} maxLength={24} placeholder="Dein Spieler"
                onChange={(e) => setName(e.target.value)} />
            </label>
            <label>Nation
              <select className="field" value={nation} onChange={(e) => setNation(e.target.value)}>
                {NATIONS.map((n) => <option key={n.key} value={n.key}>{n.name}</option>)}
              </select>
            </label>
            <label>Rückennummer
              <input className="field" type="number" min="1" max="99" value={nummer}
                onChange={(e) => setNummer(Math.max(1, Math.min(99, +e.target.value || 1)))} />
            </label>
          </div>

          <div className="prompt" style={{ marginTop: 16 }}>Position</div>
          <div className="karWahlreihe">
            {K.POSITIONEN.map((p) => (
              <button key={p.key} className={`karWahl ${pos === p.key ? "an" : ""}`} onClick={() => setPos(p.key)}>
                <b>{p.name}</b>
              </button>
            ))}
          </div>

          <div className="prompt" style={{ marginTop: 16 }}>Wie schnell soll die Zeit vergehen?</div>
          <div className="karWahlreihe">
            {Object.entries(K.TEMPO).map(([key, t]) => (
              <button key={key} className={`karWahl ${tempo === key ? "an" : ""}`} onClick={() => setTempo(key)}>
                <b>{t.name}</b><span>{t.text}</span>
              </button>
            ))}
          </div>

          {best && <p className="ruleP">Bisher am weitesten gekommen: <b>{best.stufe}</b> mit {best.name} — {best.tore} Tore in {best.saisons} Saisons.</p>}
          <div className="closeline">
            <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={starte}>Karriere beginnen</button>
          </div>
        </div>
        {regelModal}
      </div>
    );
  }

  const stufe = k.beendet ? K.stufeFuer(k) : null;
  const titelListe = TITEL_REIHE.filter((t) => k.titel[t]);

  return (
    <div className="ppRoot">
      {kopf}

      <div className="karKopf">
        <div className="karWer">
          <span className="karNummer">{k.nummer}</span>
          <div>
            <b>{k.name}</b>
            <span className="karMeta">{K.posDaten(k.pos).name} · {k.nation} · {k.alter} Jahre</span>
          </div>
        </div>
        <div className="karOverall">{Math.round(k.overall)}</div>
      </div>

      <div className="karVerein">
        <Emblem def={CLUBS.find((c) => c.key === k.verein.key) || { key: k.verein.key, name: k.verein.name, label: k.verein.key, c1: "#334", c2: "#fff", pat: "solid" }} />
        <span><b>{k.verein.name}</b><span className="karMeta">{LIGA_NAME[k.verein.lg] || k.verein.lg} · Niveau {k.verein.niveau}</span></span>
      </div>

      <div className="karBalken">
        {[["Form", k.form], ["Fitness", k.fitness], ["Moral", k.moral], ["Ruf", k.ruf]].map(([label, wert]) => (
          <div key={label}>
            <span>{label}</span>
            <div className="karBar"><i style={{ width: `${wert}%` }} /></div>
          </div>
        ))}
      </div>

      {bericht.length > 0 && (
        <div className="panel">
          {bericht.map((b, n) => (
            <div key={n} className="karSaison">
              <div className="karSaisonKopf">
                <b>Saison {b.saison}</b>
                <span className="karMeta">{b.verein.name} · Platz {b.platz}</span>
              </div>
              <div className="karZahlen">
                <span><b>{b.spiele}</b> Spiele</span>
                <span><b>{b.tore}</b> Tore</span>
                <span><b>{b.vorlagen}</b> Vorlagen</span>
              </div>
              {b.berufen && b.turnier && <div className="karMeta">Im Aufgebot für die {TITEL_NAME[b.turnier] || b.turnier}-Endrunde</div>}
              {b.titel.length > 0 && (
                <div className="karTitelZeile">{b.titel.map((t) => <span key={t} className="karTitel">{TITEL_NAME[t] || t}</span>)}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {frage && (
        <div className="panel">
          <div className="prompt">{frage.liste[frage.index].frage}</div>
          <div className="karWahlen">
            {frage.liste[frage.index].wahlen.map((w, i) => (
              <button key={i} className="karEntscheidung" onClick={() => waehle(w)}>
                <b>{w.text}</b>
                <span className="karMeta">{beschreibeWirkung(w)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {angebote && (
        <div className="panel">
          <div className="prompt">Diese Vereine wollen dich</div>
          <div className="karWahlen">
            {angebote.map((a, i) => (
              <button key={i} className="karEntscheidung" onClick={() => wechsle(a)}>
                <b>{a.verein.name}</b>
                <span className="karMeta">
                  {LIGA_NAME[a.verein.lg] || a.verein.lg} · Niveau {a.verein.niveau} · {a.jahre} Jahre
                  {a.verein.niveau > k.overall + 3 ? " · du wärst Ergänzungsspieler" : a.verein.niveau < k.overall - 4 ? " · du wärst der Star" : " · du wärst Stammspieler"}
                </span>
              </button>
            ))}
            <button className="karEntscheidung" onClick={() => setAngebote(null)}>
              <b>Bleiben</b><span className="karMeta">Beim {k.verein.name} weitermachen</span>
            </button>
          </div>
        </div>
      )}

      {!frage && !angebote && !k.beendet && (
        <div className="closeline">
          <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={() => naechsteSaison()}>
            {bericht.length ? "Weiter" : "Erste Saison spielen"}
          </button>
        </div>
      )}

      {titelListe.length > 0 && (
        <div className="panel">
          <div className="prompt">Vitrine</div>
          <div className="karVitrine">
            {titelListe.map((t) => (
              <span key={t} className="karPokal">{TITEL_NAME[t]}{k.titel[t] > 1 ? ` ×${k.titel[t]}` : ""}</span>
            ))}
          </div>
        </div>
      )}

      {k.beendet && (
        <div className="panel dailyEnd">
          {(stufe.key === "legende" || stufe.key === "weltstar") && <Confetti />}
          <div className="tmKarteKopf">
            <span className="tmKarteEmoji">{stufe.emoji}</span>
            <div>
              <h2 style={{ margin: 0 }}>{stufe.name}</h2>
              <span className="tmSpielerMeta">{k.name} · {k.saison - 1} Saisons · Rücktritt mit {k.alter}</span>
            </div>
          </div>
          <div className="tmBilanz">
            <span><b>{k.gesamt.spiele}</b>Sp</span>
            <span><b>{k.gesamt.tore}</b>T</span>
            <span><b>{k.gesamt.vorlagen}</b>V</span>
            <span className="tmPunkte"><b>{Math.round(k.hoechsterOverall || k.overall)}</b> Höchstwert</span>
          </div>
          <div className="closeline">
            <ShareButton style={{ flex: 1, padding: "12px" }}
              text={shareKarriere({
                name: k.name, stufe: stufe.name, saisons: k.saison - 1,
                tore: k.gesamt.tore, vorlagen: k.gesamt.vorlagen,
                overall: Math.round(k.hoechsterOverall || k.overall),
                titel: titelListe.map((t) => `${TITEL_NAME[t]}${k.titel[t] > 1 ? ` ×${k.titel[t]}` : ""}`),
              })} />
          </div>
          <div className="closeline">
            <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={() => setK(null)}>Neue Karriere</button>
            <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Zur Lobby</button>
          </div>
        </div>
      )}

      {regelModal}
    </div>
  );
}

/* Was eine Wahl bewirkt, in Worten. Zahlen stünden dem Spiel im Weg: „+1,6 Overall,
   −10 Fitness" liest sich wie eine Tabellenkalkulation, „Du wirst besser, aber es
   geht auf die Substanz" wie eine Entscheidung. */
function beschreibeWirkung(w) {
  const teile = [];
  const w0 = w.wirkung || {};
  if (w0.overall >= 1) teile.push("macht dich deutlich besser");
  else if (w0.overall > 0) teile.push("macht dich etwas besser");
  else if (w0.overall < 0) teile.push("kostet Spielstärke");
  if (w0.fitness >= 8) teile.push("tut dem Körper gut");
  else if (w0.fitness <= -8) teile.push("geht auf die Substanz");
  if (w0.moral >= 6) teile.push("hebt die Laune");
  else if (w0.moral <= -6) teile.push("drückt die Laune");
  if (w0.ruf >= 8) teile.push("macht Schlagzeilen");
  if (w.risiko >= 0.15) teile.push("Verletzungsgefahr");
  return teile.join(" · ") || "wirkt sich kaum aus";
}
