/* ──────────────────────────────────────────────────────────────────────────
   POSSESSION PLAY — Spieldaten & reine Logik (kein React, kein Supabase)
   Validierung ist deterministisch: Verein über clubs[], Nation über nat[],
   Alter über Geburtsjahr by. Dadurch kann jeder Client einen Zug selbst prüfen.
   ────────────────────────────────────────────────────────────────────────── */

export const P = {
  1: { name: "Spieler 1", c1: "#2DD4BF", c2: "#0D9488", glow: "rgba(45,212,191,.55)" },
  2: { name: "Spieler 2", c1: "#FB7185", c2: "#BE123C", glow: "rgba(251,113,133,.55)" },
};

const LG_COUNTRY = { BL: "GER", PL: "ENG", LL: "ESP", SA: "ITA", L1: "FRA", PT: "POR", NL: "NED" };

export const CLUBS = [
  { key: "FCB", lg: "BL", label: "FCB", name: "FC Bayern München",        c1: "#DC052D", c2: "#fff",     pat: "solid"   },
  { key: "BVB", lg: "BL", label: "BVB", name: "Borussia Dortmund",        c1: "#FDE100", c2: "#111",     pat: "stripesH" },
  { key: "RBL", lg: "BL", label: "RBL", name: "RB Leipzig",               c1: "#DD0741", c2: "#001F47",  pat: "solid"   },
  { key: "B04", lg: "BL", label: "B04", name: "Bayer 04 Leverkusen",      c1: "#E32221", c2: "#111",     pat: "halvesV" },
  { key: "SGE", lg: "BL", label: "SGE", name: "Eintracht Frankfurt",      c1: "#111",    c2: "#E1000F",  pat: "stripesV" },
  { key: "BMG", lg: "BL", label: "BMG", name: "Borussia Mönchengladbach", c1: "#fff",    c2: "#111",     pat: "halvesH" },
  { key: "VFB", lg: "BL", label: "VFB", name: "VfB Stuttgart",            c1: "#fff",    c2: "#E32219",  pat: "solid"   },
  { key: "WOB", lg: "BL", label: "WOB", name: "VfL Wolfsburg",            c1: "#65B32E", c2: "#fff",     pat: "solid"   },
  { key: "SVW", lg: "BL", label: "SVW", name: "Werder Bremen",            c1: "#1D9053", c2: "#fff",     pat: "solid"   },
  { key: "MCI", lg: "PL", label: "MCI", name: "Manchester City",          c1: "#6CABDD", c2: "#1C2C5B",  pat: "solid"   },
  { key: "MUN", lg: "PL", label: "MUN", name: "Manchester United",        c1: "#DA291C", c2: "#111",     pat: "solid"   },
  { key: "LIV", lg: "PL", label: "LIV", name: "Liverpool",                c1: "#C8102E", c2: "#fff",     pat: "solid"   },
  { key: "CHE", lg: "PL", label: "CHE", name: "Chelsea",                  c1: "#034694", c2: "#fff",     pat: "solid"   },
  { key: "ARS", lg: "PL", label: "ARS", name: "Arsenal",                  c1: "#EF0107", c2: "#fff",     pat: "solid"   },
  { key: "TOT", lg: "PL", label: "TOT", name: "Tottenham Hotspur",        c1: "#fff",    c2: "#132257",  pat: "solid"   },
  { key: "NEW", lg: "PL", label: "NEW", name: "Newcastle United",         c1: "#111",    c2: "#fff",     pat: "stripesV" },
  { key: "EVE", lg: "PL", label: "EVE", name: "Everton",                  c1: "#003399", c2: "#fff",     pat: "solid"   },
  { key: "AVL", lg: "PL", label: "AVL", name: "Aston Villa",              c1: "#670E36", c2: "#95BFE5",  pat: "halvesV" },
  { key: "BAR", lg: "LL", label: "BAR", name: "FC Barcelona",             c1: "#A50044", c2: "#004D98",  pat: "stripesV" },
  { key: "RMA", lg: "LL", label: "RMA", name: "Real Madrid",             c1: "#fff",    c2: "#FEBE10",  pat: "solid"   },
  { key: "ATM", lg: "LL", label: "ATM", name: "Atlético Madrid",          c1: "#CB3524", c2: "#fff",     pat: "stripesV" },
  { key: "SEV", lg: "LL", label: "SEV", name: "FC Sevilla",               c1: "#fff",    c2: "#D81E05",  pat: "solid"   },
  { key: "VAL", lg: "LL", label: "VAL", name: "FC Valencia",              c1: "#fff",    c2: "#F4A100",  pat: "solid"   },
  { key: "VIL", lg: "LL", label: "VIL", name: "FC Villarreal",            c1: "#FFE667", c2: "#005187",  pat: "solid"   },
  { key: "JUV", lg: "SA", label: "JUV", name: "Juventus",                 c1: "#111",    c2: "#fff",     pat: "stripesV" },
  { key: "MIL", lg: "SA", label: "MIL", name: "AC Mailand",               c1: "#FB090B", c2: "#111",     pat: "stripesV" },
  { key: "INT", lg: "SA", label: "INT", name: "Inter Mailand",            c1: "#0068A8", c2: "#111",     pat: "stripesV" },
  { key: "NAP", lg: "SA", label: "NAP", name: "SSC Neapel",               c1: "#12A0D7", c2: "#fff",     pat: "solid"   },
  { key: "ROM", lg: "SA", label: "ROM", name: "AS Rom",                   c1: "#8E1F2F", c2: "#F0BC42",  pat: "halvesV" },
  { key: "LAZ", lg: "SA", label: "LAZ", name: "Lazio Rom",                c1: "#87D8F7", c2: "#fff",     pat: "solid"   },
  { key: "PSG", lg: "L1", label: "PSG", name: "Paris Saint-Germain",      c1: "#004170", c2: "#DA291C",  pat: "stripesV" },
  { key: "ASM", lg: "L1", label: "ASM", name: "AS Monaco",               c1: "#E63312", c2: "#fff",     pat: "halvesV" },
  { key: "OM",  lg: "L1", label: "OM",  name: "Olympique Marseille",      c1: "#2FAEE0", c2: "#fff",     pat: "solid"   },
  { key: "OL",  lg: "L1", label: "OL",  name: "Olympique Lyon",           c1: "#fff",    c2: "#1B4DA1",  pat: "solid"   },
  { key: "LIL", lg: "L1", label: "LIL", name: "OSC Lille",                c1: "#E01E13", c2: "#fff",     pat: "solid"   },
  { key: "POR", lg: "PT", label: "POR", name: "FC Porto",                 c1: "#1452C8", c2: "#fff",     pat: "stripesV" },
  { key: "SLB", lg: "PT", label: "SLB", name: "Benfica Lissabon",         c1: "#E30613", c2: "#fff",     pat: "solid"   },
  { key: "SCP", lg: "PT", label: "SCP", name: "Sporting Lissabon",        c1: "#1A8A4C", c2: "#fff",     pat: "stripesH" },
  { key: "AJA", lg: "NL", label: "AJA", name: "Ajax Amsterdam",           c1: "#fff",    c2: "#D2122E",  pat: "halvesV" },
  { key: "PSV", lg: "NL", label: "PSV", name: "PSV Eindhoven",            c1: "#EC1C24", c2: "#fff",     pat: "solid"   },
  { key: "FEY", lg: "NL", label: "FEY", name: "Feyenoord Rotterdam",      c1: "#fff",    c2: "#E30613",  pat: "halvesV" },
].map((c) => ({ ...c, type: "club", country: LG_COUNTRY[c.lg] }));

