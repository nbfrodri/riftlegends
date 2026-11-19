# Reference repos and games for Rift Legends (as of 2026-11-19)

Method: GitHub metadata was read through the `gh` API on 2026-11-19. That covers "pushed_at" (last push to any branch), stars, licence and latest release. Steam pages and blogs were read through WebFetch the same day, and the rest comes from web search. Items marked **[unverified]** come from background knowledge that I could not re-check in this session. Treat them as leads, not facts.

## Q1. Open-source sports and esports management games and engines

### Takeaway
Two maintained open-source management games are architecturally closest to Rift Legends. **ZenGM** is TypeScript running in the client and is source-available, not open source. **Openfoot Manager** uses Rust, Tauri and React under GPL-3.0. In the LoL space, a **"League Manager" (FastAPI + React, Oct 2026)** project already implements almost the same feature list as IDEA.md, but it is very young and has no licence. **MOBA Manager** on Steam (Nov 2026) is said to port an Apache-2.0 "MobaGM Legacy" engine attributed to ZenGM's author.

### Cited Findings

**ZenGM (Basketball GM, Football GM, ZenGM Baseball, ZenGM Hockey)**
- Repo `zengm-games/zengm`: TypeScript, about 480 stars, created 2011-06-04, last push 2026-11-18, so very active. It publishes no GitHub releases and deploys continuously. — [GitHub API / repo](https://github.com/zengm-games/zengm)
- "Implemented entirely in client-side JavaScript, backed by IndexedDB". Development uses Node 24 + pnpm, `SPORT=football` builds the other sports from one codebase, tests live in `*.test.ts`, and the README itself says "coverage is not great". — [README](https://github.com/zengm-games/zengm)
- **Licence: source-available, NOT open source.** You may view, edit, run locally (private) and share the source. You may not host a version others can access, and the stated aim is to block distributable forks that compete with zengm.com. Contributors must sign a CLA. — [LICENSE.md](https://github.com/zengm-games/zengm/blob/master/LICENSE.md)
- Architecture according to a secondary docs index, not checked against the code: the core logic runs in a SharedWorker with a Web Worker fallback (`src/worker`). An in-memory cache layer (`src/worker/db/Cache.ts`) serves simulation and current-season views, and IndexedDB is used for history. — [Algolia docsearch summary of repo](https://docsearch.algolia.com/mcp/docs/repo/zengm-games/zengm)
- Blog post of 2026-09-21: all four games now simulate about 2x faster. Ten seasons of basketball auto-play went from 202s to 109s, and hockey from 355s to 179s. The gain came from profiling and many small optimisations by a contributor, with AI-assisted code scanning that the author then reviewed. — [ZenGM blog "twice as fast"](https://zengm.com/blog/2026/09/twice-as-fast/)
- Other 2026 blog posts include "More settings for real draft prospect ratings" (2026-10-27) and a June 2026 post on being an "old school web-based sports sim dev". — [ZenGM blog index](https://zengm.com/blog/)

**Openfoot Manager**
- Repo `openfootmanager/openfootmanager`: GPL-3.0, about 1,201 stars, created 2020-04, last push 2026-11-18, latest release v0.2.0 on 2026-05-18. Stack: Rust + Tauri + React/TypeScript. Its topics include "markov-chain" and "simulation-engine". — [GitHub](https://github.com/openfootmanager/openfootmanager)
- Features: text-based match simulation with event-driven commentary, squads, transfers and contracts, training and staff, a dynamic inbox and news generation, and scouting. — [README](https://github.com/openfootmanager/openfootmanager)
- VISION.md puts the emphasis on running locally, needing no account or server, using no telemetry, and saving to files the user can read ("the world is data you author and share"). — [VISION.md](https://github.com/openfootmanager/openfootmanager/blob/develop/VISION.md)
- A fork, `factnn/openfootmanager`, is described as a "headless, deterministic simulation" variant, which suggests the engine can be split from the UI (last push 2026-09-28). — [GitHub](https://github.com/factnn/openfootmanager)

**Bygfoot** (classic C/GTK football manager)
- The original lives on SourceForge and GitLab. GitHub only has mirrors and forks under GPL-2.0, for example `kashifsoofi/bygfoot` (last push 2026-10-16) and `duran55/bygfoot`, described as a "GTK 3 port" (2026-10-17). — [GitHub search](https://github.com/kashifsoofi/bygfoot), [duran55/bygfoot](https://github.com/duran55/bygfoot)
- [unverified] Upstream development has been sporadic for years. Bygfoot is useful as a historical reference only.

**Other football and sports managers**
- `ihofmann/open-websoccer`: PHP, LGPL-3.0, about 121 stars, last push 2026-10-13. It is an online browser manager with a server. — [GitHub](https://github.com/ihofmann/open-websoccer)
- `EliFUT/android`: Java, Apache-2.0, about 189 stars, last push 2020-10, so stale. — [GitHub](https://github.com/EliFUT/android)
- `hackdanismo/retro-touchline`: Rust, MIT, last push 2026-10-13, 0 stars. — [GitHub](https://github.com/hackdanismo/retro-touchline)
- Motorsport: `domhnallmorr/Pitwall_Flet` (Python/Flet, GPL-3.0, last push 2025-11) and `ilya-ssh/OpenRacingManager` (Python, last push 2025-03) are small hobby projects. — [Pitwall_Flet](https://github.com/domhnallmorr/Pitwall_Flet), [OpenRacingManager](https://github.com/ilya-ssh/OpenRacingManager)
- Hockey: `saileille/Ice-Hockey-Sim` is a hockey manager in Rust and Tauri (last push 2025-12, 1 star). Its description calls it the author's third attempt ("Third time is the charm?"). — [GitHub](https://github.com/saileille/Ice-Hockey-Sim)
- Cricket: I found no notable open-source cricket simulation engines. The search returned only tiny repos with 0-1 stars. — [GitHub search results, e.g. ishakir/CricketGameEngine](https://github.com/ishakir/CricketGameEngine)

**Esports and LoL managers (open source or source-visible)**
- `esports-manager/esports-manager`: Python, GPL-3.0, about 65 stars, last push 2026-01-21. Its README warns "not yet ready for gameplay… undergoing significant restructuring" and says it plans text commentary. — [GitHub](https://github.com/esports-manager/esports-manager)
- **LIGA Esports Manager** (`playliga/prototype`): this is a Counter-Strike manager, not LoL. Stack: Electron 40 + Node 24 + SQLite via Prisma, built with Electron Forge. Rosters are seeded from the PandaScore API. Latest release v3.2.2 on 2026-09-09. Licence is "Other" per GitHub, and the marketing site is GPL-3.0. It lets you play matches in-game or simulate them. — [GitHub](https://github.com/playliga/prototype), [website repo](https://github.com/playliga/website)
- **League Manager** (`MartinSG98/league-manager-backend` + `league-manager-ui`), created 2026-10-11 with last push 2026-10-19, 4-5 stars and **no licence file**:
  - Stack: a FastAPI + SQLAlchemy/SQLite backend that holds the whole engine and a React client that "only draws what this service returns". Architecture decisions are recorded as ADRs.
  - Content: 56 tier-one teams in LCK/LPL/LEC/LCS/CBLOL/LCP, First Stand, MSI and Worlds (with a Swiss stage and double elimination), fearless draft on a clock, set plays, board objectives, a patch every two weeks, and a seeded RNG stored on the career.
  - Simulation: games run minute by minute, with laning (minutes 1-14), voidgrubs, herald, drake elements and Soul strengths fitted to ranked win rates.
  - Calibration: there is a `scripts.simulate` harness that prints win rate by team-power gap, and the constants in `match_engine.py` were tuned against it.
  - Sister project **Riftlike** (`MartinSG98/riftlike-*`) plays the 2026 Worlds as a roguelike.
  - [league-manager-backend](https://github.com/MartinSG98/league-manager-backend), [league-manager-ui](https://github.com/MartinSG98/league-manager-ui), [riftlike-backend](https://github.com/MartinSG98/riftlike-backend)
- **MOBA Manager** (Steam app 4813930, developer Alagesia, released 2026-11-03, free to play):
  - The store page says it is "a modernized port of the open-source MobaGM Legacy engine by dumbmatter", licensed Apache 2.0.
  - Features: a tick-based match engine ("6,800 lines of MOBA simulation"), pick and ban with synergy/counter/early-mid-late meta ratings, roster import from JSON, fully offline saves, Hall of Fame and a trophy cabinet.
  - I could not find the MobaGM source repo: dumbmatter's public repos show no MOBA project, and GitHub search only finds `Kayshh/mobagm-editor` (MIT, 2026-10). — [Steam](https://store.steampowered.com/app/4813930), [dumbmatter repos](https://github.com/dumbmatter?tab=repositories), [mobagm-editor](https://github.com/Kayshh/mobagm-editor)

**LoL draft simulators (open source)**
- All the ones found are small. `ColinLi33/FearlessDraft` (JS, no licence, last push 2025-11), `MGSimard/SimDraft` (TS, MIT, last push 2026-11-18, 0 stars) and `jestes5111/LolDraftSimulator` (Python ML, MIT, 2022) are examples. I found no maintained, widely starred LoL draft engine. — [FearlessDraft](https://github.com/ColinLi33/FearlessDraft), [SimDraft](https://github.com/MGSimard/SimDraft), [LolDraftSimulator](https://github.com/jestes5111/LolDraftSimulator)

### Inferences
- ZenGM is the strongest architectural reference for a client-side, worker-based, IndexedDB-backed management sim with long multi-season saves. Because of its licence, it can be studied but not forked or redistributed.
- Openfoot Manager is the strongest permissive-in-spirit (GPL) desktop reference. It shows the Tauri + Rust engine pattern and treats data as authored files, which matches the IDEA.md goals of "content as data" and "deterministic sim".
- League Manager is the closest functional analogue: same leagues, fearless draft, patches, board and seeded RNG. It also shows a calibration-harness practice that is useful for the DraftSim comparison goal. With no licence, its code may not be reused (all rights reserved by default), but its README design can be read. It is about five weeks old, so its longevity is unknown.
- The engine split (headless engine plus a thin UI) appears independently in ZenGM (worker), League Manager (API) and the Openfoot fork (headless).

### Gaps
- I did not verify ZenGM's worker and cache architecture directly in source. It comes from a secondary index, and the blog post I fetched does not describe it.
- I could not find the "MobaGM Legacy" source repository, so its existence and licence rest only on the Steam page.
- The web draft tools draftlol and prodraft (and lolesports draft tools) were not checked in this session. Their stack, licence and activity are unknown.
- I did not confirm Bygfoot upstream activity on SourceForge or GitLab.

## Q2. Commercial and indie esports and sports management games: stack, UI, reception

### Takeaway
Released Steam titles with fictional-MOBA management are **Teamfight Manager 1/2**, **MOBA Manager** and **Esports Manager 2026** (which has no stated MOBA focus). Riot's **LoL Esports Manager** is still a China-only mobile game as of early 2026. **Football Manager 26** shows that a Unity engine switch can earn praise for the match visuals while the reworked UI draws heavy criticism.

### Cited Findings
- **Teamfight Manager 2** (Team Samoyed, Korea):
  - Entered Steam Early Access on 2026-05-25 for Windows, macOS and Linux. Early Access is planned for 1-2 years, with updates every two weeks.
  - Features: a fictional MOBA map ("destroy the enemy Relic"), a deathmatch mode from 2v2 to 5v5, team and personal tactics, player attributes that drive AI decisions, transfers, and Steam Workshop support for champions, teams, players, maps and tournaments.
  - Price is about €19.50. As of 2026-11-19 it was "Mostly Positive", 73% of 846 English reviews.
  - Another snapshot showed "Mixed" across 2,329 reviews in all languages, so the scores differ by language and time. The engine is not stated.
  - [Steam](https://store.steampowered.com/app/3009300/Teamfight_Manager_2/), [COGconnected 2026-05](https://cogconnected.com/2026/05/teamfight-manager-2-enters-steam-early-access-today/), [Gamespress](https://www.gamespress.com/Korean-indie-studio-Team-Samoyed-launches-Teamfight-Manager-2-in-Steam)
- **Teamfight Manager 1** (Steam app 1372810): you coach an esports team in a short auto-battling MOBA. [unverified] It came out in 2021, has a pixel-art look and was very well reviewed. The draft (picks and bans) plus watching the auto-battle is its core loop. — [Steam](https://store.steampowered.com/app/1372810/Teamfight_Manager)
- **Esports Manager 2026** (Neurona Games / indie.io, released 2026-07-06, Windows and macOS):
  - Features: transfers and loans, contract talks, real-time tactics in Simulation Mode, weekly training, morale, a "Talk" module, staff and sponsors.
  - It claims "real professional players" but names no specific esport, and draft is not mentioned.
  - Reviews: Mixed 67% (896 English reviews), recent Mostly Positive 79%.
  - [Steam](https://store.steampowered.com/app/2749950/Esports_Manager_2026/)
- **Other MOBA management titles on Steam (2026)**:
  - MOBA Team Manager (app 4074870) is a roguelike coaching sim focused on picks, bans and tactics, planned for 2026-11-18.
  - Esports Dynasty Manager (app 5109620) is set in a fictional MOBA scene.
  - An unnamed MOBA autobattler team sim (app 4396550) was planned for 2026-09-01.
  - I did not verify their release status. — [MTM](https://store.steampowered.com/app/4074870), [EDM](https://store.steampowered.com/app/5109620/), [4396550](https://store.steampowered.com/app/4396550)
- **Riot's LoL Esports Manager**:
  - Announced in Oct 2019 as a mobile game for China/LPL first, to expand to other leagues later. — [Riot Nexus 2019](https://nexus.leagueoflegends.com/en-us/2019/10/introducing-lol-esports-manager/), [PC Gamer](https://www.pcgamer.com/league-of-legends-is-getting-its-own-football-manager-like-business-sim-where-you-manage-a-pro-team/)
  - In Feb 2026 it ran LPL Spring Festival events and collector cards (Xiaohu, a Faker "Prestige" series), which shows a live-service card-collection model. — [Baidu Baike](https://baike.baidu.com/en/item/LOL%20Esports%20Manager/3334067)
  - Gamepressure lists the PC version as "canceled", from a single unsourced listing. — [Gamepressure](https://gamepressure.com/games/lol-esports-manager/z759b7)
  - I found nothing on NCSOFT involvement, and the brief's premise of an NCSOFT co-production could not be confirmed.
- **Football Manager 26** (Sports Interactive, Unity):
  - Critics praised the new Unity match engine and match-day experience. TopGear's review is titled "fantastic match engine, tangled mess menus".
  - The UI overhaul was the main complaint. Digitec called it an "interface labyrinth" and one review compared it to a Power BI dashboard.
  - Metacritic shows 68 from 44 critics. PCGamesN reported a Steam user score of about 22% at the time.
  - Coverage says the release was largely a migration of the database and core systems to Unity. Modders later worked on UI fixes.
  - [TopGear](https://www.topgear.com/car-news/gaming/football-manager-26-review-fantastic-match-engine-tangled-mess-menus), [Digitec](https://www.digitec.ch/en/page/football-manager-26-is-floundering-in-an-interface-labyrinth-40507), [PCGamesN](https://www.pcgamesn.com/football-manager-26/steam-score-criticism), [Metacritic](https://legacy.prod.metacritic.com/game/pc/football-manager-26/critic-reviews), [FRVR UI mods](https://frvr.com/blog/football-manager-26-set-for-huge-ui-overhaul-as-modders-crack-the-games-biggest-failure)
  - FM27 has a match-engine and tactics preview, including staff reporting the opponent's in-match tactical changes through the dugout. — [footballmanager.com FM27](https://www.footballmanager.com/node/1108)
- **OOTP / Franchise Hockey Manager** (Out of the Park Developments, Germany, founded 1999; specialises in "text sim-style sports games"):
  - FHM2 rebuilt its engine to track the zone of the puck and every player at all times, and FHM7 added a 2D match view.
  - Co-founder Markus Heinsohn said OOTP 25 would be his last launch as a developer.
  - [Wikipedia OOTP Dev](https://en.wikipedia.org/wiki/Out_of_the_Park_Developments), [Wikipedia FHM](https://en.wikipedia.org/wiki/Franchise_Hockey_Manager)
- **Motorsport Manager**: [unverified] Developed by Playsport Games and published by SEGA (2016). It is generally believed to be built in Unity, and the community save editors are written in C# (`realworld666/MMSaveEditor`, last push 2026-05). — [MMSaveEditor](https://github.com/realworld666/MMSaveEditor)

### Inferences
- The MOBA-manager niche on Steam is getting crowded in 2026 (TFM2, MOBA Manager, MTM, EDM, EM2026). For TFM-like games, reception centres on the draft-plus-watch loop. Esports Manager 2026's mixed reviews suggest that depth without a distinctive match or draft experience is not enough. This is inference only, since I did not read individual reviews.
- FM26 is a cautionary case: an engine or UI migration can hurt reception even when the simulation improves. Information density and navigation in management UIs are core to what players think of the game.

### Gaps
- I did not find which engines Teamfight Manager 1/2, Esports Manager 2026 and MOBA Manager use (MOBA Manager is likely JS/Electron given its ZenGM lineage, but that is unconfirmed).
- I found no reliable sources in this session for "Esports Life Tycoon" or "Esports Godfather".
- I found no dev interview or postmortem for Teamfight Manager.

## Q3. Approaches to match simulation, narrative and procedural generation

### Takeaway
The publicly documented approaches include:
- tick or minute-by-minute probabilistic event models: League Manager, MOBA Manager, FM's quarter-second "slices";
- zone-based state tracking: FHM;
- Markov-chain style engines: Openfoot topic tags;
- event-driven text commentary: Openfoot, esports-manager.

For narrative, the common tools are templates and grammars. Tracery is stale but simple, and ink is active and MIT.

### Cited Findings
- FM match engine: players and officials make a decision every quarter of a second (a "slice"). FM21 added players blocking passing lanes so that interception counts match real data. — [footballmanager.com "Match Engine AI in FM21"](https://footballmanager.com/node/404)
- League Manager LoL sim:
  - Games are simulated minute by minute: laning in minutes 1-14 with lane gold trades by matchup, solo kills and ganks, then grubs, dragons and herald.
  - Drake Soul strengths are fitted so the Soul side wins 86.8-90.6%, matching ranked data.
  - Draft scoring adds meta power (x0.8), an off-role penalty (-5), comp-type penalties, a tactic/power-curve fit and hand-picked duo synergies.
  - Patch model: nerf the most picked or banned champions, buff weak ones, apply a 3% drift to the mean, and move a whole class at mid-season.
  - [README](https://github.com/MartinSG98/league-manager-backend)
- MOBA Manager uses a tick-based engine, with outcomes driven by champion synergy, counters and early/mid/late meta ratings. — [Steam](https://store.steampowered.com/app/4813930)
- FHM2 tracks the zone of the puck and of every player throughout a game. — [Wikipedia FHM](https://en.wikipedia.org/wiki/Franchise_Hockey_Manager)
- Openfoot Manager has event-driven text commentary and generates inbox and news. Its repo topics include "markov" and "markov-chain". — [GitHub](https://github.com/openfootmanager/openfootmanager)
- **Tracery** (`galaxykate/tracery`): story-grammar JS library, Apache-2.0, about 2,222 stars, last push 2024-11-03, so effectively dormant. — [GitHub](https://github.com/galaxykate/tracery)
- **ink** (`inkle/ink`): narrative scripting language, MIT, about 5,027 stars, last push 2026-11-16. The JS port `y-lohse/inkjs` is MIT and was last pushed 2026-11-01. There are also inkcpp (MIT, 2026-11-19) and inkgd for Godot (MIT, last push 2024-08). — [ink](https://github.com/inkle/ink), [inkjs](https://github.com/y-lohse/inkjs), [inkcpp](https://github.com/JBenda/inkcpp), [inkgd](https://github.com/ephread/inkgd)
- Name generation:
  - `Tw1ddle/MarkovNameGenerator`: Markov names, about 472 stars, last push 2021-12, licence "NOASSERTION". — [GitHub](https://github.com/Tw1ddle/MarkovNameGenerator)
  - `skeeto/fantasyname`: Unlicense, about 206 stars, last push 2024-05. — [GitHub](https://github.com/skeeto/fantasyname)
  - `faker-js/faker`: about 15.5k stars, last push 2026-11-18, has locale name datasets. The licence shows as NOASSERTION on GitHub; [unverified] it is MIT. — [GitHub](https://github.com/faker-js/faker)
- League Manager handles player progression with explicit formulas. A player with fewer than 600 career games closes 12-30% of the gap to their growth target each off-season. Past age 27 a player declines about 0.5 points per year over 27, and the growth target also drops. — [README](https://github.com/MartinSG98/league-manager-backend)

### Inferences
- A per-minute, phase-based LoL event model with tuned constants and a batch calibration script is a proven indie pattern. It maps directly onto IDEA.md's "timeline by phases" and its plan to validate against DraftSim.
- ink fits authored press conferences and dialogue. A template or grammar approach (Tracery-style, possibly self-written given Tracery's dormancy) fits headline generation from match facts.

### Gaps
- I found no public material on whether any commercial manager generates text with LLMs offline.
- I did not find ZenGM's player-generation or name-generation internals in a primary source this session.
- I did not find any LoL-specific open commentary generators.

## Q4. Libraries for subsystems: tournaments, ratings, charts

### Takeaway
`brackets-manager.js` (MIT, active) covers round-robin and single/double elimination, with storage that can be swapped out, but it has no Swiss. `tournament-organizer` (MIT) and `tournament-pairings` (GPL-3.0) cover Swiss. For ratings, `openskill.js` (MIT, active) and `glicko2js` (MIT) are both maintained.

### Cited Findings
- **brackets-manager.js** (`Drarig29/brackets-manager.js`):
  - Facts: MIT, about 333 stars, latest release v1.11.1 on 2026-09-20.
  - Formats: round-robin, single and double elimination, BYEs during seeding, forfeits, and multiple stages per tournament (for example groups, then elimination).
  - Storage is pluggable (JSON, in-memory, SQL, Redis) and the library emits change events.
  - It has no GUI; it pairs with **brackets-viewer.js** (MIT, about 231 stars, last push 2026-09-19).
  - The README lists no Swiss format.
  - [brackets-manager.js](https://github.com/Drarig29/brackets-manager.js), [brackets-viewer.js](https://github.com/Drarig29/brackets-viewer.js)
- **tournament-organizer** (`slashinfty/tournament-organizer`): TypeScript, MIT, last push 2026-10-12, about 57 stars. It supports several formats including Swiss and playoffs, with tiebreakers such as Buchholz. The latest GitHub *release* tag is from 2022 (v2.1.2), although pushes continue. — [GitHub](https://github.com/slashinfty/tournament-organizer)
- **tournament-pairings** (`slashinfty/tournament-pairings`): pairing functions only, GPL-3.0 (copyleft), last push 2026-10-12. — [GitHub](https://github.com/slashinfty/tournament-pairings)
- **bbpPairings**: a C++ Swiss engine using the FIDE Dutch and Burstein systems, last push 2026-07-31, about 118 stars. It is built for chess, so pairing on colour balance does not map onto blue/red side choice. — [GitHub](https://github.com/BieremaBoyzProgramming/bbpPairings)
- `teijo/jquery-bracket`: MIT, about 500 stars, last push 2023-07, stale. — [GitHub](https://github.com/teijo/jquery-bracket)
- **Ratings**:
  - `philihp/openskill.js` (TS, MIT, about 262 stars) has latest release v5.1.0 on 2026-10-28 and is a faster, open-licence alternative to TrueSkill. — [GitHub](https://github.com/philihp/openskill.js)
  - `vivekjoshy/openskill.py` (MIT) had release v6.2.0 on 2026-01-11. — [GitHub](https://github.com/vivekjoshy/openskill.py)
  - `mmai/glicko2js` (MIT, about 160 stars) was last pushed 2026-10-29. — [GitHub](https://github.com/mmai/glicko2js)
  - `sublee/trueskill` (Python) was last pushed 2023-08. TrueSkill itself is patented by Microsoft; the patent claim is [unverified] here, but openskill.js describes itself as the "open-license alternative". — [GitHub](https://github.com/sublee/trueskill)
  - Glicko-2 in TS: `animafps/glicko2.ts` (GPL-3.0, 2026-07) and `ReedD/glicko-two` (MIT, 2020). — [glicko2.ts](https://github.com/animafps/glicko2.ts), [glicko-two](https://github.com/ReedD/glicko-two)
- Real-world format reference: per the League Manager README, Worlds Swiss pots are formed by seed and region, round 1 pairs pot 1 against pot 4 and pot 2 against pot 3, there are no same-region matches, later rounds pair equal records, and no rematches are allowed. — [README](https://github.com/MartinSG98/league-manager-backend)

### Inferences
- A combination that works is brackets-manager.js for round-robin and elimination plus Swiss pairing from tournament-organizer or custom code. LoL Swiss needs region constraints and no rematches, so a small custom Swiss on top is likely either way.
- GPL-3.0 libraries (tournament-pairings, glicko2.ts) would impose copyleft if bundled. MIT alternatives exist.

### Gaps
- Charting libraries for stats were not researched in this session (out of the tool budget).
- I found no dedicated "challonge-like" offline library beyond those listed.

## Q5. Talks, postmortems and design writeups

### Takeaway
There are few primary design writeups. The useful ones are ZenGM's blog (performance, ratings), the FM match engine pieces on footballmanager.com (slices, AI), and the League Manager README and ADRs. I found no GDC talk by Sports Interactive and no Teamfight Manager postmortem.

### Cited Findings
- ZenGM blog 2026: simulation 2x faster (2026-09-21) and real draft prospect ratings (2026-10-27). — [ZenGM blog](https://zengm.com/blog/)
- FM: "Match Engine AI in FM21" covers decision slices and lane blocking. An FM22 interview covers the new animation engine ("our old system wasn't up to scratch"), and there is an FM27 match-engine preview. — [FM21](https://footballmanager.com/node/404), [RealSport101 FM22](https://realsport101.com/article/football-manager-2022-fm22-developer-interview-new-player-animation-engine-nic-madden-cj-ramson), [FM27](https://www.footballmanager.com/node/1108)
- A Game Informer feature covers the dynamics of FM2018 (2017-11-06). — [Game Informer](https://gameinformer.com/b/features/archive/2017/11/06/the-sports-desk-inside-the-dynamics-of-football-manager-2018)
- League Manager has ADR folders in both repos (`docs/adr`). — [backend](https://github.com/MartinSG98/league-manager-backend), [ui](https://github.com/MartinSG98/league-manager-ui)
- Openfoot Manager's VISION.md is a design-philosophy document. — [VISION.md](https://github.com/openfootmanager/openfootmanager/blob/develop/VISION.md)

### Inferences
- League Manager's ADRs and Openfoot's VISION are the most directly reusable design documents for a project that wants "living documentation" (IDEA.md §10).

### Gaps
- I found no GDC Vault talk from Sports Interactive or Teamfight Manager; this is not exhaustive, because GDC Vault itself was not searched.
- I did not research Reddit threads on player praise and criticism.
- I did not find an architecture writeup by ZenGM in primary form during this session. [unverified] ZenGM historically published posts about IndexedDB and worker architecture on its blog. A search of the blog archive should check this.
