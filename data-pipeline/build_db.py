#!/usr/bin/env python3
"""
build_db.py – Baut aus dem Transfermarkt-Dataset import-fertige CSVs
              für die Possession-Play-Datenbank.

Quelle (einmalig herunterladen, braucht Kaggle-Account + API-Token):
    pip install kaggle pandas
    kaggle datasets download -d davidcariboo/player-scores -p ./data --unzip

Danach:
    python build_db.py

Output (-> ./out): leagues.csv, clubs.csv, players.csv, player_club_spells.csv

Auswahl-Logik:
 * Spieler-AUSWAHL: jeder Spieler mit >=1 Einsatz in einer Top-5-Liga seit 2000
   (so landen nur "bekannte" Spieler im Spiel).
 * Vereins-HISTORIE: für die ausgewählten Spieler werden ALLE Einsätze seit 2000
   erfasst – auch außerhalb der Top-5 (Portugal, Niederlande, Pokale, Europacup).
   Dadurch bekommen Spiel-Vereine wie Porto/Ajax/PSV ebenfalls Spieler.

Caveats:
 * Einsatz-Daten auf Spiel-Ebene reichen i.d.R. nur ~2012 zurück, nicht 2000.
   Sehr alte Vereinszugehörigkeiten fehlen daher teils.
 * "seit 2000" = Saison-Jahr >= 2000 (games.season). Bei Bedarf anpassen.
 * Spaltennamen entsprechen dem Stand des Datasets; falls es sich ändert,
   hier oben die COLS-Konstanten korrigieren.
"""
from pathlib import Path
import pandas as pd

DATA = Path("./data")
OUT  = Path("./out"); OUT.mkdir(exist_ok=True)

# Transfermarkt-Wettbewerbs-IDs der fünf Topligen
TOP5 = {
    "GB1": ("Premier League", "England"),
    "ES1": ("LaLiga",         "Spain"),
    "IT1": ("Serie A",        "Italy"),
    "L1":  ("Bundesliga",     "Germany"),
    "FR1": ("Ligue 1",        "France"),
}
SINCE = 2000


def main() -> None:
    players      = pd.read_csv(DATA / "players.csv")
    clubs        = pd.read_csv(DATA / "clubs.csv")
    games        = pd.read_csv(DATA / "games.csv")
    appearances  = pd.read_csv(DATA / "appearances.csv")

    # 1) Spiele seit 2000: einmal nur Top-5 (für die Spielerauswahl),
    #    einmal alle Wettbewerbe (für die vollständige Vereinshistorie).
    g_top5 = games[games["competition_id"].isin(TOP5) & (games["season"] >= SINCE)][["game_id"]]
    g_all  = games[games["season"] >= SINCE][["game_id", "competition_id", "season"]]

    # 2) Spielerauswahl: >=1 Top-5-Einsatz seit 2000
    app_top5 = appearances.merge(g_top5, on="game_id", how="inner")
    pids = app_top5["player_id"].unique()

    # 3) VOLLE Vereinshistorie dieser Spieler: alle Einsätze seit 2000
    app = appearances[appearances["player_id"].isin(pids)].merge(g_all, on="game_id", how="inner")

    # 4) leagues.csv
    leagues = pd.DataFrame(
        [{"tm_competition_id": c, "name": n, "country": ctry}
         for c, (n, ctry) in TOP5.items()]
    )
    leagues.to_csv(OUT / "leagues.csv", index=False)

    # 5) players.csv – nur die ausgewählten Spieler
    pl = players[players["player_id"].isin(pids)].copy()
    pl = pl[["player_id", "name", "first_name", "last_name",
             "date_of_birth", "position", "country_of_citizenship"]]
    pl.columns = ["tm_player_id", "name", "first_name", "last_name",
                  "date_of_birth", "position", "citizenship"]
    # Mononyme (Rodri, Vinícius): wenn last_name leer, vollen Namen nehmen
    pl["last_name"] = pl["last_name"].fillna("").where(
        pl["last_name"].notna() & (pl["last_name"] != ""), pl["name"])
    pl.to_csv(OUT / "players.csv", index=False)

    # 6) clubs.csv – alle Vereine aus der vollen Historie
    cids = app["player_club_id"].unique()
    cl = clubs[clubs["club_id"].isin(cids)].copy()
    cl = cl[["club_id", "name", "domestic_competition_id"]]
    cl.columns = ["tm_club_id", "name", "tm_competition_id"]
    cl.to_csv(OUT / "clubs.csv", index=False)

    # 7) player_club_spells.csv – (Spieler, Verein) -> Saison-Spanne
    spells = (
        app.groupby(["player_id", "player_club_id"])["season"]
           .agg(["min", "max"])
           .reset_index()
    )
    spells.columns = ["tm_player_id", "tm_club_id",
                      "season_start", "season_end"]
    spells.to_csv(OUT / "player_club_spells.csv", index=False)

    print(f"OK  players={len(pl):>6}  clubs={len(cl):>4}  "
          f"spells={len(spells):>6}  -> {OUT}/")


if __name__ == "__main__":
    main()
