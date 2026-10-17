import { useState, useEffect, useMemo, useRef } from "react";
import { lookupDef, norm, suggestPlayers } from "./gameData.js";
import { VIER_SEKUNDEN, RUNDEN, ziehung, spielerKey, treffer, besterSpieler, rundenTitel } from "./vier.js";
import {
  MAX_PUNKTE, tagesRunden, rundenErgebnis, summe, geloest, leererTag, tagFortsetzen,
  rundeBegonnen, rundeBeendet, tagFertig, teilenText,
} from "./vierTag.js";
import { dailyDateStr, dailyNumber, challengeState, recordChallenge, challengeStats } from "./dailyChallenge.js";
import { submit as lbSubmit } from "./leaderboard.js";
import { CarInput } from "./CarouselView.jsx";
import { WappenRaster, MiniWappen } from "./VierWappen.jsx";
import { Avatar, Emblem } from "./Emblems.jsx";
import { loadPlayers } from "./playersStore.js";
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
import DataStamp from "./DataStamp.jsx";
import ShareButton from "./ShareButton.jsx";
import ReportButton, { MeldeLink } from "./ReportButton.jsx";
import GameTop from "./GameTop.jsx";
import Icon from "./Icons.jsx";
import { merkeSpieler } from "./collection.js";

const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Speicherstand weiter */ } },
};
const tagKey = (datum) => `pp:vierTag:${datum}`;

/* „Vier Wappen" allein — als Aufgabe des Tages (für alle dieselben fünf Runden),
   danach frei mit Zufallsvereinen. Regeln in vierTag.js und vier.js. */
