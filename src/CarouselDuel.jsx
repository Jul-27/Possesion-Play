import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient.js";
import { norm, suggestPlayers } from "./gameData.js";
import {
  CAROUSEL_SECONDS, CAROUSEL_LIVES, isPlayerLegal, carouselHint,
  initCarousel, addMove, loseLife, burnedOf, currentKind, currentOwner, rematchState,
} from "./carousel.js";
import { CarScore, CarChain, CarInput, CarPrompt } from "./CarouselView.jsx";
import { loadPlayers } from "./playersStore.js";
import { loadCareerClubs } from "./careerClubsStore.js";
import { createCareerIndex } from "./careerIndex.js";
import { play, isMuted, toggleMute } from "./sound.js";
import { useLeaveEndsGame } from "./usePresence.js";
import Confetti from "./Confetti.jsx";
import DataStamp from "./DataStamp.jsx";
import ReportButton from "./ReportButton.jsx";
import GameTop from "./GameTop.jsx";
import Icon from "./Icons.jsx";

/* Transferkarussell als Duell. Der gesamte Spielstand liegt in last_move.car und ist
   dieselbe Struktur wie im Solo-Modus — die Regeln stehen einmal in carousel.js.

   Die Uhr läuft NICHT lokal, sondern über eine gemeinsame Frist (last_move.frist,
   Zeitstempel in ms). Beide Seiten rechnen daraus dieselbe Restzeit; ohne das würden
   zwei lokale Zähler auseinanderlaufen und jeder hätte eine andere Wahrheit. */