export const NATIONS = [
  { key: "FRA", label: "FRA", name: "Frankreich",      flag: { kind: "v",  colors: ["#0055A4", "#fff", "#EF4135"] } },
  { key: "GER", label: "GER", name: "Deutschland",     flag: { kind: "h",  colors: ["#111", "#DD0000", "#FFCE00"] } },
  { key: "ESP", label: "ESP", name: "Spanien",         flag: { kind: "hw", colors: ["#AA151B", "#F1BF00", "#AA151B"], weights: [1, 2, 1] } },
  { key: "ITA", label: "ITA", name: "Italien",         flag: { kind: "v",  colors: ["#009246", "#fff", "#CE2B37"] } },
  { key: "NED", label: "NED", name: "Niederlande",     flag: { kind: "h",  colors: ["#AE1C28", "#fff", "#21468B"] } },
  { key: "BEL", label: "BEL", name: "Belgien",         flag: { kind: "v",  colors: ["#111", "#FDDA24", "#EF3340"] } },
  { key: "CRO", label: "CRO", name: "Kroatien",        flag: { kind: "h",  colors: ["#FF0000", "#fff", "#171796"] } },
  { key: "ENG", label: "ENG", name: "England",         flag: { kind: "cross", colors: ["#fff", "#CE1124"] } },
  { key: "PRT", label: "PRT", name: "Portugal",        flag: { kind: "portugal" } },
  { key: "JPN", label: "JPN", name: "Japan",           flag: { kind: "circle", colors: ["#fff", "#BC002D"] } },
  { key: "BRA", label: "BRA", name: "Brasilien",       flag: { kind: "diamond" } },
  { key: "ARG", label: "ARG", name: "Argentinien",     flag: { kind: "h",  colors: ["#74ACDF", "#fff", "#74ACDF"] } },
  { key: "MEX", label: "MEX", name: "Mexiko",          flag: { kind: "v",  colors: ["#006847", "#fff", "#CE1126"] } },
  { key: "NGA", label: "NGA", name: "Nigeria",         flag: { kind: "v",  colors: ["#008751", "#fff", "#008751"] } },
  { key: "CIV", label: "CIV", name: "Elfenbeinküste",  flag: { kind: "v",  colors: ["#F77F00", "#fff", "#009E60"] } },
  { key: "SEN", label: "SEN", name: "Senegal",         flag: { kind: "v",  colors: ["#00853F", "#FDEF42", "#E31B23"] } },
  { key: "COL", label: "COL", name: "Kolumbien",       flag: { kind: "hw", colors: ["#FCD116", "#003893", "#CE1126"], weights: [2, 1, 1] } },
  { key: "USA", label: "USA", name: "USA",             flag: { kind: "canton" } },
].map((n) => ({ ...n, type: "nat" }));

