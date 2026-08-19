import { useState, useEffect } from "react";
import { supabase, getClientId, getSavedName, saveName } from "./supabaseClient.js";
import { buildBoardSerial, buildGridSerial, buildGuessSerial, genCode, START_SECONDS } from "./gameData.js";
import { initCarousel, CAROUSEL_SECONDS } from "./carousel.js";
import { loadPlayers } from "./playersStore.js";
import { dailyDateStr, dailyNumber } from "./dailyLogic.js";
import { challengeState, dailyRnd } from "./dailyChallenge.js";
import { collectStats } from "./stats.js";
import { berechneXp, stufeFuer, tagesserie, offeneHeute } from "./progress.js";
import { tagesStand, missionenDesTages, fortschritt } from "./missions.js";
import DataStamp from "./DataStamp.jsx";
import Icon from "./Icons.jsx";
import { erreichteAnzahl, BADGES } from "./badges.js";

export default function Lobby({ onEnter, onDaily, onSolo, onStats, onBoard }) {
  const [name, setName] = useState(getSavedName());
  const [mode, setMode] = useState("hex"); // "hex" | "grid" | "guess"
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [duelOpen, setDuelOpen] = useState(false);

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
      else if (mode === "carousel") {
        // Der ganze Spielstand steckt in last_move.car; die Frist startet erst beim Beitritt.
        board = { kind: "carousel" };
        last_move = { car: initCarousel(0), frist: 0, ende: null };
      }
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
          /* Das Karussell zählt pro Zug, nicht pro Partie: die Frist des ersten Zuges
             beginnt erst mit dem Beitritt — sonst liefe sie ab, während der Ersteller
             noch auf einen Gegner wartet. */
          ...(row.board?.kind === "carousel"
            ? { last_move: { ...(row.last_move || {}), frist: Date.now() + CAROUSEL_SECONDS * 1000 } }
            : {}),
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

  /* ── Fortschritt: eine Zahl über alle Modi ─────────────────────────────────
     Bis hierher zählte jeder Modus für sich, und die Lobby begrüßte einen Titel
     statt eines Ich. Stufe, XP und Serie kommen aus den vorhandenen Statistiken
     (progress.js) — kein neuer Speicher, alte Spielstände zählen rückwirkend. */
  const entries = collectStats();
  const stand = tagesStand();
  const missionen = missionenDesTages(dailyRnd("mission"));
  const { xp, raetsel, modi: modiGenutzt } = berechneXp(entries, missionen, stand);
  const stufe = stufeFuer(xp);
  const serie = tagesserie(entries);
  const offen = offeneHeute();
  const fertigeMissionen = missionen.filter((m) => fortschritt(m, stand).fertig).length;
  const heute = dailyDateStr();

  return (
    <div className="ppRoot draft">
      <div className="dTop">
        <h1 className="dTitle">POSSESSION PLAY</h1>
      </div>

      <div className="dMe">
        <div className="dRing" style={{ "--anteil": stufe.anteil }}><span>{stufe.kurz}</span></div>
        <div className="dMeBody">
          <div className="dMeName">{name.trim() || "Spieler"}</div>
          <div className="dMeStufe">{stufe.name}</div>
          <div className="dBar"><i style={{ width: `${Math.round(stufe.anteil * 100)}%` }} /></div>
          <div className="dMeSub">
            {stufe.naechste ? <>noch <b>{stufe.bisNaechste}</b> XP bis {stufe.naechste.name}</> : <>höchste Stufe erreicht</>}
          </div>
        </div>
        <div className="dSerie" title="Tage in Folge gespielt">
          <b>{serie}</b><span><Icon name="streak" size={12} /> Serie</span>
        </div>
      </div>

      <div className="dSectionRow">
        <span className="dSection">Heute</span>
        {offen > 0 && <span className="dOffen">{offen} offen</span>}
      </div>

      <button className="dHero" onClick={onDaily}>
        <div className="dHeroTop">
          <span className="dHeroIcon"><Icon name="star" size={28} /></span>
          <span className="dHeroNr">#{dailyNumber(heute)}</span>
        </div>
        <div className="dHeroName">Daily-Star</div>
        <div className="dHeroText">Acht Fragen, zwei Tipps — für alle dasselbe Rätsel.</div>
        <div className="dHeroCta">{stand.dailyGespielt ? "Nochmal ansehen" : "Jetzt spielen"} <Icon name="pfeil" size={17} /></div>
      </button>

      <button className="dWide" onClick={() => onSolo("eleven")} style={{ "--ton": "#38BDF8" }}>
        <span className="dWideIcon"><Icon name="jersey" /></span>
        <span className="dWideBody">
          <b>Elf des Tages #{dailyNumber(heute)}</b>
          <small>Startelf nach elf Bedingungen</small>
        </span>
        <span className="dWideBadge">{stand.elfKomplett ? <Icon name="check" size={16} /> : stand.elfFelder ? `${stand.elfFelder}/11` : "offen"}</span>
      </button>

      <div className="dSectionRow">
        <span className="dSection">Missionen</span>
        <span className={`dOffen ${fertigeMissionen === 3 ? "" : "ghost"}`}>{fertigeMissionen}/3</span>
      </div>
      <div className="dMissions">
        {missionen.map((m) => {
          const f = fortschritt(m, stand);
          return (
            <div key={m.id} className={`dMission ${f.fertig ? "fertig" : ""}`}>
              <span className="dMissionBox">{f.fertig && <Icon name="check" size={13} />}</span>
              <span className="dMissionText">
                {m.text}
                {m.ziel > 1 && !f.fertig && <i className="dMissionCount"> {f.jetzt}/{f.ziel}</i>}
              </span>
              <span className="dMissionXp">+{m.xp}</span>
            </div>
          );
        })}
      </div>

      <div className="dSectionRow"><span className="dSection">Modi</span></div>
      <div className="dGrid">
        {SOLO_MODI.map((m) => {
          const st = entries.find((e) => e.key === m.key);
          const erledigt = m.daily && !!challengeState(m.key);
          const meiste = Math.max(1, ...entries.map((e) => e.played || 0));
          return (
            <button key={m.key} className="dTile" style={{ "--ton": m.ton }} onClick={() => onSolo(m.key)}>
              <span className="dTileHead">
                <span className="dTileIcon"><Icon name={m.icon} /></span>
                {erledigt ? <span className="dCheck"><Icon name="check" size={15} /></span>
                  : st?.streak > 0 ? <span className="dFlame"><Icon name="streak" size={13} />{st.streak}</span> : null}
              </span>
              <b className="dTileName">{m.name}</b>
              <small className="dTileText">{m.text}</small>
              <span className="dTileBar"><i style={{ width: `${Math.round(((st?.played || 0) / meiste) * 100)}%` }} /></span>
            </button>
          );
        })}
      </div>

      <div className="dSectionRow"><span className="dSection">Gegen Freunde</span></div>
      <button className="dWide" aria-expanded={duelOpen} onClick={() => setDuelOpen((v) => !v)} style={{ "--ton": "#2DD4BF" }}>
        <span className="dWideIcon"><Icon name="duel" /></span>
        <span className="dWideBody"><b>Duell starten</b><small>Vier Modi, erstellen oder mit Code beitreten</small></span>
        <span className={`dWideChev ${duelOpen ? "open" : ""}`}><Icon name="chevron" size={18} /></span>
      </button>

      {duelOpen && (
        <div className="panel" style={{ marginTop: 10 }}>
          <label className="lobLabel">Dein Name</label>
          <input className="field" placeholder="z. B. Julian" value={name} maxLength={20}
            onChange={(e) => setName(e.target.value)} />

          <label className="lobLabel">Spielmodus</label>
          <div className="inrow" style={{ flexWrap: "wrap" }}>
            {DUELL_MODI.map((d) => (
              <button key={d.key} type="button" className={`btn ${mode === d.key ? "primary" : "ghost"}`}
                style={{ flex: 1 }} onClick={() => setMode(d.key)}>{d.name}</button>
            ))}
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
      )}

      <div className="dPair">
        <button className="dSmall" onClick={onBoard}><span><Icon name="trophy" size={20} /></span><b>Bestenliste</b><small>im Freundeskreis</small></button>
        <button className="dSmall" onClick={onStats}><span><Icon name="chart" size={20} /></span><b>Statistik</b><small>{raetsel} Rätsel · {erreichteAnzahl()}/{BADGES.length} Abzeichen</small></button>
      </div>

      <DataStamp />
    </div>
  );
}

