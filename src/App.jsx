import { useState, useEffect } from "react";
import Lobby from "./Lobby.jsx";
import Game from "./Game.jsx";
import Grid from "./Grid.jsx";
import Guess from "./Guess.jsx";
import Steckbrief from "./Steckbrief.jsx";
import Solo from "./Solo.jsx";
import Career from "./Career.jsx";
import OddOne from "./OddOne.jsx";
import Chain from "./Chain.jsx";
import Carousel from "./Carousel.jsx";
import CarouselDuel from "./CarouselDuel.jsx";
import Heatmap from "./Heatmap.jsx";
import Collection from "./Collection.jsx";
import Eleven from "./Eleven.jsx";
import Stats from "./Stats.jsx";
import Leaderboard from "./Leaderboard.jsx";
import { supabase, getClientId, getSavedName, saveName } from "./supabaseClient.js";
import { beitrittsLage, duellName, LAGE } from "./duelJoin.js";
import { gastPlatzBeanspruchen } from "./duelJoinClient.js";

function codeFromUrl() {
  const c = new URLSearchParams(window.location.search).get("game");
  return c ? c.toUpperCase() : null;
}

function boardFromUrl() {
  return new URLSearchParams(window.location.search).get("board") != null;
}

function statsFromUrl() {
  return new URLSearchParams(window.location.search).get("stats") != null;
}

function dailyFromUrl() {
  return new URLSearchParams(window.location.search).get("daily") != null;
}

// Solo-Modi über einen Schlüssel: ?solo=hex | career | … ( ?solo=1 bleibt kompatibel)
function soloFromUrl() {
  const v = new URLSearchParams(window.location.search).get("solo");
  if (v == null) return null;
  return v === "1" ? "hex" : v;
}

function NameFragen({ row, fehler, onFertig }) {
  const [wert, setWert] = useState("");
  const senden = () => wert.trim() && onFertig(wert.trim());
  const wirt = row?.names?.[1];
  return (
    <>
      {/* Wer einlädt und wozu — beides steht in der geladenen Zeile, und ohne es
          begrüßt den Eingeladenen ein namenloser Kasten. */}
      <div className="prompt">{wirt ? `${wirt} fordert dich heraus` : "Du wurdest herausgefordert"}</div>
      <p className="ruleP">
        <b>{duellName(row?.board)}</b> — unter welchem Namen sollen deine Züge erscheinen?
      </p>
      <div className="inrow">
        <input className="field" autoFocus maxLength={20} placeholder="Dein Name" value={wert}
          onChange={(e) => setWert(e.target.value)} onKeyDown={(e) => e.key === "Enter" && senden()} />
        <button className="btn primary" disabled={!wert.trim()} onClick={senden}>Mitspielen</button>
      </div>
      {fehler && <div className="fb err" style={{ marginTop: 12 }}>{fehler}</div>}
    </>
  );
}

/* Der Einladungslink `?game=CODE` landet hier. Vor der Spielansicht steht deshalb
   der Beitritt: Wer über den Link kommt, ist noch niemand im Spiel, und ohne diesen
   Schritt bliebe er stiller Zuschauer, während beim Ersteller weiter „Warte auf
   Mitspieler" steht.

   Gefragt wird höchstens nach dem NAMEN, nie nach dem Code — der steht im Link.
   Ist ein Name gespeichert (jeder, der schon einmal gespielt hat, hat einen), fällt
   auch das weg und die Partie beginnt beim Öffnen. */
