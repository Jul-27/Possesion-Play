import { useState, useEffect, useMemo, useRef } from "react";
import {
  VERSUCHE, TIPP_AB, TAGES_SL_MIN, MEIDEN_TAGE, LIGA_NAME, flagge,
  pool, zielDesTages, kandidatenListe, vorschlaege, vergleiche, sichtbareKacheln,
  werte, kachelText, hinweisText, shareText, keyOf,
} from "./steckbrief.js";
import { dailyDateStr, dailyNumber, updateStreak } from "./dailyLogic.js";
import { loadSquads } from "./squadsStore.js";
import { imageUrlFor, hatFoto, COMMONS_WIDTH_GROSS } from "./playerImage.js";
import { play, isMuted, toggleMute } from "./sound.js";
import { merkeSpieler } from "./collection.js";
import Confetti from "./Confetti.jsx";
import DataStamp from "./DataStamp.jsx";
import ReportButton from "./ReportButton.jsx";
import GameTop from "./GameTop.jsx";
import Icon from "./Icons.jsx";

const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Persistenz weiterspielen */ } },
};

/* Das Foto wird mit jedem Versuch schärfer. Es ist der einzige Hinweis, der von
   selbst kommt — wer den Spieler am Gesicht erkennt, braucht die Kacheln nicht.
   Bei acht Versuchen bleibt bis zum vierten fast alles verwaschen; der Sprung
   passiert im letzten Drittel, sonst wäre das Rätsel nach zwei Fehlversuchen vorbei. */
const UNSCHAERFE = [26, 22, 18, 14, 10, 7, 4, 2];
const unschaerfeFuer = (n) => UNSCHAERFE[Math.min(n, UNSCHAERFE.length - 1)];

/* Der Foto-Schalter des freien Spiels. Nur ein Fünftel der Kaderspieler hat ein
   Bild — mit Foto wird der Topf also klein und prominenter besetzt, ohne Foto ist er
   vollständig. Beides ist ein anderes Spiel, deshalb ist es eine Wahl und keine
   Voreinstellung. */
function freiPool(spieler, clubs, ligen, nurFoto) {
  const p = pool(spieler, clubs, ligen);
  return nurFoto ? p.filter((i) => hatFoto(spieler[i])) : p;
}

/* Der Schlüssel pp:daily:<datum> ist derselbe wie beim abgelösten Daily-Star, damit
   Missionen, Serie und Abzeichen ohne Umzug weiterlaufen. Dessen Spielstände sahen
   aber anders aus (log war eine Liste von Frage-Objekten). Am Umstellungstag läge
   so ein Stand noch im Speicher und ergäbe eine fertige Partie ohne Zeilen —
   deshalb wird alles verworfen, was nicht die neue Form hat. */
function gespeichertesTagesspiel(key) {
  const leer = { log: [], done: false, won: false };
  let roh = null;
  try { const v = localStorage.getItem(key); roh = v ? JSON.parse(v) : null; } catch { return leer; }
  if (!roh || !Array.isArray(roh.log) || roh.log.some((e) => typeof e !== "string")) return leer;
  return roh;
}

