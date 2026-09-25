#!/usr/bin/env node
/*
 * finde_doppel.mjs — sucht Doppel-Datensätze, die ein Lauf angelegt hat, und belegt
 * jede Paarung an Wikidata. SCHREIBT NICHTS.
 *
 *   node data-pipeline/finde_doppel.mjs .stand-vor-lauf/players.js
 *
 * ── WOZU ────────────────────────────────────────────────────────────────────
 * Der Schlüssel eines Spielers ist norm(name)|geburtsjahr. Ändert Wikidata das
 * Label — durch eine echte Umbenennung („Álex Grimaldo" → „Alejandro Grimaldo")
 * oder durch Vandalismus („Gareth Bale" → „Gareth Bal") —, dann passt der Schlüssel
 * nicht mehr, und der nächste Lauf legt einen ZWEITEN Datensatz an. Der neue bekommt
 * die frischen Titel und Stationen, der alte behält die Vereine. Im Spiel stehen
 * danach zwei Personen, von denen keine vollständig ist.
 *
 * Gemessen am Lauf vom 12.09.2026: 107 neue Datensätze, darunter ein „Lionel Andrés
 * Messi" mit sieben Titeln neben einem „Lionel Messi" ohne einen einzigen.
 *
 * ── DER BELEG ───────────────────────────────────────────────────────────────
 * Vorgeschlagen wird eine Paarung nur, wenn EINE Wikidata-Entität beide Namen
 * trägt: den neuen als Label oder Alias, den alten ebenso — und ihr Geburtsjahr
 * zu unserem Datensatz passt. Damit kann die Tabelle keine zwei verschiedenen
 * Personen zusammenlegen, bloss weil ihre Nachnamen gleich klingen.
 */
import { pathToFileURL } from "url";
import { norm } from "../src/gameData.js";

const UA = "PossessionPlay/1.0 (https://github.com/Jul-27; duplicate check)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const letztes = (s) => norm(s).split(/\s+/).filter(Boolean).pop();

/** Kandidatenpaare: neuer Datensatz + Bestandsdatensatz, der dieselbe Person sein kann. */
export function kandidaten(vorher, nachher) {
  const key = (p) => `${norm(p.n)}|${p.by}`;
  const alt = new Set(vorher.map(key));
  const neu = nachher.filter((p) => !alt.has(key(p)));
  const bestand = nachher.filter((p) => alt.has(key(p)));
  const paare = [];
  for (const n of neu) {
    for (const b of bestand) {
      const gleicherJahrgang = b.by === n.by;
      const gleicherNachname = letztes(b.n) === letztes(n.n);
      const gleicherName = norm(b.n) === norm(n.n);
      /* Zwei Muster: gleicher Jahrgang mit gleichem Nachnamen (Rufname vs Vollname),
         oder derselbe Name mit kaputtem Jahrgang (Wikidata-Datum verunglückt). */
      const kaputtesJahr = gleicherName && (!n.by || n.by < 1880);
      if ((gleicherJahrgang && gleicherNachname) || kaputtesJahr) paare.push({ neu: n, alt: b });
    }
  }
  return paare;
}

/* ── IM GANZEN BESTAND ──────────────────────────────────────────────────────
   `kandidaten` oben vergleicht nur, was ein Lauf NEU angelegt hat. Dubletten aus
   älteren Läufen sieht es nicht mehr — gemessen am 25.09.2026 standen noch Paare wie
   „Falcao"/„Radamel Falcao", „Éder Militão"/„Éder Gabriel Militão" oder zweimal
   „Didi" (1928 und 1929) im Bestand. Die Regel hier ist enger, weil sie über alle
   34.000 Spieler läuft statt über hundert neue:
     · gleicher Jahrgang, und die Namensteile des kürzeren stecken alle im längeren
       („falcao" ⊂ „radamel falcao"), oder
     · gleicher Jahrgang, gleicher Nachname und mindestens ein gemeinsamer Verein
       („Jonny Otto"/„Jonathan Castro Otto"), oder
     · derselbe Name, ein Jahr auseinander, mit gemeinsamem Verein (Didi).
   Brüder erfüllt die zweite Regel auch (Frank/Ronald de Boer) — deshalb bleibt der
   Beleg an EINER Wikidata-Entität Pflicht. */
