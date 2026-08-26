/* Das Infobox-Feld „Position" der deutschen Wikipedia in unser Vokabular übersetzen.

   Das Feld ist FREITEXT, und zwar in jeder Hinsicht: 62 verschiedene Schreibweisen
   in einer Stichprobe von 320 Spielern. Dieselbe Position heißt „Innenverteidiger",
   „Innenverteidigung" oder „Abwehr (Innenverteidiger)"; Torhüter stehen als „Torwart"
   oder „Tor"; Mehrfachpositionen sind mal durch Komma, mal durch Schrägstrich, mal
   durch <br /> getrennt. Bei Arjen Robben steckt eine vollständige
   Transfermarkt-Quellenangabe mit im Feld — ein naives Zerteilen an Satzzeichen
   machte daraus neun Positionen namens „url=https:", „profil" und „4360".

   Deshalb in dieser Reihenfolge: erst Vorlagen, Fußnoten und Kommentare ENTFERNEN,
   dann trennen, dann jedes Stück gegen ein geschlossenes Vokabular prüfen. Was nicht
   passt, wird gemeldet und nicht geraten. */
import { POS_BY_KEY } from "../src/positions.js";

/* Alles, was kein Positionstext ist. Vorlagen und Fußnoten müssen VOR dem Trennen
   raus, sonst zerfallen ihre Parameter in Scheinpositionen. */
