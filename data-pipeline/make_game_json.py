#!/usr/bin/env python3
"""
make_game_json.py – Erzeugt das PLAYERS-Array für src/players.js
                    aus dem Output von build_db.py (./out/*.csv).

Logik: Für jeden Spieler werden seine Vereins-Spells auf die ~40 SPIEL-Vereinskeys
gemappt (FCB, BVB, RMA, …). Nur Spieler mit >=1 Treffer landen im Spiel.
Nation = Staatsbürgerschaft (Proxy fürs Nationalteam), Jahr = Geburtsjahr.

    python make_game_json.py          # -> ./out/players_game.js  (zum Einfügen)

Ausgabe beginnt mit "export const PLAYERS = [ … ];", sodass der Inhalt 1:1 nach
src/players.js übernommen werden kann.

WICHTIG: Die TM-Vereinsnamen unten sind als normalisierte Teilstrings hinterlegt
und gegen die echte Klubliste des Datasets geprüft. Schreibt das Dataset einen
Verein anders, hier den String anpassen und den Prüfbericht erneut kontrollieren.
"""
from pathlib import Path
import json, re, unicodedata
import pandas as pd
from honours import (detect_competitions, league_champion_by_season,
                     cup_winner_by_season, squad_player_ids, WC_SQUADS)

OUT  = Path("./out")
DATA = Path("./data")  # für Honours: games/competitions/appearances

def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode()
    return s.lower().strip()

# Spielkey -> Teilstring im (offiziellen) TM-Vereinsnamen, gegen die echte
# Klubliste verifiziert. LIL/OL/ROM bewusst spezifisch (Lillestrøm/
# Lyon-Duchère/Cisco Roma ausschließen).
GAME_CLUBS = {
    "FCB": "bayern", "BVB": "dortmund", "RBL": "leipzig", "B04": "leverkusen",
    "SGE": "frankfurt", "BMG": "gladbach", "VFB": "stuttgart", "WOB": "wolfsburg", "SVW": "bremen",
    "MCI": "manchester city", "MUN": "manchester united", "LIV": "liverpool", "CHE": "chelsea",
    "ARS": "arsenal football club", "TOT": "tottenham", "NEW": "newcastle", "EVE": "everton", "AVL": "aston villa",
    "BAR": "futbol club barcelona", "RMA": "real madrid", "ATM": "atletico de madrid", "SEV": "sevilla",
    "VAL": "valencia", "VIL": "villarreal",
    "JUV": "juventus", "MIL": "calcio milan", "INT": "internazionale", "NAP": "napoli", "ROM": "sportiva roma", "LAZ": "lazio",
    "PSG": "saint-germain", "ASM": "monaco", "OM": "marseille", "OL": "olympique lyon", "LIL": "lille olympique",
    "POR": "clube do porto", "SLB": "benfica", "SCP": "clube de portugal",
    "AJA": "ajax", "PSV": "philips", "FEY": "feyenoord",
}

NATION_MAP = {
    "france": "FRA", "germany": "GER", "spain": "ESP", "italy": "ITA", "netherlands": "NED",
    "belgium": "BEL", "croatia": "CRO", "england": "ENG", "portugal": "PRT", "japan": "JPN",
    "brazil": "BRA", "argentina": "ARG", "mexico": "MEX", "nigeria": "NGA",
    "cote d'ivoire": "CIV", "ivory coast": "CIV", "senegal": "SEN", "colombia": "COL",
    "united states": "USA", "usa": "USA",
}

# Jugend-/Reserve-/B-Team-Erkennung (ganze Tokens im normalisierten Namen)
_YOUTH = re.compile(r"(?:^| )(u\d{1,2}|sub-?\d{1,2}|ii|iii|b|c|res|reserves?|youth|yth|jugend|castilla|mestalla|amateure?)(?:$| )")
def is_youth(name) -> bool:
    return bool(_YOUTH.search(norm(name)))


def club_key_for(tm_name):
    if is_youth(tm_name):
        return None
    n = norm(tm_name)
    for key, needle in GAME_CLUBS.items():
        if needle in n:
            return key
    return None


# True  = nur Spieler, die für einen der ~40 Spiel-Vereine gespielt haben
# False = ALLE Spieler aus der DB (auch ohne Spiel-Verein -> clubs:[]; großes JSON)
ONLY_GAME_CLUBS = True


