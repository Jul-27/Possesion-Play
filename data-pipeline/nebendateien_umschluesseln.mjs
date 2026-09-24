/*
 * nebendateien_umschluesseln.mjs — zieht die Nebendateien nach, wenn ein Spieler
 * umbenannt oder mit einem zweiten Datensatz verschmolzen wird.
 *
 * ── WOZU ────────────────────────────────────────────────────────────────────
 * apply_name_overrides.mjs benennt in players.js um und verschmilzt Dubletten. Vier
 * weitere Dateien sind aber ebenfalls über norm(name)|geburtsjahr verschlüsselt:
 *
 *   careerClubs.js      Stationen fürs Transferkarussell
 *   careerPathClubs.js  datierte Stationen für den Karriere-Pfad
 *   appearances.js      Einsätze und Tore je Verein
 *   playerImages.js     Fotos
 *
 * Ohne diesen Schritt zeigte der verschmolzene Spieler danach ins Leere: Das Foto
 * hinge am alten Namen, die Karussell-Stationen des zweiten Datensatzes fehlten. Im
 * Voll-Refresh baut sich jede dieser Dateien ohnehin neu aus players.js auf — dort
 * ist der Schritt harmlos; zwischen zwei Läufen hält er sie stimmig.
 *
 * Alle vier Dateien führen einen Eintrag je Zeile („  "schlüssel": wert,"). Das
 * Werkzeug arbeitet deshalb zeilenweise und fasst den übrigen Text nicht an.
 */
import { norm } from "../src/gameData.js";

const ZEILE = /^(\s+)("(?:[^"\\]|\\.)*"):\s(.*?)(,?)$/;

/**
 * Text einer Nebendatei umschlüsseln. `abbildung`: Map alterSchlüssel -> neuerSchlüssel.
 * `verschmelze(ziel, quelle)` vereinigt zwei Werte, wenn beide Schlüssel belegt sind.
 * Gibt { text, umbenannt, verschmolzen } zurück.
 */
export function umschluesseln(text, abbildung, verschmelze) {
  const zeilen = text.split("\n");
  const wo = new Map();
  zeilen.forEach((z, i) => {
    const m = z.match(ZEILE);
    if (m) wo.set(JSON.parse(m[2]), i);
  });
  let umbenannt = 0, verschmolzen = 0;
  const weg = new Set();
  for (const [von, nach] of abbildung) {
    if (von === nach || !wo.has(von)) continue;
    const iv = wo.get(von);
    const [, einzug, , wert, komma] = zeilen[iv].match(ZEILE);
    if (wo.has(nach)) {
      const iz = wo.get(nach);
      const [, ez, , zw, zk] = zeilen[iz].match(ZEILE);
      const neu = verschmelze(JSON.parse(zw), JSON.parse(wert));
      zeilen[iz] = `${ez}${JSON.stringify(nach)}: ${JSON.stringify(neu)}${zk}`;
      weg.add(iv);
      verschmolzen++;
    } else {
      zeilen[iv] = `${einzug}${JSON.stringify(nach)}: ${wert}${komma}`;
      wo.set(nach, iv);
      umbenannt++;
    }
    wo.delete(von);
  }
  return { text: zeilen.filter((_, i) => !weg.has(i)).join("\n"), umbenannt, verschmolzen };
}

/* Die Verschmelzungsregel je Datei. Immer: nichts verlieren, nichts doppeln. */
export const REGELN = {
  "careerClubs.js": (a, b) => [...new Set([...a, ...b])].sort((x, y) => x - y),
  "careerPathClubs.js": (a, b) => {
    const s = new Map([...a, ...b].map((t) => [JSON.stringify(t), t]));
    return [...s.values()].sort((x, y) => x[1] - y[1] || x[0] - y[0]);
  },
  /* Einsätze: je Verein der größere Wert — beide Datensätze beschreiben dieselben
     Stationen, der kleinere ist der unvollständige. */
  "appearances.js": (a, b) => {
    const max = (x = {}, y = {}) => {
      const out = { ...x };
      for (const [k, v] of Object.entries(y)) out[k] = Math.max(out[k] || 0, v);
      return out;
    };
    const { __tore: ta, ...ra } = a, { __tore: tb, ...rb } = b;
    const out = max(ra, rb);
    if (ta || tb) out.__tore = max(ta, tb);
    return out;
  },
  /* Ein Foto genügt; das des bleibenden Datensatzes hat Vorrang. */
  "playerImages.js": (a) => a,
};

/** NAME_OVERRIDES -> Map norm(from)|by -> norm(to)|(byTo ?? by). */
export function abbildungAus(overrides) {
  return new Map(overrides.map((o) => [`${norm(o.from)}|${o.by}`, `${norm(o.to)}|${o.byTo ?? o.by}`]));
}

/* Jeden `export const`-Block für sich: playerImages.js führt zwei Objekte, und
   derselbe Spieler kann in beiden stehen. */
export function umschluesselnText(text, abbildung, verschmelze) {
  const bloecke = text.split(/(?=^export const )/m);
  let umbenannt = 0, verschmolzen = 0;
  const neu = bloecke.map((b) => {
    const r = umschluesseln(b, abbildung, verschmelze);
    umbenannt += r.umbenannt; verschmolzen += r.verschmolzen;
    return r.text;
  });
  return { text: neu.join(""), umbenannt, verschmolzen };
}
