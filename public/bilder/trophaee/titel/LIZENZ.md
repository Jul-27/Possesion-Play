# Diese Bilder sind NICHT frei lizenziert

Der Eigentümer dieses Spiels hat sie am 18.09.2026 ausdrücklich eingesetzt, weil
das Spiel privat bleibt und nicht veröffentlicht wird.

**Vor einer Veröffentlichung muss dieser Ordner ersatzlos gelöscht werden.**
Danach greift von selbst der Rückfall: Für Champions League, Europa League, WM
und EM übernehmen die gezeichneten Grundformen aus `src/Trophaeen.jsx`. Es bricht
nichts — es sehen dann nur diese vier weniger genau aus.

## Die vier PNG: freigestellte Trophäen aus Copero

`CL.png`, `EL.png`, `WM.png` und `EM.png` stammen aus dem Vorbild
(copero.org, `/assets/trophies/`). Sie sind fremde Arbeit und wurden auf
ausdrücklichen Wunsch 1:1 übernommen.

Mehr gibt es dort nicht: Coperos `trophy-assets.js` führt 41 Wettbewerbe, aber nur
diese vier Dateien liegen tatsächlich auf dem Server; alle übrigen antworten mit
404, auch auf den anderen Copero-Adressen. Eine fünfte, `CA.png`, lag hier kurz
unter diesem Namen — sie war in Wahrheit ein Foto samt Vitrinenscheibe und ist
wieder weg. Die Copa América ist jetzt gezeichnet wie die übrigen 21.

## Die 24 JPG: Fotos der echten Trophäen

`*.jpg` zeigen die echten Trophäen, geholt aus Wikipedia und Wikimedia Commons
mit `data-pipeline/hole_pokalfotos.mjs` und danach einzeln durchgesehen. Von 26
Wettbewerben war für 24 ein brauchbares Foto zu finden; zur Saudi Pro League und
zur J1 League führt Wikimedia keine Aufnahme.

**Das Spiel zeigt sie seit dem 18.09.2026 nicht mehr.** An ihre Stelle sind die
22 gezeichneten Trophäen getreten (`src/trophaeenFormen.js`), weil ein Satz aus
24 Fotos in 24 Lichtsituationen neben vier freigestellten Bildern kein Satz war.
Die Dateien liegen nur noch zum Vergleich hier und können ersatzlos weg; der
Befehl oben holt sie jederzeit wieder.
