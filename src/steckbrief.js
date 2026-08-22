/* „Steckbrief" — reine Logik (kein React).

   Gesucht ist ein Spieler aus den aktuellen Kadern der Spielligen. Jeder Versuch ist
   selbst ein Spieler; verglichen werden nicht Buchstaben, sondern sechs Angaben aus
   seinem Steckbrief. Grün heißt „stimmt überein", grau „stimmt nicht".

   DREI ENTSCHEIDUNGEN, die das Spiel tragen:

   1. GERATEN WIRD NUR AUS DEM POOL. Wer die Bundesliga wählt, kann auch nur
      Bundesligaspieler nennen. Das ist keine Gängelung, sondern der Grund, warum das
      Spiel überhaupt lösbar ist: 500 Kandidaten lassen sich in acht Versuchen
      einkreisen, 27.000 nicht.

   2. NUR DAS ALTER BEKOMMT EINE RICHTUNG. Als reines Grün/Grau wäre die
      Alterskachel fast wertlos — zwei Spieler sind selten gleich alt, sie bliebe also
      praktisch immer grau. Mit ↑/↓ trägt jeder Fehlversuch etwas bei.
      Die Rückennummer bekommt bewusst KEINEN Pfeil, obwohl dasselbe Argument für sie
      spräche. Gemessen an 2886 Kandidaten (120 simulierte Partien je Variante): mit
      Pfeil bleiben nach drei Zügen im Median 4 Kandidaten übrig, ohne Pfeil 17. Zwei
      Zahlenpfeile zusammen machen aus dem Rätsel eine binäre Suche, die nach drei
      Zügen rechnerisch erledigt ist. Einer reicht.

   3. DIE LIGA-KACHEL ERSCHEINT NUR, WENN SIE ETWAS SAGT. Wer eine einzelne Liga
      wählt, hat sie schon beantwortet; dann bleiben fünf Kacheln.

   Fehlt einem Spieler eine Angabe, ist die Kachel „unbekannt" und wird nie grün.
   Lieber eine leere Kachel als eine erratene. */
import { norm, suggestPlayers, LEAGUES } from "./gameData.js";

export const VERSUCHE = 8;      // so viele Spieler dürfen genannt werden
export const TIPP_AB = 3;       // ab so vielen Fehlversuchen gibt es einen Hinweis

/* Untergrenze für das TAGESRÄTSEL. Der volle Pool enthält dritte Torhüter und
   Winterzugänge aus der zweiten Mannschaft; als Rätsel des Tages, das alle
   gemeinsam spielen, taugen die nicht. Beim freien Spiel gilt die Schwelle nicht —
   wer eine einzelne Liga wählt, darf ruhig auf den ganzen Kader treffen. */
export const TAGES_SL_MIN = 25;

/** Liga-Code -> Name. Kommt aus gameData, damit es die Namen nur einmal gibt. */
export const LIGA_NAME = Object.fromEntries(LEAGUES.map((l) => [l.key, l.name]));

/** Derselbe Spielerschlüssel wie in players.js und playerImages.js. */
export const keyOf = (s) => (s ? norm(s.n) + "|" + s.by : "");

/* ISO-Code -> Flaggen-Emoji. Zwei Buchstaben werden zu Regionalindikatoren; die
   Untercodes GB-ENG, GB-SCT, GB-WLS und GB-NIR brauchen die Tag-Sequenz, weil
   England, Schottland, Wales und Nordirland keine ISO-Länder sind. Nordirland hat
   auch als Tag-Sequenz kein Emoji und bleibt eine schwarze Fahne — der Ländername
   steht ohnehin daneben, die Flagge ist Beiwerk. */
export function flagge(iso) {
  if (!iso) return "";
  if (iso.length === 2) {
    return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  }
  const teile = [...iso.toLowerCase().replace(/-/g, "")];
  return "\u{1F3F4}" + teile.map((c) => String.fromCodePoint(0xe0000 + c.charCodeAt(0))).join("") + "\u{E007F}";
}

/* Kacheln in Anzeigereihenfolge.
   `pfeil`       zeigt bei Fehltreffern die Richtung zum Gesuchten
   `nurMehrliga` nur zeigen, wenn mehr als eine Liga im Pool ist
   `kurz`        Spaltenüberschrift. Sechs Spalten auf 375 px lassen für „Position"
                 keinen Platz — ausgeschrieben stieß es in die Nachbarspalte. */
