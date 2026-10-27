import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "./supabaseClient.js";
import { spielerKey, VERSUCHE, HINWEISE, SPERRE_S } from "./gesucht.js";
import {
  RUNDE_S, AUFLOESUNG_MS, SIEGE_ZIEL, neuesBrettDuell, duellPhase, sperreRest, versucheUebrig, siege, RATE_TEXT,
} from "./gesuchtDuell.js";
import { GsBrett, GsHinweise, GsSteuerung, GsRateDialog, GsWarum } from "./GesuchtView.jsx";
import { loadPlayers } from "./playersStore.js";
import { play, isMuted, toggleMute } from "./sound.js";
import { useLeaveEndsGame } from "./usePresence.js";
import { merkeSpieler } from "./collection.js";
import Confetti from "./Confetti.jsx";
import DataStamp from "./DataStamp.jsx";
import ReportButton from "./ReportButton.jsx";
import GameTop from "./GameTop.jsx";
import Icon from "./Icons.jsx";
import WaitForOpponent from "./WaitForOpponent.jsx";

/* „Der Gesuchte" als Duell. Regeln in gesuchtDuell.js, Schiedsrichter und Uhr in der
   Datenbank. Gestrichen wird nur lokal — das sind Notizen, die der Gegner nicht sieht. */
