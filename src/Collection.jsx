import { useState, useEffect, useMemo } from "react";
import { NATIONS, lookupDef } from "./gameData.js";
import { loadPlayers } from "./playersStore.js";
import { Avatar, Emblem } from "./Emblems.jsx";
import { karten, sammlungStand, stufeVon, STUFEN, gesammelt } from "./collection.js";
import GameTop from "./GameTop.jsx";
import Icon from "./Icons.jsx";
import DataStamp from "./DataStamp.jsx";

/* 🃏 Sammlung — jede korrekt genannte Spielerkarte bleibt.

   Die 31.565 Spielerdatensätze waren bisher reines Nachschlagewerk: Sie
   entschieden, ob ein Zug zählt, aber man bekam sie nie zu sehen. Hier werden sie
   zum Inhalt — mit Foto, Vereinen und Seltenheit.

   DIE SELTENHEIT LÄUFT UMGEKEHRT ZUR BEKANNTHEIT. Wer einen Spieler mit
   Bekanntheitsgrad 8 aus dem Gedächtnis nennt, hat mehr geleistet als jemand, der
   Messi tippt. „Geheimtipp" ist deshalb die wertvollste Stufe, nicht die
   geringste. */
export default function Collection({ onLeave }) {
  const [players, setPlayers] = useState(null);
  const [nation, setNation] = useState(null);
  const [stufe, setStufe] = useState(null);
  const [suche, setSuche] = useState("");
  const [zeigen, setZeigen] = useState(60);   // stückweise nachladen statt 2000 Karten auf einmal

  useEffect(() => { loadPlayers().then(setPlayers); }, []);

  const menge = useMemo(() => gesammelt(), []);
  const stand = useMemo(() => (players ? sammlungStand(players, menge) : null), [players, menge]);
  const liste = useMemo(
    () => (players ? karten(players, menge, { nation, stufe, suche }) : []),
    [players, menge, nation, stufe, suche]
  );
  useEffect(() => { setZeigen(60); }, [nation, stufe, suche]);

  const natName = (k) => NATIONS.find((n) => n.key === k)?.name || k;

  return (
    <div className="ppRoot">
      <GameTop icon="cards" name="Sammlung" ton="#A78BFA"
        zusatz={stand ? `${stand.anzahl} von ${stand.gesamt.toLocaleString("de-DE")}` : "lädt…"}>
        <button className="iconbtn" title="Zur Lobby" onClick={onLeave}><Icon name="leave" size={18} /></button>
      </GameTop>

      {!players || !stand ? <div className="qlogEmpty">Lade Spielerdaten…</div> : stand.anzahl === 0 ? (
        <div className="panel" style={{ marginTop: 18 }}>
          <div className="prompt">Noch keine Karten</div>
          <p className="ruleP">
            Jeder Spieler, den du in einem Modus richtig nennst, bleibt hier als Karte —
            mit Foto, Vereinen und Seltenheit. Fang mit einem Tagesrätsel an.
          </p>
          <p className="dataStamp" style={{ marginTop: 10 }}>
            Die Sammlung beginnt mit diesem Update. Frühere Partien lassen sich nicht
            nachträglich auswerten — was du ab jetzt nennst, wird gezählt.
          </p>
        </div>
      ) : (
        <>
          {/* Seltenheiten als Filter UND als Übersicht in einem */}
          <div className="samStufen">
            {STUFEN.map((s) => (
              <button key={s.key} type="button" style={{ "--ton": s.ton }}
                className={`samStufe ${stufe === s.key ? "aktiv" : ""}`}
                onClick={() => setStufe(stufe === s.key ? null : s.key)}>
                <b>{stand.jeStufe[s.key]}</b><span>{s.name}</span>
              </button>
            ))}
          </div>

          <div className="inrow" style={{ marginTop: 12 }}>
            <input className="field" placeholder="Name suchen…" value={suche} autoComplete="off"
              onChange={(e) => setSuche(e.target.value)} />
            {(suche || nation || stufe) && (
              <button className="btn ghost" onClick={() => { setSuche(""); setNation(null); setStufe(null); }}>
                Zurücksetzen
              </button>
            )}
          </div>

          {stand.nationen.length > 1 && (
            <div className="samNationen">
              {stand.nationen.slice(0, 12).map(([k, n]) => (
                <button key={k} type="button" className={`chip ${nation === k ? "aktiv" : ""}`}
                  onClick={() => setNation(nation === k ? null : k)}>
                  {natName(k)} <i>{n}</i>
                </button>
              ))}
            </div>
          )}

          <div className="dSectionRow">
            <span className="dSection">{liste.length} {liste.length === 1 ? "Karte" : "Karten"}</span>
            <span className="dOffen ghost">{(stand.anteil * 100).toFixed(1)} % entdeckt</span>
          </div>

          {liste.length === 0 ? (
            <div className="qlogEmpty">Keine Karte passt zu diesen Filtern.</div>
          ) : (
            <>
              <div className="samGrid">
                {liste.slice(0, zeigen).map((p) => <Karte key={p.n + p.by} p={p} />)}
              </div>
              {liste.length > zeigen && (
                <button className="btn ghost block" style={{ marginTop: 12 }}
                  onClick={() => setZeigen((z) => z + 60)}>
                  Weitere {Math.min(60, liste.length - zeigen)} zeigen
                </button>
              )}
            </>
          )}
        </>
      )}

      <DataStamp />
    </div>
  );
}

function Karte({ p }) {
  const s = stufeVon(p);
  const vereine = (p.clubs || []).slice(0, 3);
  return (
    <div className="samKarte" style={{ "--ton": s.ton }} title={`${p.n} · ${s.name}`}>
      <span className="samStufeTag">{s.name}</span>
      <Avatar player={p} size={54} />
      <b className="samName">{p.n}</b>
      <small className="samMeta">{[p.pos, p.by].filter(Boolean).join(" · ")}</small>
      {vereine.length > 0 && (
        <span className="samClubs">
          {vereine.map((k) => {
            const def = lookupDef("club", k);
            return def ? <Emblem key={k} def={def} /> : null;
          })}
          {(p.clubs || []).length > 3 && <i>+{p.clubs.length - 3}</i>}
        </span>
      )}
    </div>
  );
}
