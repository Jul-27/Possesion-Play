import { useState, useEffect } from "react";
import { getSavedName } from "./supabaseClient.js";
import { loadPlayers } from "./playersStore.js";
import { dailyNumber, dailyDateStr } from "./dailyLogic.js";
import { challengeBadge, challengeState, dailyRnd } from "./dailyChallenge.js";
import { collectStats } from "./stats.js";
import { berechneXp, stufeFuer, tagesserie, offeneHeute, missionenDesTages } from "./progress.js";
import DataStamp from "./DataStamp.jsx";

/* ENTWURF der neuen Lobby — erreichbar unter ?entwurf=lobby, die bestehende Lobby
   bleibt unangetastet. Zweck: die Richtung beurteilbar machen, bevor etwas Echtes
   ersetzt wird.

   Was sich gegenüber der alten Lobby ändert und WARUM:

   1. KOPF MIT IDENTITÄT. Bisher begrüßt die App einen Titel, kein Ich. Jetzt stehen
      Stufe, Fortschrittsbalken und Tagesserie ganz oben — beim Öffnen sieht man sich
      selbst statt eines Menüs. Die Zahlen sind ECHT, berechnet aus den vorhandenen
      Statistiken (progress.js), nicht erfunden.

   2. EIN HELD STATT ACHT GLEICHEN. Das Tagesrätsel bekommt die ganze Breite und den
      einzigen großen Aufruf. Alles andere wird kleiner. Ein Raster aus acht
      identischen Kacheln hat keinen Landeplatz fürs Auge.

   3. EINE FARBE JE MODUS. Vorher teilten sich zwölf Modi ein Türkis, weshalb das
      Raster monoton wirkte, obwohl jedes Element für sich sauber war. Der Farbton
      trägt Icon, Rand und Fortschrittspunkt.

   4. ABZEICHEN, DIE ETWAS SAGEN. Statt siebenmal „heute offen" nur noch ein Haken
      bei erledigt, eine Flamme bei laufender Serie — und oben EINE Zahl, wie viele
      Tagesrätsel offen sind.

   5. TAGESMISSIONEN als Grund, Modi zu öffnen, die man sonst liegen lässt. Aus dem
      Datum abgeleitet, also für alle gleich und ohne Server. Im Entwurf noch ohne
      Fortschrittsmessung — die käme mit der Umsetzung. */

const MODI = [
  { key: "career",   name: "Karriere-Pfad",     icon: "🧭", ton: "#A78BFA", text: "Stationen erraten",     solo: true, daily: true },
  { key: "odd",      name: "Wer passt nicht?",  icon: "🧩", ton: "#A3E635", text: "Drei gehören zusammen", solo: true, daily: true },
  { key: "chain",    name: "Fußball-Kette",     icon: "⛓️", ton: "#22D3EE", text: "Gegen die Uhr",         solo: true, daily: true },
  { key: "heat",     name: "Heatmap",           icon: "🔥", ton: "#FB923C", text: "Combos und Hitze",      solo: true, daily: true },
  { key: "hex",      name: "Hex-Training",      icon: "🎯", ton: "#2DD4BF", text: "Ohne Zeitdruck",        solo: true, daily: true },
  { key: "carousel", name: "Transferkarussell", icon: "🎠", ton: "#F472B6", text: "Gegen den Bot",         solo: true, daily: false },
];