// Nur DB-prüfbare Spezialfelder (Geburtsjahr).
export const SPECIALS = [
  { key: "Y2K", label: "AB 2000",   icon: "🎂", name: "Geboren ab 2000",   c1: "#34D399", c2: "#065f46", test: (p) => p.by >= 2000 },
  { key: "N90", label: "90ER JG.",  icon: "📅", name: "Geboren 1990–1999", c1: "#A78BFA", c2: "#5b21b6", test: (p) => p.by >= 1990 && p.by <= 1999 },
  { key: "OLD", label: "VOR 1990",  icon: "⏳", name: "Geboren vor 1990",  c1: "#94a3b8", c2: "#475569", test: (p) => p.by < 1990 },
].map((s) => ({ ...s, type: "spec" }));

/* Eingebettete Spielerdaten — kuratierter DEMO-Seed.
   Ersetze dieses Array durch den Inhalt von players_game.js (aus make_game_json.py),
   um die vollständige Datenbank zu nutzen. */
export const PLAYERS = [
  { n: "Lionel Messi", ln: "Messi", by: 1987, nat: ["ARG"], clubs: ["BAR", "PSG"] },
  { n: "Cristiano Ronaldo", ln: "Ronaldo", by: 1985, nat: ["PRT"], clubs: ["SCP", "MUN", "RMA", "JUV"] },
  { n: "Kylian Mbappé", ln: "Mbappé", by: 1998, nat: ["FRA"], clubs: ["ASM", "PSG", "RMA"] },
  { n: "Erling Haaland", ln: "Haaland", by: 2000, nat: [], clubs: ["BVB", "MCI"] },
  { n: "Jude Bellingham", ln: "Bellingham", by: 2003, nat: ["ENG"], clubs: ["BVB", "RMA"] },
  { n: "Vinícius Júnior", ln: "Vinícius Júnior", by: 2000, nat: ["BRA"], clubs: ["RMA"] },
  { n: "Vitinha", ln: "Vitinha", by: 2000, nat: ["PRT"], clubs: ["POR", "PSG"] },
  { n: "Pedri", ln: "Pedri", by: 2002, nat: ["ESP"], clubs: ["BAR"] },
  { n: "Gavi", ln: "Gavi", by: 2004, nat: ["ESP"], clubs: ["BAR"] },
  { n: "Lamine Yamal", ln: "Yamal", by: 2007, nat: ["ESP"], clubs: ["BAR"] },
  { n: "Robert Lewandowski", ln: "Lewandowski", by: 1988, nat: [], clubs: ["BVB", "FCB", "BAR"] },
  { n: "Toni Kroos", ln: "Kroos", by: 1990, nat: ["GER"], clubs: ["FCB", "B04", "RMA"] },
  { n: "Thomas Müller", ln: "Müller", by: 1989, nat: ["GER"], clubs: ["FCB"] },
  { n: "Manuel Neuer", ln: "Neuer", by: 1986, nat: ["GER"], clubs: ["FCB"] },
  { n: "Joshua Kimmich", ln: "Kimmich", by: 1995, nat: ["GER"], clubs: ["RBL", "FCB"] },
  { n: "Leon Goretzka", ln: "Goretzka", by: 1995, nat: ["GER"], clubs: ["FCB"] },
  { n: "Jamal Musiala", ln: "Musiala", by: 2003, nat: ["GER"], clubs: ["FCB"] },
  { n: "Florian Wirtz", ln: "Wirtz", by: 2003, nat: ["GER"], clubs: ["B04", "LIV"] },
  { n: "Kai Havertz", ln: "Havertz", by: 1999, nat: ["GER"], clubs: ["B04", "CHE", "ARS"] },
  { n: "Leroy Sané", ln: "Sané", by: 1996, nat: ["GER"], clubs: ["MCI", "FCB"] },
  { n: "Serge Gnabry", ln: "Gnabry", by: 1995, nat: ["GER"], clubs: ["ARS", "SVW", "FCB"] },
  { n: "İlkay Gündoğan", ln: "Gündoğan", by: 1990, nat: ["GER"], clubs: ["BVB", "MCI", "BAR"] },
  { n: "Antonio Rüdiger", ln: "Rüdiger", by: 1993, nat: ["GER"], clubs: ["VFB", "ROM", "CHE", "RMA"] },
  { n: "Mats Hummels", ln: "Hummels", by: 1988, nat: ["GER"], clubs: ["FCB", "BVB", "ROM"] },
  { n: "Mesut Özil", ln: "Özil", by: 1988, nat: ["GER"], clubs: ["SVW", "RMA", "ARS"] },
  { n: "Philipp Lahm", ln: "Lahm", by: 1983, nat: ["GER"], clubs: ["FCB"] },
  { n: "Bastian Schweinsteiger", ln: "Schweinsteiger", by: 1984, nat: ["GER"], clubs: ["FCB", "MUN"] },
  { n: "Miroslav Klose", ln: "Klose", by: 1978, nat: ["GER"], clubs: ["SVW", "FCB", "LAZ"] },
  { n: "Marco Reus", ln: "Reus", by: 1989, nat: ["GER"], clubs: ["BMG", "BVB"] },
  { n: "Mario Götze", ln: "Götze", by: 1992, nat: ["GER"], clubs: ["BVB", "FCB", "PSV", "SGE"] },
  { n: "Kevin De Bruyne", ln: "De Bruyne", by: 1991, nat: ["BEL"], clubs: ["CHE", "WOB", "MCI"] },
  { n: "Romelu Lukaku", ln: "Lukaku", by: 1993, nat: ["BEL"], clubs: ["EVE", "MUN", "INT", "CHE", "ROM"] },
  { n: "Eden Hazard", ln: "Hazard", by: 1991, nat: ["BEL"], clubs: ["LIL", "CHE", "RMA"] },
  { n: "Thibaut Courtois", ln: "Courtois", by: 1992, nat: ["BEL"], clubs: ["ATM", "CHE", "RMA"] },
  { n: "Harry Kane", ln: "Kane", by: 1993, nat: ["ENG"], clubs: ["TOT", "FCB"] },
  { n: "Bukayo Saka", ln: "Saka", by: 2001, nat: ["ENG"], clubs: ["ARS"] },
  { n: "Phil Foden", ln: "Foden", by: 2000, nat: ["ENG"], clubs: ["MCI"] },
  { n: "Declan Rice", ln: "Rice", by: 1999, nat: ["ENG"], clubs: ["ARS"] },
  { n: "Raheem Sterling", ln: "Sterling", by: 1994, nat: ["ENG"], clubs: ["LIV", "MCI", "CHE"] },
  { n: "Marcus Rashford", ln: "Rashford", by: 1997, nat: ["ENG"], clubs: ["MUN"] },
  { n: "Jack Grealish", ln: "Grealish", by: 1995, nat: ["ENG"], clubs: ["AVL", "MCI"] },
  { n: "Trent Alexander-Arnold", ln: "Alexander-Arnold", by: 1998, nat: ["ENG"], clubs: ["LIV", "RMA"] },
  { n: "Wayne Rooney", ln: "Rooney", by: 1985, nat: ["ENG"], clubs: ["EVE", "MUN"] },
  { n: "Frank Lampard", ln: "Lampard", by: 1978, nat: ["ENG"], clubs: ["CHE", "MCI"] },
  { n: "Steven Gerrard", ln: "Gerrard", by: 1980, nat: ["ENG"], clubs: ["LIV"] },
  { n: "David Beckham", ln: "Beckham", by: 1975, nat: ["ENG"], clubs: ["MUN", "RMA", "MIL", "PSG"] },
  { n: "Mohamed Salah", ln: "Salah", by: 1992, nat: [], clubs: ["CHE", "ROM", "LIV"] },
  { n: "Sadio Mané", ln: "Mané", by: 1992, nat: ["SEN"], clubs: ["LIV", "FCB"] },
  { n: "Virgil van Dijk", ln: "van Dijk", by: 1991, nat: ["NED"], clubs: ["LIV"] },
  { n: "Luka Modrić", ln: "Modrić", by: 1985, nat: ["CRO"], clubs: ["TOT", "RMA", "MIL"] },
  { n: "Karim Benzema", ln: "Benzema", by: 1987, nat: ["FRA"], clubs: ["OL", "RMA"] },
  { n: "Antoine Griezmann", ln: "Griezmann", by: 1991, nat: ["FRA"], clubs: ["ATM", "BAR"] },
  { n: "Paul Pogba", ln: "Pogba", by: 1993, nat: ["FRA"], clubs: ["MUN", "JUV"] },
  { n: "N'Golo Kanté", ln: "Kanté", by: 1991, nat: ["FRA"], clubs: ["CHE"] },
  { n: "Olivier Giroud", ln: "Giroud", by: 1986, nat: ["FRA"], clubs: ["ARS", "CHE", "MIL"] },
  { n: "Sergio Ramos", ln: "Ramos", by: 1986, nat: ["ESP"], clubs: ["SEV", "RMA", "PSG"] },
  { n: "Gerard Piqué", ln: "Piqué", by: 1987, nat: ["ESP"], clubs: ["MUN", "BAR"] },
  { n: "Andrés Iniesta", ln: "Iniesta", by: 1984, nat: ["ESP"], clubs: ["BAR"] },
  { n: "Xavi", ln: "Xavi", by: 1980, nat: ["ESP"], clubs: ["BAR"] },
  { n: "Sergio Busquets", ln: "Busquets", by: 1988, nat: ["ESP"], clubs: ["BAR"] },
  { n: "Jordi Alba", ln: "Alba", by: 1989, nat: ["ESP"], clubs: ["VAL", "BAR"] },
  { n: "Rodri", ln: "Rodri", by: 1996, nat: ["ESP"], clubs: ["VIL", "ATM", "MCI"] },
  { n: "Neymar", ln: "Neymar", by: 1992, nat: ["BRA"], clubs: ["BAR", "PSG"] },
  { n: "Casemiro", ln: "Casemiro", by: 1992, nat: ["BRA"], clubs: ["POR", "RMA", "MUN"] },
  { n: "Thiago Silva", ln: "Silva", by: 1984, nat: ["BRA"], clubs: ["MIL", "PSG", "CHE"] },
  { n: "Marquinhos", ln: "Marquinhos", by: 1994, nat: ["BRA"], clubs: ["ROM", "PSG"] },
  { n: "Alisson", ln: "Alisson", by: 1992, nat: ["BRA"], clubs: ["ROM", "LIV"] },
  { n: "Ederson", ln: "Ederson", by: 1993, nat: ["BRA"], clubs: ["SLB", "MCI"] },
  { n: "Gabriel Jesus", ln: "Jesus", by: 1997, nat: ["BRA"], clubs: ["MCI", "ARS"] },
  { n: "Rodrygo", ln: "Rodrygo", by: 2001, nat: ["BRA"], clubs: ["RMA"] },
  { n: "Lautaro Martínez", ln: "Martínez", by: 1997, nat: ["ARG"], clubs: ["INT"] },
  { n: "Ángel Di María", ln: "Di María", by: 1988, nat: ["ARG"], clubs: ["SLB", "RMA", "MUN", "PSG", "JUV"] },
  { n: "Paulo Dybala", ln: "Dybala", by: 1993, nat: ["ARG"], clubs: ["JUV", "ROM"] },
  { n: "Gianluigi Buffon", ln: "Buffon", by: 1978, nat: ["ITA"], clubs: ["JUV", "PSG"] },
  { n: "Andrea Pirlo", ln: "Pirlo", by: 1979, nat: ["ITA"], clubs: ["INT", "MIL", "JUV"] },
  { n: "Paolo Maldini", ln: "Maldini", by: 1968, nat: ["ITA"], clubs: ["MIL"] },
  { n: "Francesco Totti", ln: "Totti", by: 1976, nat: ["ITA"], clubs: ["ROM"] },
  { n: "Alessandro Del Piero", ln: "Del Piero", by: 1974, nat: ["ITA"], clubs: ["JUV"] },
  { n: "Federico Chiesa", ln: "Chiesa", by: 1997, nat: ["ITA"], clubs: ["JUV", "LIV"] },
  { n: "Nicolò Barella", ln: "Barella", by: 1997, nat: ["ITA"], clubs: ["INT"] },
  { n: "Gianluigi Donnarumma", ln: "Donnarumma", by: 1999, nat: ["ITA"], clubs: ["MIL", "PSG", "MCI"] },
  { n: "Leonardo Bonucci", ln: "Bonucci", by: 1987, nat: ["ITA"], clubs: ["JUV", "MIL"] },
  { n: "Zlatan Ibrahimović", ln: "Ibrahimović", by: 1981, nat: [], clubs: ["AJA", "JUV", "INT", "MIL", "BAR", "PSG", "MUN"] },
  { n: "Victor Osimhen", ln: "Osimhen", by: 1998, nat: ["NGA"], clubs: ["LIL", "NAP"] },
  { n: "Khvicha Kvaratskhelia", ln: "Kvaratskhelia", by: 2001, nat: [], clubs: ["NAP", "PSG"] },
  { n: "Rafael Leão", ln: "Leão", by: 1999, nat: ["PRT"], clubs: ["SLB", "LIL", "MIL"] },
  { n: "Bruno Fernandes", ln: "Fernandes", by: 1994, nat: ["PRT"], clubs: ["SCP", "MUN"] },
  { n: "Rúben Dias", ln: "Dias", by: 1997, nat: ["PRT"], clubs: ["SLB", "MCI"] },
  { n: "Bernardo Silva", ln: "Silva", by: 1994, nat: ["PRT"], clubs: ["ASM", "MCI"] },
  { n: "João Félix", ln: "Félix", by: 1999, nat: ["PRT"], clubs: ["SLB", "ATM"] },
  { n: "Diogo Jota", ln: "Jota", by: 1996, nat: ["PRT"], clubs: ["LIV"] },
  { n: "Pepe", ln: "Pepe", by: 1983, nat: ["PRT"], clubs: ["POR", "RMA"] },
  { n: "Didier Drogba", ln: "Drogba", by: 1978, nat: ["CIV"], clubs: ["OM", "CHE"] },
  { n: "Son Heung-min", ln: "Son", by: 1992, nat: [], clubs: ["B04", "TOT"] },
  { n: "Achraf Hakimi", ln: "Hakimi", by: 1998, nat: [], clubs: ["RMA", "BVB", "INT", "PSG"] },
  { n: "Frenkie de Jong", ln: "de Jong", by: 1997, nat: ["NED"], clubs: ["AJA", "BAR"] },
  { n: "Matthijs de Ligt", ln: "de Ligt", by: 1999, nat: ["NED"], clubs: ["AJA", "JUV", "FCB", "MUN"] },
  { n: "Memphis Depay", ln: "Depay", by: 1994, nat: ["NED"], clubs: ["PSV", "MUN", "OL", "BAR", "ATM"] },
  { n: "Arjen Robben", ln: "Robben", by: 1984, nat: ["NED"], clubs: ["PSV", "CHE", "RMA", "FCB"] },
  { n: "Robin van Persie", ln: "van Persie", by: 1983, nat: ["NED"], clubs: ["FEY", "ARS", "MUN"] },
  { n: "Wesley Sneijder", ln: "Sneijder", by: 1984, nat: ["NED"], clubs: ["AJA", "RMA", "INT"] },
  { n: "Luis Suárez", ln: "Suárez", by: 1987, nat: [], clubs: ["AJA", "LIV", "BAR", "ATM"] },
  { n: "Edinson Cavani", ln: "Cavani", by: 1987, nat: [], clubs: ["NAP", "PSG", "MUN", "VAL"] },
  { n: "James Rodríguez", ln: "Rodríguez", by: 1991, nat: ["COL"], clubs: ["POR", "RMA", "FCB", "EVE"] },
  { n: "Radamel Falcao", ln: "Falcao", by: 1986, nat: ["COL"], clubs: ["POR", "ATM", "ASM", "MUN", "CHE", "OM"] },
  { n: "Christian Pulisic", ln: "Pulisic", by: 1998, nat: ["USA"], clubs: ["BVB", "CHE", "MIL"] },
  { n: "Hirving Lozano", ln: "Lozano", by: 1995, nat: ["MEX"], clubs: ["PSV", "NAP"] },
  { n: "Wataru Endo", ln: "Endo", by: 1993, nat: ["JPN"], clubs: ["VFB", "LIV"] },
];

