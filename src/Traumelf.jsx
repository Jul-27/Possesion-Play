import { useState, useEffect, useMemo, useRef } from "react";
import { CLUBS, POS_LABEL } from "./gameData.js";
import { posName, positionsText, POS_BY_KEY } from "./positions.js";
import { FORMATIONS, slotLayout } from "./eleven.js";
import {
  baueZiehungen, baueKlassen, baueVerbundNetz, bewerte, obergrenze, klasseIn,
  zieh, bedientSlots, darfAufPosition, passung,
  RESPINS, SPIELE, LIGA_NAME, PASSUNG_GENAU,
} from "./draft.js";
import {
  TEAMS, teamStaerke, waehleGegner, simuliereSaison, tabelleNach, meineZeile,
  abzeichenFuer, hoehepunkte,
} from "./saison.js";
import { loadPlayers } from "./playersStore.js";
import { loadAppearances } from "./appearancesStore.js";
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
const TAKT_MS = 620;     // Spieltag für Spieltag — schnell genug zum Zusehen, langsam genug zum Lesen

/* Der laufende Draft wird NICHT gespeichert. Spielerindizes verschieben sich mit
   jedem Datenlauf, und eine Partie dauert wenige Minuten — ein halb gespeicherter
   Draft, der nach einem Deploy plötzlich andere Spieler enthält, wäre schlimmer als
   ein verlorener. Gespeichert wird nur das beste Ergebnis je Liga. */

/* Die Formation als Bild statt als Liste von Kürzeln.

   „TW · LV · IV · IV · RV · DM · DM · LA · OM · RA · MS" ist zwar vollständig, sagt
   aber niemandem etwas — man muss elf Abkürzungen im Kopf zu einer Aufstellung
   zusammensetzen. Die Punkte auf dem Feld zeigen dieselbe Information auf einen
   Blick, und die Reihen sind genau die, die nachher auch gespielt werden:
   `slotLayout` liefert hier dieselben Koordinaten wie dem großen Feld. */
function FormationsBild({ formation }) {
  const punkte = slotLayout(formation);
  return (
    <svg className="tmFormBild" viewBox="0 0 100 108" aria-hidden="true">
      <rect x="1" y="1" width="98" height="106" rx="6" className="tmFormFeld" />
      <line x1="1" y1="54" x2="99" y2="54" className="tmFormLinie" />
      <circle cx="50" cy="54" r="12" className="tmFormLinie" fill="none" />
      {/* Strafräume oben und unten — ohne sie schwebt die Elf im Nichts. */}
      <rect x="28" y="1" width="44" height="16" className="tmFormLinie" fill="none" />
      <rect x="28" y="91" width="44" height="16" className="tmFormLinie" fill="none" />
      {punkte.map((s, k) => (
        <circle key={k} cx={s.x} cy={s.y * 1.08} r="4.6" className={`tmFormPunkt ${s.pos === "TW" ? "tw" : ""}`} />
      ))}
    </svg>
  );
}