export default function Steckbrief({ onLeave }) {
  const [daten, setDaten] = useState(undefined);      // undefined = lädt, null = Fehler
  const [art, setArt] = useState("tag");              // tag | frei
  const [ligen, setLigen] = useState([]);             // nur im freien Spiel; leer = alle
  const [nurFoto, setNurFoto] = useState(false);      // nur im freien Spiel
  const [freiSpiel, setFreiSpiel] = useState(null);   // { ziel, log, fertig, gewonnen, hinweis }
  const [eingabe, setEingabe] = useState("");
  const [sugOffen, setSugOffen] = useState(false);
  const [sugAktiv, setSugAktiv] = useState(-1);
  const [meldung, setMeldung] = useState(null);
  const [hinweisOffen, setHinweisOffen] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const [regeln, setRegeln] = useState(false);
  const [muted, setMuted] = useState(isMuted());
  const [jetzt, setJetzt] = useState(Date.now());
  const feldRef = useRef(null);

  const datum = useMemo(() => dailyDateStr(), []);
  const nummer = useMemo(() => dailyNumber(datum), [datum]);
  const speicherKey = `pp:daily:${datum}`;
  const [tagSpiel, setTagSpiel] = useState(() => gespeichertesTagesspiel(speicherKey));

  useEffect(() => { loadSquads().then((d) => setDaten(d)); }, []);
  useEffect(() => { const id = setInterval(() => setJetzt(Date.now()), 30000); return () => clearInterval(id); }, []);

  const spieler = daten?.spieler || [];
  const indexVon = useMemo(() => {
    const m = new Map();
    spieler.forEach((s, i) => m.set(keyOf(s), i));
    return m;
  }, [spieler]);

  /* Zwei Töpfe. Der Tagestopf ist enger: nur Spieler mit Foto (sonst liefe die
     Enthüllung ins Leere) und erst ab einer gewissen Bekanntheit — ein dritter
     Torwart aus Paderborn wäre kein Rätsel, sondern ein Losspiel. */
  const tagKandidaten = useMemo(() => (
    daten ? pool(spieler, daten.clubs, [], TAGES_SL_MIN).filter((i) => hatFoto(spieler[i])) : []
  ), [daten, spieler]);
  const freiKandidaten = useMemo(() => (
    daten ? freiPool(spieler, daten.clubs, ligen, nurFoto) : []
  ), [daten, spieler, ligen, nurFoto]);

  const kandidaten = art === "tag" ? tagKandidaten : freiKandidaten;
  const mehrere = art === "tag" || ligen.length !== 1;
  const ctx = useMemo(() => ({
    clubs: daten?.clubs || [], nationen: daten?.nationen || [], stichtag: datum, mehrere,
  }), [daten, datum, mehrere]);

  /* Das Tagesziel steht im Spielstand, wird aber neu berechnet, falls es fehlt oder
     der Spieler inzwischen aus dem Kader gefallen ist. Beides ist nötig: ohne
     Speichern verschöbe ein Datenlauf mitten am Tag die Lösung, ohne Neuberechnung
     bliebe der Spielstand bei einem Spieler hängen, den es nicht mehr gibt. */
  const tagZiel = useMemo(() => {
    if (!daten || !tagKandidaten.length) return -1;
    const gemerkt = tagSpiel.ziel != null ? indexVon.get(tagSpiel.ziel) : undefined;
    if (gemerkt != null) return gemerkt;
    return zielDesTages(datum, spieler, tagKandidaten, MEIDEN_TAGE);
  }, [daten, tagKandidaten, tagSpiel.ziel, indexVon, datum, spieler]);

  const spiel = art === "tag"
    ? { ziel: tagZiel, log: tagSpiel.log || [], fertig: !!tagSpiel.done, gewonnen: !!tagSpiel.won, hinweis: tagSpiel.hinweis || null }
    : freiSpiel;

  const logIdx = useMemo(
    () => (spiel?.log || []).map((k) => indexVon.get(k)).filter((i) => i != null),
    [spiel, indexVon],
  );
  const ziel = spiel && spiel.ziel >= 0 ? spieler[spiel.ziel] : null;
  const zeilen = useMemo(
    () => (ziel ? logIdx.map((i) => vergleiche(spieler[i], ziel, ctx)) : []),
    [logIdx, ziel, ctx, spieler],
  );
  const liste = useMemo(() => kandidatenListe(spieler, kandidaten), [spieler, kandidaten]);
  const treffer = useMemo(() => vorschlaege(liste, eingabe, logIdx), [liste, eingabe, logIdx]);

  const uebrig = VERSUCHE - logIdx.length;
  const darfTippen = !!spiel && !spiel.fertig && uebrig > 0;
  const hinweisFrei = !!spiel && !spiel.fertig && logIdx.length >= TIPP_AB && !spiel.hinweis;

  // Countdown bis lokale Mitternacht — nur im Tagesrätsel sinnvoll.
  const mitternacht = new Date(); mitternacht.setHours(24, 0, 0, 0);
  const minuten = Math.max(0, Math.floor((mitternacht.getTime() - jetzt) / 60000));
  const countdown = `${Math.floor(minuten / 60)} h ${minuten % 60} min`;

  function sichern(next) {
    if (art === "tag") {
      if (next.fertig && !tagSpiel.done) {
        store.set("pp:dailyStats", updateStreak(store.get("pp:dailyStats"), datum, next.gewonnen));
      }
      const roh = { ziel: spieler[next.ziel] ? keyOf(spieler[next.ziel]) : null, log: next.log, done: next.fertig, won: next.gewonnen, hinweis: next.hinweis };
      setTagSpiel(roh);
      store.set(speicherKey, roh);
    } else {
      setFreiSpiel(next);
    }
  }

  function neuesFreiesSpiel(neueLigen = ligen, neuesFoto = nurFoto) {
    const k = freiPool(spieler, daten?.clubs || [], neueLigen, neuesFoto);
    if (!k.length) { setMeldung({ type: "err", text: "Für diese Auswahl gibt es keine Spieler." }); return; }
    setLigen(neueLigen); setNurFoto(neuesFoto);
    setFreiSpiel({ ziel: k[Math.floor(Math.random() * k.length)], log: [], fertig: false, gewonnen: false, hinweis: null });
    setEingabe(""); setMeldung(null); setHinweisOffen(false);
  }

  function wechsle(neueArt) {
    if (neueArt === art || !daten) return;
    setArt(neueArt); setEingabe(""); setMeldung(null); setHinweisOffen(false);
    if (neueArt === "frei" && !freiSpiel) neuesFreiesSpiel([]);
  }

  function raten(i) {
    if (!darfTippen || i == null || !ziel) return;
    setEingabe(""); setSugOffen(false); setSugAktiv(-1); setMeldung(null);
    const log = [...spiel.log, keyOf(spieler[i])];
    if (i === spiel.ziel) {
      merkeSpieler(spieler[i]);
      play("win");
      sichern({ ...spiel, log, fertig: true, gewonnen: true });
      return;
    }
    const aus = log.length >= VERSUCHE;
    play(aus ? "lose" : "err");
    sichern({ ...spiel, log, fertig: aus, gewonnen: false });
  }

  function aufgeben() {
    if (!spiel || spiel.fertig) return;
    play("lose");
    sichern({ ...spiel, fertig: true, gewonnen: false });
  }

  function hinweisWaehlen(key) {
    if (!hinweisFrei) return;
    play("click");
    setHinweisOffen(false);
    sichern({ ...spiel, hinweis: key });
  }

  function teilen() {
    const url = `${window.location.origin}${window.location.pathname}?daily=1`;
    const text = shareText(nummer, zeilen, spiel.gewonnen, url, !!spiel.hinweis);
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard?.writeText(text).then(() => { setKopiert(true); setTimeout(() => setKopiert(false), 1500); });
  }

  function waehle(i) { raten(i); }
  function taste(e) {
    if (sugOffen && treffer.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSugAktiv((n) => Math.min(n + 1, treffer.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSugAktiv((n) => Math.max(n - 1, 0)); return; }
      if (e.key === "Escape") { setSugOffen(false); return; }
      if (e.key === "Enter") { e.preventDefault(); waehle(treffer[Math.max(0, sugAktiv)]); return; }
    }
    if (e.key === "Enter" && treffer.length === 1) waehle(treffer[0]);
  }

  const kacheln = sichtbareKacheln(ctx);
  // Spielername, dann je Kachel eine Spalte — der Verein breiter als der Rest.
  const raster = {
    "--raster": `minmax(58px, 1.05fr) ${kacheln.map((k) => (k.key === "club" ? "1.6fr" : "0.94fr")).join(" ")}`,
  };
  const stats = store.get("pp:dailyStats");
  const fotoUrl = ziel ? imageUrlFor(ziel, COMMONS_WIDTH_GROSS) : null;
  const zeigFoto = (art === "tag" || nurFoto) && fotoUrl;

  return (
    <div className="ppRoot">
      <GameTop icon="guess" name="Steckbrief" ton="#38BDF8" zusatz={art === "tag" ? <>#{nummer}</> : "frei"}>
        <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}><Icon name={muted ? "mute" : "sound"} size={18} /></button>
        <button className="iconbtn" title="Regeln" onClick={() => setRegeln(true)}><Icon name="help" size={18} /></button>
        <ReportButton mode="steckbrief" />
        <button className="iconbtn" title="Zur Lobby" onClick={onLeave}><Icon name="leave" size={18} /></button>
      </GameTop>

      <div className="sbArt">
        <button className={`chip ${art === "tag" ? "on" : ""}`} disabled={!daten} onClick={() => wechsle("tag")}>Rätsel des Tages</button>
        <button className={`chip ${art === "frei" ? "on" : ""}`} disabled={!daten} onClick={() => wechsle("frei")}>Freies Spiel</button>
      </div>

      {art === "frei" && (
        <div className="chiprow sbLigen">
          <button className={`chip ${ligen.length === 0 ? "on" : ""}`} onClick={() => neuesFreiesSpiel([])}>Alle Ligen</button>
          {Object.entries(LIGA_NAME).map(([code, name]) => (
            <button key={code} className={`chip ${ligen[0] === code ? "on" : ""}`} onClick={() => neuesFreiesSpiel([code])}>{name}</button>
          ))}
          <button className={`chip ${nurFoto ? "on" : ""}`} title="Nur Spieler, von denen ein Foto vorliegt"
            onClick={() => neuesFreiesSpiel(ligen, !nurFoto)}>Mit Foto</button>
        </div>
      )}

      {daten === undefined && <div className="qlogEmpty">Lade Kaderdaten…</div>}
      {daten === null && <div className="fb err">Die Kaderdaten konnten nicht geladen werden. Bitte die Seite neu laden.</div>}

      {daten && !ziel && (
        <div className="qlogEmpty">{kandidaten.length ? "Wähle ein Rätsel." : "Für diese Auswahl gibt es keine Spieler."}</div>
      )}

      {daten && ziel && (
        <>
          {zeigFoto && (
            <div className="sbFoto">
              <div className="sbFotoRahmen">
                <img src={fotoUrl} alt="" style={{ filter: `blur(${spiel.fertig ? 0 : unschaerfeFuer(logIdx.length)}px)` }} />
              </div>
              {!spiel.fertig && <span className="sbFotoHint">wird mit jedem Versuch schärfer</span>}
            </div>
          )}

          <div className="sbZaehler">
            <span className={`dailyCount ${uebrig <= 2 ? "spent" : ""}`}>Versuche {logIdx.length}/{VERSUCHE}</span>
            <span className="dailyCount">{kandidaten.length} Kandidaten</span>
            {spiel.hinweis && <span className="dailyCount sbHinweis">💡 {hinweisText(spiel.hinweis, ziel, ctx)}</span>}
          </div>

          <div className="sbTabelle">
            {/* Kopfzeile erst, wenn es etwas zu beschriften gibt. */}
            {zeilen.length > 0 && (
              <div className="sbKopf" style={raster}>
                <span className="sbName">Spieler</span>
                {kacheln.map((k) => <span key={k.key}>{k.kurz}</span>)}
              </div>
            )}
            {zeilen.length === 0 && <div className="qlogEmpty">Nenne einen Spieler. Jede Kachel verrät, was er mit dem Gesuchten teilt.</div>}
            {zeilen.map((zeile, r) => (
              <div key={r} className="sbZeile" style={raster}>
                <span className="sbName">{spieler[logIdx[r]]?.n}</span>
                {zeile.map((z) => (
                  <span key={z.key} className={`sbKachel ${z.stand}`} title={z.text}>
                    {z.key === "na" ? <>{flagge(nationIso(ctx, spieler[logIdx[r]]))} {z.text}</>
                      : z.key === "po" ? z.wert || "?"      // in der Tabelle das Kürzel, nicht „Mittelfeld"
                        : z.text}
                    {z.pfeil && <i className={`sbPfeil ${z.pfeil}`}>{z.pfeil === "hoch" ? "▲" : "▼"}</i>}
                  </span>
                ))}
              </div>
            ))}
          </div>

          {!spiel.fertig && (
            <div className="panel">
              <div className="inrow">
                <div className="inwrap">
                  <input ref={feldRef} className="field" placeholder="Spieler aus dem Pool nennen…"
                    value={eingabe} autoComplete="off"
                    onChange={(e) => { setEingabe(e.target.value); setSugOffen(true); setSugAktiv(-1); setMeldung(null); }}
                    onKeyDown={taste} onFocus={() => setSugOffen(true)}
                    onBlur={() => setTimeout(() => setSugOffen(false), 120)} />
                  {sugOffen && treffer.length > 0 && (
                    <div className="sug">
                      {treffer.map((i, n) => (
                        <div key={i} className={`sugItem ${n === sugAktiv ? "active" : ""}`}
                          onMouseDown={(e) => { e.preventDefault(); waehle(i); }}>
                          <span className="sugWho">{spieler[i].n}</span>
                          <span className="sugMeta">{ctx.clubs[spieler[i].c]?.[1]}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {meldung && <div className={`fb ${meldung.type}`}>{meldung.text}</div>}
              <div className="minirow sbAktionen">
                {hinweisFrei && <button className="btn ghost" onClick={() => setHinweisOffen((v) => !v)}>💡 Hinweis</button>}
                {!spiel.hinweis && !hinweisFrei && <span className="sbSperre">Hinweis ab {TIPP_AB} Versuchen</span>}
                <button className="btn ghost" onClick={aufgeben}>Auflösen</button>
              </div>
              {hinweisOffen && (
                <div className="chiprow sbHinweisWahl">
                  {kacheln.map((k) => <button key={k.key} className="chip" onClick={() => hinweisWaehlen(k.key)}>{k.name}</button>)}
                </div>
              )}
            </div>
          )}

          {spiel.fertig && (
            <div className="panel dailyEnd">
              {spiel.gewonnen && <Confetti />}
              <h2 style={{ marginTop: 0 }}>{spiel.gewonnen ? "✓ Erkannt!" : "✗ Nicht erkannt"}</h2>
              <div className="sbLoesung">
                {fotoUrl && <img src={fotoUrl} alt="" />}
                <div>
                  <b>{ziel.n}</b>
                  <p className="sbLoesungMeta">
                    {[ctx.clubs[ziel.c]?.[0], kachelText("po", ziel.po),
                      `${werte(ziel, ctx).alter} Jahre`, `Nr. ${ziel.nr}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>

              {art === "tag" && stats && (
                <div className="dailyStats">
                  <span><b>{stats.played}</b> gespielt</span>
                  <span><b>{Math.round((stats.wins / Math.max(1, stats.played)) * 100)}%</b> gewonnen</span>
                  <span><b>{stats.streak}</b> Serie</span>
                  <span><b>{stats.maxStreak}</b> Rekord</span>
                </div>
              )}

              <div className="closeline">
                {art === "tag" ? (
                  <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={teilen}>{kopiert ? "Kopiert ✓" : "Ergebnis teilen"}</button>
                ) : (
                  <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={() => neuesFreiesSpiel()}>Nächstes Rätsel</button>
                )}
                <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Zur Lobby</button>
              </div>
              {art === "tag" && <p className="dailyNext">Nächster Steckbrief in {countdown}</p>}
            </div>
          )}
        </>
      )}

      {regeln && (
        <div className="overlay" onClick={() => setRegeln(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Steckbrief</h2>
            <p className="ruleP">Gesucht ist ein Spieler aus den <b>aktuellen Kadern</b>. Du hast <b>{VERSUCHE} Versuche</b>, und jeder Versuch ist selbst ein Spieler.</p>
            <p className="ruleP">Nach jedem Versuch färben sich die Kacheln: <b className="sbLegende treffer">grün</b> heißt „stimmt überein", <b className="sbLegende daneben">grau</b> heißt „stimmt nicht".</p>
            <p className="ruleP">Bei <b>Alter</b> und <b>Nummer</b> zeigt ein Pfeil zum Gesuchten: ▲ höher, ▼ niedriger.</p>
            <p className="ruleP">Geraten wird nur aus dem gewählten Pool — im Tagesrätsel aus allen Ligen, im freien Spiel aus der Liga deiner Wahl.</p>
            <p className="ruleP">Ab <b>{TIPP_AB} Versuchen</b> darfst du eine Kachel des Gesuchten aufdecken. Das Foto wird ohnehin mit jedem Versuch schärfer.</p>
            <DataStamp />
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setRegeln(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

const nationIso = (ctx, s) => (s?.na >= 0 ? ctx.nationen[s.na]?.[0] : null);
