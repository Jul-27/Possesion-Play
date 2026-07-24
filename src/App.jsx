import { useState, useEffect } from "react";
import Lobby from "./Lobby.jsx";
import Game from "./Game.jsx";
import Grid from "./Grid.jsx";
import Guess from "./Guess.jsx";
import Daily from "./Daily.jsx";
import Solo from "./Solo.jsx";
import Career from "./Career.jsx";
import OddOne from "./OddOne.jsx";
import Chain from "./Chain.jsx";
import Eleven from "./Eleven.jsx";
import Stats from "./Stats.jsx";
import Leaderboard from "./Leaderboard.jsx";
import { supabase, getClientId } from "./supabaseClient.js";

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

function GameRouter({ code, clientId, onLeave }) {
  const [board, setBoard] = useState(undefined); // undefined=lädt, null=nicht gefunden
  useEffect(() => {
    let active = true;
    setBoard(undefined);
    supabase.from("games").select("board").eq("code", code).maybeSingle()
      .then(({ data }) => { if (active) setBoard(data ? data.board : null); });
    return () => { active = false; };
  }, [code]);
  if (board === undefined) return <div className="ppRoot"><div className="panel" style={{ marginTop: 40 }}>Lade Spiel…</div></div>;
  const kind = board && !Array.isArray(board) ? board.kind : "hex";
  if (kind === "grid") return <Grid code={code} clientId={clientId} onLeave={onLeave} />;
  if (kind === "guess") return <Guess code={code} clientId={clientId} onLeave={onLeave} />;
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
  if (daily) return <Daily onLeave={leave} />;
  if (solo === "hex") return <Solo onLeave={leave} />;
  if (solo === "career") return <Career onLeave={leave} />;
  if (solo === "odd") return <OddOne onLeave={leave} />;
  if (solo === "chain") return <Chain onLeave={leave} />;
  if (solo === "eleven") return <Eleven onLeave={leave} />;
  return code
    ? <GameRouter code={code} clientId={clientId} onLeave={leave} />
    : <Lobby onEnter={enter} onDaily={enterDaily} onSolo={enterSolo} onStats={enterStats} onBoard={enterBoard} />;
}
