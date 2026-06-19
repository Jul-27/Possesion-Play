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
Diese in Supabase importieren; honours.csv kommt aus einem separaten Schritt
(API-Football / Wikidata / Kuratierung).

Hinweis zu den Caveats:
 * Einsatz-Daten auf Spiel-Ebene reichen i.d.R. nur ~2012 zurück, nicht 2000.
   Für ältere Vereinszugehörigkeiten Transferhistorie (salimt-Dataset) ergänzen.
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

    # 1) Spiele der Topligen seit 2000 -> Saison je game_id
    g = games[games["competition_id"].isin(TOP5) & (games["season"] >= SINCE)]
    g = g[["game_id", "competition_id", "season"]]

    # 2) Einsätze in genau diesen Spielen
    app = appearances.merge(g, on="game_id", how="inner")

    # 3) leagues.csv
    leagues = pd.DataFrame(
        [{"tm_competition_id": c, "name": n, "country": ctry}
         for c, (n, ctry) in TOP5.items()]
    )
    leagues.to_csv(OUT / "leagues.csv", index=False)

    # 4) players.csv – nur Spieler mit >=1 Topliga-Einsatz seit 2000
    pids = app["player_id"].unique()
    pl = players[players["player_id"].isin(pids)].copy()
    pl = pl[["player_id", "name", "first_name", "last_name",
             "date_of_birth", "position", "country_of_citizenship"]]
    pl.columns = ["tm_player_id", "name", "first_name", "last_name",
                  "date_of_birth", "position", "citizenship"]
    # Mononyme (Rodri, Vinícius): wenn last_name leer, vollen Namen nehmen
    pl["last_name"] = pl["last_name"].fillna("").where(
        pl["last_name"].notna() & (pl["last_name"] != ""), pl["name"])
    pl.to_csv(OUT / "players.csv", index=False)

    # 4b) players.json – kompakt fürs Spiel (Dropdown-Suche nach Nachname)
    pl[["tm_player_id", "name", "last_name"]].rename(
        columns={"tm_player_id": "id"}
    ).to_json(OUT / "players.json", orient="records", force_ascii=False)

    # 5) clubs.csv – Vereine, die in diesen Einsätzen vorkommen
    cids = app["player_club_id"].unique()
    cl = clubs[clubs["club_id"].isin(cids)].copy()
    cl = cl[["club_id", "name", "domestic_competition_id"]]
    cl.columns = ["tm_club_id", "name", "tm_competition_id"]
    cl.to_csv(OUT / "clubs.csv", index=False)

    # 6) player_club_spells.csv – (Spieler, Verein) -> Saison-Spanne
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
