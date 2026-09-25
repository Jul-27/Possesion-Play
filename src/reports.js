/* „Fehler melden" — reine Logik (kein React, kein Supabase).

   Zweck: Ein Spieler sieht im Spiel, dass eine Zuordnung fehlt („Fábio Vieira war
   beim HSV, das Spiel zählt es nicht"), und meldet das Paar. Gespeichert wird nur
   die MELDUNG — players.js bleibt unangetastet, bis der Export durchgesehen und ein
   Eintrag nach EXTRA_PLAYERS übernommen wurde.

   IDENTITÄT: Spieler haben in diesem Projekt keine ID. Der Schlüssel ist überall
   norm(name)|geburtsjahr — dieselbe Form, unter der auch EXTRA_PLAYERS, die
   Bildkarte und die Namenskorrekturen verschlüsselt sind. Vereine haben eine ID:
   den Drei-Buchstaben-Schlüssel der 47 Spielvereine. Die 8434 Karrierevereine
   haben keine und werden nur mit Namen geführt. */
import { norm, CLUBS, HONOURS, NATIONS } from "./gameData.js";

/** Schlüssel eines Spielers — identisch zu dem in EXTRA_PLAYERS und der Bildkarte. */
export const playerKey = (p) => (p ? norm(p.n) + "|" + p.by : "");

const KEY_VON_NAME = new Map(CLUBS.map((c) => [norm(c.name), c.key]));
/** Vereins-ID, falls es einer der 47 Spielvereine ist — sonst null. */
export const clubKeyOf = (name) => KEY_VON_NAME.get(norm(String(name || ""))) || null;

/* Alle Modi, aus denen gemeldet werden kann. Die Schlüssel wandern unverändert in
   die Datenbank, deshalb stehen sie hier einmal zentral statt verstreut in zwölf
   Dateien — ein Tippfehler im Modusnamen wäre in der Auswertung nicht mehr zu
   erkennen. `art` trennt Solo von Duell, ohne dass der Aufrufer daran denken muss. */
export const REPORT_MODES = {
  hex:            { name: "Hex-Training",           art: "solo" },
  career:         { name: "Karriere-Pfad",          art: "solo" },
  odd:            { name: "Wer passt nicht?",       art: "solo" },
  chain:          { name: "Fußball-Kette",          art: "solo" },
  carousel:       { name: "Transferkarussell",      art: "solo" },
  eleven:         { name: "Elf des Tages",          art: "solo" },
  heat:           { name: "Heatmap",                art: "solo" },
  daily:          { name: "Daily-Star",             art: "solo" },
  /* „Daily-Star" bleibt stehen, obwohl der Modus abgelöst wurde: die bereits
     eingegangenen Meldungen tragen diesen Schlüssel, und sie sollen in der
     Auswertung weiter unter ihrem damaligen Namen erscheinen. */
  steckbrief:     { name: "Steckbrief",             art: "solo" },
  ecken:          { name: "Sechs Ecken",            art: "solo" },
  traumelf:       { name: "Traumelf",               art: "solo" },
  karriere:       { name: "Karriere",               art: "solo" },
  "hex-duell":    { name: "Hex-Duell",              art: "duell" },
  "grid-duell":   { name: "Raster-Duell",           art: "duell" },
  "guess-duell":  { name: "Errate den Star",        art: "duell" },
  "carousel-duell": { name: "Transferkarussell-Duell", art: "duell" },
};

export const modeName = (mode) => REPORT_MODES[mode]?.name || mode || "unbekannt";
export const isDuel = (mode) => REPORT_MODES[mode]?.art === "duell";

/* ── DREI MELDEARTEN ─────────────────────────────────────────────────────────
   Bis 25.09.2026 ließ sich nur „Spieler → Verein fehlt" melden. Titel und
   Nationalität nicht — der gemeldete Fall „Ferran Torres gilt nicht als Weltmeister"
   passte in kein Formular. Der Schlüssel wandert als `kind` in die Datenbank.
   Für Titel und Nationen ist das Ziel { key, name } aus HONOURS bzw. NATIONS; für
   Vereine bleibt es der Vereinsname (die 8434 Karrierevereine haben keine ID). */
