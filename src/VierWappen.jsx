import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient.js";
import { lookupDef, norm, suggestPlayers } from "./gameData.js";
import {
  VIER_SEKUNDEN, VORLAUF_SEKUNDEN, AUFLOESUNG_MS, RUNDEN,
  spielerKey, treffer, besterSpieler, neuesBrett, punkteFuer, wertung, spielEnde,
  rundenTitel, phase, WAHL_TEXT,
} from "./vier.js";
import { CarInput } from "./CarouselView.jsx";
import { Avatar, Emblem } from "./Emblems.jsx";
import { loadPlayers } from "./playersStore.js";
import { play, isMuted, toggleMute } from "./sound.js";
import { useLeaveEndsGame } from "./usePresence.js";
import Confetti from "./Confetti.jsx";
import DataStamp from "./DataStamp.jsx";
import ReportButton, { MeldeLink } from "./ReportButton.jsx";
import GameTop from "./GameTop.jsx";
import Icon from "./Icons.jsx";
import WaitForOpponent from "./WaitForOpponent.jsx";
import { merkeSpieler } from "./collection.js";

/* „Vier Wappen" — Duell. Regeln und Stand in vier.js, der Schiedsrichter für
   „wer war schneller" und die Uhr in der Datenbank (vier_* in
   supabase/migrations/20261017_vier_wappen.sql).

   ── DIE UHR ──────────────────────────────────────────────────────────────────
   Start und Wahlzeiten sind Server-Zeit. Die eigene Uhr wird beim Öffnen (und bei
   jeder Rückkehr ins Tab) gegen vier_jetzt() geeicht: Versatz = Serverzeit minus
   Mitte der Anfrage. Ohne das zeigte ein Handy, dessen Uhr zwei Sekunden nachgeht,
   noch 0:02, während die Datenbank die Wahl schon als zu spät ablehnt. */