export default function GesuchtDuell({ code, clientId, onLeave }) {
  const [row, setRow] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  const [players, setPlayers] = useState(null);
  const [gestrichen, setGestrichen] = useState(new Set());
  const [falsch, setFalsch] = useState(new Set());
  const [modus, setModus] = useState("streichen");
  const [frage, setFrage] = useState(null);
  const [meldung, setMeldung] = useState(null);
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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `code=eq.${code}` }, (p) => setRow(p.new))
      .subscribe();
    return () => { aktiv = false; supabase.removeChannel(ch); };
  }, [code]);

  // Uhr gegen die Datenbank eichen; nach Rückkehr ins Tab frisch holen
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

  useEffect(() => { const t = setInterval(() => setJetzt(Date.now()), 250); return () => clearInterval(t); }, []);

  const myPlayer = !row ? 0 : (row.host_id === clientId ? 1 : row.guest_id === clientId ? 2 : 0);
  const ich = myPlayer || 1, du = ich === 1 ? 2 : 1;
  const status = row?.status || "loading";
  const names = row?.names || { 1: "Spieler 1", 2: "Spieler 2" };
  const brettDaten = row?.board?.kind === "gesucht" ? row.board : null;
  const stand = brettDaten?.stand || { runde: 0 };
  const runde = stand.runde || 0;
  const raetsel = brettDaten?.runden?.[runde] || null;
  const serverJetzt = jetzt + versatz;
  const ph = status === "playing" ? duellPhase(stand, serverJetzt) : { name: status };

  const brett = useMemo(() => (raetsel ? raetsel.brett.map((k) => nachKey.get(k)).filter(Boolean) : []), [raetsel, nachKey]);
  const ziel = raetsel ? nachKey.get(raetsel.ziel) : null;

  useLeaveEndsGame({
    code, myPlayer, status, lastMove: row?.last_move,
    finalize: (leaver) => supabase.from("games").update({
      status: "finished",
      last_move: { ...(row?.last_move || {}), forfeit: leaver, winner: leaver === 1 ? 2 : 1 },
      updated_at: new Date().toISOString(),
    }).eq("code", code).then(() => {}),
  });

  // Erste Runde starten, sobald beide da sind (die Datenbank nimmt nur den ersten Aufruf)
  useEffect(() => {
    if (status !== "playing" || !brettDaten || stand.start || !myPlayer) return;
    const marke = `${row.updated_at}`;
    if (gestartet.current === marke) return;
    gestartet.current = marke;
    supabase.rpc("gesucht_starten", { p_code: code }).then(() => {});
  }, [status, brettDaten, stand.start, myPlayer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Neue Runde: Notizen leeren
  const rundenMarke = `${runde}|${raetsel?.ziel || ""}`;
  useEffect(() => { setGestrichen(new Set()); setFalsch(new Set()); setModus("streichen"); setMeldung(null); setFrage(null); }, [rundenMarke]);

  // Nach der Auflösung weiter — beide rufen, die Rundennummer macht es idempotent
  useEffect(() => {
    if (status !== "playing" || !myPlayer || ph.name !== "aufloesung") return;
    if (serverJetzt < ph.seit + AUFLOESUNG_MS) return;
    const w = weiterGerufen.current;
    if (w.runde === runde && Date.now() - w.um < 3000) return;
    weiterGerufen.current = { runde, um: Date.now() };
    supabase.rpc("gesucht_weiter", { p_code: code, p_runde: runde }).then(() => {});
  }, [jetzt, status, ph.name, runde]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ton beim Rundenende
  const vorherSieger = useRef(null);
  useEffect(() => {
    const s = stand.sieger ?? null;
    if (s != null && vorherSieger.current == null && myPlayer) {
      play(s === myPlayer ? "win" : "lose");
      if (s === myPlayer && ziel) merkeSpieler(ziel);
    }
    vorherSieger.current = s;
  }, [stand.sieger]); // eslint-disable-line react-hooks/exhaustive-deps

  function aufKarte(p, k) {
    if (ph.name !== "laeuft") return;
    if (modus === "raten") { if (!gestrichen.has(k)) setFrage(p); return; }
    setGestrichen((g) => { const n = new Set(g); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  }

  async function raten(p) {
    setFrage(null);
    const k = spielerKey(p);
    const { data, error } = await supabase.rpc("gesucht_raten", { p_code: code, p_spieler: myPlayer, p_runde: runde, p_key: k });
    if (error) { setMeldung("Keine Verbindung — nochmal versuchen."); return; }
    const e = data?.ergebnis;
    if (e === "richtig") return;   // der Rest kommt über Realtime
    if (e === "falsch") {
      play("err");
      setFalsch((f) => new Set(f).add(k)); setGestrichen((g) => new Set(g).add(k)); setModus("streichen");
    }
    setMeldung(RATE_TEXT[e] || "Das hat nicht geklappt.");
  }

  async function nochmal() {
    if (myPlayer === 0 || !players) return;
    await supabase.from("games").update({
      board: neuesBrettDuell(players, Math.random, nachKey), status: "playing", last_move: {},
      updated_at: new Date().toISOString(),
    }).eq("code", code).eq("status", "finished");
  }

  if (loadErr) return <div className="ppRoot"><div className="panel">{loadErr}</div></div>;
  if (!row || !players || !brettDaten) return <div className="ppRoot"><div className="qlogEmpty">Lade Spiel…</div></div>;

  const sieger = row.last_move?.winner || 0;
  const aufgegeben = row.last_move?.forfeit || 0;
  const meineSperre = sperreRest(stand, String(ich), serverJetzt);
  const punkte = (s) => Array.from({ length: SIEGE_ZIEL }, (_, i) => <i key={i} className={i < siege(stand, s) ? "an" : ""} />);

  return (
    <div className="ppRoot gsSpiel">
      <GameTop icon="gesucht" name="Der Gesuchte" ton="#FB7185" zusatz={<>Duell</>}>
        <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}><Icon name={muted ? "mute" : "sound"} size={18} /></button>
        <button className="iconbtn" title="Regeln" onClick={() => setShowRules(true)}><Icon name="help" size={18} /></button>
        <ReportButton mode="gesucht-duell" gameCode={code} />
        <button className="iconbtn" title="Zur Lobby" onClick={onLeave}><Icon name="leave" size={18} /></button>
      </GameTop>

      {status === "waiting" ? <WaitForOpponent code={code} onLeave={onLeave} /> : (
        <>
          <div className="gdStand">
            <div className="gdSeite"><span>{names[ich]}</span><span className="gdSiege">{punkte(ich)}</span>
              {ph.name === "laeuft" && <small>{versucheUebrig(stand, ich)} Versuche</small>}</div>
            <div className="gdMitte">
              <span className="dailyCount">{status === "finished" ? "Abpfiff" : `Runde ${runde + 1}`}</span>
              {ph.name === "laeuft" && <span className={`timer ${ph.rest <= 15 ? "low" : ""}`}>{Math.floor(Math.min(ph.rest, RUNDE_S) / 60)}:{String(Math.min(ph.rest, RUNDE_S) % 60).padStart(2, "0")}</span>}
            </div>
            <div className="gdSeite rechts"><span>{names[du]}</span><span className="gdSiege">{punkte(du)}</span>
              {ph.name === "laeuft" && <small>{versucheUebrig(stand, du)} Versuche</small>}</div>
          </div>

          {status === "playing" && (ph.name === "warten" || ph.name === "vorlauf") && (
            <div className="panel vwVorlauf">
              <span className="vwVorlaufTitel">Runde {runde + 1}</span>
              <b className="vwCountdown" key={ph.rest || 0}>{ph.name === "vorlauf" ? ph.rest : "…"}</b>
              <span className="vwVorlaufHint">Alle {12} Sekunden ein Hinweis — wer ihn zuerst hat, gewinnt die Runde.</span>
            </div>
          )}

          {status === "playing" && ph.name === "laeuft" && raetsel && (
            <GsHinweise hinweise={raetsel.hinweise} offen={ph.offen} nachKey={nachKey}
              kopf={<span className="gdNaechster">{ph.offen < HINWEISE ? `nächster in ${ph.naechsterIn} s` : "alle Hinweise"}</span>} />
          )}

          {status === "playing" && ph.name === "aufloesung" && ziel && (
            <div className="panel gsErgebnis">
              {stand.sieger === myPlayer && <Confetti />}
              <h2>{stand.sieger == null ? `Niemand hat ${ziel.n} gefunden` : stand.sieger === myPlayer ? `Gefunden: ${ziel.n}!` : `${names[stand.sieger]} hat ${ziel.n} gefunden`}</h2>
              <p className="ruleP">{stand.sieger == null ? "Die Runde wird mit einem neuen Brett wiederholt."
                : Math.max(siege(stand, 1), siege(stand, 2)) >= SIEGE_ZIEL ? `Stand ${siege(stand, ich)} : ${siege(stand, du)} — damit ist das Spiel entschieden.`
                : `Stand ${siege(stand, ich)} : ${siege(stand, du)} — gleich geht es weiter.`}</p>
            </div>
          )}

          {status === "playing" && meldung && ph.name === "laeuft" && <div className="fb err gdMeldung">{meldung}</div>}

          {status === "playing" && (ph.name === "laeuft" || ph.name === "aufloesung") && raetsel && (
            <GsBrett spieler={brett} gestrichen={gestrichen} falsch={falsch}
              richtig={ph.name === "aufloesung" ? raetsel.ziel : null}
              modus={ph.name === "laeuft" ? modus : "streichen"} gesperrt={ph.name !== "laeuft"} onKarte={aufKarte} />
          )}
          {status === "playing" && ph.name === "aufloesung" && ziel && (
            <GsWarum ziel={ziel} hinweise={raetsel.hinweise} nachKey={nachKey} mode="gesucht-duell" gameCode={code} />
          )}

          {status === "finished" && (
            <div className="panel dailyEnd">
              {sieger === myPlayer && myPlayer !== 0 && <Confetti />}
              <h2 style={{ marginTop: 0 }}>{!sieger ? "🤝 Unentschieden" : sieger === myPlayer ? "🏆 Gewonnen!" : `🔍 ${names[sieger]} gewinnt`}</h2>
              <p>{aufgegeben ? `🚪 ${names[aufgegeben]} hat das Spiel verlassen.` : `Rundensiege ${siege(stand, ich)} : ${siege(stand, du)}`}</p>
              <ol className="gsSerie">
                {(stand.verlauf || []).map((v, i) => (
                  <li key={i}><span>{nachKey.get(v.ziel)?.n || "?"}</span>
                    <b className={v.sieger ? "" : "null"}>{v.sieger ? names[v.sieger] : "niemand"}</b></li>
                ))}
              </ol>
              <div className="closeline">
                {!aufgegeben && myPlayer !== 0 && <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={nochmal}>Revanche</button>}
                <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Zur Lobby</button>
              </div>
            </div>
          )}

          {status === "playing" && ph.name === "laeuft" && myPlayer !== 0 && (
            <GsSteuerung modus={modus} setModus={setModus} versuche={versucheUebrig(stand, ich)} sperreRest={meineSperre}
              deaktiviert={versucheUebrig(stand, ich) === 0} />
          )}
        </>
      )}

      {frage && <GsRateDialog player={frage} onJa={() => raten(frage)} onNein={() => setFrage(null)} />}
      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Der Gesuchte · Duell</h2>
            <p className="ruleP">Ihr seht dasselbe Brett mit <b>24 Spielern</b>. Alle 12 Sekunden kommt für beide derselbe neue Hinweis; nach {RUNDE_S} Sekunden ist die Runde vorbei.</p>
            <p className="ruleP"><b>Wer zuerst richtig rät, gewinnt die Runde.</b> {VERSUCHE} Versuche je Runde, ein Fehler kostet {SPERRE_S} Sekunden Pause. Streichen sind deine Notizen — dein Gegner sieht sie nicht.</p>
            <p className="ruleP">{SIEGE_ZIEL} Rundensiege gewinnen. Findet niemand den Gesuchten, gibt es eine neue Runde mit neuem Brett.</p>
            <DataStamp />
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setShowRules(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