export default function Traumelf({ onLeave }) {
  const [players, setPlayers] = useState(null);
  const [einsaetze, setEinsaetze] = useState(undefined);   // undefined = lädt, null = fehlt
  const [liga, setLiga] = useState(null);
  const [formation, setFormation] = useState(null);
  const [belegt, setBelegt] = useState([]);          // je Platz { i, jahr } — das Jahr gehört dazu
  const [ziehung, setZiehung] = useState(null);
  const [gezogen, setGezogen] = useState([]);
  const [respins, setRespins] = useState(RESPINS);
  const [verlauf, setVerlauf] = useState([]);
  const [wahl, setWahl] = useState(null);
  const [muted, setMuted] = useState(isMuted());
  const [regeln, setRegeln] = useState(false);
  const [best, setBest] = useState(() => store.get(BESTEN_KEY) || {});

  // Saison
  const [saison, setSaison] = useState(null);
  const [spieltag, setSpieltag] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const meineZeileRef = useRef(null);

  useEffect(() => { loadPlayers().then(setPlayers); }, []);
  useEffect(() => { loadAppearances().then((e) => setEinsaetze(e || null)); }, []);

  /* Ziehungen, Klassen und Netz hängen nur an der Liga — einmal bauen, nicht je Spin.
     Gemessen: 68 bis 180 ms je Liga. */
  const daten = useMemo(() => {
    if (!players || !liga || einsaetze === undefined) return null;
    const ziehungen = baueZiehungen(players, CLUBS, liga);
    return { ziehungen, klassen: baueKlassen(players, ziehungen, einsaetze), netz: baueVerbundNetz(players, ziehungen) };
  }, [players, liga, einsaetze]);

  /* Wie stark ist diese Liga? Die Töpfe sind verschieden dicht — England besteht in
     unseren Daten aus neun Großvereinen, die Bundesliga auch aus Freiburg und Mainz.
     Statt das wegzurechnen, steht es bei der Ligawahl. */
  const ligaInfo = useMemo(() => {
    if (!players || einsaetze === undefined) return {};
    const out = {};
    for (const l of LIGEN) {
      const z = baueZiehungen(players, CLUBS, l);
      if (!z.length) continue;
      const kl = baueKlassen(players, z, einsaetze);
      const s = z.map((x) => teamStaerke(x, players, kl)).sort((a, b) => a - b);
      out[l] = { schnitt: Math.round(s[Math.floor(s.length / 2)]), beste: s.at(-1), kader: z.length };
    }
    return out;
  }, [players, einsaetze]);

  const slots = useMemo(() => (formation ? slotLayout(formation) : []), [formation]);
  const posListe = useMemo(() => slots.map((s) => s.pos), [slots]);
  const obergr = useMemo(
    () => (daten && posListe.length ? obergrenze(posListe, players, daten.klassen, daten.ziehungen) : 0),
    [daten, posListe, players],
  );

  const runde = belegt.filter((e) => e != null).length;
  const draftFertig = slots.length > 0 && runde === slots.length;

  const wertung = useMemo(
    () => (draftFertig && daten ? bewerte(belegt, posListe, players, daten.klassen, daten.netz) : null),
    [draftFertig, belegt, posListe, players, daten],
  );

  /* Die Saison wird EINMAL komplett durchgerechnet, sobald die Elf steht — und dann
     Spieltag für Spieltag aufgedeckt. Andersherum, Spieltag für Spieltag gerechnet,
     hinge das Ergebnis daran, wie oft React neu zeichnet. */
  useEffect(() => {
    if (!draftFertig || !wertung || !daten || saison) return;
    const gegner = waehleGegner(daten.ziehungen, players, daten.klassen, TEAMS[liga] - 1, `${liga}:${Date.now()}`);
    setSaison(simuliereSaison({ meineStaerke: wertung.wertung, gegner, seed: Math.floor(Math.random() * 1e9) }));
    setSpieltag(0);
    setLaeuft(true);
  }, [draftFertig, wertung, daten, saison, liga, players]);

  /* Der Takt. `laeuft` schaltet ab, sobald der letzte Spieltag steht. */
  useEffect(() => {
    if (!laeuft || !saison) return;
    if (spieltag >= saison.spieltage.length) { setLaeuft(false); return; }
    const t = setTimeout(() => setSpieltag((n) => n + 1), TAKT_MS);
    return () => clearTimeout(t);
  }, [laeuft, spieltag, saison]);

  const tabelle = useMemo(
    () => (saison ? tabelleNach(saison.teams, saison.spieltage, spieltag) : []),
    [saison, spieltag],
  );
  const meine = tabelle.length ? meineZeile(tabelle) : null;
  const saisonFertig = !!saison && spieltag >= saison.spieltage.length;
  const abzeichen = saisonFertig && meine ? abzeichenFuer(meine, saison.teams.length) : null;
  const hoehen = useMemo(
    () => (saisonFertig ? hoehepunkte(saison.teams, saison.spieltage) : null),
    [saisonFertig, saison],
  );

  /* Das eigene Spiel des laufenden Spieltags — die Zahl, auf die man wartet. */
  const meinSpiel = useMemo(() => {
    if (!saison || spieltag < 1) return null;
    const tag = saison.spieltage[spieltag - 1];
    const s = tag.spiele.find((x) => x.h === 0 || x.a === 0);
    if (!s) return null;
    const heim = s.h === 0;
    return {
      nr: tag.nr, heim,
      gegner: saison.teams[heim ? s.a : s.h].name,
      eigene: heim ? s.th : s.ta,
      fremde: heim ? s.ta : s.th,
    };
  }, [saison, spieltag]);

  /* Die eigene Zeile im Blick behalten, wenn sie durch die Tabelle wandert. */
  useEffect(() => {
    if (laeuft) meineZeileRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [meine?.platz, laeuft]);

  useEffect(() => {
    if (!saisonFertig || !abzeichen || !meine) return;
    const alt = best[liga];
    if (alt && alt.punkte >= meine.punkte) return;
    const neu = { ...best, [liga]: { punkte: meine.punkte, platz: meine.platz, abzeichen: abzeichen.name, formation: formation.name } };
    setBest(neu);
    store.set(BESTEN_KEY, neu);
  }, [saisonFertig, abzeichen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Spin ───────────────────────────────────────────────────────────────────
     Gezogen wird so lange, bis ein Kader wirklich eine offene Stelle bedienen kann.
     Ohne diese Schleife wäre jeder zweite Spin verschenkt: Ein Kader ohne Torwart
     nützt nichts mehr, wenn nur noch das Tor frei ist. */
  function spin(stand = belegt, gesehen = gezogen, saat = Math.random()) {
    if (!daten) return;
    const neu = [...gesehen];
    for (let versuch = 0; versuch < 400; versuch++) {
      const kandidat = zieh(daten.ziehungen, `${liga}#${saat}#${versuch}`, neu);
      if (bedientSlots(kandidat, players, posListe, stand.map((e) => (e ? e.i : null)))) {
        setGezogen([...neu, `${kandidat.key}|${kandidat.jahr}`]);
        setZiehung(kandidat);
        setWahl(null);
        play("click");
        return;
      }
      neu.push(`${kandidat.key}|${kandidat.jahr}`);
    }
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
    setSaison(null);
    setSpieltag(0);
    /* Der erste Spin muss die frische Formation nutzen, nicht die aus dem State —
       der ist in diesem Durchlauf noch der alte. */
    const posNeu = slotLayout(f).map((s) => s.pos);
    if (!daten) return;
    for (let versuch = 0; versuch < 400; versuch++) {
      const k = zieh(daten.ziehungen, `${liga}#start#${Math.random()}#${versuch}`, []);
      if (bedientSlots(k, players, posNeu, leer)) { setZiehung(k); setGezogen([`${k.key}|${k.jahr}`]); return; }
    }
  }

  const drin = useMemo(() => new Set(belegt.filter(Boolean).map((e) => e.i)), [belegt]);

  /** Welche offenen Plätze kann dieser Spieler übernehmen? */
  const plaetzeFuer = (i) =>
    slots.map((s, k) => k).filter((k) => belegt[k] == null && darfAufPosition(players[i], posListe[k]));

  function stelleAuf(i, k) {
    const naechster = [...belegt];
    naechster[k] = { i, jahr: ziehung.jahr };
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

  /* Der Kader der laufenden Ziehung, nach Saisonklasse sortiert und um die reduziert,
     die nirgends mehr hinpassen — sie anzuzeigen hieße, dreißig Namen zur Wahl zu
     stellen, von denen achtundzwanzig nicht wählbar sind. */
  const kader = useMemo(() => {
    if (!ziehung || !daten) return [];
    return ziehung.spieler
      .filter((i) => !drin.has(i) && plaetzeFuer(i).length > 0)
      .sort((a, c) => klasseIn(daten.klassen, players, c, ziehung.jahr) - klasseIn(daten.klassen, players, a, ziehung.jahr));
  }, [ziehung, daten, belegt]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Nachbetrachtung ────────────────────────────────────────────────────────
     Für jede Runde: Wer aus DEMSELBEN Kader hätte auf DERSELBEN Position mehr
     gebracht? Gerechnet wird die fertige Elf einmal neu, mit dem anderen Spieler
     darin — die ECHTE Wertung, nicht eine Näherung.

     Eine erste Fassung schätzte stattdessen: Klasse geteilt durch elf plus ein Punkt
     je Mitspieler. Damit schlug sie allen Ernstes Iheanacho statt Haaland vor, weil
     drei zusätzliche Paare schwerer wogen als zwanzig Klassenpunkte — während der
     Verbund in der echten Wertung bei neun gedeckelt ist. Wer eine Lehre anbietet,
     muss das messen, was er behauptet. */
  const nachbetrachtung = useMemo(() => {
    if (!draftFertig || !daten || !wertung) return [];
    const jetzt = wertung.wertung;
    return verlauf.map(({ ziehung: z, gewaehlt, slot }) => {
      let beste = { i: gewaehlt, wertung: jetzt };
      for (const i of z.spieler) {
        if (i === gewaehlt || drin.has(i)) continue;
        if (!darfAufPosition(players[i], posListe[slot])) continue;
        const anders = [...belegt];
        anders[slot] = { i, jahr: z.jahr };
        const w = bewerte(anders, posListe, players, daten.klassen, daten.netz).wertung;
        if (w > beste.wertung) beste = { i, wertung: w };
      }
      return { z, gewaehlt, slot, beste, plus: Math.round((beste.wertung - jetzt) * 10) / 10 };
    }).filter((r) => r.beste.i !== r.gewaehlt).sort((a, c) => c.plus - a.plus);
  }, [draftFertig, verlauf, belegt, daten, wertung]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const regelModal = regeln && (
    <div className="overlay" onClick={() => setRegeln(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Traumelf</h2>
        <p className="ruleP">Jeder Spin zieht einen <b>echten Verein in einer echten Saison</b>. Nimm daraus <b>einen</b> Spieler auf eine freie Position — elfmal, bis die Elf steht. Danach spielt sie eine volle Saison gegen 17 bzw. 19 andere echte Kader.</p>
        <p className="ruleP">Die <b>Klasse</b> ist der Rangplatz eines Spielers unter allen ziehbaren. Sie misst Bekanntheit, nicht Können, und wird deshalb offen als Rangplatz ausgewiesen. Über 90 kommen nur eine Handvoll — und auch die nur in ihren besten Jahren: Ein 18-Jähriger und ein 37-Jähriger stehen unter ihrem eigenen Höchstwert.</p>
        <p className="ruleP">Der <b>Verbund</b> ist unser Zusatz: Für jedes Paar deiner Elf, das wirklich gleichzeitig beim selben Verein gespielt hat, steigt die Wertung. Echte Mannschaften haben ihn vollständig — deshalb musst du individuell besser sein, um mitzuhalten.</p>
        <p className="ruleP">Die Saison wird <b>Spiel für Spiel ausgespielt</b>, mit Toren und Tabelle. Das Abzeichen kommt aus dem Tabellenplatz. <b>Makellos</b> — jedes Spiel gewonnen — ist in 12.000 simulierten Saisons kein einziges Mal vorgekommen; man müsste auch gegen Bayern 2014 zweimal gewinnen.</p>
        <DataStamp />
        <div className="closeline"><button className="btn primary" style={{ flex: 1, padding: "11px" }} onClick={() => setRegeln(false)}>Los geht's</button></div>
      </div>
    </div>
  );

  if (!players || einsaetze === undefined) return <div className="ppRoot">{kopf}<div className="qlogEmpty">Lade Spielerdaten…</div>{regelModal}</div>;

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
                <span>{TEAMS[l]} Mannschaften · {SPIELE[l]} Spieltage</span>
                {ligaInfo[l] && (
                  <span>Gegner im Mittel {ligaInfo[l].schnitt}, stärkster {ligaInfo[l].beste}</span>
                )}
                {best[l] && <span className="tmBest">Bestwert Platz {best[l].platz} · {best[l].punkte} Punkte</span>}
              </button>
            ))}
          </div>
          <p className="ruleP">Die Ligen sind verschieden schwer, und das steht so in den Daten: Unsere neun englischen Vereine sind allesamt Größen, die Bundesliga bringt auch Freiburg und Mainz mit.</p>
        </div>
        {regelModal}
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
                  <FormationsBild formation={f} />
                  <b>{f.name}</b>
                </button>
              ))}
            </div>
          )}
          <div className="minirow"><button className="btn ghost" onClick={() => setLiga(null)}>Andere Liga</button></div>
        </div>
        {regelModal}
      </div>
    );
  }

  const feld = (
    <div className="pitch" style={{ "--maxn1": maxLine + 1 }}>
      <Pitch />
      {slots.map((s, k) => {
        const e = belegt[k];
        const p = e ? players[e.i] : null;
        const offen = wahl?.plaetze?.includes(k);
        return (
          <button key={k} type="button" disabled={!offen}
            title={p ? `${p.n} · ${posName(s.pos)} · ${e.jahr}` : posName(s.pos)}
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
  );

  // Schritt 4: Saison
  if (saison) {
    const gesamt = saison.spieltage.length;
    return (
      <div className="ppRoot">
        {kopf}
        <div className="dailyMeta">
          <span className="dailyCount form">{formation.name}</span>
          <span className="dailyCount">Spieltag {spieltag}/{gesamt}</span>
          {meine && <span className="dailyCount">Platz {meine.platz} · {meine.punkte} P</span>}
        </div>

        {meinSpiel && (
          <div className={`tmSpieltag ${meinSpiel.eigene > meinSpiel.fremde ? "sieg" : meinSpiel.eigene < meinSpiel.fremde ? "pleite" : "remis"}`}>
            <span className="tmGegner">{meinSpiel.heim ? "gegen" : "bei"} {meinSpiel.gegner}</span>
            <span className="tmErgebnis">{meinSpiel.eigene}:{meinSpiel.fremde}</span>
          </div>
        )}

        <div className="tmTabelle">
          {tabelle.map((z) => (
            <div key={z.name} ref={z.ich ? meineZeileRef : null}
              className={`tmZeile ${z.ich ? "ich" : ""} ${z.platz === 1 ? "meister" : ""} ${z.platz > saison.teams.length - 3 ? "abstieg" : ""}`}>
              <span className="tmPlatz">{z.platz}</span>
              <span className="tmTeam">{z.name}</span>
              <span className="tmTore">{z.tore}:{z.gegentore}</span>
              <span className="tmP">{z.punkte}</span>
            </div>
          ))}
        </div>

        {!saisonFertig ? (
          <div className="minirow">
            <button className="btn ghost" onClick={() => setLaeuft(!laeuft)}>{laeuft ? "Anhalten" : "Weiter"}</button>
            <button className="btn ghost" onClick={() => { setLaeuft(false); setSpieltag(gesamt); }}>Zum Ende</button>
          </div>
        ) : (
          <div className="panel dailyEnd tmKarte">
            {(abzeichen.key === "meister" || abzeichen.key === "rekord" || abzeichen.key === "makellos" || abzeichen.key === "unbesiegt") && <Confetti />}
            <div className="tmKarteKopf">
              <span className="tmKarteEmoji">{abzeichen.emoji}</span>
              <div>
                <h2 style={{ margin: 0 }}>{abzeichen.name}</h2>
                <span className="tmSpielerMeta">{LIGA_NAME[liga]} · {formation.name} · Platz {meine.platz} von {saison.teams.length}</span>
              </div>
            </div>

            <div className="tmBilanz">
              <span><b>{meine.s}</b>S</span><span><b>{meine.u}</b>U</span><span><b>{meine.n}</b>N</span>
              <span><b>{meine.tore}:{meine.gegentore}</b></span>
              <span className="tmPunkte"><b>{meine.punkte}</b> Punkte</span>
            </div>

            <div className="tmFakten">
              {hoehen.bestes && (
                <div><span>Höchster Sieg</span><em><b>{hoehen.bestes.eigene}:{hoehen.bestes.fremde}</b> {hoehen.bestes.heim ? "gegen" : "bei"} {hoehen.bestes.gegner}</em></div>
              )}
              {hoehen.schlimmstes && (
                <div><span>Bitterste Pleite</span><em><b>{hoehen.schlimmstes.eigene}:{hoehen.schlimmstes.fremde}</b> {hoehen.schlimmstes.heim ? "gegen" : "bei"} {hoehen.schlimmstes.gegner}</em></div>
              )}
              <div><span>Längste Serie ohne Niederlage</span><em><b>{hoehen.serie}</b> Spiele</em></div>
              <div><span>Stärke der Elf</span><em><b>{wertung.wertung}</b> von erreichbaren {obergr}</em></div>
              <div><span>Verbund</span><em><b>{wertung.paare}</b> Paare (+{wertung.bonus})</em></div>
            </div>

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
                text={shareTraumelf({
                  liga: LIGA_NAME[liga], formation: formation.name, abzeichen: abzeichen.name,
                  platz: meine.platz, teams: saison.teams.length,
                  s: meine.s, u: meine.u, n: meine.n, punkte: meine.punkte, paare: wertung.paare,
                })} />
            </div>
            <div className="closeline">
              <button className="btn primary" style={{ flex: 1, padding: "12px" }} onClick={() => { setFormation(null); setBelegt([]); setZiehung(null); setSaison(null); }}>Noch eine Saison</button>
              <button className="btn ghost" style={{ flex: 1, padding: "12px" }} onClick={onLeave}>Zur Lobby</button>
            </div>
          </div>
        )}

        {saisonFertig && feld}
        {regelModal}
      </div>
    );
  }

  // Schritt 3: Draft
  return (
    <div className="ppRoot">
      {kopf}

      <div className="dailyMeta">
        <span className="dailyCount form">{formation.name}</span>
        <span className="dailyCount">{runde}/{slots.length} besetzt</span>
        <span className={`dailyCount ${respins ? "" : "spent"}`}>Neuwurf {respins}</span>
      </div>

      {feld}

      {wahl && (
        <div className="fb ok" style={{ marginTop: 10 }}>
          {players[wahl.i].n} kann {wahl.plaetze.length} Positionen spielen — tippe die gewünschte an.
          <button className="btn ghost" style={{ padding: "3px 10px", marginLeft: 6 }} onClick={() => setWahl(null)}>Abbrechen</button>
        </div>
      )}

      {ziehung && !wahl && (
        <div className="panel">
          <div className="tmZiehung">
            <b>{ziehung.name}</b> <span className="tmJahr">{ziehung.jahr}</span>
          </div>
          <div className="tmKader">
            {kader.map((i) => {
              const p = players[i];
              const genau = plaetzeFuer(i).some((k) => passung(p, posListe[k]) === PASSUNG_GENAU);
              const kl = klasseIn(daten.klassen, players, i, ziehung.jahr);
              const grund = daten.klassen.get(i) ?? 50;
              return (
                <button key={i} className="tmSpieler" onClick={() => waehle(i)}>
                  <Avatar player={p} size={34} />
                  <span className="tmSpielerText">
                    <b>{p.n}</b>
                    <span className="tmSpielerMeta">
                      {positionsText(p.pp, POS_LABEL[p.pos])}
                      {p.by ? ` · ${ziehung.jahr - p.by} Jahre` : ""}
                      {!genau && <span className="tmAushilfe"> · Aushilfe</span>}
                    </span>
                  </span>
                  {/* Liegt die Saisonklasse unter der Grundklasse, war der Spieler in
                      diesem Jahr noch nicht oder nicht mehr auf seinem Höhepunkt. */}
                  <span className={`tmKlasse ${kl < grund ? "gedaempft" : ""}`} title={kl < grund ? `Bestwert ${grund}` : undefined}>{kl}</span>
                </button>
              );
            })}
          </div>
          <div className="minirow">
            <button className="btn ghost" disabled={!respins} onClick={respin}>Neuer Kader ({respins})</button>
          </div>
        </div>
      )}

      {!ziehung && !draftFertig && (
        <div className="fb err">Kein Kader mehr, der eine offene Position bedienen kann. Bitte neu starten.</div>
      )}

      {regelModal}
    </div>
  );
}