export const REPORT_KINDS = {
  verein: { name: "Verein", frage: "Fehlt bei einem Spieler ein Verein, bei dem er wirklich gespielt hat?", bitte: "Bitte einen Verein wählen." },
  titel:  { name: "Titel",  frage: "Fehlt einem Spieler ein Titel, den er wirklich gewonnen hat?", bitte: "Bitte einen Titel wählen." },
  nation: { name: "Nation", frage: "Fehlt bei einem Spieler die Nationalmannschaft, für die er gespielt hat?", bitte: "Bitte eine Nation wählen." },
};

/** Wählbare Ziele für Titel und Nationen. */
export const zieleFuer = (kind) =>
  kind === "titel" ? HONOURS.map((h) => ({ key: h.key, name: h.name }))
    : kind === "nation" ? NATIONS.map((n) => ({ key: n.key, name: n.name }))
      : [];

/* Das Ziel als Paar (Schlüssel, Anzeigename). Vereine: ID nur für Spielvereine. */
const zielPaar = (kind, ziel) =>
  kind === "verein" ? { key: clubKeyOf(ziel), name: ziel || "" } : { key: ziel?.key || null, name: ziel?.name || "" };

/** Was fehlt noch? Liefert null, wenn die Meldung abgeschickt werden darf. */
export function reportFehlt(player, ziel, kind = "verein") {
  if (!player) return "Bitte einen Spieler wählen.";
  if (!zielPaar(kind, ziel).name) return (REPORT_KINDS[kind] || REPORT_KINDS.verein).bitte;
  return null;
}

/* ── AUS EINEM ABGELEHNTEN ZUG ───────────────────────────────────────────────
   Lehnt ein Feld eine Antwort ab, lässt sich die Meldung vorbelegen: Art und Ziel
   ergeben sich aus dem Feld. Liga- und Sonderfelder (Jahrgang, Position) haben keine
   Entsprechung in den Daten, die man melden könnte — dort gibt es keinen Link. */
export function vorbelegungAus(def) {
  if (!def) return null;
  if (def.type === "club") return { kind: "verein", ziel: def.name };
  if (def.type === "honour") return { kind: "titel", ziel: { key: def.key, name: def.name } };
  if (def.type === "nat") return { kind: "nation", ziel: { key: def.key, name: def.name } };
  return null;
}

/* Was mitgeschickt wird, damit sich der Zug nachvollziehen lässt: das ablehnende
   Feld. Klein gehalten — die Datenbank nimmt höchstens 2000 Zeichen. */
export const kontextAus = (def) => (def ? { feld: `${def.type}:${def.key}`, feldName: def.name || def.key } : null);

/* Argumente für pc_report_submit. Bewusst hier und nicht in der Ansicht: die
   Feldnamen müssen exakt zur Datenbankfunktion passen, und genau das prüft ein Test.
   Der Spielcode wird nur bei Duellen mitgegeben — im Solo gibt es keinen. */
export function reportPayload({ player, clubName, ziel, kind = "verein", kontext = null, mode, gameCode = null, clientId = "", dataAsof = null }) {
  const z = zielPaar(kind, kind === "verein" ? ziel ?? clubName : ziel);
  return {
    p_player_key: playerKey(player),
    p_player_name: player.n,
    p_player_by: player.by ?? null,
    p_club_key: z.key,
    p_club_name: z.name,
    p_client: clientId || "",
    p_mode: mode || "",
    p_game_code: isDuel(mode) ? gameCode || "" : "",
    p_data_asof: dataAsof,
    p_kind: kind,
    p_context: kontext,
  };
}

/* Weiß das Spiel diese Zuordnung schon? Dann ist die Meldung kein Datenloch, sondern
   ein Missverständnis der Regel — etwa ein Feld, das den Verein gar nicht prüft.
   Die Ansicht sagt das vor dem Absenden, statt eine wertlose Meldung zu sammeln. */
export function bereitsBekannt(player, ziel, kind = "verein") {
  const { key } = zielPaar(kind, ziel);
  if (!key || !player) return false;
  const liste = kind === "titel" ? player.t : kind === "nation" ? player.nat : player.clubs;
  return !!liste?.includes(key);
}
