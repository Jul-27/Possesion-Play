#!/usr/bin/env python3
"""
make_game_json.py – Erzeugt das eingebettete PLAYERS-Array für possession_play.jsx
                    aus dem Output von build_db.py (./out/*.csv).

Logik: Für jeden Spieler werden seine Vereins-Spells auf die ~45 SPIEL-Vereinskeys
gemappt (FCB, BVB, RMA, …). Nur Spieler mit >=1 Treffer landen im Spiel.
Nation = Staatsbürgerschaft (Proxy fürs Nationalteam), Jahr = Geburtsjahr.

    python make_game_json.py          # -> ./out/players_game.js  (zum Einfügen)

WICHTIG: Die TM-Vereinsnamen unten sind als normalisierte Teilstrings hinterlegt.
Falls dein Dataset einen Verein anders schreibt, hier den String anpassen.
"""
from pathlib import Path
import json, unicodedata
import pandas as pd

OUT = Path("./out")

def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode()
    return s.lower().strip()

# Spielkey -> Teilstring, der im TM-Vereinsnamen vorkommt
GAME_CLUBS = {
    "FCB": "bayern", "BVB": "dortmund", "RBL": "leipzig", "B04": "leverkusen",
    "SGE": "frankfurt", "BMG": "gladbach", "VFB": "stuttgart", "WOB": "wolfsburg", "SVW": "bremen",
    "MCI": "manchester city", "MUN": "manchester united", "LIV": "liverpool", "CHE": "chelsea",
    "ARS": "arsenal", "TOT": "tottenham", "NEW": "newcastle", "EVE": "everton", "AVL": "aston villa",
    "BAR": "barcelona", "RMA": "real madrid", "ATM": "atletico", "SEV": "sevilla",
    "VAL": "valencia", "VIL": "villarreal",
    "JUV": "juventus", "MIL": "ac milan", "INT": "inter", "NAP": "napoli", "ROM": "roma", "LAZ": "lazio",
    "PSG": "paris", "ASM": "monaco", "OM": "marseille", "OL": "lyon", "LIL": "lille",
    "POR": "porto", "SLB": "benfica", "SCP": "sporting cp",
    "AJA": "ajax", "PSV": "psv", "FEY": "feyenoord",
}
# Inter/Mailand sauber von Inter Miami trennen etc. ist Sache der TM-Namen.

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


# True  = nur Spieler, die für einen der ~45 Spiel-Vereine gespielt haben
#         (empfohlen: kompaktes JSON, jeder Spieler kann mind. Vereinsfelder erfüllen)
# False = ALLE Spieler aus der DB (auch ohne Spiel-Verein -> clubs:[]; großes JSON)
ONLY_GAME_CLUBS = True


def main():
    players = pd.read_csv(OUT / "players.csv")
    clubs   = pd.read_csv(OUT / "clubs.csv")
    spells  = pd.read_csv(OUT / "player_club_spells.csv")

    # tm_club_id -> Spielkey (nur für gemappte Vereine)
    club_key = {}
    matched_names = {}  # Spielkey -> Menge der TM-Namen, die gematcht haben (Prüfbericht)
    for _, c in clubs.iterrows():
        k = club_key_for(c["name"])
        if k:
            club_key[c["tm_club_id"]] = k
            matched_names.setdefault(k, set()).add(c["name"])

    # PRÜFBERICHT: zeigt je Spielkey, welche TM-Vereinsnamen zugeordnet wurden.
    # Hier kontrollieren, ob ein Verein falsch/gar nicht gematcht wurde,
    # und ggf. den Teilstring in GAME_CLUBS anpassen.
    print("── Vereins-Zuordnung (kontrollieren!) ──")
    for k in GAME_CLUBS:
        names = sorted(matched_names.get(k, []))
        flag = "" if names else "  ⚠️ KEIN TREFFER"
        print(f"  {k}: {', '.join(names) if names else '—'}{flag}")
    print("────────────────────────────────────────")

    # Spieler -> Set der Spielkeys
    pclubs = {}
    for _, s in spells.iterrows():
        k = club_key.get(s["tm_club_id"])
        if k:
            pclubs.setdefault(s["tm_player_id"], set()).add(k)

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
    js = "const PLAYERS = [\n  " + body + "\n];\n"
    (OUT / "players_game.js").write_text(js, encoding="utf-8")
    print(f"OK  {len(out)} Spieler -> {OUT}/players_game.js  "
          f"(in possession_play.jsx das PLAYERS-Array ersetzen)")


if __name__ == "__main__":
    main()
