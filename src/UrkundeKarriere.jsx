import { Emblem } from "./Emblems.jsx";
import Trophaee from "./Trophaeen.jsx";

/* Die Laufbahn-Zusammenfassung — das Bild, das am Ende bleibt.

   ── WAS SIE ZEIGT UND WARUM SO ──────────────────────────────────────────────
   Oben die Person, daneben die Auswahl und die Einzelauszeichnungen, darunter eine
   Karte je Verein — in den Farben des Vereins, mit Wappen, Spielen, Toren, Vorlagen
   und den dort gewonnenen Trophäen. Damit liest sie sich, wie man eine Laufbahn
   erzählt: „Erst Sandhausen, dann drei Jahre Freiburg, dann Sevilla — und in Sevilla
   der Pokal."

   ── WARUM SIE KEIN SVG MEHR IST ─────────────────────────────────────────────
   Sie war ein SVG, weil sie sich als PNG speichern liess. Dafür musste sie auf alles
   Externe verzichten: Wappen als gezeichnete Scheibe mit Kürzel, Trophäen als Pfad.
   Eine Leinwand, in die ein SVG mit externen Bildern gezeichnet wird, lässt sich
   nicht mehr auslesen — der Export wäre genau dann gebrochen.

   Der Export ist weg, also fällt die Bedingung weg. Jetzt ist es gewöhnliches HTML
   mit den ECHTEN Wappen (dieselbe Emblem-Marke wie überall im Spiel, mit demselben
   Rückfall auf die gezeichnete Scheibe, wenn eine Datei fehlt) und denselben
   Trophäen wie in der Vitrine. Geteilt wird über den Teilen-Knopf darunter. */

/* Nationaltitel gehören ins Länderfeld, Vereinstitel auf die Vereinskarten. */
const NATIONAL = new Set(["WM", "EM", "CA"]);

/* Eine Vereinsmarke braucht key/c1/c2/pat; die Station trägt alles davon mit sich,
   weil sie aus derselben Vereinsliste gebaut wurde. */
const defAus = (s) => ({ type: "club", key: s.key, name: s.name, label: s.label || s.key,
  c1: s.c1, c2: s.c2 || "#FFFFFF", pat: s.pat || "solid" });

function Zahl({ wert, name }) {
  return <span className="ukZahl"><b>{wert}</b><small>{name}</small></span>;
}