export const KACHELN = [
  { key: "lg",    name: "Liga",     kurz: "Liga",   nurMehrliga: true },
  { key: "club",  name: "Verein",   kurz: "Verein" },
  { key: "po",    name: "Position", kurz: "Pos." },
  { key: "na",    name: "Nation",   kurz: "Nation" },
  { key: "alter", name: "Alter",    kurz: "Alter",  pfeil: true },
  { key: "nr",    name: "Nummer",   kurz: "Nr." },
];

export const POS_NAME = { TW: "Torwart", ABW: "Abwehr", MF: "Mittelfeld", ST: "Sturm" };

/** Alter am Stichtag. Ohne volles Geburtsdatum null — geschätzt wird nicht. */
export function alterAm(spieler, stichtag) {
  if (!spieler?.gb) return null;
  const [gj, gm, gt] = spieler.gb.split("-").map(Number);
  const [sj, sm, st] = String(stichtag).split("-").map(Number);
  return sj - gj - (sm < gm || (sm === gm && st < gt) ? 1 : 0);
}

/* Die sechs Werte eines Spielers, aufgelöst zu dem, was auf der Kachel steht.
   `ctx` liefert die Namenslisten aus squads.js und den Stichtag. */
export function werte(spieler, ctx) {
  const club = ctx.clubs[spieler?.c] || null;
  return {
    lg:    club?.[1] || null,
    club:  club?.[0] || null,
    po:    spieler?.po || null,
    na:    spieler?.na >= 0 ? ctx.nationen[spieler.na]?.[1] || null : null,
    alter: alterAm(spieler, ctx.stichtag),
    nr:    spieler?.nr || null,
  };
}

/** Anzuzeigender Text einer Kachel. */
export function kachelText(key, wert) {
  if (wert == null) return "?";
  if (key === "po") return POS_NAME[wert] || wert;
  return String(wert);
}

/* Ein Versuch, ausgewertet. Je Kachel:
     stand  "treffer" | "daneben" | "unbekannt"
     pfeil  "hoch" (der Gesuchte hat den höheren Wert) | "runter" | null   */
export function vergleiche(tipp, ziel, ctx) {
  const t = werte(tipp, ctx), z = werte(ziel, ctx);
  return sichtbareKacheln(ctx).map((k) => {
    const a = t[k.key], b = z[k.key];
    const stand = a == null || b == null ? "unbekannt" : a === b ? "treffer" : "daneben";
    return {
      key: k.key, name: k.name, wert: a, text: kachelText(k.key, a), stand,
      pfeil: k.pfeil && stand === "daneben" ? (b > a ? "hoch" : "runter") : null,
    };
  });
}

/** Kacheln dieser Partie — ohne Liga, wenn der Pool nur eine enthält. */
export function sichtbareKacheln(ctx) {
  return KACHELN.filter((k) => !k.nurMehrliga || ctx.mehrere);
}

/* ── Pool ──────────────────────────────────────────────────────────────────────
   Ratbar ist nur, wer alle sechs Angaben hat. Ein Spieler ohne Rückennummer wäre
   als Ziel unfair (die Kachel bliebe für jeden Versuch grau) und als Tipp wertlos. */
export function vollstaendig(spieler) {
  return !!(spieler?.gb && spieler?.nr && spieler?.po && spieler?.na >= 0);
}

/**
 * Indizes der spielbaren Spieler.
 * @param ligen  Liga-Codes; leer = alle
 * @param minSl  Mindest-Bekanntheit (nur fürs Tagesziel, nicht fürs Raten)
 */
export function pool(spieler, clubs, ligen = [], minSl = 0) {
  const erlaubt = ligen.length ? new Set(ligen) : null;
  const out = [];
  for (let i = 0; i < spieler.length; i++) {
    const s = spieler[i];
    if (!vollstaendig(s)) continue;
    if (erlaubt && !erlaubt.has(clubs[s.c]?.[1])) continue;
    if ((s.sl || 0) < minSl) continue;
    out.push(i);
  }
  return out;
}

/* Rendezvous-Hashing wie beim Daily-Star: es gewinnt der kleinste Hash aus Datum und
   stabilem Spielerschlüssel. Ein Datenupdate verschiebt das Tagesziel dadurch nur,
   wenn genau der Gewinner wegfällt — nicht bei jeder Kaderänderung. Bei einem Modus,
   dessen Datenbasis sich jede Woche bewegt, ist das der ganze Unterschied. */
function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}

function besterHash(datum, spieler, kandidaten) {
  let best = kandidaten[0], bestH = Infinity;
  for (const i of kandidaten) {
    const s = spieler[i];
    const h = hashStr(`steckbrief:${datum}|${norm(s.n)}|${s.by}`);
    if (h < bestH) { bestH = h; best = i; }
  }
  return best;
}

const tagVersetzt = (datum, tage) =>
  new Date(Date.parse(datum) + tage * 86400000).toISOString().slice(0, 10);