function GameRouter({ code, clientId, onLeave }) {
  const [row, setRow] = useState(undefined);        // undefined = lädt, null = nicht gefunden
  const [name, setName] = useState(getSavedName());
  const [beitritt, setBeitritt] = useState(null);   // null | "laeuft" | "fertig"
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    let aktiv = true;
    setRow(undefined); setBeitritt(null); setFehler("");
    supabase.from("games").select("*").eq("code", code).maybeSingle()
      .then(({ data }) => { if (aktiv) setRow(data || null); });
    return () => { aktiv = false; };
  }, [code]);

  const lage = beitrittsLage(row, clientId);

  /* Beitreten, sobald klar ist, dass der Platz frei ist und ein Name vorliegt.
     Der Effekt läuft genau einmal je Spiel — `beitritt` sperrt ihn danach. */
  useEffect(() => {
    if (lage !== LAGE.FREI || beitritt || !name.trim()) return;
    setBeitritt("laeuft");
    gastPlatzBeanspruchen(code, clientId, name.trim()).then(({ ok, fehler: f }) => {
      if (!ok) { setBeitritt(null); setFehler(f); return; }
      saveName(name.trim());
      setBeitritt("fertig");
      /* Die geladene Zeile ist jetzt veraltet — ohne diesen Nachtrag bliebe die Lage
         „frei" und die Ansicht hinge auf „Trete dem Spiel bei…". Die Spielansicht
         lädt gleich ohnehin ihren eigenen, vollständigen Stand. */
      setRow((r) => (r ? { ...r, guest_id: clientId, status: "playing" } : r));
    });
  }, [lage, beitritt, name, code, clientId]);

  const rahmen = (inhalt) => <div className="ppRoot"><div className="panel" style={{ marginTop: 40 }}>{inhalt}</div></div>;

  if (row === undefined) return rahmen("Lade Spiel…");
  if (row === null) return rahmen(<>
    <div className="fb err">Kein Spiel mit diesem Code gefunden.</div>
    <button className="btn primary block" style={{ marginTop: 12 }} onClick={onLeave}>Zur Lobby</button>
  </>);

  if (lage === LAGE.VOLL) return rahmen(<>
    <div className="prompt">Dieses Spiel ist bereits voll</div>
    <p className="ruleP">Zwei Spieler sind schon dabei. Starte selbst eine Partie und schick deinen Link weiter.</p>
    <button className="btn primary block" style={{ marginTop: 12 }} onClick={onLeave}>Zur Lobby</button>
  </>);

  // Einmalige Namensfrage, wenn dieses Gerät noch nie gespielt hat.
  if (lage === LAGE.FREI && !name.trim()) {
    return rahmen(<NameFragen row={row} fehler={fehler} onFertig={setName} />);
  }

  if (lage === LAGE.FREI) return rahmen(fehler
    ? <>
      <div className="fb err">{fehler}</div>
      <button className="btn primary block" style={{ marginTop: 12 }} onClick={onLeave}>Zur Lobby</button>
    </>
    : "Trete dem Spiel bei…");

  const board = row.board;
  const kind = board && !Array.isArray(board) ? board.kind : "hex";
  if (kind === "grid") return <Grid code={code} clientId={clientId} onLeave={onLeave} />;
  if (kind === "guess") return <Guess code={code} clientId={clientId} onLeave={onLeave} />;
  if (kind === "carousel") return <CarouselDuel code={code} clientId={clientId} onLeave={onLeave} />;
  return <Game code={code} clientId={clientId} onLeave={onLeave} />;
}

export default function App() {
  const [code, setCode] = useState(codeFromUrl());
  const [daily, setDaily] = useState(dailyFromUrl());
  const [solo, setSolo] = useState(soloFromUrl());
  const [stats, setStats] = useState(statsFromUrl());
  const [board, setBoard] = useState(boardFromUrl());
  const clientId = getClientId();

  useEffect(() => {
    const onPop = () => { setCode(codeFromUrl()); setDaily(dailyFromUrl()); setSolo(soloFromUrl()); setStats(statsFromUrl()); setBoard(boardFromUrl()); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function enter(c) {
    const url = `${window.location.pathname}?game=${c}`;
    window.history.pushState({}, "", url);
    setDaily(false); setSolo(null); setCode(c); setStats(false); setBoard(false);
  }
  function enterDaily() {
    window.history.pushState({}, "", `${window.location.pathname}?daily=1`);
    setCode(null); setSolo(null); setDaily(true); setStats(false); setBoard(false);
  }
  function enterSolo(mode) {
    window.history.pushState({}, "", `${window.location.pathname}?solo=${mode}`);
    setCode(null); setDaily(false); setSolo(mode); setStats(false); setBoard(false);
  }
  function enterStats() {
    window.history.pushState({}, "", `${window.location.pathname}?stats=1`);
    setCode(null); setDaily(false); setSolo(null); setStats(true);
  }
  function enterBoard() {
    window.history.pushState({}, "", `${window.location.pathname}?board=1`);
    setCode(null); setDaily(false); setSolo(null); setStats(false); setBoard(true);
  }
  function leave() {
    window.history.pushState({}, "", window.location.pathname);
    setCode(null); setDaily(false); setSolo(null); setStats(false); setBoard(false);
  }

  if (board) return <Leaderboard onLeave={leave} />;
  if (stats) return <Stats onLeave={leave} onSolo={enterSolo} onDaily={enterDaily} />;
  if (daily) return <Steckbrief onLeave={leave} />;
  if (solo === "hex") return <Solo onLeave={leave} />;
  if (solo === "career") return <Career onLeave={leave} />;
  if (solo === "odd") return <OddOne onLeave={leave} />;
  if (solo === "chain") return <Chain onLeave={leave} />;
  if (solo === "carousel") return <Carousel onLeave={leave} />;
  if (solo === "eleven") return <Eleven onLeave={leave} />;
  if (solo === "heat") return <Heatmap onLeave={leave} />;
  if (solo === "sammlung") return <Collection onLeave={leave} />;
  return code
    ? <GameRouter code={code} clientId={clientId} onLeave={leave} />
    : <Lobby onEnter={enter} onDaily={enterDaily} onSolo={enterSolo} onStats={enterStats} onBoard={enterBoard} />;
}
