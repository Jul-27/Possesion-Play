import { DATA_ASOF, FIXES_ASOF } from "./dataInfo.js";

const de = (iso) => iso.split("-").reverse().join(".");

/* Eine Stelle für alle Ansichten — vorher stand diese Zeile zehnmal im Code und war
   in Game.jsx bereits auseinandergelaufen.

   DATA_ASOF und FIXES_ASOF sind bewusst getrennt: Kader, Transfers und Titel stammen
   aus dem letzten Wikidata-Abruf, während kuratierte Namenskorrekturen später
   nachgezogen werden können. Beides in einem Datum zu führen ließe den Datenstand
   frischer aussehen, als er ist. Die Korrekturzeile erscheint nur, wenn sie abweicht. */
export default function DataStamp({ note }) {
  return (
    <p className="dataStamp">
      Datenstand: {de(DATA_ASOF)} · Quelle: Wikidata
      {FIXES_ASOF && FIXES_ASOF !== DATA_ASOF ? ` · Korrekturen: ${de(FIXES_ASOF)}` : ""}
      {note ? ` — ${note}` : ""}
    </p>
  );
}
