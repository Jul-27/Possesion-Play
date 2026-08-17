import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { suggestPlayers, lookupDef } from "./gameData.js";
import { loadPlayers } from "./playersStore.js";
import { loadCareerClubs } from "./careerClubsStore.js";
import { createCareerIndex } from "./careerIndex.js";
import { Emblem } from "./Emblems.jsx";
import { clubKeyOf, reportFehlt, bereitsBekannt, modeName } from "./reports.js";
import { submitReport } from "./reportClient.js";
import { play } from "./sound.js";

/* 🚩 „Fehler melden" — eine Komponente für alle zwölf Spielmodi.

   Steht als weiterer Knopf in der bestehenden .iconrow jedes Modus; die Modi geben
   nur ihren Schlüssel und (im Duell) den Spielcode mit. Nichts hier verändert
   players.js — gespeichert wird ausschließlich die Meldung.

   Spieler und Vereine kommen aus den vorhandenen Quellen: loadPlayers() plus
   suggestPlayers() für die Namen, createCareerIndex() für die Vereine. Der Index
   führt die 47 Spielvereine und die 8434 Karrierevereine zusammen und sortiert
   Vorschläge nach Bekanntheit — bei „inter" steht Inter Mailand vor Internacional.
   Beides wird ERST beim Öffnen des Dialogs geladen, damit kein Modus dafür zahlt,
   der nie eine Meldung sieht. */
export default function ReportButton({ mode, gameCode = null }) {
  const [offen, setOffen] = useState(false);
  return (
    <>
      <button className="iconbtn" title="Fehler melden" onClick={() => setOffen(true)}>🚩</button>
      {/* PORTAL, kein gewöhnliches Kind: der Knopf steht in .topbar, und die trägt die
          dropIn-Animation mit fill:both — sie behält dadurch einen transform und wird
          zum Bezugsrahmen für position:fixed. Das Overlay hätte dort nur die Kopfzeile
          verdeckt (343×127 px) statt den Bildschirm. Am <body> gilt wieder der
          Viewport, und der Dialog liegt über allem, egal aus welchem Modus er kommt. */}
      {offen && createPortal(
        <ReportModal mode={mode} gameCode={gameCode} onClose={() => setOffen(false)} />,
        document.body
      )}
    </>
  );
}

