import { useState } from "react";
import { supabase, getClientId, getSavedName, saveName } from "./supabaseClient.js";
import { buildBoardSerial, genCode, START_SECONDS } from "./gameData.js";

export default function Lobby({ onEnter }) {
  const [name, setName] = useState(getSavedName());
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function createGame() {
    setError(""); setBusy(true);
    try {
      const code = genCode();
      const me = getClientId();
      const myName = name.trim() || "Spieler 1";
      saveName(myName);
      const { error } = await supabase.from("games").insert({
        code,
        board: buildBoardSerial(),
        owners: {},
        turn: 1,
        status: "waiting",
        host_id: me,
        guest_id: null,
        names: { 1: myName, 2: "Spieler 2" },
        last_move: null,
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
      <div className="subtitle">Hex-Duell · Online gegen einen Freund</div>

      <div className="panel" style={{ marginTop: 22 }}>
        <label className="lobLabel">Dein Name</label>
        <input className="field" placeholder="z. B. Julian" value={name} maxLength={20}
          onChange={(e) => setName(e.target.value)} />

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

      <p className="lobHint">Erstelle ein Spiel, teile den Code mit deinem Freund — ihr spielt in Echtzeit, jeder im eigenen Browser.</p>
    </div>
  );
}