/* Apostrophe gleichsetzen: „Samuel Eto'o" und „Samuel Eto’o" standen als zwei
   Personen im Bestand, weil norm() die beiden Zeichen unterscheidet. */
const teile = (s) => norm(s).replace(/[’‘`´]/g, "'").split(/[\s-]+/).filter(Boolean);
const stationen = (p) => new Set([...(p.clubs || []), ...(p.cp || []).map((c) => c[0])]);

export function kandidatenImBestand(players) {
  const nachJahr = new Map();
  for (const p of players) (nachJahr.get(p.by) || nachJahr.set(p.by, []).get(p.by)).push(p);
  const paare = [];
  const gemeinsam = (a, b) => { const s = stationen(a); return [...stationen(b)].some((c) => s.has(c)); };
  for (const [by, liste] of nachJahr) {
    const nachbarn = nachJahr.get(by + 1) || [];
    for (let i = 0; i < liste.length; i++) {
      const a = liste[i], ta = teile(a.n);
      for (let j = i + 1; j < liste.length; j++) {
        const b = liste[j], tb = teile(b.n);
        if (norm(a.n) === norm(b.n)) continue;
        const [kurz, lang] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
        const enthalten = kurz.every((t) => lang.includes(t));
        const nachname = ta.at(-1) === tb.at(-1) && gemeinsam(a, b);
        if (enthalten || nachname) paare.push({ neu: a, alt: b });
      }
      for (const b of nachbarn) {
        if (norm(a.n) === norm(b.n) && gemeinsam(a, b)) paare.push({ neu: a, alt: b });
      }
    }
  }
  return paare;
}

/* ── DRITTE QUELLE: EINE PERSON, ZWEI LABELS ────────────────────────────────
   Umschriften fallen durch beide Regeln oben — „Andriy Yarmolenko" und „Andrij
   Jarmolenko" teilen kein einziges Namensteil. Wikidata verrät sie trotzdem: Eine
   Kaderabfrage liefert je Person das englische UND das deutsche Label. Zeigen beide
   auf zwei verschiedene Datensätze mit gleichem Jahrgang, ist das ein Kandidat.
   `zeilen`: [{ namen: [en, de], by }] aus den Nationalmannschaftskadern. */
export function kandidatenAusLabels(players, zeilen) {
  const idx = new Map(players.map((p) => [`${norm(p.n)}|${p.by}`, p]));
  const paare = new Map();
  for (const { namen, by } of zeilen) {
    const treffer = [...new Set(namen.filter(Boolean).map((n) => idx.get(`${norm(n)}|${by}`)).filter(Boolean))];
    for (let i = 0; i < treffer.length; i++) for (let j = i + 1; j < treffer.length; j++) {
      const [a, b] = [treffer[i], treffer[j]].sort((x, y) => x.n.localeCompare(y.n));
      paare.set(`${a.n}|${b.n}|${by}`, { neu: a, alt: b });
    }
  }
  return [...paare.values()];
}

async function kaderZeilen(teams) {
  const zeilen = [];
  for (const qid of teams) {
    const q = `SELECT DISTINCT ?en ?de ?by WHERE { ?p p:P54 ?st . ?st ps:P54 wd:${qid} .
      ?p wdt:P106 wd:Q937857 ; wdt:P569 ?d . BIND(YEAR(?d) AS ?by)
      ?p rdfs:label ?en FILTER(LANG(?en) = "en") ?p rdfs:label ?de FILTER(LANG(?de) = "de")
      FILTER(?en != ?de) }`;
    let rows = null;
    for (let v = 0; v < 6 && !rows; v++) {
      const r = await fetch("https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q),
        { headers: { "User-Agent": UA, Accept: "application/sparql-results+json" } }).catch(() => null);
      if (r?.ok) { try { rows = (await r.json()).results.bindings; } catch { /* nochmal */ } }
      if (!rows) await sleep(10000 * (v + 1));
    }
    if (!rows) throw new Error(`Kader ${qid}: WDQS antwortet nicht`);
    for (const b of rows) if (b.by) zeilen.push({ namen: [b.en.value, b.de.value], by: Number(b.by.value) });
    await sleep(1200);
  }
  return zeilen;
}

/** Alle Namen einer Entität: Labels und Aliase in allen Sprachen, plus dewiki-Titel. */
async function namenVonQid(qid) {
  const u = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  const d = (await (await fetch(u, { headers: { "User-Agent": UA } })).json()).entities?.[qid];
  if (!d) return null;
  const namen = new Set();
  for (const l of Object.values(d.labels || {})) namen.add(norm(l.value));
  for (const liste of Object.values(d.aliases || {})) for (const a of liste) namen.add(norm(a.value));
  const dewiki = d.sitelinks?.dewiki?.title || null;
  if (dewiki) namen.add(norm(dewiki));
  const jahr = (d.claims?.P569?.[0]?.mainsnak?.datavalue?.value?.time || "").match(/(\d{4})/)?.[1];
  return { namen, dewiki, jahr: jahr ? Number(jahr) : null };
}

async function sucheQid(name) {
  const u = "https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=de&uselang=de"
    + "&type=item&limit=8&search=" + encodeURIComponent(name);
  const d = await (await fetch(u, { headers: { "User-Agent": UA } })).json();
  return (d.search || []).map((s) => s.id);
}

/* ── BELEG FÜR DEN BESTAND: JEDER DATENSATZ FÜR SICH ─────────────────────────
   Die Regel für neue Datensätze (eine Entität trägt beide Namen) ist im ganzen
   Bestand zu schwach: Raúl González und Raúl Tamudo sind beide Jahrgang 1977, und
   trägt Tamudos Eintrag den Alias „Raúl", lägen zwei Personen zusammen. Deshalb wird
   hier JEDER Datensatz einzeln einer Entität zugeordnet, und das Geburtsjahr muss
   passen. Verschmolzen wird nur, wenn beide auf DIESELBE Entität zeigen.

     1. Über den Artikeltitel der englischen und deutschen Wikipedia, samt
        Weiterleitungen (ausTiteln). Das trägt den Großteil.
     2. Nur für Rufnamen ohne Artikel, deren Partner Stufe 1 schon aufgelöst hat:
        Wikidata-Suche, Label vor Alias, bei mehreren Treffern nichts (zuordnen). */
const API = "https://www.wikidata.org/w/api.php";
/* Bei Drosselung (429) wächst die Pause: 5, 10, 20, 40 s. Mit fünf gleichzeitigen
   Suchen und festen 3 s lief ein Lauf nach wenigen hundert Anfragen ins Leere. */
const holen = async (params) => {
  for (let v = 0; v < 6; v++) {
    try {
      const r = await fetch(`${API}?${new URLSearchParams({ format: "json", ...params })}`, { headers: { "User-Agent": UA } });
      if (r.ok) return await r.json();
    } catch { /* nochmal */ }
    await sleep(5000 * 2 ** v);
  }
  throw new Error("Wikidata antwortet nicht");
};

const ohneKlammer = (t) => t.replace(/\s*\([^)]*\)\s*$/, "");

/** wbgetentities-Entität -> { primaer: Set, alias: Set, jahre: Set, en, de, dewiki, enwiki }. */
export function entitaet(e) {
  const primaer = new Set(), alias = new Set();
  for (const l of Object.values(e.labels || {})) primaer.add(norm(l.value));
  for (const sl of ["dewiki", "enwiki"]) {
    const t = e.sitelinks?.[sl]?.title;
    if (t) { primaer.add(norm(t)); primaer.add(norm(ohneKlammer(t))); }
  }
  for (const liste of Object.values(e.aliases || {})) for (const a of liste) alias.add(norm(a.value));
  const jahre = new Set((e.claims?.P569 || []).filter((c) => c.rank !== "deprecated" && c.mainsnak?.datavalue)
    .map((c) => Number(c.mainsnak.datavalue.value.time.match(/^[+-]?(\d+)/)[1])));
  return { primaer, alias, jahre, en: e.labels?.en?.value || null, de: e.labels?.de?.value || null,
    dewiki: e.sitelinks?.dewiki?.title || null, enwiki: e.sitelinks?.enwiki?.title || null };
}

/** Welche Entität ist dieser Datensatz? QID oder null (keine oder mehrdeutig). */
export function zuordnen(p, entitaeten, jahre = [p.by]) {
  const n = norm(p.n);
  const passt = (e) => jahre.some((j) => e.jahre.has(j));
  for (const stufe of ["primaer", "alias"]) {
    const treffer = [...entitaeten].filter(([, e]) => passt(e) && e[stufe].has(n)).map(([q]) => q);
    if (treffer.length === 1) return treffer[0];
    if (treffer.length > 1) return null;
  }
  return null;
}

/** Aus den über Artikeltitel gefundenen IDs die eine, deren Geburtsjahr passt —
    oder null, wenn keine oder mehrere übrig bleiben (en und de uneins). */
export function ausTiteln(qids, ents, jahre) {
  const passend = [...new Set(qids)].filter((q) => ents.has(q) && jahre.some((j) => ents.get(q).jahre.has(j)));
  return passend.length === 1 ? passend[0] : null;
}

/** Welcher Name bleibt? { p, regel }.
    0. Sperrliste (KEIN_ZIEL); bei reinem Apostroph-Unterschied der eintippbare Name
    1. der deutsche Artikeltitel — von Menschen gepflegt und kaum vandaliert; das
       englische Label war es nicht: André Onana hieß dort „Andrcu Onana", Darko
       Brašanac „Garikoitz Brašanac" (gemessen am 25.09.2026)
    2. der Rufname, wenn er ganz im anderen Namen steckt — „Pablo Iñiguez" statt
       „Pablo Íñiguez de Heredia Larraz", auch wenn das englische Label der Vollname ist
    3. das englische Label, 4. das deutsche Label, 5. sonst der kürzere Name. */
/* Namen, die nie Ziel werden dürfen — vandalierte oder verschriebene englische
   Labels, die ein Paar sonst über Regel 3 gewönnen (gefunden am 25.09.2026). */
export const KEIN_ZIEL = new Set([
  "Zé cuscuz da pimba",   // Warley Silva dos Santos, Q-Label vandaliert
  "Macnelly Torress",     // Macnelly Torres, doppeltes s im Label
]);

const TYPO_APOSTROPH = /[’‘`´]/;
const ohneApostroph = (s) => norm(s).replace(/['’‘`´]/g, "");

export function besterName(a, b, e, geschuetzt = new Set()) {
  /* Von Hand gepflegte Zielnamen (NAME_OVERRIDES ohne diese Datei) sind geprüft und
     teils gemeldet — „Javier Hernández" bleibt, auch wenn der deutsche Artikel
     „Chicharito" heißt. */
  const g = (p) => geschuetzt.has(`${p.n}|${p.by}`);
  if (g(a) !== g(b)) return { p: g(a) ? a : b, regel: "kuratiert" };
  if (KEIN_ZIEL.has(a.n) !== KEIN_ZIEL.has(b.n)) return { p: KEIN_ZIEL.has(a.n) ? b : a, regel: "sperrliste" };
  /* 0. Unterscheiden sich die Namen nur im Apostroph, gewinnt der eintippbare:
     Die deutsche Wikipedia schreibt „Eto’o", im Spiel tippt jeder „eto'o". */
  if (ohneApostroph(a.n) === ohneApostroph(b.n) && TYPO_APOSTROPH.test(a.n) !== TYPO_APOSTROPH.test(b.n)) {
    return { p: TYPO_APOSTROPH.test(a.n) ? b : a, regel: "tippbar" };
  }
  const gleich = (p, soll) => soll && norm(p.n) === norm(soll);
  const dewiki = e.dewiki && ohneKlammer(e.dewiki);
  for (const p of [a, b]) if (gleich(p, dewiki)) return { p, regel: "dewiki" };
  const [ta, tb] = [teile(a.n), teile(b.n)];
  if (ta.length < tb.length && ta.every((t) => tb.includes(t))) return { p: a, regel: "rufname" };
  if (tb.length < ta.length && tb.every((t) => ta.includes(t))) return { p: b, regel: "rufname" };
  for (const [regel, soll] of [["en", e.en], ["de", e.de]]) {
    for (const p of [a, b]) if (gleich(p, soll)) return { p, regel };
  }
  return { p: b.n.length < a.n.length ? b : a, regel: "kürzer" };
}

async function pruefeBestand(ausgabe) {
  const players = (await import(new URL("../src/players.js", import.meta.url).href + "?t=" + Date.now())).PLAYERS;
  const { NAT_TEAM_QID } = await import("./wikidata_national.mjs");
  const { NAME_OVERRIDES } = await import("./name_overrides.mjs");
  const { DUBLETTEN } = await import("./dubletten.mjs");
  const eigene = new Set(DUBLETTEN.map((o) => `${o.from}|${o.by}`));
  const geschuetzt = new Set(NAME_OVERRIDES.filter((o) => !eigene.has(`${o.from}|${o.by}`))
    .map((o) => `${o.to}|${o.byTo ?? o.by}`));
  const ausLabels = kandidatenAusLabels(players, await kaderZeilen(Object.values(NAT_TEAM_QID)));
  const schon = new Set();
  const paare = [];
  for (const x of [...kandidatenImBestand(players), ...ausLabels]) {
    const k = [`${x.neu.n}|${x.neu.by}`, `${x.alt.n}|${x.alt.by}`].sort().join("~");
    if (!schon.has(k)) { schon.add(k); paare.push(x); }
  }
  console.log(`  davon ${ausLabels.length} aus Kader-Labels (Umschriften)`);
  const beteiligt = new Map();
  for (const { neu, alt } of paare) for (const p of [neu, alt]) beteiligt.set(`${p.n}|${p.by}`, p);
  console.log(`${paare.length} Kandidatenpaare, ${beteiligt.size} Datensätze — Suche bei Wikidata …`);

  /* Über die Artikeltitel statt über die Suche: Die Wikipedia-API löst 50 Namen je
     Anfrage auf, folgt Weiterleitungen („Heung-min Son" → „Son Heung-min") und
     liefert die Wikidata-ID mit. Die Suche kostete vier Anfragen je Datensatz und lief
     nach wenigen hundert in die Drosselung (25.09.2026). Begriffsklärungsseiten
     zählen nicht — „Pedro" ist keine Person. */
  const qidsVon = new Map([...beteiligt.keys()].map((k) => [k, []]));
  for (const wiki of ["en", "de"]) {
    const namen = [...new Set([...beteiligt.values()].flatMap((p) => [p.n, ohneKlammer(p.n)]))];
    const aufgeloest = new Map();
    for (let j = 0; j < namen.length; j += 50) {
      const r = await fetch(`https://${wiki}.wikipedia.org/w/api.php?${new URLSearchParams({
        format: "json", action: "query", redirects: "1", prop: "pageprops",
        ppprop: "wikibase_item|disambiguation", titles: namen.slice(j, j + 50).join("|"),
      })}`, { headers: { "User-Agent": UA } }).then((x) => x.json());
      const weiter = new Map();
      for (const x of [...(r.query?.normalized || []), ...(r.query?.redirects || [])]) weiter.set(x.from, x.to);
      const qid = new Map(Object.values(r.query?.pages || {})
        .filter((pg) => pg.pageprops?.wikibase_item && !("disambiguation" in pg.pageprops))
        .map((pg) => [pg.title, pg.pageprops.wikibase_item]));
      for (const n of namen.slice(j, j + 50)) {
        let t = n;
        for (let h = 0; h < 3 && weiter.has(t); h++) t = weiter.get(t);
        if (qid.has(t)) aufgeloest.set(n, qid.get(t));
      }
      await sleep(250);
    }
    for (const [k, p] of beteiligt) {
      for (const n of [p.n, ohneKlammer(p.n)]) if (aufgeloest.has(n)) qidsVon.get(k).push(aufgeloest.get(n));
    }
    console.log(`  ${wiki}.wikipedia: ${aufgeloest.size} von ${namen.length} Namen aufgelöst`);
  }
  /* ZWEITE STUFE, nur für Rufnamen ohne Artikel („Falcao" ist in der englischen
     Wikipedia eine Begriffsklärung): Suche bei Wikidata, und die Zuordnung muss
     eindeutig sein — Label vor Alias, Jahrgang passend (zuordnen). Nur Datensätze,
     deren Partner schon über einen Titel aufgelöst ist; alles andere wäre Raten. */
  const offeneNamen = new Map();
  for (const { neu, alt } of paare) {
    const [ka, kb] = [`${neu.n}|${neu.by}`, `${alt.n}|${alt.by}`];
    if (!qidsVon.get(ka).length && qidsVon.get(kb).length) offeneNamen.set(ka, neu);
    if (!qidsVon.get(kb).length && qidsVon.get(ka).length) offeneNamen.set(kb, alt);
  }
  const suchTreffer = new Map();
  for (const [k, p] of offeneNamen) {
    const qs = new Set();
    for (const language of ["en", "de"]) {
      const d = await holen({ action: "wbsearchentities", language, uselang: language, type: "item", limit: "10", search: ohneKlammer(p.n) });
      for (const x of d.search || []) qs.add(x.id);
      await sleep(150);
    }
    suchTreffer.set(k, [...qs]);
  }
  console.log(`  Suche für ${offeneNamen.size} Rufnamen ohne Artikel`);

  const alle = [...new Set([...qidsVon.values(), ...suchTreffer.values()].flat())];
  const ents = new Map();
  for (let j = 0; j < alle.length; j += 50) {
    const d = await holen({ action: "wbgetentities", ids: alle.slice(j, j + 50).join("|"),
      props: "labels|aliases|claims|sitelinks", sitefilter: "dewiki|enwiki" });
    for (const [q, e] of Object.entries(d.entities || {})) if (!e.missing) ents.set(q, entitaet(e));
    await sleep(150);
  }

  /* ZWEI JAHRGÄNGE: welcher stimmt? Wikidata führt dann meist beide (daher die
     Dublette) oder nur den falschen — Enzo Maresca steht dort mit 1981, geboren ist
     er 1980. Die Geburtsjahr-Kategorien beider Wikipedias entscheiden; widersprechen
     sie sich oder schweigen sie, bleibt das Paar liegen. */
  const jahrBelegt = new Map();
  const jahrFrage = async (e, jahre) => {
    const treffer = new Set();
    for (const [wiki, titel, kat] of [["de", e.dewiki, (j) => `Kategorie:Geboren ${j}`], ["en", e.enwiki, (j) => `Category:${j} births`]]) {
      if (!titel) continue;
      const r = await fetch(`https://${wiki}.wikipedia.org/w/api.php?${new URLSearchParams({
        format: "json", action: "query", prop: "categories", titles: titel, clcategories: jahre.map(kat).join("|"),
      })}`, { headers: { "User-Agent": UA } }).then((x) => x.json());
      for (const pg of Object.values(r.query?.pages || {})) for (const c of pg.categories || []) {
        const j = jahre.find((y) => c.title === kat(y));
        if (j) treffer.add(j);
      }
      await sleep(150);
    }
    return treffer.size === 1 ? [...treffer][0] : null;
  };

  const zuord = (p, jahre) => {
    const k = `${p.n}|${p.by}`;
    if (qidsVon.get(k).length) return ausTiteln(qidsVon.get(k), ents, jahre);
    const kandidaten = new Map((suchTreffer.get(k) || []).filter((q) => ents.has(q)).map((q) => [q, ents.get(q)]));
    return zuordnen(p, kandidaten, jahre);
  };
  const belegt = [], offen = [];
  for (const { neu, alt } of paare) {
    const jahre = [...new Set([neu.by, alt.by])];
    const qa = zuord(neu, jahre), qb = zuord(alt, jahre);
    if (!qa || qa !== qb) { offen.push({ a: `${neu.n}|${neu.by}`, b: `${alt.n}|${alt.by}`, qa, qb }); continue; }
    const e = ents.get(qa);
    let ziel, regel = "jahrgang";
    if (neu.by !== alt.by) {
      const k = `${qa}|${jahre.join(",")}`;
      if (!jahrBelegt.has(k)) jahrBelegt.set(k, await jahrFrage(e, jahre));
      const j = jahrBelegt.get(k);
      if (!j) { offen.push({ a: `${neu.n}|${neu.by}`, b: `${alt.n}|${alt.by}`, qa, qb, grund: "Jahrgang unklar" }); continue; }
      ziel = neu.by === j ? neu : alt;
    } else ({ p: ziel, regel } = besterName(neu, alt, e, geschuetzt));
    const weg = ziel === neu ? alt : neu;
    belegt.push({ from: weg.n, by: weg.by, to: ziel.n, ...(ziel.by !== weg.by ? { byTo: ziel.by } : {}), src: qa,
      sl: Math.max(neu.sl || 0, alt.sl || 0), regel, en: e.en, dewiki: e.dewiki });
  }
  const { writeFileSync } = await import("fs");
  writeFileSync(ausgabe, JSON.stringify({ belegt, offen }, null, 1));
  console.log(`belegt: ${belegt.length} · nicht belegt: ${offen.length} -> ${ausgabe}`);
}

async function main() {
  if (process.argv.includes("--bestand")) {
    return pruefeBestand(process.argv[process.argv.indexOf("--bestand") + 1] || "doppel-bestand.json");
  }
  const vorherPfad = process.argv[2] || ".stand-vor-lauf/players.js";
  const vorher = (await import(pathToFileURL(vorherPfad).href)).PLAYERS;
  const nachher = (await import(new URL("../src/players.js", import.meta.url).href + "?t=" + Date.now())).PLAYERS;

  const paare = kandidaten(vorher, nachher);
  console.log(`${paare.length} Kandidatenpaare — jedes wird an Wikidata geprüft\n`);

  const belegt = [], offen = [];
  for (const { neu, alt } of paare) {
    let gefunden = null;
    for (const qid of [...new Set([...(await sucheQid(alt.n)), ...(await sucheQid(neu.n))])].slice(0, 8)) {
      const e = await namenVonQid(qid);
      await sleep(120);
      if (!e) continue;
      /* Beide Namen an EINER Entität, und ihr Geburtsjahr passt zu unserem gültigen
         Datensatz — sonst ist es nicht dieselbe Person. */
      if (e.namen.has(norm(neu.n)) && e.namen.has(norm(alt.n)) && e.jahr === alt.by) { gefunden = { qid, ...e }; break; }
    }
    const zeile = `  { from: ${JSON.stringify(neu.n)}, by: ${neu.by}, to: ${JSON.stringify(alt.n)},`
      + ` src: ${JSON.stringify(gefunden?.qid || "")} },`;
    if (gefunden) { belegt.push(zeile + `  // ${gefunden.dewiki || ""}`); }
    else offen.push(`  ${neu.n} | ${neu.by}  <->  ${alt.n} | ${alt.by}   (kein gemeinsamer Beleg)`);
    await sleep(200);
  }

  console.log(`── belegt (${belegt.length}) — fertig für NAME_OVERRIDES ──`);
  console.log(belegt.join("\n"));
  console.log(`\n── unbelegt (${offen.length}) — von Hand ansehen, NICHT übernehmen ──`);
  console.log(offen.join("\n"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

/* Ketten auflösen: Aus A→B und B→C wird A→C und B→C. applyOverrides benennt jeden
   Datensatz nur einmal um — eine Kette ließe A beim Zwischennamen B stehen, als
   eigene Person. Kreise (die es bei eindeutiger Namensregel nicht geben darf)
   werden gemeldet statt still gebrochen. */
export function kettenAufloesen(belegt) {
  const nach = new Map(belegt.map((b) => [`${b.from}|${b.by}`, b]));
  const out = [];
  for (const b of belegt) {
    let ziel = { n: b.to, by: b.byTo ?? b.by };
    const gesehen = new Set([`${b.from}|${b.by}`]);
    while (nach.has(`${ziel.n}|${ziel.by}`)) {
      const k = `${ziel.n}|${ziel.by}`;
      if (gesehen.has(k)) throw new Error(`Kreis bei ${k}`);
      gesehen.add(k);
      const n = nach.get(k);
      ziel = { n: n.to, by: n.byTo ?? n.by };
    }
    out.push({ ...b, to: ziel.n, ...(ziel.by !== b.by ? { byTo: ziel.by } : {}) });
  }
  /* Dieselbe Quelle kann in mehreren Paaren vorkommen — einmal genügt. */
  return [...new Map(out.map((o) => [`${o.from}|${o.by}`, o])).values()];
}