export const cname = (def) => (def.type === "club" ? `${def.name} (${def.country})` : def.name);
export const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function playerMatchesHex(player, def) {
  if (!player || !def) return false;
  if (def.type === "club") return (player.clubs || []).includes(def.key);
  if (def.type === "nat") return (player.nat || []).includes(def.key);
  if (def.type === "spec") return def.test ? def.test(player) : false;
  return false;
}

// ── Geometrie (pointy-top, 4-5-4-5-4-5-4) ────────────────────────────────────
const ROW_LEN = (r) => (r % 2 === 1 ? 5 : 4);
export const HEXH = 2 / Math.sqrt(3);
const ROWSP = 0.75 * HEXH;
export const BOARDH = HEXH + 6 * ROWSP;

const RAW = [];
for (let r = 0; r < 7; r++) for (let c = 0; c < ROW_LEN(r); c++) RAW.push({ row: r, col: c });
export const POSITIONS = RAW.map((p, i) => {
  const xc = p.row % 2 === 1 ? 0.5 + p.col : 1 + p.col;
  const yc = HEXH / 2 + p.row * ROWSP;
  return { idx: i, row: p.row, col: p.col, left: (xc / 5) * 100, top: (yc / BOARDH) * 100 };
});
const idxByRC = Object.fromEntries(POSITIONS.map((p) => [`${p.row},${p.col}`, p.idx]));
function neighborsRC(r, c) {
  const wide = r % 2 === 1;
  const cand = [[r, c - 1], [r, c + 1]];
  if (wide) cand.push([r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]);
  else cand.push([r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]);
  return cand.filter(([rr, cc]) => rr >= 0 && rr < 7 && cc >= 0 && cc < ROW_LEN(rr));
}
export const ADJP = Object.fromEntries(
  POSITIONS.map((p) => [p.idx, neighborsRC(p.row, p.col).map(([rr, cc]) => idxByRC[`${rr},${cc}`])])
);