/* Ein Farbton je Modus. Vorher teilten sich alle ein Türkis, weshalb das Raster
   monoton wirkte, obwohl jede Kachel für sich sauber war. */
const SOLO_MODI = [
  { key: "career",   name: "Karriere-Pfad",     icon: "route", ton: "#A78BFA", text: "Stationen erraten",     daily: true },
  { key: "odd",      name: "Wer passt nicht?",  icon: "odd", ton: "#A3E635", text: "Drei gehören zusammen", daily: true },
  { key: "chain",    name: "Fußball-Kette",     icon: "chain", ton: "#22D3EE", text: "Gegen die Uhr",         daily: true },
  { key: "heat",     name: "Heatmap",           icon: "flame", ton: "#FB923C", text: "Combos und Hitze",      daily: true },
  { key: "hex",      name: "Hex-Training",      icon: "hex", ton: "#2DD4BF", text: "Ohne Zeitdruck",        daily: true },
  { key: "carousel", name: "Transferkarussell", icon: "carousel", ton: "#F472B6", text: "Gegen den Bot",         daily: false },
];

const DUELL_MODI = [
  { key: "hex",   name: "Hex-Duell" },
  { key: "grid",  name: "Raster-Duell" },
  { key: "guess", name: "Errate den Star" },
  { key: "carousel", name: "Transferkarussell" },
];