def main():
    players    = pd.read_csv(OUT / "players.csv")
    clubs      = pd.read_csv(OUT / "clubs.csv")
    spells     = pd.read_csv(OUT / "player_club_spells.csv")
    transfers  = pd.read_csv(OUT / "player_transfers.csv")  # auch Stationen vor ~2012
    tr_name_cols = [c for c in ("from_name", "to_name") if c in transfers.columns]

    # tm_club_id -> Spielkey (aus den Einsatz-Vereinen)
    club_key = {}
    for _, c in clubs.iterrows():
        k = club_key_for(c["name"])
        if k:
            club_key[c["tm_club_id"]] = k

    # PRÜFBERICHT über ALLE zu mappenden Vereinsnamen (Einsätze + Transfers,
    # ohne Jugend/Reserve), damit auch Transfer-Namen kontrolliert werden.
    all_names = set(clubs["name"].dropna())
    for col in tr_name_cols:
        all_names |= set(transfers[col].dropna())
    matched_names = {}
    for nm in all_names:
        k = club_key_for(nm)
        if k:
            matched_names.setdefault(k, set()).add(nm)

    print("── Vereins-Zuordnung (kontrollieren!) ──")
    for k in GAME_CLUBS:
        names = sorted(matched_names.get(k, []))
        flag = "" if names else "  ⚠️ KEIN TREFFER"
        print(f"  {k}: {', '.join(names) if names else '—'}{flag}")
    print("────────────────────────────────────────")

    # Spieler -> Set der Spielkeys: (a) aus Einsätzen, (b) aus Transferhistorie
    pclubs = {}
    for _, s in spells.iterrows():
        k = club_key.get(s["tm_club_id"])
        if k:
            pclubs.setdefault(s["tm_player_id"], set()).add(k)
    for _, t in transfers.iterrows():
        for col in tr_name_cols:
            k = club_key_for(t[col])
            if k:
                pclubs.setdefault(t["tm_player_id"], set()).add(k)

    # ── Honours (Titel je Spieler) -> player_titles {tm_player_id: set(keys)} ──
    games_h = pd.read_csv(DATA / "games.csv")
    comps_h = pd.read_csv(DATA / "competitions.csv")
    apps_h  = pd.read_csv(DATA / "appearances.csv")
    if "season" not in apps_h.columns:
        apps_h = apps_h.merge(games_h[["game_id", "season"]], on="game_id", how="left")
    comp_ids = detect_competitions(comps_h)
    player_titles = {}
    def _add(pid, key): player_titles.setdefault(pid, set()).add(key)
    for key in ["MBL", "MPL", "MLL", "MSA", "ML1"]:
        cid = comp_ids.get(key)
        if not cid:
            continue
        for season, club in league_champion_by_season(games_h, cid).items():
            for pid in squad_player_ids(apps_h, cid, club, season):
                _add(pid, key)
    for key in ["DFB", "FAC", "CDR", "CIT", "CL"]:
        cid = comp_ids.get(key)
        if not cid:
            continue
        winners, _ties = cup_winner_by_season(games_h, cid)
        for season, club in winners.items():
            for pid in squad_player_ids(apps_h, cid, club, season):
                _add(pid, key)
    name2id = {}
    for _, p in players.iterrows():
        name2id.setdefault(norm(p["name"]), p["tm_player_id"])
    for names in WC_SQUADS.values():
        for nm in names:
            pid = name2id.get(norm(nm))
            if pid is not None:
                _add(pid, "WM")

    out = []
    for _, p in players.iterrows():
        keys = sorted(pclubs.get(p["tm_player_id"], []))
        if ONLY_GAME_CLUBS and not keys:
            continue  # für dieses Spiel irrelevant
        nat = NATION_MAP.get(norm(p.get("citizenship", "")))
        try:
            by = int(str(p["date_of_birth"])[:4])
        except Exception:
            continue
        rec = {
            "n": p["name"],
            "ln": p["last_name"] if isinstance(p["last_name"], str) and p["last_name"].strip() else p["name"],
            "by": by,
            "nat": [nat] if nat else [],
            "clubs": keys,
        }
        titles = sorted(player_titles.get(p["tm_player_id"], []))
        if titles:
            rec["t"] = titles
        out.append(rec)

    out.sort(key=lambda r: r["n"])
    body = ",\n  ".join(json.dumps(r, ensure_ascii=False) for r in out)
    # export const, damit der Inhalt 1:1 nach src/players.js übernommen werden kann
    js = "export const PLAYERS = [\n  " + body + "\n];\n"
    (OUT / "players_game.js").write_text(js, encoding="utf-8")
    print(f"OK  {len(out)} Spieler -> {OUT}/players_game.js  "
          f"(Inhalt nach src/players.js übernehmen)")


if __name__ == "__main__":
    main()