// ── Board: bauen + (de)serialisieren für Supabase ────────────────────────────
const shuffle = (a) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
};
const pick = (a, n) => shuffle(a).slice(0, n);

const DEF_BY_KEY = {
  club: Object.fromEntries(CLUBS.map((c) => [c.key, c])),
  nat: Object.fromEntries(NATIONS.map((n) => [n.key, n])),
  spec: Object.fromEntries(SPECIALS.map((s) => [s.key, s])),
};
export const lookupDef = (type, key) => DEF_BY_KEY[type]?.[key];

// kompakte, serialisierbare Form: pro Feld nur { t: type, k: key }
export function buildBoardSerial() {
  const specials = pick(SPECIALS, 3);
  const blClubs = pick(CLUBS.filter((c) => c.lg === "BL"), 4);
  const nations = pick(NATIONS, 6);
  const rest = pick(CLUBS.filter((c) => !blClubs.includes(c)), 31 - 3 - 4 - 6);
  const chosen = shuffle([...specials, ...blClubs, ...nations, ...rest]);
  return chosen.map((d) => ({ t: d.type, k: d.key }));
}

// serialisiertes Board -> volle Zellen mit Position + aufgelöstem def
export function hydrateBoard(serial) {
  return POSITIONS.map((p, i) => ({ ...p, def: lookupDef(serial[i].t, serial[i].k) }));
}

// 6-stelliger, gut lesbarer Spielcode (ohne verwechselbare Zeichen)
export function genCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}
