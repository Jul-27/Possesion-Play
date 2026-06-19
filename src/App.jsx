import { useState, useEffect } from "react";
import Lobby from "./Lobby.jsx";
import Game from "./Game.jsx";
import { getClientId } from "./supabaseClient.js";

function codeFromUrl() {
  const c = new URLSearchParams(window.location.search).get("game");
  return c ? c.toUpperCase() : null;
}

export default function App() {
  const [code, setCode] = useState(codeFromUrl());
  const clientId = getClientId();

  // Browser-Zurück/Vor unterstützen
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
    ? <Game code={code} clientId={clientId} onLeave={leave} />
    : <Lobby onEnter={enter} />;
}