function ReportModal({ mode, gameCode, onClose }) {
  const [players, setPlayers] = useState(null);
  const [idx, setIdx] = useState(null);
  const [ladeFehler, setLadeFehler] = useState("");
  const [spielerQ, setSpielerQ] = useState("");
  const [spieler, setSpieler] = useState(null);
  const [vereinQ, setVereinQ] = useState("");
  const [verein, setVerein] = useState(null);
  const [status, setStatus] = useState("formular");   // formular | senden | ok | fehler
  const [fehler, setFehler] = useState("");
  const laeuft = useRef(false);
  const ersteEingabe = useRef(null);

  useEffect(() => {
    let aktiv = true;
    Promise.all([loadPlayers(), loadCareerClubs()])
      .then(([ps, cc]) => { if (!aktiv) return; setPlayers(ps); setIdx(createCareerIndex(ps, cc.clubs, cc.byKey)); })
      .catch(() => { if (aktiv) setLadeFehler("Die Spieler- und Vereinsdaten konnten nicht geladen werden."); });
    return () => { aktiv = false; };
  }, []);

  useEffect(() => { if (players) ersteEingabe.current?.focus(); }, [players]);

  // Escape schließt — außer während des Speicherns, sonst bliebe unklar, ob es ankam.
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !laeuft.current) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const spielerTreffer = useMemo(
    () => (players && spielerQ.trim().length >= 2 ? suggestPlayers(players, spielerQ, 8) : []),
    [players, spielerQ]
  );
  const vereinTreffer = useMemo(
    () => (idx && vereinQ.trim().length >= 2 ? idx.suggest(vereinQ, 8) : []),
    [idx, vereinQ]
  );

  const fehltNoch = reportFehlt(spieler, verein);
  const schonDrin = spieler && verein && bereitsBekannt(spieler, verein);

  async function senden() {
    if (laeuft.current || fehltNoch) return;      // Doppelklick läuft ins Leere
    laeuft.current = true;
    setStatus("senden"); setFehler("");
    try {
      await submitReport({ player: spieler, clubName: verein, mode, gameCode });
      setStatus("ok"); play("ok");
      setTimeout(onClose, 1900);
    } catch (e) {
      setFehler(e.message || "Unbekannter Fehler.");
      setStatus("fehler");
    } finally {
      laeuft.current = false;
    }
  }

  const schliessbar = status !== "senden";

  return (
    <div className="overlay" onClick={() => schliessbar && onClose()}>
      <div className="modal repModal" onClick={(e) => e.stopPropagation()}>
        <h2>Fehler melden</h2>

        {status === "ok" ? (
          <>
            <div className="fb ok" style={{ marginTop: 14 }}>✓ Fehler erfolgreich gemeldet. Danke!</div>
            <p className="ruleP">
              <b>{spieler.n}</b> → <b>{verein}</b> ist notiert. Die Zuordnung wird geprüft und mit dem
              nächsten Datenlauf ergänzt — dein laufendes Spiel bleibt unverändert.
            </p>
            <div className="closeline">
              <button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={onClose}>Schließen</button>
            </div>
          </>
        ) : (
          <>
            <p className="ruleP">
              Fehlt bei einem Spieler ein Verein, bei dem er wirklich gespielt hat? Melde das Paar.
              Es wird geprüft und mit dem nächsten Datenlauf ergänzt — nicht sofort übernommen.
            </p>

            {ladeFehler ? <div className="fb err">{ladeFehler}</div> : !players || !idx ? (
              <div className="qlogEmpty">Lade Spieler- und Vereinsdaten…</div>
            ) : (
              <>
                <Feld
                  label="Spieler"
                  inputRef={ersteEingabe}
                  placeholder="Name eingeben (ab 2 Buchstaben)…"
                  query={spielerQ}
                  gewaehlt={spieler?.n}
                  onQuery={(v) => { setSpielerQ(v); setSpieler(null); }}
                  onClear={() => { setSpieler(null); setSpielerQ(""); }}
                  treffer={spieler ? [] : spielerTreffer}
                  zeile={(p) => (
                    <>
                      <span>{p.n}</span>
                      <span className="sugMeta">{[p.pos, p.by].filter(Boolean).join(" · ")}</span>
                    </>
                  )}
                  onPick={(p) => { setSpieler(p); setSpielerQ(p.n); }}
                  schluessel={(p) => p.n + p.by}
                />

                <Feld
                  label="Verein"
                  placeholder="Verein eingeben (ab 2 Buchstaben)…"
                  query={vereinQ}
                  gewaehlt={verein}
                  onQuery={(v) => { setVereinQ(v); setVerein(null); }}
                  onClear={() => { setVerein(null); setVereinQ(""); }}
                  treffer={verein ? [] : vereinTreffer}
                  zeile={(name) => {
                    const key = clubKeyOf(name);
                    const def = key ? lookupDef("club", key) : null;
                    return (
                      <>
                        <span className="repClub">{def && <Emblem def={def} />}{name}</span>
                        {key && <span className="sugMeta">{key}</span>}
                      </>
                    );
                  }}
                  onPick={(name) => { setVerein(name); setVereinQ(name); }}
                  schluessel={(name) => name}
                />

                {schonDrin && (
                  <div className="fb info">
                    Diese Zuordnung kennt das Spiel bereits. Wenn ein Feld sie trotzdem nicht wertet,
                    liegt es an der Regel des Feldes, nicht an den Daten — melde sie trotzdem, wenn du
                    dir sicher bist.
                  </div>
                )}
                {status === "fehler" && <div className="fb err">Speichern fehlgeschlagen: {fehler}</div>}

                <div className="closeline">
                  <button className="btn ghost" style={{ flex: 1, padding: "12px" }}
                    disabled={!schliessbar} onClick={onClose}>Abbrechen</button>
                  <button className="btn primary" style={{ flex: 1, padding: "12px" }}
                    disabled={!!fehltNoch || status === "senden"} onClick={senden}>
                    {status === "senden" ? "Sende…" : "Senden"}
                  </button>
                </div>
                <p className="dataStamp" style={{ marginTop: 10 }}>
                  Gemeldet aus: {modeName(mode)}{gameCode ? ` · Spiel ${gameCode}` : ""}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* Ein Suchfeld mit Trefferliste. Die Liste läuft IM FLUSS statt als absolutes
   Dropdown wie sonst im Spiel: .modal hat overflow:hidden, ein überstehendes
   Dropdown würde am Rand des Fensters abgeschnitten. */
function Feld({ label, placeholder, query, gewaehlt, onQuery, onClear, treffer, zeile, onPick, schluessel, inputRef }) {
  return (
    <div className="repFeld">
      <label className="repLabel">{label}</label>
      <div className="inrow">
        <input ref={inputRef} className="field" placeholder={placeholder} value={query} autoComplete="off"
          onChange={(e) => onQuery(e.target.value)} />
        {gewaehlt && <button className="btn ghost repClear" title="Auswahl löschen" onClick={onClear}>✕</button>}
      </div>
      {gewaehlt ? (
        <div className="repGewaehlt">✓ {gewaehlt}</div>
      ) : treffer.length > 0 ? (
        <div className="repList">
          {treffer.map((t) => (
            <div key={schluessel(t)} className="sugItem" onClick={() => onPick(t)}>{zeile(t)}</div>
          ))}
        </div>
      ) : query.trim().length >= 2 ? (
        <div className="repLeer">Kein Treffer.</div>
      ) : null}
    </div>
  );
}