/* Wie lange ein Spieler nach seinem Auftritt gesperrt bleibt. Der Tagestopf umfasst
   nur die 386 Spieler mit Foto; zieht man daraus 365-mal, häufen sich Wiederholungen.

   GEMESSEN an genau diesem Topf über ein Jahr: ohne Sperre wiederholen 56 von 365
   Tagen ein Ziel aus den letzten 90 Tagen, mit Sperre noch 16. Kein völliger Ausschluss
   — die Sperrliste enthält die UNGESPERRTEN Vortagssieger, nicht deren tatsächliche
   Ziele (siehe zielDesTages) — aber gut zwei Drittel weniger, für 12 ms Rechenzeit
   einmal beim Laden. Ein lückenloses Verfahren gäbe es (den Topf als Permutation
   durchlaufen), es kostete aber die Stabilität gegenüber Datenläufen: nach einem
   Kader-Update bekäme jeder, der den Tag noch nicht begonnen hat, ein anderes Rätsel
   als sein Freund, der schon gespielt hat. Beim Rendezvous-Verfahren passiert das nur,
   wenn genau der Tagessieger aus dem Kader fällt. */
export const MEIDEN_TAGE = 90;

/**
 * Das Ziel eines Tages.
 * @param meidenTage  so viele Vortage werden gemieden (0 = keine Sperre)
 *
 * Gesperrt werden die UNGESPERRTEN Gewinner der Vortage, nicht deren tatsächliche
 * Ziele. Sonst hinge jeder Tag rekursiv an allen früheren und wäre nicht mehr
 * berechenbar. Die Sperre ist dadurch nicht ganz lückenlos, drückt die Wiederholungen
 * im Fenster aber praktisch auf null.
 */
export function zielDesTages(datum, spieler, kandidaten, meidenTage = 0) {
  if (!kandidaten.length) return -1;
  if (!meidenTage) return besterHash(datum, spieler, kandidaten);
  const gesperrt = new Set();
  for (let d = 1; d <= meidenTage; d++) {
    gesperrt.add(besterHash(tagVersetzt(datum, -d), spieler, kandidaten));
  }
  const frei = kandidaten.filter((i) => !gesperrt.has(i));
  return besterHash(datum, spieler, frei.length ? frei : kandidaten);
}

/* ── Hinweis ───────────────────────────────────────────────────────────────────
   Ab drei Fehlversuchen darf eine Kachel des GESUCHTEN aufgedeckt werden. Welche,
   entscheidet der Spieler — ein zufälliger Hinweis wäre mal geschenkt, mal wertlos. */
export function hinweisText(key, ziel, ctx) {
  const kachel = sichtbareKacheln(ctx).find((k) => k.key === key);
  if (!kachel) return null;
  return `${kachel.name}: ${kachelText(key, werte(ziel, ctx)[key])}`;
}

/* ── Vorschlagsliste ───────────────────────────────────────────────────────────
   Nur Spieler aus dem Pool, und schon Genannte fallen raus. suggestPlayers stammt
   aus gameData.js und wird hier bewusst wiederverwendet: dieselbe Normalisierung,
   dieselbe Sortierung, dieselbe Behandlung von Umlauten wie überall sonst. */
/** Einmal je Partie bauen, nicht je Tastendruck: suggestPlayers braucht Objekte. */
export function kandidatenListe(spieler, indizes) {
  return indizes.map((i) => ({ ...spieler[i], _i: i }));
}

export function vorschlaege(liste, query, genannt = [], limit = 8) {
  const raus = new Set(genannt);
  return suggestPlayers(liste.filter((p) => !raus.has(p._i)), query, limit).map((p) => p._i);
}

/* ── Ergebnis ──────────────────────────────────────────────────────────────────
   Das Emoji-Raster zeigt je Versuch eine Zeile mit einer Kachel je Spalte. Die
   Pfeile bleiben drin: ohne sie sähen zwei völlig verschiedene Partien gleich aus. */
export function shareGrid(zeilen) {
  return zeilen.map((k) => k.map((z) =>
    z.stand === "treffer" ? "🟩" : z.pfeil === "hoch" ? "🔼" : z.pfeil === "runter" ? "🔽" : "⬜",
  ).join("")).join("\n");
}

export function shareText(nummer, zeilen, gewonnen, url, hinweis = false) {
  const kopf = `Steckbrief #${nummer} ${gewonnen ? `${zeilen.length}/${VERSUCHE}` : `X/${VERSUCHE}`}${hinweis ? " 💡" : ""}`;
  return `${kopf}\n${shareGrid(zeilen)}\n${url}`;
}
