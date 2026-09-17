# Diese Bilder sind NICHT frei lizenziert

Die Fotos in diesem Ordner zeigen die echten Trophäen der Wettbewerbe. Sie stammen
aus Wikipedia und Wikimedia Commons; ein Teil steht unter freien Lizenzen, ein
anderer nicht — und die Trophäen selbst sind geschützte Entwürfe.

Der Eigentümer dieses Spiels hat sie am 18.09.2026 ausdrücklich eingesetzt, weil
das Spiel privat bleibt und nicht veröffentlicht wird.

**Vor einer Veröffentlichung muss dieser Ordner ersatzlos gelöscht werden.**
Danach greift von selbst der Rückfall: zuerst die erzeugten Aufnahmen unter
`../<form>.png`, dann die gezeichneten Formen in `src/Trophaeen.jsx`. Es bricht
nichts — es sehen nur wieder alle Meisterschaften gleich aus.

Geholt mit `data-pipeline/hole_pokalfotos.mjs`, danach von Hand durchgesehen:
Von 26 Wettbewerben war für 24 ein brauchbares Foto zu finden. Es fehlen nur die
Saudi Pro League und die J1 League — zu beiden führt Wikimedia keine Aufnahme der
Trophäe; sie behalten die erzeugte Schale.

Die Suche lief in zwei Durchgängen. Der erste über die Wikipedia-Artikelbilder
lieferte viel Falsches (Logos, Stadien, einmal die Trophäe der Baseball World
Series); der zweite über die Commons-Dateisuche und die Bilderlisten der Artikel
traf. Jedes Bild wurde einzeln angesehen.