export default function UrkundeKarriere({
  name, nummer, position, land, gesamt = {}, hoechste = 0, marktwert = "",
  titel = [], auszeichnungen = [], stationen = [], national = null, datum = "",
  torwart = false, abschluss = false, trainerschein = false,
}) {
  const nationalTitel = titel.filter((t) => NATIONAL.has(t.key));
  const bdo = titel.find((t) => t.key === "BDO");
  /* NICHT stationen.length: Wer zweimal bei PSV war, hat zwei Karten, aber einen
     Verein. Die Bilanzzeile darüber zählt die Vereine — die beiden Zahlen standen
     nebeneinander und widersprachen sich (7 gegen 8). */
  const vereine = new Set(stationen.map((s) => s.key)).size;

  return (
    <div className="ukKarriere">
      <div className="ukKopf">
        <section className="ukFeld ukPerson">
          <h4>Laufbahn beendet</h4>
          <b className="ukName">{name}</b>
          <p className="ukUnter">#{nummer} · {position} · {land}</p>
          <div className="ukZahlen">
            <Zahl wert={gesamt.spiele ?? 0} name="Spiele" />
            {/* Ein Torwart schießt keine Tore — seine Laufbahn misst sich an dem,
                was nicht passiert ist. */}
            {torwart ? (
              <>
                <Zahl wert={gesamt.gegentore ?? 0} name="Gegentore" />
                <Zahl wert={gesamt.westen ?? 0} name="Weiße Westen" />
              </>
            ) : (
              <>
                <Zahl wert={gesamt.tore ?? 0} name="Tore" />
                <Zahl wert={gesamt.vorlagen ?? 0} name="Vorlagen" />
              </>
            )}
            <Zahl wert={vereine} name="Vereine" />
          </div>
          <div className="ukRating">
            {/* Der Höchstwert der Laufbahn, nicht der Wert beim Rücktritt — sonst steht
                auf der Urkunde eine kleinere Zahl als in der Erinnerung. */}
            <small>Bestwert</small><b>{hoechste}</b>
            {marktwert ? <em>{marktwert}</em> : null}
          </div>
          {/* WAS NEBEN DEM PLATZ ENTSTANDEN IST. Der Schulabschluss kostete mit
              zwanzig einen Punkt Stärke und tauchte danach nirgends wieder auf —
              nicht einmal hier. Jetzt steht er da, und der Trainerschein, den er
              erst möglich macht, daneben. */}
          {(abschluss || trainerschein) && (
            <p className="ukBrief">
              {abschluss ? <span>Schulabschluss</span> : null}
              {trainerschein ? <span>Trainerschein</span> : null}
            </p>
          )}
        </section>

        <section className="ukFeld">
          <h4>Auswahl</h4>
          <b className="ukLand">{land}</b>
          {/* Die Länderspielbilanz stand bisher nur im Spielkopf; auf der Urkunde
              fehlte sie, obwohl dort Nationaltitel vergeben werden. */}
          {national && national.spiele
            ? <p className="ukUnter">
                {national.spiele} {national.spiele === 1 ? "Spiel" : "Spiele"}
                {torwart ? null : <>
                  {" · "}{national.tore} {national.tore === 1 ? "Tor" : "Tore"}
                  {" · "}{national.vorlagen} {national.vorlagen === 1 ? "Vorlage" : "Vorlagen"}
                </>}
              </p>
            : <p className="ukUnter">nie berufen</p>}
          <div className="ukPokale">
            {nationalTitel.length
              ? nationalTitel.map((t) => (
                  <span key={t.key} className="ukPokal">
                    <Trophaee titel={t.key} groesse={46} titelText={t.name} />
                    <small>{t.anzahl > 1 ? `${t.name} ×${t.anzahl}` : t.name}</small>
                  </span>
                ))
              : <span className="ukLeer">Vitrine leer</span>}
          </div>
        </section>

        <section className="ukFeld ukEhren">
          <h4>Einzelauszeichnungen</h4>
          {bdo ? (
            <span className="ukPokal">
              <Trophaee titel="BDO" groesse={46} titelText="Ballon d'Or" />
              <small>{bdo.anzahl > 1 ? `Ballon d'Or ×${bdo.anzahl}` : "Ballon d'Or"}</small>
            </span>
          ) : null}
          <ul className="ukListe">
            {auszeichnungen.map((a) => <li key={a.key}>{a.name}</li>)}
          </ul>
          {!bdo && !auszeichnungen.length ? <span className="ukLeer">keine</span> : null}
        </section>
      </div>

      <div className="ukVereine">
        {stationen.map((s, i) => (
          <article key={`${s.key}-${i}`} className="ukVerein" style={{ "--ukFarbe": s.c1 }}>
            <span className="ukWappen"><Emblem def={defAus(s)} /></span>
            <b className="ukVereinName">{s.name}</b>
            <div className="ukZahlen">
              <Zahl wert={s.spiele} name="SP" />
              {torwart ? <><Zahl wert={s.gegentore ?? 0} name="GT" /><Zahl wert={s.westen ?? 0} name="WW" /></>
                       : <><Zahl wert={s.tore} name="TO" /><Zahl wert={s.vorlagen} name="VO" /></>}
            </div>
            <div className="ukVereinPokale">
              {/* Ein Titel mit der Auswahl gehört ins Länderfeld, nicht auf die Karte des
                  Vereins, bei dem der Spieler damals unter Vertrag stand. */}
              {(s.titel || []).filter((tk) => !NATIONAL.has(tk)).map((tk, n) => (
                <Trophaee key={n} titel={tk} groesse={26} />
              ))}
            </div>
          </article>
        ))}
      </div>

      <p className="ukFuss">Possession Play · Karriere · {datum}</p>
    </div>
  );
}
