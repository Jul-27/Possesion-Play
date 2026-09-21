# Diese vier Bilder sind NICHT frei lizenziert

`CL.png`, `EL.png`, `WM.png` und `EM.png` sind freigestellte Trophäen aus dem
Vorbild (copero.org, `/assets/trophies/`). Sie sind fremde Arbeit und wurden auf
ausdrücklichen Wunsch 1:1 übernommen, weil das Spiel privat bleibt und nicht
veröffentlicht wird.

**Vor einer Veröffentlichung muss dieser Ordner ersatzlos gelöscht werden.**
Danach greift von selbst der Rückfall: Für diese vier Wettbewerbe übernehmen die
gezeichneten Grundformen aus `src/Trophaeen.jsx`. Es bricht nichts — es sehen dann
nur diese vier weniger genau aus.

Mehr gibt es dort nicht: Coperos `trophy-assets.js` führt 41 Wettbewerbe, aber nur
diese vier Dateien liegen tatsächlich auf dem Server; alle übrigen antworten mit
404, auch auf den anderen Copero-Adressen. Eine fünfte, `CA.png`, lag hier kurz
unter diesem Namen — sie war in Wahrheit ein Foto samt Vitrinenscheibe.

Die übrigen 22 Trophäen sind gezeichnet und brauchen keine Datei; warum, steht in
`src/trophaeenFormen.js`.

## Was hier einmal lag: 24 Fotos der echten Trophäen

Bis zum 20.09.2026 standen hier zusätzlich `*.jpg` — Fotos der echten Trophäen aus
Wikipedia und Wikimedia Commons. Sie sind gelöscht: Seit die 22 gezeichneten
Trophäen da sind, hat das Spiel sie nicht mehr angezeigt, und 24 Fotos in 24
Lichtsituationen waren ohnehin kein Satz.

`data-pipeline/hole_pokalfotos.mjs` holt sie in einem Lauf zurück, falls sie doch
noch einmal gebraucht werden.