export function saeubern(roh) {
  let s = String(roh || "");
  s = s.replace(/<!--[\s\S]*?-->/g, " ");
  s = s.replace(/<ref[^>]*\/>/gi, " ").replace(/<ref[\s\S]*?<\/ref>/gi, " ");
  // Vorlagen von innen nach außen abtragen — {{Internetquelle|titel={{!}}…}} ist verschachtelt.
  for (let i = 0; i < 5 && s.includes("{{"); i++) s = s.replace(/\{\{[^{}]*\}\}/g, " ");
  s = s.replace(/\{\{[\s\S]*$/, " ");          // unbalancierte Reste
  s = s.replace(/<br\s*\/?>/gi, "|");
  s = s.replace(/\[\[([^\]|]*\|)?/g, "").replace(/\]\]/g, "");
  s = s.replace(/<[^>]*>/g, " ");
  return s;
}

/* Trennzeichen: Komma, Schrägstrich, Semikolon, „und", Zeilenumbruch. Der Bindestrich
   NICHT — „Links-Außenverteidiger" ist eine Position, keine zwei.

   Kompakte Infoboxen schreiben mehrere Parameter in EINE Zeile
   („| position = Sturm | jugendvereine_tabelle ="). Der nachfolgende Parametername
   landete dadurch als Scheinposition im Ergebnis — 75-mal im vollen Lauf. Stücke mit
   einem Gleichheitszeichen sind nie Positionen und fliegen raus.

   ABFRAGE_WIKIDATA ist ein Platzhalter, mit dem ein Artikel die Angabe an Wikidata
   delegiert. Kein Fehler, nur nichts zu holen — deshalb still verworfen statt als
   Vokabellücke gemeldet. */
export function zerlegen(text) {
  return saeubern(text)
    .split(/\||,|;|\n|\s+und\s+|\s*\/\s*/)
    .map((t) => t.trim().replace(/^[-–—\s]+|[-–—\s.]+$/g, ""))
    .filter(Boolean)
    .filter((t) => !t.includes("=") && !/^ABFRAGE_WIKIDATA$/i.test(t));
}

/* Das Vokabular als geordnete Regelliste. Die REIHENFOLGE trägt die Bedeutung:
   „Rechter Außenverteidiger" muss vor „Außenverteidiger" stehen, „Offensives
   Mittelfeld" vor „Mittelfeld", sonst gewinnt der allgemeinere Begriff.

   GROB heißt: das ist nur eine der vier alten Gruppen, keine feine Position. Solche
   Angaben liefern nichts Neues und werden verworfen — sonst stünde bei der Hälfte
   aller Spieler „Sturm" als vermeintlich genaue Position. */
const GROB = Symbol("grobe Gruppe");
const REGELN = [
  // Tor
  [/^(fu(ß|ss)ball)?tor(wart|h(ü|ue)ter|frau)?$/i, "TW"],
  [/torwart|torh(ü|ue)ter|^tor$/i, "TW"],

  // Abwehr — Seiten vor der seitenlosen Variante
  [/libero|ausputzer/i, "LIB"],
  [/(rechte[rs]?|rechts)[\s-]*(au(ß|ss)en)?verteidig/i, "RV"],
  [/(linke[rs]?|links)[\s-]*(au(ß|ss)en)?verteidig/i, "LV"],
  /* Die Klammerform gibt es auch ohne „Außen": „Verteidigung (links)",
     „Verteidiger (rechts)". Zusammen 27-mal im vollen Lauf. */
  [/(au(ß|ss)en)?verteidig[a-zä]*\s*\(\s*rechts?\s*\)/i, "RV"],
  [/(au(ß|ss)en)?verteidig[a-zä]*\s*\(\s*links?\s*\)/i, "LV"],
  [/au(ß|ss)enverteidig|au(ß|ss)enbahn/i, "AV"],
  [/innenverteidig|vorstopper|mittell(ä|ae)ufer|zentrale[rs]?\s+abwehr/i, "IV"],
  [/abwehr\s*\(\s*innenverteidig/i, "IV"],

  /* Mittelfeld. Die Klammerform („Mittelfeld (defensiv)", „Mittelfeldspieler
     (offensiv)") ist im Bestand fast so häufig wie die Adjektivform und fehlte
     zunächst ganz — allein diese Schreibweisen kamen 80-mal vor. */
  [/defensive[rs]?\s+mittelfeld|mittelfeld[a-zä]*\s*\(\s*defensiv|sechser|abr(ä|ae)umer/i, "DM"],
  [/offensive[rs]?\s+mittelfeld|mittelfeld[a-zä]*\s*\(\s*offensiv|zehner|spielmacher|regisseur/i, "OM"],
  [/zentrale[rs]?\s+mittelfeld|mittelfeld[a-zä]*\s*\(\s*zentral|achter/i, "ZM"],
  [/(rechte[rs]?|rechts)[\s-]*mittelfeld|mittelfeld[a-zä]*\s*\(\s*rechts?\s*\)/i, "RM"],
  [/(linke[rs]?|links)[\s-]*mittelfeld|mittelfeld[a-zä]*\s*\(\s*links?\s*\)/i, "LM"],
  /* „Außenläufer" ist die Position des WM-Systems, die heute dem äußeren Mittelfeld
     entspricht — mit Seitenangabe entsprechend links oder rechts. */
  [/au(ß|ss)enl(ä|ae)ufer\s*\(\s*rechts?\s*\)/i, "RM"],
  [/au(ß|ss)enl(ä|ae)ufer\s*\(\s*links?\s*\)/i, "LM"],
  [/(ä|ae)u(ß|ss)ere[rs]?\s+mittelfeld|au(ß|ss)enmittelfeld|wing\s*half|au(ß|ss)enl(ä|ae)ufer/i, "AM"],

  // Sturm
  [/h(ä|ae)ngende\s+spitze|zweite\s+spitze|halbst(ü|ue)rmer/i, "HS"],
  [/(rechte[rs]?|rechts)[\s-]*(au(ß|ss)en|fl(ü|ue)gel)/i, "RA"],
  [/(linke[rs]?|links)[\s-]*(au(ß|ss)en|fl(ü|ue)gel)/i, "LA"],
  [/fl(ü|ue)gel|au(ß|ss)enst(ü|ue)rmer|au(ß|ss)enangreifer|au(ß|ss)ensturm/i, "FL"],
  [/mittelst(ü|ue)rmer|sturmspitze|mittelangriff|neuner/i, "MS"],

  // …und erst ganz zuletzt die groben Sammelbegriffe
  [/^(sturm|st(ü|ue)rmer(in)?|angriff|angreifer(in)?|angriffsspieler(in)?)$/i, GROB],
  [/^(mittelfeld|mittelfeldspieler(in)?)$/i, GROB],
  [/^(abwehr|abwehrspieler(in)?|verteidiger(in)?|verteidigung|defensive)$/i, GROB],
];

/* „Rechtes/Linkes Mittelfeld" — beim Trennen am Schrägstrich bleibt vom ersten Teil
   nur „Rechtes" übrig, das Substantiv steht erst hinten. Solche verkürzten Stücke
   bekommen das Substantiv des folgenden Stücks angehängt, sonst ginge die halbe
   Angabe verloren (Ashley Young stand dadurch nur als Linkes Mittelfeld da). */
const NUR_SEITE = /^(rechte[rs]?|linke[rs]?|rechts|links)$/i;
export function seitenErgaenzen(stuecke) {
  return stuecke.map((s, i) => {
    if (!NUR_SEITE.test(s)) return s;
    const naechstes = stuecke[i + 1];
    if (!naechstes) return s;
    const substantiv = naechstes.replace(/^(rechte[rs]?|linke[rs]?|rechts|links)[\s-]*/i, "").trim();
    return substantiv ? `${s} ${substantiv}` : s;
  });
}

/** Ein einzelnes Stück Text -> Positionsschlüssel, GROB oder null (unbekannt). */
export function deuten(stueck) {
  const s = String(stueck).trim();
  if (!s) return null;
  for (const [re, key] of REGELN) if (re.test(s)) return key;
  return null;
}

/**
 * Das ganze Feld -> { pp, grob, unbekannt }.
 *   pp         die feinen Positionen, in der Reihenfolge des Artikels, ohne Dubletten
 *   grob       true, wenn nur grobe Sammelbegriffe dastanden
 *   unbekannt  Textstücke, die zu nichts passten — für den Bericht, nicht fürs Raten
 *
 * „Rechtes/Linkes Mittelfeld" zerfällt beim Schrägstrich in zwei Stücke und ergibt
 * daher richtig RM und LM.
 */
export function positionenAusFeld(feld) {
  const pp = [];
  const unbekannt = [];
  let grob = false;
  for (const stueck of seitenErgaenzen(zerlegen(feld))) {
    const d = deuten(stueck);
    if (d === GROB) { grob = true; continue; }
    if (!d) { unbekannt.push(stueck); continue; }
    if (!pp.includes(d)) pp.push(d);
  }
  return { pp, grob: grob && !pp.length, unbekannt };
}

/** Das Feld „Position" aus dem Wikitext einer Spieler-Infobox. */
export function positionsFeld(wikitext) {
  const m = String(wikitext || "").match(/^\s*\|\s*position\s*=\s*(.*)$/mi);
  return m ? m[1] : null;
}

/* Kontrolle, dass Vokabular und Regeln nicht auseinanderlaufen: jede Regel muss auf
   einen bekannten Schlüssel zeigen. */
export const UNBEKANNTE_REGELZIELE = REGELN
  .map(([, k]) => k).filter((k) => k !== GROB && !POS_BY_KEY[k]);
