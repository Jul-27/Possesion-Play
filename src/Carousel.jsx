import { useState, useEffect, useMemo, useCallback } from "react";
import { norm, suggestPlayers, CLUBS } from "./gameData.js";
import {
  CAROUSEL_SECONDS, CAROUSEL_LIVES, BOT_LEVELS, botLevel,
  isPlayerLegal, pickStart,
  botClubMove, botPlayerMove, carouselHint, matchClub, suggestClubs,
  initCarousel, addMove, loseLife, burnedOf, currentKind, currentOwner,
} from "./carousel.js";
import { CarScore, CarChain, CarInput, CarPrompt, clubName } from "./CarouselView.jsx";
import { loadPlayers } from "./playersStore.js";
import { play, isMuted, toggleMute } from "./sound.js";
import Confetti from "./Confetti.jsx";
import DataStamp from "./DataStamp.jsx";
import ShareButton from "./ShareButton.jsx";
import { shareCarousel } from "./share.js";

const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Statistik weiter */ } },
};

const ICH = 0, BOT = 1;

/* Transferkarussell gegen den Bot. Die Regeln stecken vollständig in carousel.js —
   diese Datei ist Darstellung, Uhr und Bot-Takt. */
export default function Carousel({ onLeave }) {
  const [players, setPlayers] = useState(null);
  const [level, setLevel] = useState(() => store.get("pp:carouselLevel") || "mittel");
  const [gestartet, setGestartet] = useState(false);
  const [state, setState] = useState(() => initCarousel(ICH));
  const [left, setLeft] = useState(CAROUSEL_SECONDS);
  const [feedback, setFeedback] = useState(null);
  const [rundenEnde, setRundenEnde] = useState(null);   // { reason, loser, hint }
  const [eingabe, setEingabe] = useState("");
  const [sugOpen, setSugOpen] = useState(false);
  const [sugActive, setSugActive] = useState(-1);
  const [botDenkt, setBotDenkt] = useState(false);
  const [muted, setMuted] = useState(isMuted());
  const [showRules, setShowRules] = useState(false);

  useEffect(() => { loadPlayers().then(setPlayers); }, []);

  const kind = currentKind(state);
  const owner = currentOwner(state);
  const amZug = gestartet && !state.over && !rundenEnde && owner === ICH && !botDenkt;
  const { clubs: burnedClubs, players: burnedPlayers } = useMemo(() => burnedOf(state), [state]);
  const letzter = state.moves[state.moves.length - 1] || null;
  const aktuellerSpieler = useMemo(() => {
    if (!players) return null;
    for (let i = state.moves.length - 1; i >= 0; i--) {
      if (state.moves[i].kind === "player") return players.find((p) => p.n === state.moves[i].value);
    }
    return null;
  }, [players, state.moves]);

  const spielerVorschlaege = useMemo(() => {
    if (!players || kind !== "player") return [];
    return suggestPlayers(players, eingabe, 8).filter((p) => !burnedPlayers.has(p.n));
  }, [players, eingabe, kind, burnedPlayers]);
  const vereinsVorschlaege = useMemo(
    () => (kind === "club" ? suggestClubs(eingabe, CLUBS, norm) : []), [eingabe, kind]);

  /* Ein Leben abziehen. Die Auflösung zeigt, was möglich gewesen wäre — daran lernt
     man mehr als an der bloßen Meldung „falsch". */
  const verliere = useCallback((wer, grund) => {
    const ziel = kind === "club" ? aktuellerSpieler : letzter?.value;
    const hint = players && ziel ? carouselHint(players, kind, ziel, burnedClubs, burnedPlayers) : null;
    setRundenEnde({ reason: grund, loser: wer, hint, kind });
    setState((s) => loseLife(s, wer, grund));
    play(wer === ICH ? "err" : "ok");
  }, [kind, aktuellerSpieler, letzter, players, burnedClubs, burnedPlayers]);

  // Uhr: 30 s je Zug, sie läuft für beide Seiten
  useEffect(() => {
    if (!gestartet || state.over || rundenEnde) return;
    setLeft(CAROUSEL_SECONDS);
    const t = setInterval(() => setLeft((s) => {
      if (s <= 1) { clearInterval(t); verliere(owner, "time"); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [gestartet, state.moves.length, state.round, state.over, rundenEnde]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bot am Zug
  useEffect(() => {
    if (!gestartet || !players || state.over || rundenEnde || owner !== BOT) return;
    setBotDenkt(true);
    const denkzeit = 900 + Math.random() * 1600;
    const t = setTimeout(() => {
      setBotDenkt(false);
      if (kind === "club") {
        const c = botClubMove(players, aktuellerSpieler, burnedClubs, burnedPlayers, Math.random, level);
        if (!c) return verliere(BOT, "stuck");
        setState((s) => addMove(s, "club", c));
      } else {
        const ziel = state.moves.length === 0 ? null : letzter.value;
        const p = ziel ? botPlayerMove(players, ziel, burnedClubs, burnedPlayers, Math.random, level)
                       : pickStart(players, Math.random);
        if (!p) return verliere(BOT, "stuck");
        setState((s) => addMove(s, "player", p.n));
      }
      play("click");
    }, denkzeit);
    return () => clearTimeout(t);
  }, [gestartet, players, state.moves.length, state.round, owner, kind, rundenEnde, state.over]); // eslint-disable-line react-hooks/exhaustive-deps

  function starte(stufe = level) {
    store.set("pp:carouselLevel", stufe);
    setLevel(stufe);
    setState(initCarousel(ICH));
    setRundenEnde(null); setFeedback(null); setEingabe(""); setGestartet(true);
    setLeft(CAROUSEL_SECONDS);
  }

  function naechsteRunde() {
    setRundenEnde(null); setFeedback(null); setEingabe(""); setLeft(CAROUSEL_SECONDS);
  }

  function absenden() {
    if (!amZug || !players) return;
    const text = eingabe.trim();
    if (!text) return;

    if (kind === "club") {
      const key = matchClub(text, CLUBS, norm);
      if (!key) return setFeedback({ ok: false, text: "Diesen Verein kenne ich nicht." });
      if (!(aktuellerSpieler?.clubs || []).includes(key)) {
        play("err");
        return verliere(ICH, "wrong");
      }
      if (burnedClubs.has(key)) return setFeedback({ ok: false, text: `${clubName(key)} ist in dieser Runde schon durch.` });
      setState((s) => addMove(s, "club", key));
      setEingabe(""); setSugOpen(false); setFeedback(null); play("ok");
      return;
    }

    const q = norm(text);
    const hit = players.find((p) => norm(p.n) === q) || players.find((p) => norm(p.ln) === q);
    if (!hit) return setFeedback({ ok: false, text: "Diesen Spieler kenne ich nicht." });
    if (burnedPlayers.has(hit.n)) return setFeedback({ ok: false, text: `${hit.n} war in dieser Runde schon dran.` });

    if (state.moves.length === 0) {
      // Eröffnung: mindestens zwei Vereine
      if ((hit.clubs || []).length < 2) {
        return setFeedback({ ok: false, text: `${hit.n} hat nur einen Verein — zum Eröffnen brauchst du zwei.` });
      }
    } else {
      const ziel = letzter.value;
      if (!(hit.clubs || []).includes(ziel)) { play("err"); return verliere(ICH, "wrong"); }
      if (!isPlayerLegal(hit, ziel, burnedClubs, burnedPlayers)) {
        return setFeedback({ ok: false, text: `${hit.n} hat außer ${clubName(ziel)} keinen freien Verein — such jemanden, der die Kette weiterträgt.` });
      }
    }
    setState((s) => addMove(s, "player", hit.n));
    setEingabe(""); setSugOpen(false); setFeedback(null); play("ok");
  }


  // Statistik erst am Spielende schreiben
  useEffect(() => {
    if (!state.over) return;
    const prev = store.get("pp:carouselStats") || { played: 0, won: 0, bestChain: 0 };
    store.set("pp:carouselStats", {
      played: prev.played + 1,
      won: prev.won + (state.over.winner === ICH ? 1 : 0),
      bestChain: Math.max(prev.bestChain, state.lastRound?.laenge || 0),
    });
    play(state.over.winner === ICH ? "win" : "lose");
  }, [state.over]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = store.get("pp:carouselStats") || { played: 0, won: 0, bestChain: 0 };

  return (
    <div className="ppRoot">
      <div className="topbar">
        <div>
          <h1 className="title">POSSESSION PLAY</h1>
          <div className="subtitle">🎠 Transferkarussell · {gestartet ? `gegen den Bot (${botLevel(level).name})` : "Übung"}</div>
        </div>
        <div className="iconrow">
          <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}>{muted ? "🔇" : "🔊"}</button>
          <button className="iconbtn" title="Regeln" onClick={() => setShowRules(true)}>?</button>
          <button className="iconbtn" title="Zur Lobby" onClick={onLeave}>⏏</button>
        </div>
      </div>

      {!players ? <div className="qlogEmpty">Lade Spielerdaten…</div> : !gestartet ? (
        <div className="panel" style={{ marginTop: 18 }}>
          <div className="prompt">Wie stark soll der Bot sein?</div>
          <p className="ruleP">Die Stufe legt fest, <b>wie viele Spieler der Bot kennt</b> — nicht, wie schlau er zieht. Du darfst immer jeden Spieler aus den Daten nennen.</p>
          <div className="carLevels">
            {BOT_LEVELS.map((l) => (
              <button key={l.key} type="button" className={`carLevel ${level === l.key ? "active" : ""}`} onClick={() => setLevel(l.key)}>
                <b>{l.name}</b><span>{l.hint}</span>
              </button>
            ))}
          </div>
          {stats.played > 0 && (
            <p className="ruleP" style={{ marginTop: 12 }}>Bisher {stats.played} Spiele, davon {stats.won} gewonnen · längste Kette {stats.bestChain}</p>
          )}
          <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={() => starte()}>Karussell starten</button></div>
        </div>
      ) : (
        <>
          <CarScore lives={state.lives} owner={owner}
            /* loseLife zählt die Runde hoch, auch beim letzten Leben — nach dem
               Spielende wäre sonst eine Runde zu viel zu sehen. */
            round={state.over ? state.round - 1 : state.round}
            left={left} chainLen={state.moves.length} names={["Du", "Bot"]} over={!!state.over} />

          <CarChain moves={state.moves} players={players} me={ICH}
            leer="Eröffne mit einem Spieler, der bei mindestens zwei Vereinen war." />

          {!state.over && !rundenEnde && (
            <div className="panel">
              <div className="prompt">
                {owner === BOT
                  ? (botDenkt ? "Der Bot überlegt…" : "Der Bot ist am Zug")
                  : <CarPrompt kind={kind} chainLen={state.moves.length}
                      aktuellerSpieler={aktuellerSpieler} letzterVerein={letzter?.value} />}
              </div>
              {amZug && (
                <>
                  <CarInput kind={kind} value={eingabe}
                    onChange={(v) => { setEingabe(v); setFeedback(null); }} onSubmit={absenden}
                    vorschlaege={kind === "club" ? vereinsVorschlaege : spielerVorschlaege}
                    sugOpen={sugOpen} setSugOpen={setSugOpen} sugActive={sugActive} setSugActive={setSugActive} />
                  {feedback && <div className={`fb ${feedback.ok ? "ok" : "err"}`} style={{ marginTop: 10 }}>{feedback.text}</div>}
                  <div className="minirow"><button className="btn ghost" onClick={() => verliere(ICH, "aufgabe")}>Runde aufgeben</button></div>
                </>
              )}
            </div>
          )}

          {rundenEnde && !state.over && (
            <div className="panel">
              <h2 style={{ marginTop: 0 }}>{rundenEnde.loser === ICH ? "💔 Leben verloren" : "🎯 Punkt für dich"}</h2>
              <p>{roundText(rundenEnde, clubName)}</p>
              {rundenEnde.hint && (
                <p className="ruleP">Möglich gewesen wäre <b>{rundenEnde.hint.player?.n || clubName(rundenEnde.hint.club)}</b>.</p>
              )}
              {/* state ist hier bereits der Stand NACH loseLife — starter ist also schon
                  gedreht und darf nicht noch einmal invertiert werden. */}
              <p className="ruleP">Runde {state.round}: <b>{state.starter === ICH ? "du eröffnest" : "der Bot eröffnet"}</b> — die Reihenfolge wechselt nach jedem verlorenen Leben.</p>
              <div className="closeline">
                <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={naechsteRunde}>Weiter</button>
              </div>
            </div>
          )}

          {state.over && (
            <div className="panel dailyEnd">
              {state.over.winner === ICH && <Confetti />}
              <h2 style={{ marginTop: 0 }}>{state.over.winner === ICH ? "🏆 Gewonnen!" : "🤖 Der Bot gewinnt"}</h2>
              <p>Endstand {state.lives[ICH]} zu {state.lives[BOT]} Leben nach {state.round - 1} Runden.</p>
              <div className="closeline">
                <ShareButton text={shareCarousel(state.over.winner === ICH, state.lives[ICH], state.lives[BOT], botLevel(level).name)} style={{ flex: 1, padding: "12px" }} />
              </div>
              <div className="closeline">
                <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={() => setGestartet(false)}>Neues Spiel</button>
                <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Zur Lobby</button>
              </div>
            </div>
          )}
        </>
      )}

      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Transferkarussell</h2>
            <p className="ruleP">Eine Kette springt zwischen Spielern und Vereinen: ein Spieler — ein Verein, bei dem er war — ein Spieler dieses Vereins — dessen nächster Verein — und so weiter.</p>
            <p className="ruleP">Jeder Verein und jeder Spieler ist danach für die Runde <b>verbraucht</b>. Ein genannter Spieler muss außerdem noch <b>mindestens einen freien Verein</b> haben — sonst könnte man den Gegner mit einem Ein-Vereins-Spieler sofort ersticken.</p>
            <p className="ruleP">Nach der Eröffnung übernimmt jede Seite abwechselnd ein <b>ganzes Paar</b>: erst den Verein, dann den nächsten Spieler. So macht keiner dauerhaft den schwereren Teil.</p>
            <p className="ruleP">Pro Zug hast du <b>{CAROUSEL_SECONDS} Sekunden</b>. Wer falsch antwortet oder die Zeit reißt, verliert eins von {CAROUSEL_LIVES} Leben; danach eröffnet die andere Seite. Wer zuerst ohne Leben dasteht, verliert.</p>
            <DataStamp />
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export function roundText(ende, name) {
  const wer = ende.loser === ICH ? "Du hast" : "Der Bot hat";
  if (ende.reason === "time") return `${wer} die 30 Sekunden gerissen.`;
  if (ende.reason === "wrong") return ende.kind === "club" ? `${wer} einen Verein genannt, bei dem der Spieler nie war.` : `${wer} einen Spieler genannt, der nie bei diesem Verein war.`;
  if (ende.reason === "stuck") return `${wer} nichts mehr gefunden.`;
  return `${wer} die Runde abgegeben.`;
}
