import { useState, useEffect, useMemo, useRef } from "react";
import {
  HINWEISE, VERSUCHE, SPERRE_S, SOLO_RAETSEL, THEMEN, spielerKey, baueRaetsel, tagesRaetsel,
  punkteFuer, bestenlistenPunkte, teilenText,
} from "./gesucht.js";
import { GsBrett, GsHinweise, GsSteuerung, GsRateDialog, GsWarum } from "./GesuchtView.jsx";
import { dailyDateStr, dailyNumber, challengeState, recordChallenge, challengeStats } from "./dailyChallenge.js";
import { submit as lbSubmit } from "./leaderboard.js";
import { loadPlayers } from "./playersStore.js";
import { play, isMuted, toggleMute } from "./sound.js";
import { merkeSpieler } from "./collection.js";
import Confetti from "./Confetti.jsx";
import DataStamp from "./DataStamp.jsx";
import ShareButton from "./ShareButton.jsx";
import ReportButton from "./ReportButton.jsx";
import GameTop from "./GameTop.jsx";
import Icon from "./Icons.jsx";

const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Speicherstand weiter */ } },
};
const tagKey = (d) => `pp:gesuchtTag:${d}`;
const leererStand = () => ({ offen: 1, fehler: 0, gestrichen: [], falsch: [], fertig: null });

/* „Der Gesuchte" allein: das Tagesrätsel (für alle gleich, einmal am Tag) oder eine
   Serie aus fünf Rätseln zu einem Thema. Regeln und Generator in gesucht.js.

   DAS TAGESRÄTSEL MERKT SICH SEINEN STAND im Browser — aufgedeckte Hinweise,
   Fehlversuche, Streichungen. Wer neu lädt, bekommt die Hinweise nicht zurück und
   macht keinen Fehlversuch ungeschehen. */
