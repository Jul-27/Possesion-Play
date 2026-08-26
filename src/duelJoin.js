/* Einem Duell beitreten — die eine Stelle, an der der Gästeplatz beansprucht wird.

   WARUM ES DAS GIBT: Bis hierher stand diese Logik ausschließlich in der Lobby, im
   Ablauf „Code eintippen → Beitreten". Der Einladungslink `?game=CODE` führt aber
   direkt in die Spielansicht und ging an der Lobby vorbei — wer ihn öffnete, wurde
   nie als Spieler 2 eingetragen, blieb stiller Zuschauer, und beim Ersteller stand
   weiter „Warte auf Mitspieler". Der Link war damit genau für den Zweck unbrauchbar,
   für den es ihn gibt.

   Beide Wege rufen jetzt dasselbe auf. Getrennte Fassungen wären auseinander-
   gelaufen: Das Karussell braucht beim Beitritt eine Sonderbehandlung (siehe
   beitrittsFelder), und die hätte der zweite Weg mit Sicherheit nicht mitbekommen.

   Hier steht nur die REGEL, ohne Netz — der Datenbankzugriff liegt in
   duelJoinClient.js. Dieselbe Teilung wie bei reports.js/reportClient.js: so lässt
   sich die Karussell-Sonderregel testen, ohne Supabase hochzufahren. */
import { START_SECONDS } from "./gameData.js";
import { CAROUSEL_SECONDS } from "./carousel.js";

export const LAGE = {
  DABEI: "dabei",   // ich bin Ersteller oder schon eingetragener Gast
  FREI: "frei",     // der Gästeplatz ist frei, ich kann ihn nehmen
  VOLL: "voll",     // jemand anderes hat ihn
};

/** Reine Einordnung, ohne Netz: darf dieser Client dem Spiel beitreten? */
export function beitrittsLage(row, clientId) {
  if (!row || !clientId) return null;
  if (row.host_id === clientId || row.guest_id === clientId) return LAGE.DABEI;
  return row.guest_id ? LAGE.VOLL : LAGE.FREI;
}

/* Die Felder, die ein Beitritt setzt. Ausgelagert und rein, damit die Karussell-
   Sonderregel testbar ist: dort läuft die Frist PRO ZUG, nicht pro Partie, und sie
   darf erst mit dem Beitritt beginnen — sonst tickt sie herunter, während der
   Ersteller noch auf einen Gegner wartet, und der Gast verliert seinen ersten Zug
   noch vor dem ersten Blick aufs Brett. */
export function beitrittsFelder(row, clientId, name, jetzt = Date.now()) {
  const felder = {
    guest_id: clientId,
    status: "playing",
    names: { ...(row?.names || {}), 2: name },
    clocks: {
      ...(row?.clocks || { 1: START_SECONDS, 2: START_SECONDS, timeout: null }),
      started: new Date(jetzt).toISOString(),
    },
    updated_at: new Date(jetzt).toISOString(),
  };
  if (row?.board?.kind === "carousel") {
    felder.last_move = { ...(row.last_move || {}), frist: jetzt + CAROUSEL_SECONDS * 1000 };
  }
  return felder;
}

/* Die vier Duell-Modi unter dem Namen, den auch die Lobby zeigt. `board.kind` fehlt
   bei den ältesten Partien (dort war board noch ein reines Feld-Array) — die waren
   immer Hex. */
export const DUELL_NAME = {
  hex: "Hex-Duell", grid: "Raster-Duell", guess: "Errate den Star", carousel: "Transferkarussell",
};
export const duellName = (board) =>
  DUELL_NAME[board && !Array.isArray(board) ? board.kind : "hex"] || DUELL_NAME.hex;

/** Der Einladungslink eines Spiels — überall dieselbe Form. */
export const einladungsLink = (code) =>
  `${window.location.origin}${window.location.pathname}?game=${code}`;
