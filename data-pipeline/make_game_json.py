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
import json, unicodedata
import pandas as pd

OUT = Path("./out")

def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode()
    return s.lower().strip()

# Spielkey -> Teilstring, der im TM-Vereinsnamen vorkommt
# (gegen die echte davidcariboo/player-scores-Klubliste verifiziert)
GAME_CLUBS = {
    "FCB": "bayern", "BVB": "dortmund", "RBL": "leipzig", "B04": "leverkusen",
    "SGE": "frankfurt", "BMG": "gladbach", "VFB": "stuttgart", "WOB": "wolfsburg", "SVW": "bremen",
    "MCI": "manchester city", "MUN": "manchester united", "LIV": "liverpool", "CHE": "chelsea",
    "ARS": "arsenal football club", "TOT": "tottenham", "NEW": "newcastle", "EVE": "everton", "AVL": "aston villa",
    "BAR": "futbol club barcelona", "RMA": "real madrid", "ATM": "atletico de madrid", "SEV": "sevilla",
    "VAL": "valencia", "VIL": "villarreal",
    "JUV": "juventus", "MIL": "calcio milan", "INT": "internazionale", "NAP": "napoli", "ROM": "roma", "LAZ": "lazio",
    "PSG": "saint-germain", "ASM": "monaco", "OM": "marseille", "OL": "lyon", "LIL": "lille",
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


def club_key_for(tm_name: str):
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
    tr_name_cols = [c for c in ("from_club_name", "to_club_name") if c in transfers.columns]

    # tm_club_id -> Spielkey (aus den Einsatz-Vereinen)
    club_key = {}
    for _, c in clubs.iterrows():
        k = club_key_for(c["name"])
        if k:
            club_key[c["tm_club_id"]] = k

    # PRÜFBERICHT über ALLE zu mappenden Vereinsnamen (Einsätze + Transfers),
    # damit auch Transfer-Schreibweisen kontrolliert werden.
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
        out.append({
            "n": p["name"],
            "ln": p["last_name"] if isinstance(p["last_name"], str) and p["last_name"].strip() else p["name"],
            "by": by,
            "nat": [nat] if nat else [],
            "clubs": keys,
        })

    out.sort(key=lambda r: r["n"])
    body = ",\n  ".join(json.dumps(r, ensure_ascii=False) for r in out)
    # export const, damit der Inhalt 1:1 nach src/players.js übernommen werden kann
    js = "export const PLAYERS = [\n  " + body + "\n];\n"
    (OUT / "players_game.js").write_text(js, encoding="utf-8")
    print(f"OK  {len(out)} Spieler -> {OUT}/players_game.js  "
          f"(Inhalt nach src/players.js übernehmen)")


if __name__ == "__main__":
    main()
