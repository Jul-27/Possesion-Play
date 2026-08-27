import { useState, useEffect, useMemo, useRef } from "react";
import { suggestPlayers } from "./gameData.js";
import {
  baueNetz, kuerzesterWeg, abstaende, paarDesTages, pruefeSchritt, gemeinsameStation,
  stationText, shareText, sindMitspieler, ECKEN_MAX, ECKEN_TIPP_AB,
} from "./sechsEcken.js";
import { dailyDateStr, dailyNumber } from "./dailyLogic.js";
import { recordChallenge, challengeState, challengeStats } from "./dailyChallenge.js";
import { loadPlayers } from "./playersStore.js";
import { loadCareerPath } from "./careerPathStore.js";
import { Avatar } from "./Emblems.jsx";
import { play, isMuted, toggleMute } from "./sound.js";
import { merkeSpieler } from "./collection.js";
import Confetti from "./Confetti.jsx";
import DataStamp from "./DataStamp.jsx";
import ReportButton from "./ReportButton.jsx";
import GameTop from "./GameTop.jsx";
import Icon from "./Icons.jsx";

const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Persistenz weiterspielen */ } },
};

export default function SechsEcken({ onLeave }) {
  const [players, setPlayers] = useState(null);
  const [dated, setDated] = useState(undefined);   // undefined = lädt, null = fehlt
  const [eingabe, setEingabe] = useState("");
  const [sugOffen, setSugOffen] = useState(false);
  const [sugAktiv, setSugAktiv] = useState(-1);
  const [meldung, setMeldung] = useState(null);
  const [tipp, setTipp] = useState(null);
  const [kopiert, setKopiert] = useState(false);
  const [regeln, setRegeln] = useState(false);
  const [muted, setMuted] = useState(isMuted());
  const feldRef = useRef(null);

  const datum = useMemo(() => dailyDateStr(), []);
  const nummer = useMemo(() => dailyNumber(datum), [datum]);
  const speicherKey = `pp:ecken:${datum}`;
  const [spiel, setSpiel] = useState(() => store.get(speicherKey) || { kette: [], fertig: false, gewonnen: false, fehl: 0 });

  useEffect(() => { loadPlayers().then(setPlayers); }, []);
  useEffect(() => { loadCareerPath().then((d) => setDated(d || null)); }, []);

  /* Das Netz einmal je Datensatz bauen, nicht je Zug: 24 ms für 1.022 Spieler und
     23.942 Kanten — einmal beim Öffnen unmerklich, bei jedem Tastendruck nicht. */
  const netz = useMemo(
    () => (players && dated ? baueNetz(players, dated) : null),
    [players, dated],
  );
  const paar = useMemo(
    () => (netz && players ? paarDesTages(datum, players, netz) : null),
    [netz, players, datum],
  );

  const von = paar ? players[paar.von] : null;
  const nach = paar ? players[paar.nach] : null;
  /* Die Kette steht als Spielername im Speicher, nicht als Index: Ein Datenlauf
     verschiebt Indizes, Namen bleiben. */
  const ketteIdx = useMemo(() => {
    if (!netz || !players || !paar) return [];
    const nachName = new Map(netz.knoten.map((i) => [players[i].n, i]));
    return (spiel.kette || []).map((n) => nachName.get(n)).filter((i) => i != null);
  }, [spiel.kette, netz, players, paar]);

  const voll = paar ? [paar.von, ...ketteIdx] : [];
  const glieder = useMemo(() => {
    if (!netz) return [];
    return voll.slice(1).map((i, k) => ({ i, station: gemeinsameStation(netz, voll[k], i) }));
  }, [voll, netz]);
  const geschlossen = !!(netz && paar && voll.length && sindMitspieler(netz, voll[voll.length - 1], paar.nach));

  const kandidaten = useMemo(() => {
    if (!netz || !players || !paar) return [];
    const raus = new Set([...voll, paar.nach]);
    return netz.knoten.filter((i) => !raus.has(i)).map((i) => ({ ...players[i], _i: i }));
  }, [netz, players, paar, voll]);
  const treffer = useMemo(
    () => (eingabe.trim().length >= 2 ? suggestPlayers(kandidaten, eingabe, 8) : []),
    [kandidaten, eingabe],
  );

  const uebrig = ECKEN_MAX - ketteIdx.length;
  const darfNennen = !spiel.fertig && uebrig > 0;
  const tippFrei = !spiel.fertig && (spiel.fehl || 0) >= ECKEN_TIPP_AB && !tipp;

  function sichern(next) {
    if (next.fertig && !spiel.fertig) recordChallenge("ecken", next.gewonnen, datum);
    setSpiel(next);
    store.set(speicherKey, next);
  }

  function nennen(i) {
    if (!darfNennen || i == null || !netz || !paar) return;
    const e = pruefeSchritt(netz, voll, i, paar.nach);
    setEingabe(""); setSugOffen(false); setSugAktiv(-1);
    if (e.fehler === "kein-mitspieler") {
      play("err");
      setMeldung({ type: "err", text: `${players[i].n} hat nie mit ${players[voll[voll.length - 1]].n} zusammengespielt.` });
      sichern({ ...spiel, fehl: (spiel.fehl || 0) + 1 });
      return;
    }
    if (e.fehler) { play("err"); setMeldung({ type: "err", text: e.fehler }); return; }

    setMeldung(null);
    merkeSpieler(players[i]);
    const kette = [...(spiel.kette || []), players[i].n];
    if (e.schliesst) { play("win"); sichern({ ...spiel, kette, fertig: true, gewonnen: true }); return; }
    play("ok");
    const aus = kette.length >= ECKEN_MAX;
    if (aus) play("lose");
    sichern({ ...spiel, kette, fertig: aus, gewonnen: false });
  }

  function aufgeben() {
    if (spiel.fertig) return;
    play("lose");
    sichern({ ...spiel, fertig: true, gewonnen: false });
  }

  /* Der Hinweis nennt einen VEREIN auf dem kürzesten Weg, keinen Spieler. Ein Name
     wäre die halbe Lösung; ein Verein grenzt ein, ohne sie zu verschenken. */
  function hinweisHolen() {
    if (!tippFrei || !netz || !paar) return;
    const weg = kuerzesterWeg(netz, voll[voll.length - 1], paar.nach);
    const station = weg.length > 1 ? gemeinsameStation(netz, weg[0], weg[1]) : null;
    play("click");
    setTipp(station ? `Der nächste Schritt spielte bei ${station.club}.` : "Von hier führt kein Weg mehr zum Ziel.");
  }

  function teilen() {
    const url = `${window.location.origin}${window.location.pathname}?solo=ecken`;
    const text = shareText(nummer, von?.n, nach?.n, spiel.gewonnen ? ketteIdx.length : null, paar.par - 1, url);
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => { setKopiert(true); setTimeout(() => setKopiert(false), 1500); });
  }

  function taste(e) {
    if (sugOffen && treffer.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSugAktiv((n) => Math.min(n + 1, treffer.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSugAktiv((n) => Math.max(n - 1, 0)); return; }
      if (e.key === "Escape") { setSugOffen(false); return; }
      if (e.key === "Enter") { e.preventDefault(); nennen(treffer[Math.max(0, sugAktiv)]._i); return; }
    }
    if (e.key === "Enter" && treffer.length === 1) nennen(treffer[0]._i);
  }

  const stats = challengeStats("ecken");
  const loesung = spiel.fertig && !spiel.gewonnen && netz && paar
    ? kuerzesterWeg(netz, paar.von, paar.nach) : null;

  return (
    <div className="ppRoot">
      <GameTop icon="network" name="Sechs Ecken" ton="#A78BFA" zusatz={<>#{nummer}</>}>
        <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}><Icon name={muted ? "mute" : "sound"} size={18} /></button>
        <button className="iconbtn" title="Regeln" onClick={() => setRegeln(true)}><Icon name="help" size={18} /></button>
        <ReportButton mode="ecken" />
        <button className="iconbtn" title="Zur Lobby" onClick={onLeave}><Icon name="leave" size={18} /></button>
      </GameTop>

      {(!players || dated === undefined) && <div className="qlogEmpty">Lade Karrieredaten…</div>}
      {dated === null && <div className="fb err">Die Karrieredaten konnten nicht geladen werden. Bitte die Seite neu laden.</div>}
      {netz && !paar && <div className="qlogEmpty">Heute lässt sich kein Rätsel bilden.</div>}

      {paar && (
        <>
          <div className="seZiel">
            <span className="seEnde"><Avatar player={von} size={44} /><b>{von.n}</b></span>
            <span className="sePfeil"><Icon name="pfeil" size={20} /></span>
            <span className="seEnde"><Avatar player={nach} size={44} /><b>{nach.n}</b></span>
          </div>

          <div className="sbZaehler">
            <span className={`dailyCount ${uebrig <= 2 ? "spent" : ""}`}>Schritte {ketteIdx.length}/{ECKEN_MAX}</span>
            <span className="dailyCount">Bestweg {paar.par - 1}</span>
            {tipp && <span className="dailyCount sbHinweis">💡 {tipp}</span>}
          </div>

          <div className="seKette">
            <div className="seGlied start"><Avatar player={von} size={30} /><b>{von.n}</b></div>
            {glieder.map(({ i, station }, k) => (
              <div key={k} className="seSchritt">
                <span className="seBruecke">{stationText(station)}</span>
                <div className="seGlied"><Avatar player={players[i]} size={30} /><b>{players[i].n}</b></div>
              </div>
            ))}
            {geschlossen && (
              <div className="seSchritt">
                <span className="seBruecke">{stationText(gemeinsameStation(netz, voll[voll.length - 1], paar.nach))}</span>
                <div className="seGlied ziel"><Avatar player={nach} size={30} /><b>{nach.n}</b></div>
              </div>
            )}
            {!geschlossen && <div className="seOffen">… noch nicht bei {nach.n}</div>}
          </div>

          {!spiel.fertig && (
            <div className="panel">
              <div className="inrow">
                <div className="inwrap">
                  <input ref={feldRef} className="field"
                    placeholder={`Mitspieler von ${players[voll[voll.length - 1]].n} nennen…`}
                    value={eingabe} autoComplete="off"
                    onChange={(e) => { setEingabe(e.target.value); setSugOffen(true); setSugAktiv(-1); setMeldung(null); }}
                    onKeyDown={taste} onFocus={() => setSugOffen(true)}
                    onBlur={() => setTimeout(() => setSugOffen(false), 120)} />
                  {sugOffen && treffer.length > 0 && (
                    <div className="sug">
                      {treffer.map((s, n) => (
                        <div key={s._i} className={`sugItem ${n === sugAktiv ? "active" : ""}`}
                          onMouseDown={(e) => { e.preventDefault(); nennen(s._i); }}>
                          <span className="sugWho"><Avatar player={s} size={30} />{s.n}</span>
                          <span className="sugMeta">{new Date().getFullYear() - s.by}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {meldung && <div className={`fb ${meldung.type}`}>{meldung.text}</div>}
              <div className="minirow sbAktionen">
                {tippFrei && <button className="btn ghost" onClick={hinweisHolen}>💡 Hinweis</button>}
                {!tipp && !tippFrei && <span className="sbSperre">Hinweis ab {ECKEN_TIPP_AB} Fehlversuchen</span>}
                <button className="btn ghost" onClick={aufgeben}>Auflösen</button>
              </div>
            </div>
          )}

          {spiel.fertig && (
            <div className="panel dailyEnd">
              {spiel.gewonnen && <Confetti />}
              <h2 style={{ marginTop: 0 }}>
                {spiel.gewonnen
                  ? ketteIdx.length <= paar.par - 1 ? "✨ Bestweg gefunden!" : "✓ Verbunden!"
                  : "✗ Nicht verbunden"}
              </h2>
              {loesung && (
                <p className="ruleP">
                  Ein kürzester Weg: <b>{loesung.map((i) => players[i].n).join(" → ")}</b>
                </p>
              )}
              {stats && (
                <div className="dailyStats">
                  <span><b>{stats.played}</b> gespielt</span>
                  <span><b>{Math.round((stats.wins / Math.max(1, stats.played)) * 100)}%</b> gelöst</span>
                  <span><b>{stats.streak}</b> Serie</span>
                  <span><b>{stats.maxStreak}</b> Rekord</span>
                </div>
              )}
              <div className="closeline">
                <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={teilen}>{kopiert ? "Kopiert ✓" : "Ergebnis teilen"}</button>
                <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Zur Lobby</button>
              </div>
            </div>
          )}
        </>
      )}

      {regeln && (
        <div className="overlay" onClick={() => setRegeln(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Sechs Ecken</h2>
            <p className="ruleP">Verbinde die beiden Spieler über <b>gemeinsame Mitspieler</b>.</p>
            <p className="ruleP">Jeder genannte Spieler muss mit dem vorherigen <b>gleichzeitig beim selben Verein</b> gespielt haben — derselbe Verein zu verschiedenen Zeiten zählt nicht.</p>
            <p className="ruleP">Sobald dein letzter Spieler ein Mitspieler des Ziels war, ist die Kette geschlossen. Du hast <b>{ECKEN_MAX} Schritte</b>.</p>
            <p className="ruleP">Der <b>Bestweg</b> ist die kürzestmögliche Kette. Ihn zu treffen ist die eigentliche Aufgabe — verbinden allein reicht schon zum Sieg.</p>
            <DataStamp />
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setRegeln(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
