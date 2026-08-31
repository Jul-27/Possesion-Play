import { useState, useEffect, useMemo } from "react";
import { CLUBS, POS_LABEL } from "./gameData.js";
import { posName, positionsText, POS_BY_KEY } from "./positions.js";
import { FORMATIONS, slotLayout } from "./eleven.js";
import {
  baueZiehungen, baueKlassen, baueVerbundNetz, bewerte, obergrenze, bilanz, abzeichenFuer,
  zieh, bedientSlots, darfAufPosition, passung,
  RESPINS, SPIELE, LIGA_NAME, PASSUNG_GENAU,
} from "./draft.js";
import { loadPlayers } from "./playersStore.js";
import { Avatar } from "./Emblems.jsx";
import Pitch, { Jersey } from "./Pitch.jsx";
import { play, isMuted, toggleMute } from "./sound.js";
import { merkeSpieler } from "./collection.js";
import Confetti from "./Confetti.jsx";
import DataStamp from "./DataStamp.jsx";
import ShareButton from "./ShareButton.jsx";
import { shareTraumelf } from "./share.js";
import ReportButton from "./ReportButton.jsx";
import GameTop from "./GameTop.jsx";
import Icon from "./Icons.jsx";

const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Speicherstand weiter */ } },
};

const LIGEN = ["BL", "PL", "LL"];
const BESTEN_KEY = "pp:traumelf:best";

/* Der laufende Draft wird NICHT gespeichert. Spielerindizes verschieben sich mit
   jedem Datenlauf, und eine Partie dauert zwei Minuten — ein halb gespeicherter
   Draft, der nach einem Deploy plötzlich andere Spieler enthält, wäre schlimmer als
   ein verlorener. Gespeichert wird nur das beste Ergebnis je Liga. */