export default function VierWappen({ code, clientId, onLeave }) {
  const [row, setRow] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [players, setPlayers] = useState(null);
  const [eingabe, setEingabe] = useState("");
  const [gepickt, setGepickt] = useState(null);
  const [sugOpen, setSugOpen] = useState(false);
  const [sugActive, setSugActive] = useState(-1);
  const [feedback, setFeedback] = useState(null);
  const [sendet, setSendet] = useState(false);
  const [jetzt, setJetzt] = useState(Date.now());
  const [versatz, setVersatz] = useState(0);
  const [muted, setMuted] = useState(isMuted());
  const [showRules, setShowRules] = useState(false);
  const gestartet = useRef("");
  const weiterGerufen = useRef({ runde: -1, um: 0 });

  useEffect(() => { loadPlayers().then(setPlayers); }, []);
  const nachKey = useMemo(() => new Map((players || []).map((p) => [spielerKey(p), p])), [players]);

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

  // Uhr eichen und nach Rückkehr ins Tab den Stand frisch holen
  useEffect(() => {
    const eichen = async () => {
      const t0 = Date.now();
      const { data } = await supabase.rpc("vier_jetzt");
      const t1 = Date.now();
      if (data) setVersatz(Date.parse(data) - (t0 + t1) / 2);
    };
    const refetch = () => {
      if (document.visibilityState !== "visible") return;
      supabase.from("games").select("*").eq("code", code).maybeSingle().then(({ data }) => { if (data) setRow(data); });
      eichen();
    };
    eichen();
    document.addEventListener("visibilitychange", refetch);
    window.addEventListener("focus", refetch);
    return () => { document.removeEventListener("visibilitychange", refetch); window.removeEventListener("focus", refetch); };
  }, [code]);

  useEffect(() => { const t = setInterval(() => setJetzt(Date.now()), 200); return () => clearInterval(t); }, []);

  const myPlayer = !row ? 0 : (row.host_id === clientId ? 1 : row.guest_id === clientId ? 2 : 0);
  const gegner = myPlayer === 2 ? 1 : 2;
  const status = row?.status || "loading";
  const names = row?.names || { 1: "Spieler 1", 2: "Spieler 2" };
  const brett = row?.board?.kind === "vier" ? row.board : null;
  const stand = brett?.stand || { runde: 0, start: null, wahl: {}, verlauf: [] };
  const runde = stand.runde || 0;
  const vereine = brett?.runden?.[runde] || [];
  const serverJetzt = jetzt + versatz;
  const ph = status === "playing" ? phase(stand, serverJetzt) : { name: status };
  const meineWahl = myPlayer ? stand.wahl?.[myPlayer] : null;
  const seineWahl = stand.wahl?.[gegner] || null;

  const { punkte: bisher, runden: verlauf } = useMemo(
    () => (brett ? wertung(brett, nachKey) : { punkte: [0, 0], runden: [] }), [brett, nachKey]);
  // Während der Auflösung zählt die laufende Runde schon mit
  const jetztPunkte = ph.name === "aufloesung"
    ? [bisher[0] + punkteFuer(stand.wahl?.[1], vereine, nachKey), bisher[1] + punkteFuer(stand.wahl?.[2], vereine, nachKey)]
    : bisher;

  useLeaveEndsGame({
    code, myPlayer, status, lastMove: row?.last_move,
    finalize: (leaver) => supabase.from("games").update({
      status: "finished",
      last_move: { ...(row?.last_move || {}), forfeit: leaver, winner: leaver === 1 ? 2 : 1 },
      updated_at: new Date().toISOString(),
    }).eq("code", code).then(() => {}),
  });

  // Erste Runde starten, sobald beide da sind. Beide rufen; die Datenbank nimmt nur den ersten.
  useEffect(() => {
    if (status !== "playing" || !brett || stand.start || !myPlayer) return;
    const marke = `${row.updated_at}`;
    if (gestartet.current === marke) return;
    gestartet.current = marke;
    supabase.rpc("vier_starten", { p_code: code }).then(() => {});
  }, [status, brett, stand.start, myPlayer]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Neue Runde (oder Revanche): Eingabe leeren. Als Zeichenkette, nicht als Array —
     jedes Realtime-Update bringt ein neues Array, und „Schon vergeben" verschwand
     sonst in dem Moment, in dem die Wahl des Gegners eintraf. */
  const rundenMarke = `${runde}|${(brett?.runden || []).map((r) => r.join(",")).join(";")}`;
  useEffect(() => { setEingabe(""); setGepickt(null); setFeedback(null); setSendet(false); }, [rundenMarke]);

  /* Weiter nach der Auflösung. Beide Seiten rufen, die Rundennummer macht es
     idempotent. Ist ein Aufruf verloren gegangen, wird nach drei Sekunden wiederholt. */
  useEffect(() => {
    if (status !== "playing" || !myPlayer || ph.name !== "aufloesung") return;
    if (serverJetzt < ph.aufgeloestSeit + AUFLOESUNG_MS) return;
    const w = weiterGerufen.current;
    if (w.runde === runde && Date.now() - w.um < 3000) return;
    weiterGerufen.current = { runde, um: Date.now() };
    const { ende, sieger } = spielEnde(runde + 1, jetztPunkte, brett.runden.length);
    supabase.rpc("vier_weiter", { p_code: code, p_runde: runde, p_ende: ende, p_sieger: sieger }).then(() => {});
  }, [jetzt, status, ph.name, runde]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ton zum Abpfiff
  const vorherStatus = useRef(status);
  useEffect(() => {
    if (vorherStatus.current === "playing" && status === "finished" && myPlayer) {
      const s = row?.last_move?.winner;
      play(s === myPlayer ? "win" : s ? "lose" : "click");
    }
    vorherStatus.current = status;
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const vorschlaege = useMemo(
    () => (players ? suggestPlayers(players, eingabe, 8) : []), [players, eingabe]);

  async function absenden() {
    if (ph.name !== "laeuft" || meineWahl || sendet || !players || !myPlayer) return;
    const text = eingabe.trim();
    if (!text) return;
    const q = norm(text);
    const hit = (gepickt && norm(gepickt.n) === q) ? gepickt
      : players.filter((p) => norm(p.n) === q).sort((a, b) => (b.sl || 0) - (a.sl || 0))[0]
        || players.filter((p) => norm(p.ln) === q).sort((a, b) => (b.sl || 0) - (a.sl || 0))[0];
    if (!hit) return setFeedback("Diesen Spieler kenne ich nicht.");
    setSendet(true);
    const { data, error } = await supabase.rpc("vier_waehlen", {
      p_code: code, p_spieler: myPlayer, p_runde: runde, p_key: spielerKey(hit), p_name: hit.n,
    });
    setSendet(false);
    if (error) return setFeedback("Keine Verbindung — nochmal versuchen.");
    const ergebnis = data?.ergebnis;
    if (ergebnis === "ok") {
      play("click"); setFeedback(null); merkeSpieler(hit);
      // Nicht auf Realtime warten: die eigene Wahl sofort zeigen
      setRow((r) => r && r.board?.stand?.runde === runde
        ? { ...r, board: { ...r.board, stand: { ...r.board.stand, wahl: { ...r.board.stand.wahl, [myPlayer]: { key: spielerKey(hit), name: hit.n, zeit: data.jetzt } } } } }
        : r);
      return;
    }
    play("err");
    if (ergebnis === "vergeben") { setEingabe(""); setGepickt(null); }
    setFeedback(WAHL_TEXT[ergebnis] || "Das hat nicht geklappt.");
  }

  /* Revanche im selben Code — wie im Karussell: Stand ERSETZEN, und
     .eq("status", "finished") verhindert, dass zwei gleichzeitige Klicks eine schon
     begonnene Partie wieder auf null setzen. */
  async function nochmal() {
    if (myPlayer === 0 || !players) return;
    await supabase.from("games").update({
      board: neuesBrett(players),
      status: "playing",
      last_move: {},
      updated_at: new Date().toISOString(),
    }).eq("code", code).eq("status", "finished");
  }

  if (loadErr) return <div className="ppRoot"><div className="panel">{loadErr}</div></div>;
  if (!row || !players || !brett) return <div className="ppRoot"><div className="qlogEmpty">Lade Spiel…</div></div>;

  const ich = myPlayer || 1;
  const meinName = names[ich], seinName = names[ich === 1 ? 2 : 1];
  const meine = jetztPunkte[ich - 1], seine = jetztPunkte[ich === 1 ? 1 : 0];
  const sieger = row.last_move?.winner || 0;
  const aufgegeben = row.last_move?.forfeit || 0;

  return (
    <div className="ppRoot">
      <GameTop icon="vier" name="Vier Wappen" ton="#A78BFA" zusatz={<>Duell</>}>
        <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}><Icon name={muted ? "mute" : "sound"} size={18} /></button>
        <button className="iconbtn" title="Regeln" onClick={() => setShowRules(true)}><Icon name="help" size={18} /></button>
        <ReportButton mode="vier-duell" gameCode={code} />
        <button className="iconbtn" title="Zur Lobby" onClick={onLeave}><Icon name="leave" size={18} /></button>
      </GameTop>

      {status === "waiting" ? (
        <WaitForOpponent code={code} onLeave={onLeave} />
      ) : (
        <>
          <div className="vwStand">
            <div className={`vwSeite ${ph.name === "laeuft" && meineWahl ? "fertig" : ""}`}>
              <span className="vwWer">{meinName}</span>
              <b className="vwPunkte">{meine}</b>
              {ph.name === "laeuft" && <small className="vwStatus">{meineWahl ? "hat gewählt ✓" : "überlegt…"}</small>}
            </div>
            <div className="vwMitte">
              <span className="dailyCount">{status === "finished" ? "Abpfiff" : rundenTitel(runde)}</span>
            </div>
            <div className={`vwSeite rechts ${ph.name === "laeuft" && seineWahl ? "fertig" : ""}`}>
              <span className="vwWer">{seinName}</span>
              <b className="vwPunkte">{seine}</b>
              {ph.name === "laeuft" && <small className="vwStatus">{seineWahl ? "hat gewählt ✓" : "überlegt…"}</small>}
            </div>
          </div>

          {status === "playing" && (ph.name === "warten" || ph.name === "vorlauf") && (
            <div className="panel vwVorlauf">
              <span className="vwVorlaufTitel">{rundenTitel(runde)}</span>
              <b className="vwCountdown" key={ph.rest || 0}>{ph.name === "vorlauf" ? Math.min(ph.rest, VORLAUF_SEKUNDEN) : "…"}</b>
              <span className="vwVorlaufHint">Vier Wappen — ein Spieler, möglichst viele davon.</span>
            </div>
          )}

          {status === "playing" && (ph.name === "laeuft" || ph.name === "aufloesung") && (
            <>
              <WappenRaster vereine={vereine} abgehakt={ph.name === "aufloesung"
                ? new Set([stand.wahl?.[1], stand.wahl?.[2]].flatMap((w) => treffer(w ? nachKey.get(w.key) : null, vereine)))
                : null} />

              {ph.name === "laeuft" && (
                <div className="panel">
                  <div className="vwZeit"><span style={{ width: `${Math.max(0, ph.anteil) * 100}%` }} className={ph.rest <= 10 ? "knapp" : ""} /></div>
                  <div className="vwZeitZahl"><span className={`timer ${ph.rest <= 10 ? "low" : ""}`}>0:{String(Math.min(ph.rest, VIER_SEKUNDEN)).padStart(2, "0")}</span></div>
                  {meineWahl ? (
                    <p className="vwGewaehlt">Du hast <b>{meineWahl.name}</b> gewählt — {seineWahl ? "gleich kommt die Auflösung." : `warte auf ${seinName}…`}</p>
                  ) : (
                    <>
                      <div className="prompt">Wer hat bei <b>möglichst vielen</b> dieser Vereine gespielt?</div>
                      <CarInput kind="player" value={eingabe} onChange={(v) => { setEingabe(v); setFeedback(null); }}
                        onPick={setGepickt} onSubmit={absenden} vorschlaege={vorschlaege} disabled={sendet}
                        sugOpen={sugOpen} setSugOpen={setSugOpen} sugActive={sugActive} setSugActive={setSugActive} />
                      {feedback && <div className="fb err" style={{ marginTop: 10 }}>{feedback}</div>}
                    </>
                  )}
                </div>
              )}

              {ph.name === "aufloesung" && (
                <Aufloesung vereine={vereine} stand={stand} ich={ich} names={names} players={players}
                  nachKey={nachKey} code={code}
                  rest={Math.max(0, Math.ceil((ph.aufgeloestSeit + AUFLOESUNG_MS - serverJetzt) / 1000))} />
              )}
            </>
          )}

          {status === "finished" && (
            <div className="panel dailyEnd">
              {sieger === myPlayer && myPlayer !== 0 && <Confetti />}
              <h2 style={{ marginTop: 0 }}>
                {!sieger ? "🤝 Unentschieden" : sieger === myPlayer ? "🏆 Gewonnen!" : `🛡️ ${names[sieger]} gewinnt`}
              </h2>
              <p>{aufgegeben
                ? `🚪 ${names[aufgegeben]} hat das Spiel verlassen.`
                : `Endstand ${meine} : ${seine} nach ${verlauf.length} ${verlauf.length === 1 ? "Runde" : "Runden"}.`}</p>
              <RundenUebersicht verlauf={verlauf} ich={ich} nachKey={nachKey} />
              <div className="closeline">
                {!aufgegeben && myPlayer !== 0 && (
                  <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={nochmal}>Revanche</button>
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
            <h2>Vier Wappen</h2>
            <p className="ruleP">Jede Runde zeigt <b>vier Vereine</b>. Beide haben gleichzeitig <b>{VIER_SEKUNDEN} Sekunden</b>, um einen Spieler zu nennen, der bei möglichst vielen davon gespielt hat.</p>
            <p className="ruleP">Pro passendem Verein gibt es <b>einen Punkt</b> — bis zu vier pro Runde. Eine falsche oder keine Antwort bringt null, sonst nichts.</p>
            <p className="ruleP">Denselben Spieler gibt es pro Runde nur einmal: <b>Wer zuerst bestätigt, bekommt ihn.</b> Wer zu spät kommt, sieht „Schon vergeben" und darf in der restlichen Zeit neu wählen.</p>
            <p className="ruleP">Nach {RUNDEN} Runden gewinnt, wer mehr Punkte hat. Bei Gleichstand folgt eine Entscheidungsrunde mit neuen Vereinen.</p>
            <DataStamp />
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Die vier Wappen im Quadrat, mit Namen. */
function WappenRaster({ vereine, abgehakt = null }) {
  return (
    <div className="vwRaster">
      {vereine.map((k) => {
        const def = lookupDef("club", k);
        return (
          <div key={k} className={`vwKachel ${abgehakt ? (abgehakt.has(k) ? "an" : "aus") : ""}`}>
            <span className="vwWappen">{def && <Emblem def={def} />}</span>
            <span className="vwName">{def?.name || k}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Kleine Wappenzeile einer Wahl: Treffer farbig, der Rest grau. */
function MiniWappen({ vereine, hits }) {
  return (
    <span className="vwMini">
      {vereine.map((k) => {
        const def = lookupDef("club", k);
        return <span key={k} className={`vwMiniWappen ${hits.includes(k) ? "an" : "aus"}`} title={def?.name}>{def && <Emblem def={def} />}</span>;
      })}
    </span>
  );
}

function WahlKarte({ wahl, name, vereine, nachKey, code, mein }) {
  const p = wahl ? nachKey.get(wahl.key) : null;
  const hits = treffer(p, vereine);
  return (
    <div className={`vwKarte ${mein ? "mein" : ""}`}>
      <span className="vwKarteWer">{name}</span>
      {p ? (
        <>
          <div className="vwKarteSpieler"><Avatar player={p} size={40} /><b>{p.n}</b></div>
          <MiniWappen vereine={vereine} hits={hits} />
          <b className={`vwPlus ${hits.length ? "" : "null"}`}>+{hits.length}</b>
          {/* Ein grauer Verein, bei dem er doch war? Dann ist es ein Datenfehler. Nur auf
              der eigenen Karte — sechs Meldelinks auf einmal wären mehr Liste als Spiel. */}
          {mein && vereine.filter((k) => !hits.includes(k)).map((k) => (
            <MeldeLink key={k} mode="vier-duell" gameCode={code} player={p} def={lookupDef("club", k)}
              text={`War doch bei ${lookupDef("club", k)?.name || k}?`} />
          ))}
        </>
      ) : (
        <><p className="vwKeine">Keine Wahl</p><b className="vwPlus null">+0</b></>
      )}
    </div>
  );
}

function Aufloesung({ vereine, stand, ich, names, players, nachKey, code, rest }) {
  const du = ich === 1 ? 2 : 1;
  const w1 = stand.wahl?.[ich] || null, w2 = stand.wahl?.[du] || null;
  const beste = Math.max(punkteFuer(w1, vereine, nachKey), punkteFuer(w2, vereine, nachKey));
  const genannt = new Set([w1?.key, w2?.key].filter(Boolean));
  const moeglich = besterSpieler(players, vereine, genannt);
  return (
    <div className="panel vwAufloesung">
      <div className="vwKarten">
        <WahlKarte wahl={w1} name={names[ich]} vereine={vereine} nachKey={nachKey} code={code} mein />
        <WahlKarte wahl={w2} name={names[du]} vereine={vereine} nachKey={nachKey} code={code} />
      </div>
      {moeglich && moeglich.treffer > beste && (
        <p className="ruleP vwMoeglich">Möglich gewesen: <b>{moeglich.player.n}</b> mit {moeglich.treffer} von 4.</p>
      )}
      <p className="vwWeiter">Weiter in {rest} s…</p>
    </div>
  );
}

function RundenUebersicht({ verlauf, ich, nachKey }) {
  if (!verlauf.length) return null;
  const du = ich === 1 ? 2 : 1;
  return (
    <div className="vwUebersicht">
      {verlauf.map((r, i) => (
        <div key={i} className="vwZeile">
          <span className="vwZeileNr">{i < RUNDEN ? i + 1 : "E"}</span>
          <span className="vwZeileWappen">
            {r.vereine.map((k) => { const def = lookupDef("club", k); return <span key={k} className="vwMiniWappen">{def && <Emblem def={def} />}</span>; })}
          </span>
          <span className="vwZeileWahl">{r.wahl?.[ich] ? nachKey.get(r.wahl[ich].key)?.n || r.wahl[ich].name : "—"} <b className={r.punkte[ich - 1] ? "" : "null"}>+{r.punkte[ich - 1]}</b></span>
          <span className="vwZeileWahl rechts">{r.wahl?.[du] ? nachKey.get(r.wahl[du].key)?.n || r.wahl[du].name : "—"} <b className={r.punkte[du - 1] ? "" : "null"}>+{r.punkte[du - 1]}</b></span>
        </div>
      ))}
    </div>
  );
}
