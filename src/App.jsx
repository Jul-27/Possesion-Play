import { useState, useEffect } from "react";
import Lobby from "./Lobby.jsx";
import Game from "./Game.jsx";
import Grid from "./Grid.jsx";
import Guess from "./Guess.jsx";
import { supabase, getClientId } from "./supabaseClient.js";

function codeFromUrl() {
  const c = new URLSearchParams(window.location.search).get("game");
  return c ? c.toUpperCase() : null;
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
  const clientId = getClientId();

  useEffect(() => {
    const onPop = () => setCode(codeFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function enter(c) {
    const url = `${window.location.pathname}?game=${c}`;
    window.history.pushState({}, "", url);
    setCode(c);
  }
  function leave() {
    window.history.pushState({}, "", window.location.pathname);
    setCode(null);
  }

  return code
    ? <GameRouter code={code} clientId={clientId} onLeave={leave} />
    : <Lobby onEnter={enter} />;
}