export default function LobbyDraft({ onDaily, onSolo, onStats, onBoard, onLeave }) {
  const [name] = useState(getSavedName() || "Spieler");
  useEffect(() => { loadPlayers(); }, []);

  const entries = collectStats();
  const { xp, raetsel, modi } = berechneXp(entries);
  const stufe = stufeFuer(xp);
  const serie = tagesserie(entries);
  const offen = offeneHeute();
  const missionen = missionenDesTages(dailyRnd("mission"));

  const dailyOffen = !localGeloest("daily");
  const elfStand = elevenStand();

  return (
    <div className="ppRoot draft">
      {/* ── Kopf: wer bin ich, wie weit bin ich ───────────────────────────── */}
      <div className="dTop">
        <div className="dBrand">
          <h1 className="dTitle">POSSESSION PLAY</h1>
        </div>
        <button className="iconbtn" title="Zurück zur alten Lobby" onClick={onLeave}>⏏</button>
      </div>

      <div className="dMe">
        <div className="dRing" style={{ "--anteil": stufe.anteil }}>
          <span>{stufe.kurz}</span>
        </div>
        <div className="dMeBody">
          <div className="dMeName">{name}</div>
          <div className="dMeStufe">{stufe.name}</div>
          <div className="dBar"><i style={{ width: `${Math.round(stufe.anteil * 100)}%` }} /></div>
          <div className="dMeSub">
            {stufe.naechste ? <>noch <b>{stufe.bisNaechste}</b> XP bis {stufe.naechste.name}</> : <>höchste Stufe erreicht</>}
          </div>
        </div>
        <div className="dSerie" title="Tage in Folge gespielt">
          <b>{serie}</b><span>🔥 Serie</span>
        </div>
      </div>

      {/* ── Held: das Tagesrätsel ─────────────────────────────────────────── */}
      <div className="dSectionRow">
        <span className="dSection">Heute</span>
        {offen > 0 && <span className="dOffen">{offen} offen</span>}
      </div>

      <button className="dHero" onClick={onDaily}>
        <div className="dHeroTop">
          <span className="dHeroIcon">🌟</span>
          <span className="dHeroNr">#{dailyNumber(dailyDateStr())}</span>
        </div>
        <div className="dHeroName">Daily-Star</div>
        <div className="dHeroText">Acht Fragen, zwei Tipps — für alle dasselbe Rätsel.</div>
        <div className="dHeroCta">{dailyOffen ? "Jetzt spielen" : "Nochmal ansehen"} <span>→</span></div>
      </button>

      <button className="dWide" onClick={() => onSolo("eleven")} style={{ "--ton": "#38BDF8" }}>
        <span className="dWideIcon">👕</span>
        <span className="dWideBody">
          <b>Elf des Tages #{dailyNumber(dailyDateStr())}</b>
          <small>Startelf nach elf Bedingungen</small>
        </span>
        <span className="dWideBadge">{elfStand}</span>
      </button>

      {/* ── Tagesmissionen ────────────────────────────────────────────────── */}
      <div className="dSectionRow"><span className="dSection">Missionen</span><span className="dOffen ghost">0/3</span></div>
      <div className="dMissions">
        {missionen.map((m) => (
          <div key={m.id} className="dMission">
            <span className="dMissionBox" />
            <span className="dMissionText">{m.text}</span>
            <span className="dMissionXp">+40</span>
          </div>
        ))}
      </div>

      {/* ── Modi ──────────────────────────────────────────────────────────── */}
      <div className="dSectionRow"><span className="dSection">Modi</span></div>
      <div className="dGrid">
        {MODI.map((m) => {
          const st = entries.find((e) => e.key === m.key);
          const erledigt = m.daily && !!challengeState(m.key);
          return (
            <button key={m.key} className="dTile" style={{ "--ton": m.ton }} onClick={() => onSolo(m.key)}>
              <span className="dTileHead">
                <span className="dTileIcon">{m.icon}</span>
                {erledigt ? <span className="dCheck">✓</span>
                  : st?.streak > 0 ? <span className="dFlame">🔥{st.streak}</span> : null}
              </span>
              <b className="dTileName">{m.name}</b>
              <small className="dTileText">{m.text}</small>
              <span className="dTileBar"><i style={{ width: st?.played ? "100%" : "0%" }} /></span>
            </button>
          );
        })}
      </div>

      {/* ── Duell + Nebenwege ─────────────────────────────────────────────── */}
      <div className="dSectionRow"><span className="dSection">Gegen Freunde</span></div>
      <button className="dWide duell" onClick={onLeave} style={{ "--ton": "#2DD4BF" }}>
        <span className="dWideIcon">🤝</span>
        <span className="dWideBody"><b>Duell starten</b><small>Vier Modi, Spiel erstellen oder Code eingeben</small></span>
        <span className="dWideChev">›</span>
      </button>

      <div className="dPair">
        <button className="dSmall" onClick={onBoard}><span>🏆</span><b>Bestenliste</b></button>
        <button className="dSmall" onClick={onStats}>
          <span>📊</span><b>Statistik</b>
          <small>{raetsel} Rätsel · {modi} Modi</small>
        </button>
      </div>

      <p className="dNote">
        Entwurf. Stufe, XP und Serien sind aus deinen echten Statistiken gerechnet;
        Missionen zeigen noch keinen Fortschritt.
      </p>
      <DataStamp />
    </div>
  );
}

const localGeloest = (mode) => { try { return !!localStorage.getItem(`pp:ch:${mode}:${dailyDateStr()}`); } catch { return false; } };

function elevenStand() {
  try {
    const st = JSON.parse(localStorage.getItem(`pp:eleven:${dailyDateStr()}`) || "null");
    if (st?.done) return "✓";
    const n = (st?.names || []).filter(Boolean).length;
    return n ? `${n}/11` : "offen";
  } catch { return "offen"; }
}