export default function VierTag({ onLeave }) {
  const datum = useMemo(() => dailyDateStr(), []);
  const [players, setPlayers] = useState(null);
  const [isDaily, setIsDaily] = useState(() => !challengeState("vier"));
  const [runden, setRunden] = useState(null);
  /* Fortschritt: im Tagesmodus aus dem Speicher (eine angefangene Runde zählt null),
     frei nur im Speicher der Ansicht. */
  const [tag, setTag] = useState(() => (challengeState("vier") ? leererTag() : tagFortsetzen(store.get(tagKey(datum)))));
  const [phase, setPhase] = useState("bereit");   // bereit | laeuft | aufloesung | ende
  const [frist, setFrist] = useState(0);
  const [jetzt, setJetzt] = useState(Date.now());
  const [eingabe, setEingabe] = useState("");
  const [gepickt, setGepickt] = useState(null);
  const [sugOpen, setSugOpen] = useState(false);
  const [sugActive, setSugActive] = useState(-1);
  const [feedback, setFeedback] = useState(null);
  const [muted, setMuted] = useState(isMuted());
  const [showRules, setShowRules] = useState(false);
  const gewertet = useRef(false);

  useEffect(() => { loadPlayers().then(setPlayers); }, []);
  const nachKey = useMemo(() => new Map((players || []).map((p) => [spielerKey(p), p])), [players]);

  useEffect(() => {
    if (!players || runden) return;
    setRunden(isDaily ? tagesRunden(players, datum) : ziehung(players, Math.random, RUNDEN));
  }, [players, runden, isDaily, datum]);

  // Den Tagesfortschritt mitschreiben — nur im Tagesmodus
  useEffect(() => { if (isDaily) store.set(tagKey(datum), tag); }, [tag, isDaily, datum]);

  // Schon fertig (z. B. nach Neuladen in der letzten Runde)? Dann gleich das Ergebnis.
  useEffect(() => { if (runden && tagFertig(tag) && phase === "bereit") setPhase("ende"); }, [runden, tag, phase]);

  const i = tag.ergebnisse.length;
  const vereine = runden?.[phase === "aufloesung" || phase === "ende" ? Math.max(0, i - 1) : i] || [];
  const rest = Math.max(0, Math.ceil((frist - jetzt) / 1000));

  useEffect(() => {
    if (phase !== "laeuft") return;
    const t = setInterval(() => setJetzt(Date.now()), 200);
    return () => clearInterval(t);
  }, [phase]);

  // Zeit um: Runde ohne Wahl beenden
  useEffect(() => {
    if (phase === "laeuft" && jetzt >= frist) beenden(null);
  }, [jetzt, phase, frist]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ergebnis festhalten, sobald die fünfte Runde vorbei ist — genau einmal
  useEffect(() => {
    if (!tagFertig(tag) || gewertet.current || !runden) return;
    gewertet.current = true;
    const punkte = summe(tag.ergebnisse);
    const prev = store.get("pp:vierStats") || { played: 0, best: 0, total: 0 };
    store.set("pp:vierStats", { played: prev.played + 1, best: Math.max(prev.best, punkte), total: prev.total + punkte });
    if (isDaily) {
      recordChallenge("vier", geloest(punkte));
      lbSubmit("vier", { punkte, runden: tag.ergebnisse.map((e) => e.punkte) }).catch(() => {});
    }
  }, [tag, runden, isDaily]);

  const vorschlaege = useMemo(() => (players ? suggestPlayers(players, eingabe, 8) : []), [players, eingabe]);

  function starten() {
    if (!runden || tagFertig(tag)) return;
    setEingabe(""); setGepickt(null); setFeedback(null);
    setTag((t) => rundeBegonnen(t, t.ergebnisse.length));
    const f = Date.now() + VIER_SEKUNDEN * 1000;
    setFrist(f); setJetzt(Date.now());
    setPhase("laeuft");
  }

  function beenden(player) {
    const ergebnis = rundenErgebnis(player, runden[i], player ? spielerKey(player) : null);
    setTag((t) => rundeBeendet(t, ergebnis));
    setPhase("aufloesung");
    play(ergebnis.punkte >= 3 ? "win" : ergebnis.punkte ? "ok" : "err");
  }

  function absenden() {
    if (phase !== "laeuft" || !players) return;
    const q = norm(eingabe.trim());
    if (!q) return;
    const hit = (gepickt && norm(gepickt.n) === q) ? gepickt
      : players.filter((p) => norm(p.n) === q).sort((a, b) => (b.sl || 0) - (a.sl || 0))[0]
        || players.filter((p) => norm(p.ln) === q).sort((a, b) => (b.sl || 0) - (a.sl || 0))[0];
    if (!hit) return setFeedback("Diesen Spieler kenne ich nicht.");
    merkeSpieler(hit);
    beenden(hit);
  }

  function weiter() {
    if (tagFertig(tag)) { setPhase("ende"); if (geloest(summe(tag.ergebnisse))) play("win"); return; }
    starten();
  }

  function freiWeiter() {
    gewertet.current = false;
    setIsDaily(false);
    setTag(leererTag());
    setRunden(players ? ziehung(players, Math.random, RUNDEN) : null);
    setPhase("bereit");
  }

  const punkte = summe(tag.ergebnisse);
  const letztes = tag.ergebnisse[i - 1];
  const tagesSerie = challengeStats("vier")?.streak || 0;
  const schonGespielt = isDaily === false && challengeState("vier");

  return (
    <div className="ppRoot">
      <GameTop icon="vier" name="Vier Wappen" ton="#C084FC" zusatz={isDaily ? `Aufgabe des Tages #${dailyNumber(datum)}` : "frei"}>
        <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}><Icon name={muted ? "mute" : "sound"} size={18} /></button>
        <button className="iconbtn" title="Regeln" onClick={() => setShowRules(true)}><Icon name="help" size={18} /></button>
        <ReportButton mode="vier" />
        <button className="iconbtn" title="Zur Lobby" onClick={onLeave}><Icon name="leave" size={18} /></button>
      </GameTop>

      <div className="dailyMeta">
        {isDaily && <span className="dailyCount form">Tagesserie {tagesSerie}</span>}
        {/* Während der Auflösung ist die Runde schon gezählt — gezeigt wird aber noch sie. */}
        <span className="dailyCount">{phase === "ende" ? "Fertig" : rundenTitel(Math.min(phase === "aufloesung" ? i - 1 : i, RUNDEN - 1))}</span>
        <span className="dailyCount">{punkte} / {MAX_PUNKTE} Punkte</span>
      </div>

      {!players || !runden ? <div className="qlogEmpty">Lade Spielerdaten…</div> : (
        <>
          {phase === "bereit" && (
            <div className="panel vwVorlauf">
              <span className="vwVorlaufTitel">{rundenTitel(i)}</span>
              <p className="vwStartText">
                {i === 0
                  ? <>Vier Vereine, {VIER_SEKUNDEN} Sekunden: Nenne einen Spieler, der bei <b>möglichst vielen</b> davon war.</>
                  : <>Bisher <b>{punkte}</b> Punkte. Es geht weiter mit Runde {i + 1}.</>}
              </p>
              {schonGespielt && i === 0 && <p className="vwVorlaufHint">Die Aufgabe von heute ist erledigt — das hier sind Zufallsvereine.</p>}
              {tag.ergebnisse.some((e) => e.abgebrochen) && <p className="vwVorlaufHint">Eine aufgedeckte Runde wurde nicht beantwortet und zählt null.</p>}
              <button className="btn primary" style={{ marginTop: 10, padding: "12px 28px" }} onClick={starten}>
                {i === 0 ? "Los geht's" : "Weiter"}
              </button>
            </div>
          )}

          {(phase === "laeuft" || phase === "aufloesung") && (
            <WappenRaster vereine={vereine} abgehakt={phase === "aufloesung"
              ? new Set(treffer(letztes?.key ? nachKey.get(letztes.key) : null, vereine)) : null} />
          )}

          {phase === "laeuft" && (
            <div className="panel">
              <div className="vwZeit"><span style={{ width: `${Math.max(0, (frist - jetzt) / (VIER_SEKUNDEN * 1000)) * 100}%` }} className={rest <= 10 ? "knapp" : ""} /></div>
              <div className="vwZeitZahl"><span className={`timer ${rest <= 10 ? "low" : ""}`}>0:{String(Math.min(rest, VIER_SEKUNDEN)).padStart(2, "0")}</span></div>
              <div className="prompt">Wer hat bei <b>möglichst vielen</b> dieser Vereine gespielt?</div>
              <CarInput kind="player" value={eingabe} onChange={(v) => { setEingabe(v); setFeedback(null); }}
                onPick={setGepickt} onSubmit={absenden} vorschlaege={vorschlaege}
                sugOpen={sugOpen} setSugOpen={setSugOpen} sugActive={sugActive} setSugActive={setSugActive} />
              {feedback && <div className="fb err" style={{ marginTop: 10 }}>{feedback}</div>}
            </div>
          )}

          {phase === "aufloesung" && letztes && (
            <SoloAufloesung ergebnis={letztes} vereine={vereine} players={players} nachKey={nachKey}
              letzte={tagFertig(tag)} onWeiter={weiter} />
          )}

          {phase === "ende" && (
            <div className="panel dailyEnd">
              {geloest(punkte) && <Confetti />}
              <h2 style={{ marginTop: 0 }}>{punkte >= 16 ? "🏆 Überragend!" : geloest(punkte) ? "✅ Stark!" : "🛡️ Geschafft"}</h2>
              <p><b>{punkte}</b> von {MAX_PUNKTE} Punkten{isDaily ? ` · Tagesserie ${tagesSerie}` : ""}.</p>
              <div className="vwUebersicht">
                {tag.ergebnisse.map((e, r) => (
                  <div key={r} className="vwZeile solo">
                    <span className="vwZeileNr">{r + 1}</span>
                    <span className="vwZeileWappen">
                      {(runden[r] || []).map((k) => { const def = lookupDef("club", k);
                        return <span key={k} className={`vwMiniWappen ${treffer(e.key ? nachKey.get(e.key) : null, runden[r]).includes(k) ? "" : "aus"}`}>{def && <Emblem def={def} />}</span>; })}
                    </span>
                    <span className="vwZeileWahl">{e.name || (e.abgebrochen ? "abgebrochen" : "—")} <b className={e.punkte ? "" : "null"}>+{e.punkte}</b></span>
                  </div>
                ))}
              </div>
              {isDaily && (
                <div className="closeline"><ShareButton text={teilenText(dailyNumber(datum), tag.ergebnisse)} style={{ flex: 1, padding: "12px" }} /></div>
              )}
              <div className="closeline">
                <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={freiWeiter}>{isDaily ? "Frei weiterspielen" : "Nochmal"}</button>
                <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Zur Lobby</button>
              </div>
            </div>
          )}
        </>
      )}

      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Vier Wappen</h2>
            <p className="ruleP">Jede Runde zeigt <b>vier Vereine</b>. Du hast <b>{VIER_SEKUNDEN} Sekunden</b>, um einen Spieler zu nennen, der bei möglichst vielen davon gespielt hat.</p>
            <p className="ruleP">Pro passendem Verein gibt es <b>einen Punkt</b> — höchstens {MAX_PUNKTE} in {RUNDEN} Runden. Ab {MAX_PUNKTE / 2} Punkten gilt die Aufgabe des Tages als gelöst.</p>
            <p className="ruleP">Die Aufgabe des Tages ist für alle gleich. Eine aufgedeckte Runde läuft weiter, auch wenn du die Seite verlässt.</p>
            <DataStamp />
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function SoloAufloesung({ ergebnis, vereine, players, nachKey, letzte, onWeiter }) {
  const p = ergebnis.key ? nachKey.get(ergebnis.key) : null;
  const hits = treffer(p, vereine);
  const moeglich = besterSpieler(players, vereine, new Set([ergebnis.key].filter(Boolean)));
  return (
    <div className="panel vwAufloesung">
      <div className="vwKarte mein vwSoloKarte">
        {p ? (
          <>
            <div className="vwKarteSpieler"><Avatar player={p} size={44} /><b>{p.n}</b></div>
            <MiniWappen vereine={vereine} hits={hits} />
            <b className={`vwPlus ${hits.length ? "" : "null"}`}>+{hits.length}</b>
            {/* Nur bei mindestens einem Treffer: Wer ganz danebenliegt, hat meist den
                falschen Spieler genannt — vier Meldelinks wären dann nur Rauschen. */}
            {hits.length > 0 && vereine.filter((k) => !hits.includes(k)).map((k) => (
              <MeldeLink key={k} mode="vier" player={p} def={lookupDef("club", k)}
                text={`War doch bei ${lookupDef("club", k)?.name || k}?`} />
            ))}
          </>
        ) : (
          <><p className="vwKeine">Zeit abgelaufen — keine Wahl</p><b className="vwPlus null">+0</b></>
        )}
      </div>
      {moeglich && moeglich.treffer > hits.length && (
        <p className="ruleP vwMoeglich">Möglich gewesen: <b>{moeglich.player.n}</b> mit {moeglich.treffer} von 4.</p>
      )}
      <div className="closeline">
        <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={onWeiter}>{letzte ? "Zum Ergebnis" : "Nächste Runde"}</button>
      </div>
    </div>
  );
}
