import { useState, useEffect } from "react";
import { supabase, getClientId, getSavedName, saveName } from "./supabaseClient.js";
import { buildBoardSerial, buildGridSerial, buildGuessSerial, genCode, START_SECONDS } from "./gameData.js";
import { loadPlayers } from "./playersStore.js";
import { dailyDateStr, dailyNumber } from "./dailyLogic.js";
import { DATA_ASOF } from "./dataInfo.js";

export default function Lobby({ onEnter, onDaily, onSolo }) {
  const [name, setName] = useState(getSavedName());
  const [mode, setMode] = useState("hex"); // "hex" | "grid" | "guess"
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadPlayers(); }, []); // Hintergrund-Prefetch der Spielerliste

  async function createGame() {
    setError(""); setBusy(true);
    try {
      const code = genCode();
      const me = getClientId();
      const myName = name.trim() || "Spieler 1";
      saveName(myName);
      let board, last_move;
      if (mode === "grid") { board = buildGridSerial(await loadPlayers()); last_move = { picksAll: {} }; }
      else if (mode === "guess") { board = buildGuessSerial(await loadPlayers()); last_move = { log: [], winner: null }; }
      else { board = buildBoardSerial(); last_move = null; }
      const { error } = await supabase.from("games").insert({
        code,
        board,
        owners: {},
        turn: 1,
        status: "waiting",
        host_id: me,
        guest_id: null,
        names: { 1: myName, 2: "Spieler 2" },
        last_move,
        clocks: { 1: START_SECONDS, 2: START_SECONDS, started: null, timeout: null },
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      onEnter(code);
    } catch (e) {
      setError("Spiel konnte nicht erstellt werden: " + (e.message || e));
    } finally { setBusy(false); }
  }

  async function joinGame() {
    setError(""); setBusy(true);
    try {
      const code = joinCode.trim().toUpperCase();
      if (code.length !== 6) { setError("Bitte einen 6-stelligen Code eingeben."); setBusy(false); return; }
      const me = getClientId();
      const myName = name.trim() || "Spieler 2";
      saveName(myName);

      const { data: row, error: selErr } = await supabase.from("games").select("*").eq("code", code).maybeSingle();
      if (selErr) throw selErr;
      if (!row) { setError("Kein Spiel mit diesem Code gefunden."); setBusy(false); return; }

      // Wiedereinstieg, falls ich schon dabei bin
      if (row.host_id === me || row.guest_id === me) { onEnter(code); return; }
      if (row.guest_id) { setError("Dieses Spiel ist bereits voll."); setBusy(false); return; }

      // Gästeplatz beanspruchen (nur wenn noch frei -> verhindert Race)
      const { data: upd, error: updErr } = await supabase
        .from("games")
        .update({ guest_id: me, status: "playing", names: { ...row.names, 2: myName },
          clocks: { ...(row.clocks || { 1: START_SECONDS, 2: START_SECONDS, timeout: null }), started: new Date().toISOString() },
          updated_at: new Date().toISOString() })
        .eq("code", code)
        .is("guest_id", null)
        .select()
        .maybeSingle();
      if (updErr) throw updErr;
      if (!upd) { setError("Jemand anderes ist gerade beigetreten."); setBusy(false); return; }
      onEnter(code);
    } catch (e) {
      setError("Beitritt fehlgeschlagen: " + (e.message || e));
    } finally { setBusy(false); }
  }

  return (
    <div className="lobby">
      <h1 className="title">POSSESSION PLAY</h1>
      <div className="subtitle">{{ hex: "Hex-Duell", grid: "Raster-Duell", guess: "Errate den Star" }[mode]} · Online gegen einen Freund</div>

      <DailyCard onDaily={onDaily} />

      <div className="panel" style={{ marginTop: 22 }}>
        <label className="lobLabel">Dein Name</label>
        <input className="field" placeholder="z. B. Julian" value={name} maxLength={20}
          onChange={(e) => setName(e.target.value)} />

        <label className="lobLabel">Spielmodus</label>
        <div className="inrow" style={{ flexWrap: "wrap" }}>
          <button type="button" className={`btn ${mode === "hex" ? "primary" : "ghost"}`} style={{ flex: 1 }} onClick={() => setMode("hex")}>Hex-Duell</button>
          <button type="button" className={`btn ${mode === "grid" ? "primary" : "ghost"}`} style={{ flex: 1 }} onClick={() => setMode("grid")}>Raster-Duell</button>
          <button type="button" className={`btn ${mode === "guess" ? "primary" : "ghost"}`} style={{ flex: 1 }} onClick={() => setMode("guess")}>Errate den Star</button>
        </div>


        <button className="btn primary block" style={{ marginTop: 14 }} disabled={busy} onClick={createGame}>
          Neues Spiel erstellen
        </button>

        <div className="orline"><span>oder</span></div>

        <label className="lobLabel">Mit Code beitreten</label>
        <div className="inrow">
          <input className="field mono" placeholder="ABC123" value={joinCode} maxLength={6}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && joinGame()} />
          <button className="btn ghost" disabled={busy} onClick={joinGame}>Beitreten</button>
        </div>

        {error && <div className="fb err" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      <div className="soloSection">
        <div className="soloTitle">Solo spielen</div>
        <div className="soloGrid">
          <button type="button" className="soloTile" onClick={() => onSolo("hex")}>
            <span className="soloIcon">🎯</span>
            <b>Hex-Training</b>
            <small>Board allein lösen, ohne Zeitdruck</small>
          </button>
          <button type="button" className="soloTile" onClick={() => onSolo("career")}>
            <span className="soloIcon">🧭</span>
            <b>Karriere-Pfad</b>
            <small>Spieler an seinen Stationen erraten</small>
          </button>
          <button type="button" className="soloTile" onClick={() => onSolo("odd")}>
            <span className="soloIcon">🧩</span>
            <b>Wer passt nicht?</b>
            <small>Drei gehören zusammen, einer nicht</small>
          </button>
        </div>
      </div>

      <p className="lobHint">Erstelle ein Spiel, teile den Code mit deinem Freund — ihr spielt in Echtzeit, jeder im eigenen Browser.</p>
      <p className="dataStamp">Datenstand: {DATA_ASOF.split("-").reverse().join(".")} · Quelle: Wikidata</p>
    </div>
  );
}

function DailyCard({ onDaily }) {
  const dateStr = dailyDateStr();
  let state = null;
  try { state = JSON.parse(localStorage.getItem(`pp:daily:${dateStr}`) || "null"); } catch { /* egal */ }
  const badge = state?.done ? (state.won ? "✓ gelöst" : "✗ vorbei") : "heute offen";
  return (
    <button className="dailyCard" onClick={onDaily}>
      <span className="dailyCardIcon">🌟</span>
      <span className="dailyCardText">
        <b>Daily-Star #{dailyNumber(dateStr)}</b>
        <small>Das tägliche Rätsel — solo, für alle gleich</small>
      </span>
      <span className={`dailyBadge ${state?.done ? (state.won ? "won" : "lost") : ""}`}>{badge}</span>
    </button>
  );
}
