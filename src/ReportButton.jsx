import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { suggestPlayers, lookupDef, norm } from "./gameData.js";
import { loadPlayers } from "./playersStore.js";
import { loadCareerClubs } from "./careerClubsStore.js";
import { createCareerIndex } from "./careerIndex.js";
import { Emblem } from "./Emblems.jsx";
import { clubKeyOf, reportFehlt, bereitsBekannt, modeName, REPORT_KINDS, zieleFuer, vorbelegungAus, kontextAus } from "./reports.js";
import { submitReport } from "./reportClient.js";
import { play } from "./sound.js";
import Icon from "./Icons.jsx";

/* 🚩 „Fehler melden" — eine Komponente für alle Spielmodi. Drei Meldearten (Verein,
   Titel, Nation); aus einem abgelehnten Zug öffnet MeldeLink den Dialog vorbelegt.

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
      <button className="iconbtn" title="Fehler melden" onClick={() => setOffen(true)}><Icon name="flag" size={18} /></button>
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

/* „Stimmt doch? Melden" — steht unter einer Ablehnung und öffnet den Dialog mit
   Spieler, Art und Ziel aus dem abgelehnten Feld. Mitgeschickt wird das Feld, damit
   sich der Zug später nachvollziehen lässt. Für Liga- und Sonderfelder gibt es
   nichts zu melden (vorbelegungAus → null), dann erscheint kein Link. */
export function MeldeLink({ mode, gameCode = null, player, def }) {
  const [offen, setOffen] = useState(false);
  const v = vorbelegungAus(def);
  if (!v || !player) return null;
  return (
    <>
      <button type="button" className="meldeLink" onClick={() => setOffen(true)}>
        <Icon name="flag" size={13} /> Stimmt doch? Melden
      </button>
      {offen && createPortal(
        <ReportModal mode={mode} gameCode={gameCode} onClose={() => setOffen(false)}
          vorbelegung={{ player, ...v, kontext: kontextAus(def) }} />,
        document.body
      )}
    </>
  );
}

function ReportModal({ mode, gameCode, onClose, vorbelegung = null }) {
  const [players, setPlayers] = useState(null);
  const [idx, setIdx] = useState(null);
  const [ladeFehler, setLadeFehler] = useState("");
  const [kind, setKind] = useState(vorbelegung?.kind || "verein");
  const [spielerQ, setSpielerQ] = useState(vorbelegung?.player?.n || "");
  const [spieler, setSpieler] = useState(vorbelegung?.player || null);
  const [vereinQ, setVereinQ] = useState(
    typeof vorbelegung?.ziel === "string" ? vorbelegung.ziel : vorbelegung?.ziel?.name || "");
  /* Das Ziel: bei Vereinen der Name, bei Titeln und Nationen { key, name }. */
  const [verein, setVerein] = useState(vorbelegung?.ziel || null);
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
  const vereinTreffer = useMemo(() => {
    if (kind !== "verein") {
      const q = norm(vereinQ.trim());
      return zieleFuer(kind).filter((z) => !q || norm(z.name).includes(q) || norm(z.key).startsWith(q));
    }
    return idx && vereinQ.trim().length >= 2 ? idx.suggest(vereinQ, 8) : [];
  }, [idx, vereinQ, kind]);

  const zielName = kind === "verein" ? verein : verein?.name;
  const fehltNoch = reportFehlt(spieler, verein, kind);
  const schonDrin = spieler && verein && bereitsBekannt(spieler, verein, kind);

  function artWechseln(k) {
    if (k === kind) return;
    setKind(k); setVerein(null); setVereinQ("");
  }

  async function senden() {
    if (laeuft.current || fehltNoch) return;      // Doppelklick läuft ins Leere
    laeuft.current = true;
    setStatus("senden"); setFehler("");
    try {
      /* Der Zusammenhang gilt nur, solange die Meldung zum abgelehnten Feld passt —
         wer die Art wechselt, meldet etwas anderes. */
      const kontext = vorbelegung && kind === vorbelegung.kind ? vorbelegung.kontext : null;
      await submitReport({ player: spieler, kind, ziel: verein, kontext, mode, gameCode });
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
              <b>{spieler.n}</b> → <b>{zielName}</b> ist notiert. Die Angabe wird geprüft und mit dem
              nächsten Datenlauf ergänzt — dein laufendes Spiel bleibt unverändert.
            </p>
            <div className="closeline">
              <button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={onClose}>Schließen</button>
            </div>
          </>
        ) : (
          <>
            <div className="repArten" role="group" aria-label="Was fehlt?">
              {Object.entries(REPORT_KINDS).map(([k, v]) => (
                <button key={k} type="button" className={"chip" + (kind === k ? " on" : "")}
                  disabled={status === "senden"} onClick={() => artWechseln(k)}>{v.name}</button>
              ))}
            </div>
            <p className="ruleP">
              {REPORT_KINDS[kind].frage} Melde es — es wird geprüft und mit dem nächsten
              Datenlauf ergänzt, nicht sofort übernommen.
            </p>
            {vorbelegung?.kontext && kind === vorbelegung.kind && (
              <div className="fb info">Aus dem abgelehnten Zug: Feld „{vorbelegung.kontext.feldName}“.</div>
            )}

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

                {kind === "verein" ? (
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
                ) : (
                  <Feld
                    key={kind}
                    label={REPORT_KINDS[kind].name}
                    placeholder={kind === "titel" ? "Titel suchen…" : "Nation suchen…"}
                    query={vereinQ}
                    gewaehlt={verein?.name}
                    onQuery={(v) => { setVereinQ(v); setVerein(null); }}
                    onClear={() => { setVerein(null); setVereinQ(""); }}
                    treffer={verein ? [] : vereinTreffer}
                    immer
                    zeile={(z) => {
                      const def = lookupDef(kind === "titel" ? "honour" : "nat", z.key);
                      return (
                        <>
                          <span className="repClub">{def && <Emblem def={def} />}{z.name}</span>
                          <span className="sugMeta">{z.key}</span>
                        </>
                      );
                    }}
                    onPick={(z) => { setVerein(z); setVereinQ(z.name); }}
                    schluessel={(z) => z.key}
                  />
                )}

                {schonDrin && (
                  <div className="fb info">
                    Diese Angabe kennt das Spiel bereits. Wenn ein Feld sie trotzdem nicht wertet,
                    liegt es an der Regel des Feldes oder an einem zweiten Datensatz desselben
                    Spielers — melde sie trotzdem, wenn du dir sicher bist.
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
function Feld({ label, placeholder, query, gewaehlt, onQuery, onClear, treffer, zeile, onPick, schluessel, inputRef, immer = false }) {
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
      ) : query.trim().length >= 2 || (immer && query.trim()) ? (
        <div className="repLeer">Kein Treffer.</div>
      ) : null}
    </div>
  );
}
