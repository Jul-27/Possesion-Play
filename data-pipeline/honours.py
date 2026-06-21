#!/usr/bin/env python3
"""
honours.py – Berechnet Titel/Honours je Spieler für Possession Play.

Quellen (davidcariboo/player-scores): games.csv, appearances.csv, competitions.csv.

Honours (11):
  Meister (aus Punktetabelle):  MBL MPL MLL MSA ML1
  Pokal/CL (aus Finalspiel):    DFB FAC CDR CIT CL
  Weltmeister (kuratierte Kader, Namensabgleich): WM

Wichtige Datensatz-Fakten (per Probe bestätigt):
 * games reicht 2005–2025; Pokal/CL-Finals ab 2012.
 * Finals: round == "Final" (exakt! "Quarter-Finals"/"Semi-Finals" enthalten
   ebenfalls "Final"). Elfmeter sind in home/away_club_goals eingerechnet →
   Sieger immer aus den Toren ableitbar (keine Tor-Gleichstände in Finals).
 * appearances hat KEINE season-Spalte → vorher per game_id aus games joinen.
 * Coupe de France ist NICHT im Datensatz (kein domestic_cup für Frankreich).
"""
import unicodedata
import pandas as pd

# Land -> Honour-Key
TOP5_LEAGUE = {"Germany": "MBL", "England": "MPL", "Spain": "MLL", "Italy": "MSA", "France": "ML1"}
TOP5_CUP    = {"Germany": "DFB", "England": "FAC", "Spain": "CDR", "Italy": "CIT"}  # FR: keine Coupe de France
CL_COMP_ID  = "CL"


def norm(s):
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode()
    return s.lower().strip()


def detect_competitions(comps):
    """competitions.csv -> {honour_key: competition_id}. Liga via sub_type
    'first_tier', Pokal via type 'domestic_cup', CL fix 'CL'."""
    out = {}
    for _, c in comps.iterrows():
        country = c.get("country_name")
        if c.get("sub_type") == "first_tier" and country in TOP5_LEAGUE:
            out[TOP5_LEAGUE[country]] = c["competition_id"]
        if c.get("type") == "domestic_cup" and country in TOP5_CUP:
            out[TOP5_CUP[country]] = c["competition_id"]
    out["CL"] = CL_COMP_ID
    return out


def league_champion_by_season(games, comp_id):
    """{season: champion_club_id} aus 3/1/0-Punkten, Tie-Break Tordiff, dann Tore."""
    g = games[games["competition_id"] == comp_id].dropna(subset=["home_club_goals", "away_club_goals"])
    res = {}
    for season, gs in g.groupby("season"):
        pts, gd, gf = {}, {}, {}
        for _, m in gs.iterrows():
            h, a = m["home_club_id"], m["away_club_id"]
            hg, ag = int(m["home_club_goals"]), int(m["away_club_goals"])
            for c in (h, a):
                pts.setdefault(c, 0); gd.setdefault(c, 0); gf.setdefault(c, 0)
            gd[h] += hg - ag; gd[a] += ag - hg; gf[h] += hg; gf[a] += ag
            if hg > ag: pts[h] += 3
            elif ag > hg: pts[a] += 3
            else: pts[h] += 1; pts[a] += 1
        if pts:
            res[season] = max(pts, key=lambda c: (pts[c], gd[c], gf[c]))
    return res


def cup_winner_by_season(games, comp_id):
    """({season: winner_club_id}, [unentschiedene_saisons]) aus dem Finalspiel."""
    g = games[(games["competition_id"] == comp_id) & (games["round"].astype(str) == "Final")]
    res, ties = {}, []
    for season, fs in g.groupby("season"):
        m = fs.iloc[-1]  # letztes Finalspiel der Saison
        hg, ag = m["home_club_goals"], m["away_club_goals"]
        if pd.notna(hg) and pd.notna(ag) and int(hg) != int(ag):
            res[season] = m["home_club_id"] if int(hg) > int(ag) else m["away_club_id"]
        else:
            ties.append(season)  # sollte laut Probe nicht vorkommen; lieber fehlend als falsch
    return res, ties


def squad_player_ids(apps_with_season, comp_id, club_id, season):
    """player_ids mit >=1 Einsatz in comp_id für club_id in season."""
    a = apps_with_season
    sel = a[(a["competition_id"] == comp_id) & (a["player_club_id"] == club_id) & (a["season"] == season)]
    return set(sel["player_id"].unique())