export default function DerGesuchte({ onLeave }) {
  const datum = useMemo(() => dailyDateStr(), []);
  const [players, setPlayers] = useState(null);
  const [ansicht, setAnsicht] = useState("start");   // start | spiel | serieEnde
  const [art, setArt] = useState(null);               // tag | serie
  const [thema, setThema] = useState("alle");
  const [raetsel, setRaetsel] = useState(null);
  const [stand, setStand] = useState(leererStand());
  const [serie, setSerie] = useState([]);              // Ergebnisse der laufenden Serie
  const [modus, setModus] = useState("streichen");
  const [frage, setFrage] = useState(null);
  const [sperreBis, setSperreBis] = useState(0);
  const [jetzt, setJetzt] = useState(Date.now());
  const [muted, setMuted] = useState(isMuted());
  const [showRules, setShowRules] = useState(false);
  const gewertet = useRef(false);

  useEffect(() => { loadPlayers().then(setPlayers); }, []);
  const nachKey = useMemo(() => new Map((players || []).map((p) => [spielerKey(p), p])), [players]);
  useEffect(() => { if (sperreBis <= Date.now()) return; const t = setInterval(() => setJetzt(Date.now()), 250); return () => clearInterval(t); }, [sperreBis]);

  const tagErledigt = !!challengeState("gesucht");
  const sperreRest = Math.max(0, Math.ceil((sperreBis - jetzt) / 1000));

  // Tagesstand mitschreiben
  useEffect(() => { if (art === "tag" && raetsel) store.set(tagKey(datum), stand); }, [stand, art, raetsel, datum]);

  function starteTag() {
    const r = tagesRaetsel(players, datum, nachKey);
    const alt = store.get(tagKey(datum));
    gewertet.current = !!alt?.fertig;
    setArt("tag"); setRaetsel(r); setStand(alt && Array.isArray(alt.gestrichen) ? alt : leererStand());
    // Auch die Ratepause übersteht das Neuladen — sonst wäre Neuladen ein Weg drumherum.
    setModus("streichen"); setSperreBis(alt?.sperreBis || 0); setJetzt(Date.now()); setAnsicht("spiel");
  }

  function starteSerie(t = thema) {
    gewertet.current = false;
    setArt("serie"); setThema(t); setSerie([]);
    setRaetsel(baueRaetsel(players, Math.random, t, nachKey)); setStand(leererStand());
    setModus("streichen"); setSperreBis(0); setAnsicht("spiel");
  }

  function naechstesRaetsel() {
    if (serie.length >= SOLO_RAETSEL) { setAnsicht("serieEnde"); return; }
    gewertet.current = false;
    setRaetsel(baueRaetsel(players, Math.random, thema, nachKey)); setStand(leererStand());
    setModus("streichen"); setSperreBis(0);
  }

  const brett = useMemo(() => (raetsel ? raetsel.brett.map((k) => nachKey.get(k)).filter(Boolean) : []), [raetsel, nachKey]);
  const ziel = raetsel ? nachKey.get(raetsel.ziel) : null;
  const gestrichen = useMemo(() => new Set(stand.gestrichen), [stand.gestrichen]);
  const falsch = useMemo(() => new Set(stand.falsch), [stand.falsch]);
  const versuche = VERSUCHE - stand.fehler;
  const moeglich = punkteFuer({ hinweise: stand.offen, fehler: stand.fehler, geloest: true });

  /* Ein Rätsel ist vorbei — genau einmal werten. */
  function abschliessen(geloest) {
    const ergebnis = { geloest, hinweise: stand.offen, fehler: stand.fehler, ziel: raetsel.ziel };
    ergebnis.punkte = punkteFuer(ergebnis);
    setStand((s) => ({ ...s, fertig: ergebnis }));
    if (gewertet.current) return;
    gewertet.current = true;
    if (geloest) { play("win"); merkeSpieler(ziel); } else play("lose");
    const st = store.get("pp:gesuchtStats") || { played: 0, gefunden: 0, bestSerie: 0, punkte: 0 };
    store.set("pp:gesuchtStats", { ...st, played: st.played + 1, gefunden: st.gefunden + (geloest ? 1 : 0), punkte: st.punkte + ergebnis.punkte });
    if (art === "tag") {
      recordChallenge("gesucht", geloest);
      lbSubmit("gesucht", { punkte: ergebnis.punkte, hinweise: ergebnis.hinweise, fehler: ergebnis.fehler, geloest }).catch(() => {});
    } else {
      const neu = [...serie, ergebnis];
      setSerie(neu);
      if (neu.length >= SOLO_RAETSEL) {
        const summe = neu.reduce((s, e) => s + e.punkte, 0);
        const st2 = store.get("pp:gesuchtStats");
        store.set("pp:gesuchtStats", { ...st2, bestSerie: Math.max(st2.bestSerie || 0, summe) });
      }
    }
  }

  function aufKarte(p, k) {
    if (stand.fertig) return;
    if (modus === "raten") { if (!gestrichen.has(k) && sperreRest === 0) setFrage(p); return; }
    setStand((s) => ({ ...s, gestrichen: s.gestrichen.includes(k) ? s.gestrichen.filter((x) => x !== k) : [...s.gestrichen, k] }));
  }

  function raten(p) {
    setFrage(null);
    const k = spielerKey(p);
    if (k === raetsel.ziel) { abschliessen(true); return; }
    play("err");
    const fehler = stand.fehler + 1;
    setStand((s) => ({ ...s, fehler, falsch: [...s.falsch, k], gestrichen: s.gestrichen.includes(k) ? s.gestrichen : [...s.gestrichen, k] }));
    setModus("streichen");
    if (fehler >= VERSUCHE) { abschliessenNach(fehler); return; }
    const bis = Date.now() + SPERRE_S * 1000;
    setSperreBis(bis); setJetzt(Date.now());
    setStand((s) => ({ ...s, sperreBis: bis }));
  }
  /* Nach dem dritten Fehlversuch: Stand mit allen drei Fehlern werten. */
  function abschliessenNach(fehler) {
    const ergebnis = { geloest: false, hinweise: stand.offen, fehler, ziel: raetsel.ziel, punkte: 0 };
    setStand((s) => ({ ...s, fertig: ergebnis }));
    if (gewertet.current) return;
    gewertet.current = true;
    play("lose");
    const st = store.get("pp:gesuchtStats") || { played: 0, gefunden: 0, bestSerie: 0, punkte: 0 };
    store.set("pp:gesuchtStats", { ...st, played: st.played + 1 });
    if (art === "tag") {
      recordChallenge("gesucht", false);
      lbSubmit("gesucht", { punkte: 0, hinweise: ergebnis.hinweise, fehler, geloest: false }).catch(() => {});
    } else setSerie((s) => [...s, ergebnis]);
  }

  const weiterHinweis = () => setStand((s) => ({ ...s, offen: Math.min(HINWEISE, s.offen + 1) }));

  const kopf = (
    <GameTop icon="gesucht" name="Der Gesuchte" ton="#FB7185"
      zusatz={ansicht === "start" ? "Wer ist es?" : art === "tag" ? `Tagesrätsel #${dailyNumber(datum)}` : `${THEMEN[thema].name} · Rätsel ${Math.min(serie.length + (stand.fertig ? 0 : 1), SOLO_RAETSEL)}/${SOLO_RAETSEL}`}>
      <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}><Icon name={muted ? "mute" : "sound"} size={18} /></button>
      <button className="iconbtn" title="Regeln" onClick={() => setShowRules(true)}><Icon name="help" size={18} /></button>
      <ReportButton mode="gesucht" />
      <button className="iconbtn" title={ansicht === "start" ? "Zur Lobby" : "Zurück"} onClick={() => (ansicht === "start" ? onLeave() : setAnsicht("start"))}><Icon name="leave" size={18} /></button>
    </GameTop>
  );

  const regeln = showRules && (
    <div className="overlay" onClick={() => setShowRules(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Der Gesuchte</h2>
        <p className="ruleP">Auf dem Brett liegen <b>24 Spieler</b>, einer ist gesucht. Alle Hinweise beschreiben ihn.</p>
        <p className="ruleP"><b>Streichen</b> ist deine Notiz: Antippen legt ein Kreuz auf die Karte, nochmal antippen holt sie zurück.</p>
        <p className="ruleP"><b>Raten:</b> umschalten, Karte antippen, bestätigen. {VERSUCHE} Versuche; ein Fehler kostet {SPERRE_S} Sekunden Pause.</p>
        <p className="ruleP">Du startest mit <b>1000 Punkten</b>. Jeder weitere Hinweis kostet 100, jeder Fehlversuch 150. Die Hinweise sind so gewählt, dass keiner allein die Lösung verrät — erst alle sechs zusammen lassen genau einen übrig.</p>
        <DataStamp />
        <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
      </div>
    </div>
  );

  if (!players) return <div className="ppRoot">{kopf}<div className="qlogEmpty">Lade Spielerdaten…</div></div>;

  if (ansicht === "start") {
    const tagSt = challengeStats("gesucht");
    const tagStand = store.get(tagKey(datum));
    return (
      <div className="ppRoot">
        {kopf}
        <button className={"gsTagKarte" + (tagErledigt ? " fertig" : "")} onClick={starteTag}>
          <span className="gsTagKopf">Tagesrätsel #{dailyNumber(datum)}</span>
          <b>{tagErledigt ? (tagStand?.fertig?.geloest ? `Gelöst · ${tagStand.fertig.punkte} Punkte` : "Heute nicht gefunden") : "Für alle dasselbe Brett"}</b>
          <small>{tagErledigt ? "Ansehen — morgen gibt es ein neues." : `Einmal am Tag, zählt für die Bestenliste · Serie ${tagSt?.streak || 0}`}</small>
        </button>
        <div className="gsStart">
          <h3>Freies Spiel — fünf Rätsel</h3>
          <p className="ruleP">Wähle, aus welchen Spielern das Brett gezogen wird.</p>
          <div className="gsThemen">
            {Object.entries(THEMEN).map(([k, t]) => (
              <button key={k} type="button" className="gsThema" onClick={() => starteSerie(k)}>
                <b>{t.name}</b><small>{t.text}</small>
              </button>
            ))}
          </div>
        </div>
        <DataStamp />
        {regeln}
      </div>
    );
  }

  if (ansicht === "serieEnde") {
    const summe = serie.reduce((s, e) => s + e.punkte, 0);
    return (
      <div className="ppRoot">
        {kopf}
        <div className="panel dailyEnd">
          {summe >= 3000 && <Confetti />}
          <h2 style={{ marginTop: 0 }}>{summe} Punkte</h2>
          <p>{serie.filter((e) => e.geloest).length} von {SOLO_RAETSEL} gefunden · {THEMEN[thema].name}</p>
          <ol className="gsSerie">
            {serie.map((e, i) => (
              <li key={i}><span>{nachKey.get(e.ziel)?.n}</span><b className={e.geloest ? "" : "null"}>{e.geloest ? `${e.punkte}` : "—"}</b></li>
            ))}
          </ol>
          <div className="closeline">
            <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={() => starteSerie(thema)}>Neue Serie</button>
            <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={() => setAnsicht("start")}>Anderes Thema</button>
          </div>
        </div>
        {regeln}
      </div>
    );
  }

  const fertig = stand.fertig;
  return (
    <div className="ppRoot gsSpiel">
      {kopf}
      <div className="dailyMeta">
        {art === "serie" && <span className="dailyCount">{serie.reduce((s, e) => s + e.punkte, 0)} Punkte bisher</span>}
        {!fertig && <span className="dailyCount form">jetzt {moeglich} möglich</span>}
      </div>

      {!fertig && (
        <GsHinweise hinweise={raetsel.hinweise} offen={stand.offen} nachKey={nachKey} onWeiter={weiterHinweis} />
      )}

      {fertig && (
        <div className="panel gsErgebnis">
          {fertig.geloest && <Confetti />}
          <h2>{fertig.geloest ? `Gefunden: ${ziel.n}` : `Gesucht war ${ziel.n}`}</h2>
          <p className="ruleP">{fertig.geloest
            ? <><b>{fertig.punkte} Punkte</b> · {fertig.hinweise} {fertig.hinweise === 1 ? "Hinweis" : "Hinweise"}{fertig.fehler ? ` · ${fertig.fehler} ${fertig.fehler === 1 ? "Fehlversuch" : "Fehlversuche"}` : ""}
                <small className="gsRechnung"> (1000 − {fertig.hinweise - 1} × 100{fertig.fehler ? ` − ${fertig.fehler} × 150` : ""})</small></>
            : "Drei Fehlversuche — diesmal nicht."}</p>
          <div className="closeline">
            {art === "tag"
              ? <>
                  <ShareButton text={teilenText(dailyNumber(datum), fertig)} style={{ flex: 1, padding: "12px" }} />
                  <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={() => setAnsicht("start")}>Frei spielen</button>
                </>
              : <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={naechstesRaetsel}>
                  {serie.length >= SOLO_RAETSEL ? "Zum Ergebnis" : "Nächstes Rätsel"}
                </button>}
          </div>
          {art === "tag" && <p className="gsHinweisKlein">Bestenliste: {bestenlistenPunkte(fertig.punkte)} Punkte</p>}
        </div>
      )}

      <GsBrett spieler={brett} gestrichen={gestrichen} falsch={falsch} richtig={fertig ? raetsel.ziel : null}
        modus={fertig ? "streichen" : modus} gesperrt={!!fertig} onKarte={aufKarte} />

      {fertig && <GsWarum ziel={ziel} hinweise={raetsel.hinweise} nachKey={nachKey} mode="gesucht" />}

      {!fertig && <GsSteuerung modus={modus} setModus={setModus} versuche={versuche} sperreRest={sperreRest} />}
      {frage && <GsRateDialog player={frage} onJa={() => raten(frage)} onNein={() => setFrage(null)} />}
      {regeln}
    </div>
  );
}