export default function CarouselDuel({ code, clientId, onLeave }) {
  const [row, setRow] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [players, setPlayers] = useState(null);
  const [eingabe, setEingabe] = useState("");
  const [sugOpen, setSugOpen] = useState(false);
  const [sugActive, setSugActive] = useState(-1);
  const [feedback, setFeedback] = useState(null);
  const [jetzt, setJetzt] = useState(Date.now());
  const [muted, setMuted] = useState(isMuted());
  const [showRules, setShowRules] = useState(false);
  const [copied, setCopied] = useState(false);
  const schreibt = useRef(false);

  const [idx, setIdx] = useState(null);
  useEffect(() => {
    Promise.all([loadPlayers(), loadCareerClubs()]).then(([ps, cc]) => {
      setPlayers(ps);
      setIdx(createCareerIndex(ps, cc.clubs, cc.byKey));
    });
  }, []);

  useEffect(() => {
    let aktiv = true;
    supabase.from("games").select("*").eq("code", code).maybeSingle().then(({ data, error }) => {
      if (!aktiv) return;
      if (error) setLoadErr(error.message);
      else if (!data) setLoadErr("Spiel nicht gefunden.");
      else setRow(data);
    });
    const ch = supabase.channel("game:" + code)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `code=eq.${code}` },
        (p) => setRow(p.new))
      .subscribe();
    return () => { aktiv = false; supabase.removeChannel(ch); };
  }, [code]);

  // Reconnect-Heilung wie in den anderen Duell-Modi
  useEffect(() => {
    const refetch = () => {
      if (document.visibilityState !== "visible") return;
      supabase.from("games").select("*").eq("code", code).maybeSingle().then(({ data }) => { if (data) setRow(data); });
    };
    document.addEventListener("visibilitychange", refetch);
    window.addEventListener("focus", refetch);
    return () => { document.removeEventListener("visibilitychange", refetch); window.removeEventListener("focus", refetch); };
  }, [code]);

  useEffect(() => { const t = setInterval(() => setJetzt(Date.now()), 500); return () => clearInterval(t); }, []);

  const myPlayer = !row ? 0 : (row.host_id === clientId ? 1 : row.guest_id === clientId ? 2 : 0);
  const status = row?.status || "loading";
  const names = row?.names || { 1: "Spieler 1", 2: "Spieler 2" };
  const state = row?.last_move?.car || initCarousel(0);
  const frist = row?.last_move?.frist || 0;
  const rundenEnde = row?.last_move?.ende || null;

  // Sitz 0/1 der Logik entspricht Spieler 1/2 der Datenbank
  const ich = myPlayer === 0 ? -1 : myPlayer - 1;
  const kind = currentKind(state);
  const owner = currentOwner(state);
  const amZug = status === "playing" && !state.over && !rundenEnde && owner === ich;
  const { clubs: burnedClubs, players: burnedPlayers } = useMemo(() => burnedOf(state), [state]);
  const letzter = state.moves[state.moves.length - 1] || null;
  const aktuellerSpieler = useMemo(() => {
    if (!players) return null;
    for (let i = state.moves.length - 1; i >= 0; i--) {
      if (state.moves[i].kind === "player") return players.find((p) => p.n === state.moves[i].value);
    }
    return null;
  }, [players, state.moves]);

  const rest = Math.max(0, Math.ceil((frist - jetzt) / 1000));

  const vorschlaege = useMemo(() => {
    if (!players || !idx) return [];
    if (kind === "club") return idx.suggest(eingabe);
    return suggestPlayers(players, eingabe, 8).filter((p) => !burnedPlayers.has(p.n));
  }, [players, idx, eingabe, kind, burnedPlayers]);

  useLeaveEndsGame({
    code, myPlayer, status, lastMove: row?.last_move,
    finalize: (leaver) => supabase.from("games").update({
      status: "finished",
      last_move: { ...(row?.last_move || {}), forfeit: leaver, winner: leaver === 1 ? 2 : 1 },
      updated_at: new Date().toISOString(),
    }).eq("code", code).then(() => {}),
  });

  async function schreibe(patch) {
    if (schreibt.current) return;
    schreibt.current = true;
    try {
      await supabase.from("games").update({ ...patch, updated_at: new Date().toISOString() }).eq("code", code);
    } finally { schreibt.current = false; }
  }

  const neueFrist = () => Date.now() + CAROUSEL_SECONDS * 1000;

  function zugSchreiben(next) {
    return schreibe({
      turn: currentOwner(next) + 1,
      status: next.over ? "finished" : "playing",
      last_move: { ...(row.last_move || {}), car: next, frist: neueFrist(), ende: null },
    });
  }

  function lebenAbziehen(wer, grund) {
    const ziel = kind === "club" ? aktuellerSpieler : letzter?.value;
    const hint = idx && ziel ? carouselHint(idx, kind, ziel, burnedClubs, burnedPlayers) : null;
    const next = loseLife(state, wer, grund);
    return schreibe({
      turn: currentOwner(next) + 1,
      status: next.over ? "finished" : "playing",
      last_move: {
        ...(row.last_move || {}), car: next, frist: neueFrist(),
        ende: { reason: grund, loser: wer, kind, hint: hint?.player?.n || hint?.club || null },
        winner: next.over ? next.over.winner + 1 : null,
      },
    });
  }

  /* Zeitablauf. Zuerst darf der schreiben, der am Zug ist; ist der weg, übernimmt die
     Gegenseite nach zwei Sekunden Karenz. Sonst hinge ein Spiel für immer, wenn jemand
     mitten im Zug das Tab schließt. */
  useEffect(() => {
    if (status !== "playing" || state.over || rundenEnde || !frist || myPlayer === 0) return;
    const abgelaufen = jetzt > frist;
    if (!abgelaufen) return;
    const meinZug = owner === ich;
    if (meinZug || jetzt > frist + 2000) lebenAbziehen(owner, "time");
  }, [jetzt, frist, status, owner, rundenEnde]); // eslint-disable-line react-hooks/exhaustive-deps

  function absenden() {
    if (!amZug || !players) return;
    const text = eingabe.trim();
    if (!text) return;

    if (kind === "club") {
      const name = idx.match(text);
      if (!name) return setFeedback({ ok: false, text: "Diesen Verein kenne ich nicht." });
      if (!idx.clubsOf(aktuellerSpieler).includes(name)) { play("err"); setEingabe(""); return lebenAbziehen(ich, "wrong"); }
      if (burnedClubs.has(name)) return setFeedback({ ok: false, text: `${name} ist in dieser Runde schon durch.` });
      setEingabe(""); setFeedback(null); play("ok");
      return zugSchreiben(addMove(state, "club", name));
    }

    const q = norm(text);
    const hit = players.find((p) => norm(p.n) === q) || players.find((p) => norm(p.ln) === q);
    if (!hit) return setFeedback({ ok: false, text: "Diesen Spieler kenne ich nicht." });
    if (burnedPlayers.has(hit.n)) return setFeedback({ ok: false, text: `${hit.n} war in dieser Runde schon dran.` });
    if (state.moves.length === 0) {
      if (idx.clubsOf(hit).length < 2) return setFeedback({ ok: false, text: `${hit.n} hat nur einen Verein — zum Eröffnen brauchst du zwei.` });
    } else {
      const ziel = letzter.value;
      if (!idx.clubsOf(hit).includes(ziel)) { play("err"); setEingabe(""); return lebenAbziehen(ich, "wrong"); }
      if (!isPlayerLegal(idx, hit, ziel, burnedClubs, burnedPlayers)) {
        return setFeedback({ ok: false, text: `${hit.n} hat außer ${ziel} keinen freien Verein — such jemanden, der die Kette weiterträgt.` });
      }
    }
    setEingabe(""); setFeedback(null); play("ok");
    return zugSchreiben(addMove(state, "player", hit.n));
  }

  function weiter() {
    schreibe({ last_move: { ...(row.last_move || {}), ende: null, frist: neueFrist() } });
  }

  /* Revanche: neue Partie im selben Code, ohne Umweg über die Lobby. Ein Klick genügt,
     die Gegenseite zieht über Realtime mit — wie „Neues Spiel" in den anderen Duellen.

     Zwei Feinheiten:
     · last_move wird ERSETZT statt ergänzt — winner, forfeit und die leftBy-Marker aus
       der alten Partie müssen weg, sonst gilt sie sofort wieder als entschieden.
     · .eq("status", "finished") ist der Wettlaufschutz. Klicken beide gleichzeitig,
       verpufft der zweite Schreibvorgang, statt eine schon begonnene Partie samt
       erstem Zug wieder auf null zu setzen. */
  async function nochmal() {
    if (myPlayer === 0) return;
    const frisch = rematchState(state);
    await supabase.from("games").update({
      turn: currentOwner(frisch) + 1,
      status: "playing",
      last_move: { car: frisch, frist: neueFrist(), ende: null },
      updated_at: new Date().toISOString(),
    }).eq("code", code).eq("status", "finished");
  }

  if (loadErr) return <div className="ppRoot"><div className="panel">{loadErr}</div></div>;
  if (!row || !players || !idx) return <div className="ppRoot"><div className="qlogEmpty">Lade Spiel…</div></div>;

  const sitzNamen = [names[1], names[2]];
  const gewinner = state.over ? state.over.winner : (row.last_move?.winner ? row.last_move.winner - 1 : null);
  /* Nach einem Abgang ist niemand mehr da, der die Revanche annehmen könnte — dann
     führt der Knopf nur in eine Partie gegen ein leeres Tab. */
  const aufgegeben = row.last_move?.forfeit || 0;
  const revanche = !aufgegeben && myPlayer !== 0;

  return (
    <div className="ppRoot">
      <GameTop icon="carousel" name="Transferkarussell" ton="#F472B6" zusatz={<>Duell</>}>
        <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}><Icon name={muted ? "mute" : "sound"} size={18} /></button>
          <button className="iconbtn" title="Regeln" onClick={() => setShowRules(true)}><Icon name="help" size={18} /></button>
          <ReportButton mode="carousel-duell" gameCode={code} />
          <button className="iconbtn" title="Zur Lobby" onClick={onLeave}><Icon name="leave" size={18} /></button>
      </GameTop>

      {status === "waiting" ? (
        <div className="panel" style={{ marginTop: 18 }}>
          <div className="prompt">Warte auf den zweiten Spieler</div>
          <p className="ruleP">Gib den Code weiter — sobald jemand beitritt, geht es los.</p>
          <div className="closeline">
            <button className="btn primary" style={{ flex: 1, padding: "12px" }}
              onClick={() => navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
              {copied ? "Kopiert ✓" : `Code ${code} kopieren`}
            </button>
          </div>
        </div>
      ) : (
        <>
          <CarScore lives={state.lives} owner={owner} round={state.over ? state.round - 1 : state.round}
            left={rest} chainLen={state.moves.length} names={sitzNamen} over={!!state.over} />

          <CarChain moves={state.moves} players={players} idx={idx} me={ich}
            leer={owner === ich ? "Eröffne mit einem Spieler, der bei mindestens zwei Vereinen war."
                                : `${sitzNamen[owner]} eröffnet…`} />

          {/* status prüfen, nicht nur state.over: beim Abgang des Gegners endet die Partie
              ohne verlorenes Leben — sonst stünde „X ist am Zug…" neben dem Abpfiff. */}
          {!state.over && !rundenEnde && status !== "finished" && (
            <div className="panel">
              <div className="prompt">
                {amZug
                  ? <CarPrompt kind={kind} chainLen={state.moves.length} aktuellerSpieler={aktuellerSpieler} letzterVerein={letzter?.value} />
                  : <>{sitzNamen[owner]} ist am Zug…</>}
              </div>
              {amZug && (
                <>
                  <CarInput kind={kind} idx={idx} value={eingabe} onChange={(v) => { setEingabe(v); setFeedback(null); }}
                    onSubmit={absenden} vorschlaege={vorschlaege}
                    sugOpen={sugOpen} setSugOpen={setSugOpen} sugActive={sugActive} setSugActive={setSugActive} />
                  {feedback && <div className={`fb ${feedback.ok ? "ok" : "err"}`} style={{ marginTop: 10 }}>{feedback.text}</div>}
                  <div className="minirow"><button className="btn ghost" onClick={() => lebenAbziehen(ich, "aufgabe")}>Runde aufgeben</button></div>
                </>
              )}
            </div>
          )}

          {rundenEnde && !state.over && (
            <div className="panel">
              <h2 style={{ marginTop: 0 }}>{rundenEnde.loser === ich ? "💔 Leben verloren" : `🎯 Punkt für ${sitzNamen[1 - rundenEnde.loser]}`}</h2>
              <p>{duellText(rundenEnde, sitzNamen)}</p>
              {rundenEnde.hint && <p className="ruleP">Möglich gewesen wäre <b>{rundenEnde.hint}</b>.</p>}
              <p className="ruleP">Runde {state.round}: <b>{sitzNamen[state.starter]}</b> eröffnet — die Reihenfolge wechselt nach jedem verlorenen Leben.</p>
              <div className="closeline">
                <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={weiter}>Weiter</button>
              </div>
            </div>
          )}

          {(state.over || status === "finished") && (
            <div className="panel dailyEnd">
              {gewinner === ich && <Confetti />}
              <h2 style={{ marginTop: 0 }}>{gewinner === ich ? "🏆 Gewonnen!" : `🎠 ${sitzNamen[gewinner] || "Der Gegner"} gewinnt`}</h2>
              <p>{aufgegeben
                ? `🚪 ${names[aufgegeben]} hat das Spiel verlassen.`
                : `Endstand ${state.lives[0]} zu ${state.lives[1]} Leben nach ${Math.max(1, state.round - 1)} Runden.`}</p>
              {revanche && <p className="ruleP">Neue Partie im selben Code — <b>{sitzNamen[rematchState(state).starter]}</b> eröffnet.</p>}
              <div className="closeline">
                {revanche && (
                  <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={nochmal}>Nochmal spielen</button>
                )}
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
            <p className="ruleP">Jeder Verein und jeder Spieler ist danach für die Runde <b>verbraucht</b>. Ein genannter Spieler muss außerdem noch <b>mindestens einen freien Verein</b> haben.</p>
            <p className="ruleP">Nach der Eröffnung übernimmt jede Seite abwechselnd ein <b>ganzes Paar</b>: erst den Verein, dann den nächsten Spieler.</p>
            <p className="ruleP">Pro Zug hast du <b>{CAROUSEL_SECONDS} Sekunden</b>. Wer falsch antwortet oder die Zeit reißt, verliert eins von {CAROUSEL_LIVES} Leben; danach eröffnet die andere Seite.</p>
            <DataStamp />
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export function duellText(ende, namen) {
  const wer = namen[ende.loser];
  if (ende.reason === "time") return `${wer} hat die 30 Sekunden gerissen.`;
  if (ende.reason === "wrong") return ende.kind === "club"
    ? `${wer} hat einen Verein genannt, bei dem der Spieler nie war.`
    : `${wer} hat einen Spieler genannt, der nie bei diesem Verein war.`;
  return `${wer} hat die Runde abgegeben.`;
}