# ── Weltmeister-Siegerkader (kuratiert) ──────────────────────────────────────
# Namen im Transfermarkt-Stil; Zuordnung per norm() gegen players.name.
# Fehlende/abweichende Namen führen zu Auslassung (kein Falschtreffer).
# Spieler vor ~2012 sind meist gar nicht im Spieler-Pool und matchen daher nicht.
WC_SQUADS = {
    2002: [  # Brasilien
        "Marcos", "Dida", "Rogerio Ceni", "Cafu", "Lucio", "Roque Junior", "Edmilson",
        "Roberto Carlos", "Juliano Belletti", "Anderson Polga", "Junior", "Gilberto Silva",
        "Kleberson", "Ricardinho", "Juninho Paulista", "Vampeta", "Denilson", "Rivaldo",
        "Ronaldinho", "Ronaldo", "Edilson", "Luizao", "Kaka",
    ],
    2006: [  # Italien
        "Gianluigi Buffon", "Angelo Peruzzi", "Marco Amelia", "Gianluca Zambrotta",
        "Fabio Cannavaro", "Marco Materazzi", "Alessandro Nesta", "Andrea Barzagli",
        "Fabio Grosso", "Massimo Oddo", "Cristian Zaccardo", "Andrea Pirlo",
        "Gennaro Gattuso", "Daniele De Rossi", "Mauro Camoranesi", "Simone Perrotta",
        "Francesco Totti", "Alessandro Del Piero", "Alberto Gilardino", "Luca Toni",
        "Vincenzo Iaquinta", "Filippo Inzaghi", "Simone Barone",
    ],
    2010: [  # Spanien
        "Iker Casillas", "Victor Valdes", "Pepe Reina", "Sergio Ramos", "Gerard Pique",
        "Carles Puyol", "Joan Capdevila", "Alvaro Arbeloa", "Raul Albiol", "Carlos Marchena",
        "Xavi", "Andres Iniesta", "Sergio Busquets", "Xabi Alonso", "Cesc Fabregas",
        "Javi Martinez", "David Silva", "Pedro", "Jesus Navas", "David Villa",
        "Fernando Torres", "Fernando Llorente", "Juan Mata",
    ],
    2014: [  # Deutschland
        "Manuel Neuer", "Roman Weidenfeller", "Ron-Robert Zieler", "Philipp Lahm",
        "Jerome Boateng", "Mats Hummels", "Per Mertesacker", "Benedikt Howedes",
        "Shkodran Mustafi", "Erik Durm", "Bastian Schweinsteiger", "Sami Khedira",
        "Toni Kroos", "Mesut Ozil", "Mario Gotze", "Thomas Muller", "Andre Schurrle",
        "Christoph Kramer", "Lukas Podolski", "Julian Draxler", "Miroslav Klose",
        "Kevin Grosskreutz", "Matthias Ginter",
    ],
    2018: [  # Frankreich
        "Hugo Lloris", "Steve Mandanda", "Alphonse Areola", "Benjamin Pavard",
        "Raphael Varane", "Samuel Umtiti", "Presnel Kimpembe", "Lucas Hernandez",
        "Djibril Sidibe", "Benjamin Mendy", "Paul Pogba", "N'Golo Kante", "Blaise Matuidi",
        "Corentin Tolisso", "Steven Nzonzi", "Kylian Mbappe", "Antoine Griezmann",
        "Olivier Giroud", "Ousmane Dembele", "Nabil Fekir", "Florian Thauvin",
        "Thomas Lemar", "Adil Rami",
    ],
    2022: [  # Argentinien
        "Emiliano Martinez", "Franco Armani", "Geronimo Rulli", "Nahuel Molina",
        "Cristian Romero", "Nicolas Otamendi", "Lisandro Martinez", "Nicolas Tagliafico",
        "Marcos Acuna", "Gonzalo Montiel", "German Pezzella", "Juan Foyth", "Rodrigo De Paul",
        "Alexis Mac Allister", "Enzo Fernandez", "Leandro Paredes", "Giovani Lo Celso",
        "Guido Rodriguez", "Exequiel Palacios", "Lionel Messi", "Angel Di Maria",
        "Julian Alvarez", "Lautaro Martinez", "Paulo Dybala", "Angel Correa",
        "Alejandro Gomez", "Thiago Almada",
    ],
}
