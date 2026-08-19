import { useState, useEffect } from "react";
import { getGroup, setGroup, leaveGroup, getName, setName, createGroup, joinGroup, top, saison, MODES } from "./leaderboard.js";
import { dailyDateStr, dailyNumber } from "./dailyLogic.js";
import DataStamp from "./DataStamp.jsx";
import GameTop from "./GameTop.jsx";
import Icon from "./Icons.jsx";

/* Bestenliste für einen Freundeskreis. Ohne Gruppencode ist nichts sichtbar — die
   Datenbanktabellen sind gesperrt, jeder Zugriff verlangt den Code. */
export default function Leaderboard({ onLeave }) {
  const [group, setG] = useState(getGroup());
  const [name, setN] = useState(getName() || "");
  const [ansicht, setAnsicht] = useState("saison");   // saison | heute
  const [mode, setMode] = useState("chain");
  const [saisonDaten, setSaison] = useState(null);
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [groupName, setGroupName] = useState("");
  const [copied, setCopied] = useState(false);
  const day = dailyDateStr();

  useEffect(() => {
    if (!group) return;
    let aktiv = true;
    setRows(null);
    top(mode, day).then((r) => { if (aktiv) setRows(r); });
    return () => { aktiv = false; };
  }, [group, mode, day]);

  // Saison einmal je Gruppe laden — sie ändert sich nicht im Sekundentakt.
  useEffect(() => {
    if (!group) return setSaison(null);
    let aktiv = true;
    saison().then((d) => { if (aktiv) setSaison(d); });
    return () => { aktiv = false; };
  }, [group]);

  async function doCreate() {
    if (!groupName.trim()) { setError("Bitte einen Gruppennamen eingeben."); return; }
    setBusy(true); setError("");
    try { setG(await createGroup(groupName)); }
    catch (e) { setError("Gruppe konnte nicht erstellt werden: " + e.message); }
    finally { setBusy(false); }
  }

  async function doJoin() {
    if (joinCode.trim().length !== 6) { setError("Der Code hat 6 Zeichen."); return; }
    setBusy(true); setError("");
    try {
      const g = await joinGroup(joinCode);
      if (!g) setError("Keine Gruppe mit diesem Code gefunden.");
      else setG(g);
    } catch (e) { setError("Beitritt fehlgeschlagen: " + e.message); }
    finally { setBusy(false); }
  }

  function saveName(v) { setN(v); setName(v); }
  function copyCode() {
    navigator.clipboard?.writeText(group.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  }

  return (
    <div className="ppRoot">
      <GameTop icon="trophy" name="Bestenliste" ton="#FACC15" zusatz={<>Tag #{dailyNumber(day)}</>}>
        <button className="iconbtn" title="Zur Lobby" onClick={onLeave}><Icon name="leave" size={18} /></button>
      </GameTop>

      {!group ? (
        <div className="panel" style={{ marginTop: 18 }}>
          <div className="prompt">Bestenliste für deinen Freundeskreis</div>
          <p className="ruleP">Erstelle eine Gruppe und teile den Code. Nur wer ihn hat, sieht die Liste — und trägt sich ein.</p>

          <label className="lobLabel">Gruppenname</label>
          <div className="inrow">
            <input className="field" placeholder="z. B. Kegelclub" value={groupName} maxLength={40}
              onChange={(e) => { setGroupName(e.target.value); setError(""); }} />
            <button className="btn primary" disabled={busy} onClick={doCreate}>Erstellen</button>
          </div>

          <div className="orline"><span>oder</span></div>

          <label className="lobLabel">Mit Code beitreten</label>
          <div className="inrow">
            <input className="field mono" placeholder="ABC123" value={joinCode} maxLength={6}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && doJoin()} />
            <button className="btn ghost" disabled={busy} onClick={doJoin}>Beitreten</button>
          </div>

          {error && <div className="fb err" style={{ marginTop: 12 }}>{error}</div>}
        </div>
      ) : (
        <>
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="lbHead">
              <span className="lbGroupName">{group.name}</span>
              <button className="btn ghost lbCode" onClick={copyCode}>{copied ? "Kopiert ✓" : group.code}</button>
            </div>
            <label className="lobLabel">Dein Anzeigename</label>
            <input className="field" placeholder="z. B. Julian" value={name} maxLength={24}
              onChange={(e) => saveName(e.target.value)} />
            {!name.trim() && <p className="ruleP" style={{ marginTop: 8 }}>Ohne Namen wird dein Ergebnis nicht übertragen.</p>}
          </div>

          <div className="lbSwitch">
            <button type="button" className={ansicht === "saison" ? "active" : ""} onClick={() => setAnsicht("saison")}>Saison</button>
            <button type="button" className={ansicht === "heute" ? "active" : ""} onClick={() => setAnsicht("heute")}>Heute</button>
          </div>

          {ansicht === "saison" ? <Saison daten={saisonDaten} /> : (
          <>
          <div className="lbTabs">
            {Object.entries(MODES).map(([k, m]) => (
              <button key={k} type="button" className={`lbTab ${mode === k ? "active" : ""}`} onClick={() => setMode(k)}>
                <span><Icon name={m.icon} size={17} /></span>
              </button>
            ))}
          </div>

          {rows === null ? <div className="qlogEmpty">Lade Bestenliste…</div>
            : rows.length === 0 ? (
              <div className="qlogEmpty">Für {MODES[mode].name} hat heute noch niemand gespielt.</div>
            ) : (
              <div className="lbList">
                {rows.map((r) => (
                  <div key={r.client_id} className={`lbRow ${r.isMe ? "me" : ""}`}>
                    <span className="lbRank">{r.rank}</span>
                    <span className="lbName">{r.display_name}{r.isMe ? " (du)" : ""}</span>
                    <span className="lbDetail">{MODES[mode].label(r.score, r.detail)}</span>
                    <span className="lbScore">{r.score}</span>
                  </div>
                ))}
              </div>
            )}

          </>
          )}

          <div className="closeline" style={{ marginTop: 14 }}>
            <button className="btn ghost" style={{ flex: 1, padding: "11px" }}
              onClick={() => { leaveGroup(); setG(null); }}>Gruppe verlassen</button>
          </div>
        </>
      )}

      <DataStamp />
    </div>
  );
}

/* Saisontabelle. Zeigt neben Punkten und Platz die LIGA — sie ergibt sich aus den
   Punkten, nicht aus dem Platz: In einem Freundeskreis soll niemand absteigen,
   nur weil ein anderer besser war. Wer spielt, steigt; wer aussetzt, startet die
   nächste Saison wieder unten. */
function Saison({ daten }) {
  if (!daten) return <div className="qlogEmpty">Lade Saison…</div>;
  const { spanne, zeilen } = daten;
  return (
    <>
      <div className="dSectionRow">
        <span className="dSection">Saison {spanne.nummer}</span>
        <span className="dOffen ghost">
          {spanne.resttage === 1 ? "letzter Tag" : `noch ${spanne.resttage} Tage`}
        </span>
      </div>

      {zeilen.length === 0 ? (
        <div className="qlogEmpty">In dieser Saison hat noch niemand gespielt.</div>
      ) : (
        <div className="lbList">
          {zeilen.map((r) => (
            <div key={r.client_id} className={`lbRow ${r.ichSelbst ? "me" : ""}`}>
              <span className="lbRank">{r.platz}</span>
              <span className="lbName">
                {r.name}{r.ichSelbst ? " (du)" : ""}
                <small className="lbLiga">{r.liga.name} · {r.tage} {r.tage === 1 ? "Tag" : "Tage"}</small>
              </span>
              <span className="lbScore">{r.punkte}</span>
            </div>
          ))}
        </div>
      )}

      {(() => {
        const ich = zeilen.find((r) => r.ichSelbst);
        if (!ich) return null;
        const l = ich.liga;
        return (
          <div className="lbLigaBox">
            <div className="lbLigaKopf">
              <b>{l.name}</b>
              {l.naechste
                ? <span>noch <b>{l.bisNaechste}</b> Punkte bis {l.naechste.name}</span>
                : <span>höchste Liga erreicht</span>}
            </div>
            <span className="dBar"><i style={{ width: `${Math.round(l.anteil * 100)}%` }} /></span>
          </div>
        );
      })()}
    </>
  );
}
