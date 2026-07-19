# Graph Report - /Users/jul/Possesion-Play  (2026-07-12)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 285 nodes · 658 edges · 14 communities (13 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.57)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dca89e93`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- wikidata_roster.mjs
- gameData.js
- Game.jsx
- Daily.jsx
- wikidata_honours.mjs
- package.json
- main
- wikidata_honours_extra.mjs
- fetch_logos.mjs
- apply_msa.mjs
- refresh_all.mjs

## God Nodes (most connected - your core abstractions)
1. `stampDataInfo()` - 18 edges
2. `loadPlayers()` - 14 edges
3. `Grid()` - 13 edges
4. `Guess()` - 13 edges
5. `norm()` - 13 edges
6. `suggestPlayers()` - 13 edges
7. `isMuted()` - 13 edges
8. `Game()` - 12 edges
9. `toggleMute()` - 12 edges
10. `Daily()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `detect_competitions()`  [INFERRED]
  data-pipeline/make_game_json.py → data-pipeline/honours.py
- `main()` --calls--> `league_champion_by_season()`  [INFERRED]
  data-pipeline/make_game_json.py → data-pipeline/honours.py
- `main()` --calls--> `cup_winner_by_season()`  [INFERRED]
  data-pipeline/make_game_json.py → data-pipeline/honours.py
- `main()` --calls--> `squad_player_ids()`  [INFERRED]
  data-pipeline/make_game_json.py → data-pipeline/honours.py
- `main()` --calls--> `stampDataInfo()`  [EXTRACTED]
  data-pipeline/wikidata_honours_extra.mjs → data-pipeline/stamp.mjs

## Import Cycles
- None detected.

## Communities (14 total, 1 thin omitted)

### Community 0 - "wikidata_roster.mjs"
Cohesion: 0.06
Nodes (55): agg, byKey, GAME_BY_QID, HERE, players, PLAYERS_PATH, sleep(), sparql() (+47 more)

### Community 1 - "gameData.js"
Cohesion: 0.09
Nodes (43): activeInRange(), answerGuessQuestion(), buildBoardSerial(), buildGridSerial(), buildGuessSerial(), checkGuess(), CLUB_LG, CLUBS (+35 more)

### Community 2 - "Game.jsx"
Cohesion: 0.17
Nodes (23): COLORS, Confetti(), makeParts(), Cell(), Emblem(), Game(), ADJP, cname() (+15 more)

### Community 3 - "Daily.jsx"
Cohesion: 0.15
Nodes (22): App(), codeFromUrl(), dailyFromUrl(), soloFromUrl(), Combo(), Daily(), sigOf(), store (+14 more)

### Community 4 - "wikidata_honours.mjs"
Cohesion: 0.11
Nodes (21): added, HERE, players, PLAYERS_PATH, HERE, players, PLAYERS_PATH, applyGapWinners() (+13 more)

### Community 5 - "package.json"
Cohesion: 0.09
Nodes (22): dependencies, react, react-dom, @supabase/supabase-js, devDependencies, vite, @vitejs/plugin-react, name (+14 more)

### Community 6 - "main"
Cohesion: 0.22
Nodes (12): cup_winner_by_season(), detect_competitions(), league_champion_by_season(), player_ids mit >=1 Einsatz in comp_id für club_id in season., competitions.csv -> {honour_key: competition_id}. Liga via sub_type     'first_t, {season: champion_club_id} aus 3/1/0-Punkten, Tie-Break Tordiff, dann Tore., ({season: winner_club_id}, [unentschiedene_saisons]) aus dem Finalspiel., squad_player_ids() (+4 more)

### Community 7 - "wikidata_honours_extra.mjs"
Cohesion: 0.32
Nodes (12): EXPECT, fetchAwardPlayers(), fetchHonourPlayers(), HERE, main(), norm(), PLAYERS_PATH, recToString() (+4 more)

### Community 8 - "fetch_logos.mjs"
Cohesion: 0.29
Nodes (10): CLUB_SEARCH, download(), fetchOk(), getJson(), HERE, LEAGUE_IDS, main(), OUT (+2 more)

### Community 9 - "apply_msa.mjs"
Cohesion: 0.29
Nodes (8): fetchWinners(), HERE, norm(), players, PLAYERS_PATH, sleep(), sparql(), WINDOWS

## Knowledge Gaps
- **82 isolated node(s):** `HERE`, `PLAYERS_PATH`, `GAME_BY_QID`, `agg`, `players` (+77 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `stampDataInfo()` connect `wikidata_roster.mjs` to `apply_msa.mjs`, `wikidata_honours.mjs`, `wikidata_honours_extra.mjs`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `loadPlayers()` connect `Game.jsx` to `gameData.js`, `Daily.jsx`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `HERE`, `PLAYERS_PATH`, `GAME_BY_QID` to the rest of the system?**
  _82 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `wikidata_roster.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.056535504296698326 - nodes in this community are weakly interconnected._
- **Should `gameData.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08888888888888889 - nodes in this community are weakly interconnected._
- **Should `wikidata_honours.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.11384615384615385 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._