export default function Traumelf({ onLeave }) {
  const [players, setPlayers] = useState(null);
  const [liga, setLiga] = useState(null);
  const [formation, setFormation] = useState(null);
  const [belegt, setBelegt] = useState([]);          // Spielerindex je Slot
  const [ziehung, setZiehung] = useState(null);
  const [gezogen, setGezogen] = useState([]);        // schon gesehene Verein-Saison-Paare
  const [respins, setRespins] = useState(RESPINS);
  const [verlauf, setVerlauf] = useState([]);        // je Runde: was lag an, was wurde genommen
  const [wahl, setWahl] = useState(null);            // Spieler, für den noch der Platz fehlt
  const [muted, setMuted] = useState(isMuted());
  const [regeln, setRegeln] = useState(false);
  const [best, setBest] = useState(() => store.get(BESTEN_KEY) || {});

  useEffect(() => { loadPlayers().then(setPlayers); }, []);

  /* Ziehungen, Klassen und Netz hängen nur an der Liga — einmal bauen, nicht je Spin.
     Gemessen: 74 bis 180 ms je Liga. */
  const daten = useMemo(() => {
    if (!players || !liga) return null;
    const ziehungen = baueZiehungen(players, CLUBS, liga);
    return { ziehungen, klassen: baueKlassen(players, ziehungen), netz: baueVerbundNetz(players, ziehungen) };
  }, [players, liga]);

  const slots = useMemo(() => (formation ? slotLayout(formation) : []), [formation]);
  const posListe = useMemo(() => slots.map((s) => s.pos), [slots]);
  const obergr = useMemo(
    () => (daten && posListe.length ? obergrenze(posListe, players, daten.klassen) : 0),
    [daten, posListe, players],
  );

  const runde = belegt.filter((i) => i != null).length;
  const fertig = slots.length > 0 && runde === slots.length;

  const wertung = useMemo(
    () => (fertig && daten ? bewerte(belegt, posListe, players, daten.klassen, daten.netz) : null),
    [fertig, belegt, posListe, players, daten],
  );
  const b = useMemo(
    () => (wertung ? bilanz(wertung.wertung, SPIELE[liga], obergr) : null),
    [wertung, liga, obergr],
  );
  const abzeichen = b ? abzeichenFuer(b) : null;

  /* Bestleistung je Liga festhalten, sobald eine Saison durchgespielt ist. */
  useEffect(() => {
    if (!b || !abzeichen) return;
    const alt = best[liga];
    if (alt && alt.punkte >= b.punkte) return;
    const neu = { ...best, [liga]: { punkte: b.punkte, abzeichen: abzeichen.name, formation: formation.name } };
    setBest(neu);
    store.set(BESTEN_KEY, neu);
  }, [b, abzeichen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Spin ───────────────────────────────────────────────────────────────────
     Gezogen wird so lange, bis ein Kader wirklich eine offene Stelle bedienen kann.
     Ohne diese Schleife wäre jeder zweite Spin verschenkt: Ein Kader ohne Torwart
     nützt nichts mehr, wenn nur noch das Tor frei ist. */
  function spin(stand = belegt, gesehen = gezogen, saat = Math.random()) {
    if (!daten) return;
    let neu = [...gesehen];
    for (let versuch = 0; versuch < 400; versuch++) {
      const kandidat = zieh(daten.ziehungen, `${liga}#${saat}#${versuch}`, neu);
      if (bedientSlots(kandidat, players, posListe, stand)) {
        setGezogen([...neu, `${kandidat.key}|${kandidat.jahr}`]);
        setZiehung(kandidat);
        setWahl(null);
        play("click");
        return;
      }
      neu.push(`${kandidat.key}|${kandidat.jahr}`);
    }
    /* Unerreichbar, solange baueZiehungen alle vier Gruppen verlangt — aber lieber
       eine ehrliche Meldung als ein stummer Stillstand. */
    setZiehung(null);
  }

  function starte(f) {
    const leer = slotLayout(f).map(() => null);
    setFormation(f);
    setBelegt(leer);
    setGezogen([]);
    setRespins(RESPINS);
    setVerlauf([]);
    setWahl(null);
    /* Der erste Spin muss die frische Formation nutzen, nicht die aus dem State —
       der ist in diesem Durchlauf noch der alte. */
    const posNeu = slotLayout(f).map((s) => s.pos);
    if (!daten) return;
    for (let versuch = 0; versuch < 400; versuch++) {
      const k = zieh(daten.ziehungen, `${liga}#start#${Math.random()}#${versuch}`, []);
      if (bedientSlots(k, players, posNeu, leer)) { setZiehung(k); setGezogen([`${k.key}|${k.jahr}`]); return; }
    }
  }

  /* Welche offenen Plätze kann dieser Spieler übernehmen? */
  const plaetzeFuer = (i) =>
    slots.map((s, k) => k).filter((k) => belegt[k] == null && darfAufPosition(players[i], posListe[k]));

  function stelleAuf(i, k) {
    const naechster = [...belegt];
    naechster[k] = i;
    setBelegt(naechster);
    setVerlauf([...verlauf, { ziehung, gewaehlt: i, slot: k }]);
    setWahl(null);
    merkeSpieler(players[i]);
    play("ok");
    if (naechster.some((x) => x == null)) spin(naechster);
    else setZiehung(null);
  }

  function waehle(i) {
    const moeglich = plaetzeFuer(i);
    if (moeglich.length === 1) stelleAuf(i, moeglich[0]);
    else setWahl({ i, plaetze: moeglich });
  }

  function respin() {
    if (respins <= 0) return;
    setRespins(respins - 1);
    spin();
  }

  /* Der Kader der laufenden Ziehung, nach Klasse sortiert und um die reduziert, die
     nirgends mehr hinpassen — sie anzuzeigen hieße, elf Namen zur Wahl zu stellen,
     von denen neun nicht wählbar sind. */
  const kader = useMemo(() => {
    if (!ziehung || !daten) return [];
    return ziehung.spieler
      .filter((i) => !belegt.includes(i) && plaetzeFuer(i).length > 0)
      .sort((a, c) => (daten.klassen.get(c) || 0) - (daten.klassen.get(a) || 0));
  }, [ziehung, daten, belegt]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Nachbetrachtung ────────────────────────────────────────────────────────
     Für jede Runde: Wer aus DEMSELBEN Kader hätte auf DERSELBEN Position mehr
     gebracht? Gerechnet wird die fertige Elf einmal neu, mit dem anderen Spieler
     darin — die ECHTE Wertung, nicht eine Näherung.

     Eine erste Fassung schätzte stattdessen: Klasse geteilt durch elf plus ein Punkt
     je Mitspieler. Damit schlug sie allen Ernstes Iheanacho statt Haaland vor, weil
     drei zusätzliche Paare schwerer wogen als zwanzig Klassenpunkte — während der
     Verbund in der echten Wertung bei neun gedeckelt ist und ab etwa zwölf Paaren
     gar nichts mehr bringt. Wer eine Lehre anbietet, muss das messen, was er
     behauptet. */
  const nachbetrachtung = useMemo(() => {
    if (!fertig || !daten) return [];
    const jetzt = wertung.wertung;
    return verlauf.map(({ ziehung: z, gewaehlt, slot }) => {
      let beste = { i: gewaehlt, wertung: jetzt };
      for (const i of z.spieler) {
        if (i === gewaehlt || belegt.includes(i)) continue;
        if (!darfAufPosition(players[i], posListe[slot])) continue;
        const anders = [...belegt];
        anders[slot] = i;
        const w = bewerte(anders, posListe, players, daten.klassen, daten.netz).wertung;
        if (w > beste.wertung) beste = { i, wertung: w };
      }
      return { z, gewaehlt, slot, beste, plus: Math.round((beste.wertung - jetzt) * 10) / 10 };
    }).filter((r) => r.beste.i !== r.gewaehlt).sort((a, c) => c.plus - a.plus);
  }, [fertig, verlauf, belegt, daten, wertung]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxLine = formation ? Math.max(...formation.lines.map((l) => l.length)) : 4;

  // ── Ansicht ────────────────────────────────────────────────────────────────

  const kopf = (
    <GameTop icon="crown" name="Traumelf" ton="#FBBF24" zusatz={liga ? <>{LIGA_NAME[liga]}</> : null}>
      <button className="iconbtn" title="Ton an/aus" onClick={() => setMuted(toggleMute())}><Icon name={muted ? "mute" : "sound"} size={18} /></button>
      <button className="iconbtn" title="Regeln" onClick={() => setRegeln(true)}><Icon name="help" size={18} /></button>
      <ReportButton mode="traumelf" />
      <button className="iconbtn" title="Zur Lobby" onClick={onLeave}><Icon name="leave" size={18} /></button>
    </GameTop>
  );

  if (!players) return <div className="ppRoot">{kopf}<div className="qlogEmpty">Lade Spielerdaten…</div></div>;

  // Schritt 1: Liga
  if (!liga) {
    return (
      <div className="ppRoot">
        {kopf}
        <div className="panel">
          <div className="prompt">In welcher Liga soll deine Elf antreten?</div>
          <div className="tmLigen">
            {LIGEN.map((l) => (
              <button key={l} className="tmLiga" onClick={() => { setLiga(l); play("click"); }}>
                <b>{LIGA_NAME[l]}</b>
                <span>{SPIELE[l]} Spieltage</span>
                {best[l] && <span className="tmBest">Bestwert {best[l].punkte} · {best[l].abzeichen}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Schritt 2: Formation
  if (!formation) {
    return (
      <div className="ppRoot">
        {kopf}
        <div className="panel">
          <div className="prompt">Welche Formation spielst du?</div>
          <p className="ruleP">Die Formation legt fest, welche elf Positionen du besetzen musst — und wie leicht du sie füllst. Torhüter gibt es in jedem Kader, echte Außenstürmer nicht.</p>
          {!daten ? <div className="qlogEmpty">Baue die Ziehungen…</div> : (
            <div className="tmFormationen">
              {FORMATIONS.map((f) => (
                <button key={f.name} className="tmFormation" onClick={() => { starte(f); play("click"); }}>
                  <b>{f.name}</b>
                  <span>{f.lines.flat().map((p) => POS_BY_KEY[p]?.kurz || p).join(" · ")}</span>
                </button>
              ))}
            </div>
          )}
          <div className="minirow"><button className="btn ghost" onClick={() => setLiga(null)}>Andere Liga</button></div>
        </div>
      </div>
    );
  }

  return (
    <div className="ppRoot">
      {kopf}

      <div className="dailyMeta">
        <span className="dailyCount form">{formation.name}</span>
        <span className="dailyCount">{runde}/{slots.length} besetzt</span>
        {!fertig && <span className={`dailyCount ${respins ? "" : "spent"}`}>Neuwurf {respins}</span>}
      </div>

      <div className="pitch" style={{ "--maxn1": maxLine + 1 }}>
        <Pitch />
        {slots.map((s, k) => {
          const p = belegt[k] != null ? players[belegt[k]] : null;
          const offen = wahl?.plaetze?.includes(k);
          return (
            <button key={k} type="button" disabled={!offen}
              title={p ? `${p.n} · ${posName(s.pos)}` : posName(s.pos)}
              className={`pslot ${p ? "set" : ""} ${offen ? "active" : ""}`}
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
              onClick={() => offen && stelleAuf(wahl.i, k)}>
              <span className="pslotFig">
                {p ? <Avatar player={p} size={42} /> : <Jersey pos={s.pos} />}
              </span>
              <span className="pslotName">{p ? p.ln : POS_BY_KEY[s.pos]?.kurz || s.pos}</span>
            </button>
          );
        })}
      </div>

      {wahl && (
        <div className="fb ok" style={{ marginTop: 10 }}>
          {players[wahl.i].n} kann {wahl.plaetze.length} Positionen spielen — tippe die gewünschte an.
          {" "}<button className="btn ghost" style={{ padding: "3px 10px", marginLeft: 6 }} onClick={() => setWahl(null)}>Abbrechen</button>
        </div>
      )}

      {!fertig && ziehung && !wahl && (
        <div className="panel">
          <div className="tmZiehung">
            <b>{ziehung.name}</b> <span className="tmJahr">{ziehung.jahr}</span>
          </div>
          <div className="tmKader">
            {kader.map((i) => {
              const p = players[i];
              const genau = plaetzeFuer(i).some((k) => passung(p, posListe[k]) === PASSUNG_GENAU);
              return (
                <button key={i} className="tmSpieler" onClick={() => waehle(i)}>
                  <Avatar player={p} size={34} />
                  <span className="tmSpielerText">
                    <b>{p.n}</b>
                    <span className="tmSpielerMeta">
                      {positionsText(p.pp, POS_LABEL[p.pos])}
                      {!genau && <span className="tmAushilfe"> · Aushilfe</span>}
                    </span>
                  </span>
                  <span className="tmKlasse">{daten.klassen.get(i)}</span>
                </button>
              );
            })}
          </div>
          <div className="minirow">
            <button className="btn ghost" disabled={!respins} onClick={respin}>
              Neuer Kader ({respins})
            </button>
          </div>
        </div>
      )}

      {!fertig && !ziehung && (
        <div className="fb err">Kein Kader mehr, der eine offene Position bedienen kann. Bitte neu starten.</div>
      )}

      {fertig && b && (
        <div className="panel dailyEnd">
          {abzeichen.key === "makellos" && <Confetti />}
          <h2 style={{ marginTop: 0 }}>{abzeichen.name}</h2>
          <div className="tmBilanz">
            <span><b>{b.siege}</b>S</span><span><b>{b.remis}</b>U</span><span><b>{b.niederlagen}</b>N</span>
            <span className="tmPunkte"><b>{b.punkte}</b> Punkte</span>
          </div>
          <p className="ruleP">
            Klasse im Schnitt <b>{wertung.klasseSchnitt}</b>, dazu <b>{wertung.paare}</b> Verbund-Paar{wertung.paare === 1 ? "" : "e"} (+{wertung.bonus}) — Wertung <b>{wertung.wertung}</b> von erreichbaren {obergr}.
          </p>

          {nachbetrachtung.length > 0 && (
            <>
              <div className="prompt" style={{ marginTop: 14 }}>Da lag mehr drin</div>
              <div className="tmLehre">
                {nachbetrachtung.slice(0, 4).map((r, n) => (
                  <div key={n} className="tmLehreZeile">
                    <span className="tmLehreKader">{r.z.name} {r.z.jahr}</span>
                    <span>
                      <span className="tmSpielerMeta">{POS_BY_KEY[posListe[r.slot]]?.kurz || posListe[r.slot]}</span>
                      {" "}{players[r.gewaehlt].ln} → <b>{players[r.beste.i].ln}</b>
                      {" "}<span className="tmSpielerMeta">+{r.plus}</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="closeline">
            <ShareButton style={{ flex: 1, padding: "12px" }}
              text={shareTraumelf({ liga: LIGA_NAME[liga], formation: formation.name, b, abzeichen: abzeichen.name, paare: wertung.paare })} />
          </div>
          <div className="closeline">
            <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={() => { setFormation(null); setBelegt([]); setZiehung(null); }}>Noch eine Saison</button>
            <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Zur Lobby</button>
          </div>
        </div>
      )}

      {regeln && (
        <div className="overlay" onClick={() => setRegeln(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Traumelf</h2>
            <p className="ruleP">Jeder Spin zieht einen <b>echten Verein in einer echten Saison</b>. Nimm daraus <b>einen</b> Spieler auf eine freie Position — elfmal, bis die Elf steht. Danach spielt sie eine volle Saison.</p>
            <p className="ruleP">Zwei Dinge zählen. Die <b>Klasse</b> ist der Rangplatz eines Spielers unter allen ziehbaren, von 50 bis 99 — sie misst Bekanntheit, nicht Können, und wird deshalb offen als Rangplatz ausgewiesen. Auf seiner echten Position zählt ein Spieler voll, als Aushilfe in seiner Gruppe etwas weniger.</p>
            <p className="ruleP">Der <b>Verbund</b> ist unser Zusatz: Für jedes Paar deiner Elf, das wirklich gleichzeitig beim selben Verein gespielt hat, steigt die Wertung. Zufällig zusammengewürfelte Elfen schaffen das fast nie — wer aus wenigen Kadern draftet, baut eine Mannschaft, die es hätte geben können.</p>
            <p className="ruleP">Einen <b>Neuwurf</b> gibt es pro Partie. Die Saisonlänge richtet sich nach der Liga: {SPIELE.BL} Spiele in der Bundesliga, {SPIELE.PL} in England und Spanien.</p>
            <DataStamp />
            <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setRegeln(false)}>Los geht's</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
