import { useState } from "react";
import { imageUrlFor, initialsOf } from "./playerImage.js";
import { lookupDef } from "./gameData.js";
import { HINWEISE, HINWEIS_KOSTEN, VERSUCHE, hinweisText, belegText, spielerKey, kartenNamen } from "./gesucht.js";
import { MeldeLink } from "./ReportButton.jsx";
import Icon from "./Icons.jsx";

/* Gemeinsame Darstellung von „Der Gesuchte" für Solo, Tagesrätsel und Duell. */

/* Eine Karte: Foto hochkant, Nachname darunter. Gestrichen = grau mit Kreuz; falsch
   geraten = zusätzlich rot. */
function Karte({ player, name, gestrichen, falsch, richtig, modus, gesperrt, onClick }) {
  const [err, setErr] = useState(false);
  const url = imageUrlFor(player, 250);
  const klasse = ["gsKarte", gestrichen && "aus", falsch && "falsch", richtig && "richtig", modus === "raten" && !gestrichen && "ratbar"]
    .filter(Boolean).join(" ");
  return (
    <button type="button" className={klasse} disabled={gesperrt} onClick={onClick}
      aria-label={`${player.n} ${modus === "raten" ? "als Antwort wählen" : gestrichen ? "zurückholen" : "streichen"}`}>
      <span className="gsFoto">
        {url && !err ? <img src={url} alt="" onError={() => setErr(true)} /> : <span className="gsInitialen">{initialsOf(player)}</span>}
        {gestrichen && <span className="gsKreuz" aria-hidden="true"><Icon name="kreuz" size={30} /></span>}
        {richtig && <span className="gsHaken" aria-hidden="true"><Icon name="check" size={18} /></span>}
      </span>
      <span className="gsName">{name}</span>
    </button>
  );
}

/** Das Brett: 24 Karten. */
export function GsBrett({ spieler, gestrichen, falsch = new Set(), richtig = null, modus, gesperrt, onKarte }) {
  const namen = kartenNamen(spieler);
  return (
    <div className="gsBrett">
      {spieler.map((p, i) => {
        // Derselbe Schlüssel wie beim Raten und in der Datenbank (norm(name)|jahr).
        const k = spielerKey(p);
        return (
          <Karte key={k} player={p} name={namen[i]} gestrichen={gestrichen.has(k)} falsch={falsch.has(k)} richtig={richtig === k}
            modus={modus} gesperrt={gesperrt} onClick={() => onKarte(p, k)} />
        );
      })}
    </div>
  );
}

/* DIE HINWEISLEISTE BLEIBT OBEN STEHEN (sticky) und zeigt alle bisherigen Hinweise.
   Bei AnstoßQuiz scrollte der Hinweis beim Streichen der unteren Reihen weg, und ein
   übersprungener Hinweis war für immer verloren. */
export function GsHinweise({ hinweise, offen, nachKey, onWeiter, weiterText = null, kopf = null }) {
  const aktuell = hinweise[offen - 1];
  const frueher = hinweise.slice(0, offen - 1);
  return (
    <section className="gsLeiste">
      <div className="gsLeisteKopf">
        <span className="gsLeisteNr">Hinweis {offen} von {HINWEISE}</span>
        <span className="gsPunkte" aria-hidden="true">
          {hinweise.map((_, i) => <i key={i} className={i < offen ? "an" : ""} />)}
        </span>
        {kopf}
      </div>
      <p className="gsAktuell" key={offen}>{aktuell ? hinweisText(aktuell, nachKey) : ""}</p>
      {frueher.length > 0 && (
        <ol className="gsFrueher">
          {frueher.map((h, i) => <li key={i}><b>{i + 1}</b>{hinweisText(h, nachKey)}</li>)}
        </ol>
      )}
      {onWeiter && offen < HINWEISE && (
        <button type="button" className="gsWeiter" onClick={onWeiter}>
          {weiterText || <>Nächster Hinweis <small>−{HINWEIS_KOSTEN} Punkte</small></>} <Icon name="pfeil" size={15} />
        </button>
      )}
    </section>
  );
}

/** Untere Leiste: Streichen/Raten, Versuche, Sperre. */
export function GsSteuerung({ modus, setModus, versuche, sperreRest = 0, deaktiviert = false }) {
  return (
    <div className="gsSteuerung">
      <div className="gsUmschalter" role="tablist">
        <button type="button" role="tab" aria-selected={modus === "streichen"} className={modus === "streichen" ? "an" : ""}
          onClick={() => setModus("streichen")}>Streichen</button>
        <button type="button" role="tab" aria-selected={modus === "raten"} className={modus === "raten" ? "an" : ""}
          disabled={deaktiviert || sperreRest > 0} onClick={() => setModus("raten")}>
          {sperreRest > 0 ? `Pause ${sperreRest} s` : "Raten"}
        </button>
      </div>
      <span className="gsVersuche">
        {Array.from({ length: VERSUCHE }, (_, i) => <i key={i} className={i < versuche ? "an" : ""} />)}
        {versuche === 1 ? "1 Versuch" : `${versuche} Versuche`}
      </span>
    </div>
  );
}

/** „Ist es …?" — Bestätigen vor dem Raten. */
export function GsRateDialog({ player, onJa, onNein }) {
  const url = imageUrlFor(player, 250);
  return (
    <div className="overlay" onClick={onNein}>
      <div className="modal gsDialog" onClick={(e) => e.stopPropagation()}>
        <h2>Ist es {player.ln || player.n}?</h2>
        <p className="ruleP">Falsch kostet einen Versuch und eine kurze Pause.</p>
        {url && <img className="gsDialogFoto" src={url} alt="" />}
        <div className="closeline">
          <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={onJa}>Ja, er ist es</button>
          <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onNein}>Noch nicht</button>
        </div>
      </div>
    </div>
  );
}

/* Gegenstück zu einem „nie"-Hinweis über den Gesuchten — wer es besser weiß, meldet
   den fehlenden Verein, Titel oder die Nation direkt hier. */
function meldeDef(h) {
  if (h.ja) return null;
  if (h.art === "verein") return lookupDef("club", h.wert);
  if (h.art === "titel") return lookupDef("honour", h.wert);
  return null;
}

/** „Warum er?" — alle Hinweise mit Beleg. */
export function GsWarum({ ziel, hinweise, nachKey, mode, gameCode = null }) {
  return (
    <details className="gsWarum" open>
      <summary>Warum {ziel.n}?</summary>
      <ol>
        {hinweise.map((h, i) => {
          const def = meldeDef(h);
          return (
            <li key={i}>
              <b>{hinweisText(h, nachKey)}</b>
              <small>{belegText(h, ziel, nachKey)}</small>
              {def && <MeldeLink mode={mode} gameCode={gameCode} player={ziel} def={def} text="Stimmt nicht? Melden" />}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
