# Languages and game engines for Rift Legends (UI-heavy 2D desktop esports management game) — state as of 2026-11-19

Scope note: research done on 2026-11-19. GitHub figures were pulled live via the GitHub API on that date. Items marked **[background, unverified]** come from prior knowledge and were not re-confirmed by a source in this session; treat them as hypotheses for the report writer.

## Q1. Game engines/frameworks: status in 2026 and suitability for UI-heavy games (tables, lists, scrolling, text, theming)

### Takeaway
Godot 4.x (4.7.2 stable, Aug 2026) is the most mature, fully open-source option with a retained-mode Control/Container UI system plus a Rust binding (gdext 0.5.x) and C#; Unity 6.x is mature but mid-transition to CoreCLR/Unity 7 and is now the engine of Football Manager 26, whose UI was badly received. Bevy (0.20.1, Oct 2026) is improving UI quickly (BSN, Feathers, headless widgets) but still has no shipped editor and breaks API every release; Fyrox reached 1.0 in March 2026. Lightweight frameworks (Love2D, Raylib, MonoGame/FNA, Defold) leave most table/list/scroll UI to the developer or third-party libs.

### Cited Findings
**Live GitHub snapshot (GitHub API, 2026-11-19)** — stars / latest release / last push:
- godotengine/godot: 120,424 stars; latest 4.7.2-stable (2026-08-18); pushed 2026-11-19 — [GitHub](https://github.com/godotengine/godot)
- bevyengine/bevy: 49,870; v0.20.1 (2026-10-28) — [GitHub](https://github.com/bevyengine/bevy)
- raysan5/raylib: 35,733; 6.2 (2026-10-15) — [GitHub](https://github.com/raysan5/raylib)
- MonoGame/MonoGame: 14,658; v3.8.6.1 (2026-11-04) — [GitHub](https://github.com/MonoGame/MonoGame)
- FyroxEngine/Fyrox: 9,685; v1.0.0 (2026-03-29) — [GitHub](https://github.com/FyroxEngine/Fyrox)
- love2d/love: 8,977; latest *tagged release* still 11.5 (2023-12-03), though pushed 2026-11-05 — [GitHub](https://github.com/love2d/love)
- stride3d/stride: 7,954; 4.4.3 (2026-11-17) — [GitHub](https://github.com/stride3d/stride)
- defold/defold: 6,470; 1.14.1 (2026-11-10) — [GitHub](https://github.com/defold/defold)
- godot-rust/gdext: 5,411; v0.5.5 (2026-08-09) — [GitHub](https://github.com/godot-rust/gdext)
- FNA-XNA/FNA: 3,068; 26.11 (2026-11-01) — [GitHub](https://github.com/FNA-XNA/FNA)
- Non-engine UI stacks (relevant for a "core + UI toolkit" path): tauri 113,000 stars, tauri-cli v2.12.6 (2026-11-18); ocornut/imgui 77,177, v1.93.0 (2026-10-14); DioxusLabs/dioxus 39,853, v0.7.10 (2026-07-30); emilk/egui 32,392, 0.37.0 (2026-10-15); AvaloniaUI 31,847, 12.1.6 (2026-11-09); slint 24,643, v1.19.0 (2026-11-16) — GitHub API (repos: [tauri](https://github.com/tauri-apps/tauri), [imgui](https://github.com/ocornut/imgui), [dioxus](https://github.com/DioxusLabs/dioxus), [egui](https://github.com/emilk/egui), [Avalonia](https://github.com/AvaloniaUI/Avalonia), [slint](https://github.com/slint-ui/slint))

**Godot**
- Godot 4.6 stable launched late January 2026 ("Modern" editor theme default, Jolt default 3D physics, unique Node IDs, **LibGodot embedding**); maintenance 4.6.1–4.6.3 followed — [GamingOnLinux, Jan 2026](https://www.gamingonlinux.com/2026/01/the-free-and-open-source-godot-engine-4-6-is-out-now-with-major-upgrades); [AlternativeTo, Jan 2026](https://alternativeto.net/news/2026/1/godot-4-6-debuts-modern-theme-jolt-physics-node-ids-and-libgodot-embed); [godotengine.org 4.6](https://godotengine.org/releases/4.6/)
- Godot 4.7 released ~2026-06-19 (third-party date) — [Cinevva, 2026-06-19](https://app.cinevva.com/news/2026-06-19-godot-4-7-released); latest patch 4.7.2 on 2026-08-18 (GitHub API).
- 4.7 UI-relevant features: `offset_transform_*` on Control lets you move/rotate/scale a Control **without affecting container layout** (directly useful for animated draft cards inside containers); PopupMenu search bar for long lists; Tree drag-and-drop drop indicator; RichTextLabel images sized relative to font; screen-reader landmark navigation; GDExtension listing in Project Settings — [Godot 4.7 release page](https://godotengine.org/releases/4.7/)
- C#/.NET in Godot: as of the 4.7 mono build, users report web export is still blocked for C# projects; official .NET 10 support not confirmed (only proposals/discussion) — [Godot forum thread](https://forum.godotengine.org/t/is-there-an-update-on-exporting-c-projects-to-web/128821); [.NET 10 proposal #13076](https://github.com/godotengine/godot-proposals/discussions/13076); [GodotCon Boston web .NET prototype](https://godotengine.org/article/live-from-godotcon-boston-web-dotnet-prototype/). (Irrelevant for a desktop-only game, but signals C# remains a second-class platform in some areas.)
- godot-rust/gdext: v0.5.0 (27 Mar) made Godot 4.6 default, Rust 2024 edition, typed dictionaries, non-null object APIs; v0.5.3 (19 May) removed bindgen/LLVM/C compiler requirement, ~7% faster compile; v0.5.4 (23 Jun) added `api-4-7`; v0.5.5 (9 Aug) async fn for virtual funcs. Still pre-1.0, with announced behavioral changes for v0.6 and several use-after-free/robustness fixes in 2026 — [gdext releases](https://github.com/godot-rust/gdext/releases)

**Bevy**
- Releases: 0.18 (2026-01-13), 0.19 (2026-06-19), 0.20 (2026-10-08); ~1 breaking release every 4–5 months — [bevy.org/news](https://bevy.org/news/)
- 0.17 (2025-09-30) added an experimental headless UI widget library (feature flag `experimental_bevy_ui_widgets`), UI gradients, and the "Feathers" UI layer for the future editor — [Bevy 0.17](https://bevy.org/news/bevy-0-17/); [AlternativeTo](https://alternativeto.net/news/2025/10/bevy-0-17-adds-raytraced-lighting-improved-observers-and-events-headless-ui-widgets-and-more)
- 0.20 UI: BSN scene notation syntax "should largely be nailed down"; Feathers adds Color Input, **Scrollable List View**, Dropdown, Lazy Menu, drag-scrub Number Input, semantic-token theming; headless TabList/Tab with accessibility integration; `em`/`rem` units; inline boxes/images in text. **No editor shipped yet**; Feathers/BSN are described as building blocks; no stability/production-readiness claim — [Bevy 0.20](https://bevy.org/news/bevy-0-20/)
- A 2025 Bevy maintainer blog post discusses "production readiness" at Bevy's fifth birthday — [jms55, 2025-09-03](https://jms55.github.io/posts/2025-09-03-bevy-fifth-birthday) (not fetched; title only)

**Unity**
- Unity 6.3 LTS released 2025-12-04; UI Toolkit gained custom UI shaders (URP only), post-processing filters and built-in SVG — [Unity blog](https://unity.com/blog/unity-6-3-lts-is-now-available); [CG Channel, 2025-12-05](https://www.cgchannel.com/2025/12/unity-6-3-lts-is-out-see-5-key-features-for-cg-artists/)
- CoreCLR transition: Unity said 6.7 is the last Mono-based release (Mar 2026); experimental CoreCLR desktop player in 6.7 alpha (Jun 2026); at Unite Seoul (2026-07-21) Unity announced **Unity 7** with CoreCLR, .NET 10, C# 14, MSBuild; one summary says Unity 7 preview in December 2026, full release targeted Q1 2027. Sources conflict on whether full CoreCLR lands in 6.8 or 7 — [Unity March 2026 update](https://discussions.unity.com/t/coreclr-scripting-and-ecs-status-update-march-2026/1711852); [Unity June 2026 update](https://discussions.unity.com/t/coreclr-scripting-and-serialization-update-june-2026/1723299); [Unite Seoul 2026 recap](https://unity.com/blog/unite-seoul-keynote-2026-recap); [Inven Global](https://www.invenglobal.com/articles/24003/unity-engine-7-changing-the-development-paradigm-and-the-roadmap-ahead)

**Fyrox / others / new engines**
- Fyrox v1.0.0 (March 2026), Rust 2D/3D engine whose editor is built on the engine's own UI framework — GitHub API; [openapps.pro](https://openapps.pro/apps/fyrox)
- New/changed engines 2025–2026: Cocos 4 made fully open source (Jan 2026) — [It's FOSS](https://itsfoss.com/news/cocos-4-game-engine/); Gaijin's EdenSpark in open beta, open-sourcing announced but unconfirmed — [GameFromScratch](https://gamefromscratch.com/edenspark-game-engine-in-beta/); s&box replaced Yoga with its own C# layout engine with CSS Grid support — [s&box update 26.09.08](https://sbox.game/news/update-26-09-08); Solarus 2.0.3 (Jan 2026, C++/Lua 2D) — [solarus-games.org](https://www.solarus-games.org/)

### Inferences
- For a menu/table-heavy game, the decisive engine capability is a retained-mode UI with containers, scroll containers, rich text, theming and tweening. Godot ships this out of the box (Control/Container/Theme/Tween/RichTextLabel/Tree/ItemList) and 4.7's `offset_transform` specifically removes a long-standing pain point for animating UI inside layouts. Unity has UI Toolkit (USS/UXML, CSS-like) plus uGUI. Bevy now has the primitives (Scrollable List View, rem units, theming tokens), but data-grid/table widgets, virtualization and an editor are still absent per the 0.20 notes, so UI would be mostly hand-built and re-migrated each release.
- Love2D, Raylib, MonoGame/FNA give you a render loop, not a UI toolkit. Tables, scrolling, text layout, focus and theming would come from immediate-mode libs (Dear ImGui/raygui/Myra/Gum etc.) or be hand-written. That is fine for prototypes, but it's costly for an FM-style UI with dozens of screens. **[background, unverified]** Defold has a GUI system with node-based layout, but no built-in table/data-grid widgets; Stride is 3D-focused with a weak 2D UI story.
- Love2D's last tagged release is 11.5 (Dec 2023), even though the repo is active (12.0 is long in development). For a 2026 greenfield project that is a maturity/stagnation signal.
- "Non-engine" UI stacks (Tauri + web UI, Avalonia, Slint, egui, Dioxus) are viable for a game that is mostly menus. Web/CSS has the richest animation and data-table ecosystem (GSAP/Framer-Motion-like tweening, virtualized grids). The tradeoff is that the draft "spectacle" (particles, shaders, camera shake) is easier in a game engine. This is a legitimate alternative architecture the report should mention.
- Fyrox 1.0 is a real milestone, but its community is about 1/12 of Godot's by stars and its UI framework is primarily editor-oriented.

### Gaps
- Bevy 0.18/0.19 UI specifics were not fetched; only the 0.17 and 0.20 notes were confirmed.
- Godot 4.8 status (dev snapshots, ETA) was not found in this session.
- No source was confirmed for Godot's official .NET baseline version in 4.7 (believed to be .NET 8 **[background, unverified]**).
- Unity 6.x latest point version as of Nov 2026: docs URLs reference "6000.6", "6000.7" and "7000.0" manuals ([Unity docs](https://docs.unity.com/en-us/engine/7000.0/manual/whats-new/unity63)), but the current stable/LTS version was not confirmed. Unity's runtime-fee reversal (Sept 2024) and current Personal-plan terms were not re-verified.
- Defold's and Raylib's 2026 release notes (UI changes) were not read.

## Q2. Languages for the deterministic simulation core

### Takeaway
No language is clearly "best" for AI agents. Frontier models in 2026 are near-perfect on small, well-specified tasks in mainstream languages, and provided tests matter more than the language. Rust consistently costs more and fails to compile more often in LLM benchmarks, while TypeScript, Python and C# are the cheapest and fastest for agents. For determinism, the important choices are integer/fixed-point math and a single, explicitly seeded PRNG, more than the language itself.

### Cited Findings
- Akita benchmark (Oct 2026), 7 languages, one task, 4 attempts per cell: median time and tokens were TypeScript 53 s/147.5k, C# 61 s/171.6k, Kotlin 65 s/170.6k, Haskell 75 s, Python 77 s/138.2k, Rust 80 s/188.1k (about 650 lines vs about 260 for C#), Ruby 82 s. On Opus, C#, Haskell and Kotlin were cheapest (C# about 94k tokens). Frontier models passed 28/28 and 25/25, with failures being semantic rather than type errors. **"Provided tests mattered more than language"**: weaker models produced 24 correct artifacts with tests vs 16 without. The author states no general ranking can be drawn — [akitaonrails.com, 2026-10-11](https://akitaonrails.com/en/2026/10/11/are-there-better-languages-for-programming-with-llms/)
- Endoh benchmark (Claude Code Opus 4.6, 13 languages, 600 runs, ~200-line programs): Ruby $0.36, Python $0.38, JS $0.39, Go $0.50, Rust $0.54 (widest variance, 2 of 3 total failures, plus one case where the agent wrongly blamed the tests), TypeScript $0.62, C $0.74. Static languages were 1.4–2.6x costlier. Caveats: prototype scale, author bias acknowledged, C# and Kotlin not covered — [InfoQ, 2026-04-06](https://infoq.com/news/2026/04/ai-coding-language-benchmark)
- PROBE paper: Python has the highest pass rates, then C++ and Java, then C; Rust is the most challenging, mainly due to non-compiling outputs — [arXiv 2607.13820](https://arxiv.org/pdf/2607.13820)
- LLM coding performance correlates with language popularity, likely because of training-data density — [HackerNoon](https://hackernoon.com/comparing-llms-coding-abilities-across-programming-languages)
- Multi-SWE-bench (secondhand summary): resolution rates are highest for Python/TypeScript and drop for C/C++/Rust repos — summary cited in search results; original not verified.

### Inferences
- **Determinism.** A management sim's hot paths are mostly integer/ratio math (ratings, probabilities, schedules), so the safe pattern is integers or fixed-point with an explicitly passed, seedable PRNG, plus a ban on hash-map iteration order, wall-clock time and threads in the core. Language notes **[background, unverified]**:
  - Rust: deterministic `HashMap` iteration requires `BTreeMap`/`IndexMap` or a fixed hasher. f32/f64 are IEEE-deterministic on the same target, but transcendental functions can differ across platforms (`libm` crate helps).
  - C#: `Dictionary` order is insertion-based but not guaranteed. `System.Random` with a seed is stable within one .NET version, though implementation changes across versions make your own PRNG (e.g. PCG/xoshiro) safer.
  - JS/TS: only f64 numbers (BigInt for exact ints), and `Math.random` can't be seeded.
  - GDScript: no native fixed-point; `RandomNumberGenerator` is seedable.
  - Cross-platform save/replay compatibility (Linux/Windows/macOS) favors avoiding floats in the outcome-determining path regardless of language.
- **Performance.** Simulating many seasons, with thousands of matches each, is light work for any compiled or JIT language (Rust, C#, Kotlin, Go, TypeScript on V8/Bun). Python and GDScript could become bottlenecks for bulk AI-vs-AI simulation of decades. This is an inference, not a benchmark.
- **Agent-friendliness.** Practical evidence suggests TypeScript, C# and Python are the cheapest and fastest for agents; Rust costs more iterations but its compiler catches more mistakes. Since tests dominate agent success, a language with fast, ergonomic unit and property tests matters:
  - Rust: `cargo test`, proptest.
  - C#: xUnit, FsCheck.
  - TypeScript: Vitest, fast-check.
  - Kotlin: JUnit/Kotest.
  - Go: `go test`.
- **Niche languages.** Zig, Odin and Gleam have small training corpora (inference from the popularity correlation above), immature ecosystems and, for Zig, pre-1.0 language churn. That makes them weaker choices for an agent-heavy workflow.
- **Engine fit.** C# is the only language that is first-class in both Godot (.NET build) and Unity, and it is also the language of MonoGame, FNA, Stride and Avalonia. Rust pairs with Bevy and Fyrox natively and with Godot via gdext. TypeScript pairs with web-UI shells (Tauri/Electron).

### Gaps
- No 2026 benchmark directly compared LLM quality on C# vs Rust vs TypeScript at large codebase scale (benchmarks were ~200-line programs or a single task).
- No authoritative 2026 source was fetched on cross-platform float determinism in .NET 10 or Rust. The determinism notes above are background knowledge.
- No data was gathered on Kotlin, Go, Zig, Odin or Gleam game-engine integrations in 2026.

## Q3. Pure core library + separate presentation layer: integration paths

### Takeaway
The cleanest, best-supported "external core" paths in 2026 are a C# core in a plain .NET class library consumed by Godot-.NET or Unity, and a Rust core consumed by Godot via gdext (0.5.x, pre-1.0, tracks 4.6/4.7 APIs). Godot 4.6's LibGodot embedding adds the inverse option of embedding Godot in a host app, though its maturity is unverified.

### Cited Findings
- gdext v0.5.x supports Godot 4.6 by default with an `api-4-7` level, `Result` returns from `#[func]`, typed dictionaries, typed RPCs and async virtual functions. It no longer needs LLVM/bindgen (simpler build). An editor behavior change is coming in v0.6, and memory-safety fixes continued through 2026 — [gdext releases](https://github.com/godot-rust/gdext/releases)
- Godot 4.6 introduced LibGodot embedding — [AlternativeTo, Jan 2026](https://alternativeto.net/news/2026/1/godot-4-6-debuts-modern-theme-jolt-physics-node-ids-and-libgodot-embed)
- Unity 7 brings CoreCLR, .NET 10, C# 14 and MSBuild support. That should allow sharing a standard .NET class library and NuGet packages with fewer Mono/IL2CPP caveats — [Unite Seoul 2026 recap](https://unity.com/blog/unite-seoul-keynote-2026-recap)
- Football Manager 26 uses exactly this split: Unity for graphics and rendering, while the match engine, tactics and AI stay SI's proprietary systems — [Wikipedia: FM26](https://en.wikipedia.org/wiki/Football_Manager_26)

### Inferences
- **C# core + Godot .NET:** the core is a netstandard/net8+ class library with zero Godot references, testable with `dotnet test` headless, and the Godot project references it. Lowest friction, one language end to end, and a shareable core with Unity if the engine ever changes. Risks: Godot's .NET version lags upstream .NET, there is no web export (irrelevant here), and C# in Godot has a smaller community/sample base than GDScript.
- **Rust core + Godot (gdext):** the core crate has no Godot dependency, and a thin `gdext` crate exposes facades and DTOs. Strong typing and determinism tooling. Costs: two languages, FFI marshalling of collections and events, pre-1.0 binding churn, longer compile times, and higher agent iteration cost per the Q2 benchmarks.
- **Rust core + Bevy:** native, with no FFI. However, the UI must be built in Bevy UI, which remains the weakest point (Q1), and Bevy breaks every ~4 months.
- **Core in any language + web UI (Tauri/Electron):** Rust core inside Tauri, or a TypeScript core in the same process. This gives strong table/animation tooling. The draft "spectacle" would rely on CSS/Canvas/WebGL animation libraries instead of engine tweening and particles.
- **GDScript-only:** the fastest to prototype, but it weakens "rules separated from UI". There is no compile-time enforcement of the boundary, typing is gradual, and headless testing relies on GUT/gdUnit4 **[background, unverified]**.
- An event-sourced history (append-only facts plus projections) is language-agnostic. The core should emit domain events consumed by the UI for animation, so the draft and timeline screens become "playback" of core events. That pattern is easier when the core can run headless in CI.

### Gaps
- No 2026 source was found on LibGodot's API stability or real-world usage.
- No published performance numbers for gdext marshalling overhead were found.
- No 2026 article benchmarking a Godot-C# "pure core" project setup was found.

## Q4. What existing management/sim games use, and lessons

### Takeaway
The genre leader (Football Manager) moved its presentation to Unity for FM26 while keeping its proprietary sim core. Its UI rebuild was widely criticized as less efficient and buggy, a lesson that UI information density and navigation matter more than engine choice. Motorsport Manager used Unity. Teamfight Manager's and OOTP's tech could not be confirmed.

### Cited Findings
- FM26's UI was rebuilt in Unity around a new "Tile and Card" system powering every screen, and SI aims for a shared core UI system across its Unity-based games — [footballmanager.com FM26 UI feature](https://www.footballmanager.com/features/total-football-total-control-fm26s-reimagined-user-interface)
- Unity handles FM26's graphics and rendering, while the match engine, tactics and AI remain SI's proprietary systems — [Wikipedia](https://en.wikipedia.org/wiki/Football_Manager_26)
- FM26 UI reception: "a lot of what made FM's interface efficient and customizable is simply gone" (Mashable via [AOL](https://www.aol.com/articles/football-manager-26-review-fun-100115198.html)); "fantastic match engine, tangled mess of menus" ([Top Gear](https://www.topgear.com/car-news/gaming/football-manager-26-review-fantastic-match-engine-tangled-mess-menus)); "buggy interface" ([GosuGamers](https://www.gosugamers.net/entertainment/news/77565-review-football-manager-26-looks-good-but-its-buggy-interface-leaves-much-to-be-desired))
- UI and core-system co-development was reportedly outsourced in part to The Knights of Unity, and SI has not commented — [Operation Sports](https://www.operationsports.com/development-on-football-manager-26s-ui-was-apparently-outsourced)
- Modders are building custom FM26 UIs now that it is Unity-based — [FRVR](https://frvr.com/blog/football-manager-26-set-for-huge-ui-overhaul-as-modders-crack-the-games-biggest-failure)
- Motorsport Manager used Unity (allowing custom car models) — [GamerMatters](https://gamermatters.com/motorsport-manager-lets-you-be-the-boss-of-a-fictional-f1-team/); a sequel is reportedly planned for 2027 per search snippets (unverified).
- OOTP: sources describe a proprietary simulation engine but don't name its technology — [PC Gamer review](https://pcgamer.com/out-of-the-park-baseball-review); [OOTP Developments](https://ootpdevelopments.com/out-of-the-park-baseball-home/)
- Teamfight Manager (Team Samoyed, Korea) is the closest genre match. Teamfight Manager 2 entered Steam Early Access in May 2026 with Steam Workshop support. Its engine is not stated on Steam, GOG or Metacritic — [Steam TFM2](https://store.steampowered.com/app/3009300/Teamfight_Manager_2/); [esports-news.co.uk](https://esports-news.co.uk/?p=195558)

### Inferences
- FM26 shows that splitting a proprietary sim core from engine presentation works at AAA scale. Its backlash shows the risk sits in UI/UX design (density, keyboard navigation, customization), not engine capability. For Rift Legends, the UI framework's ability to build dense, fast, keyboard-friendly tables is a first-order criterion.
- Moddable UIs (FM26 community, TFM2 Workshop) suggest "content as data" plus data-driven themes and layouts adds long-term value.

### Gaps
- Teamfight Manager 1/2 engine: unknown (possibly Unity **[background, unverified]**; it would need SteamDB or file inspection).
- OOTP's UI technology (believed to be a custom C++ engine **[background, unverified]**).
- Hades' tech (Supergiant's custom C++ engine "The Forge"-based, with Lua scripting **[background, unverified]**) was not researched in this session.
- No 2025–2026 GDC talks or postmortems on management-game UI architecture were found within the tool budget.

## Q5. Latest versions, maturity and community activity (summary table, 2026-11-19)

### Takeaway
Every major candidate except Love2D shipped a release in the last 3 months. Godot dominates community size among open-source engines, Bevy is second and fast-moving but pre-1.0, and Fyrox hit 1.0. Unity is the commercial incumbent heading into a major runtime transition (Unity 7, preview Dec 2026, GA targeted Q1 2027).

### Cited Findings
| Engine/framework | Latest (date) | Stars | Language(s) | UI toolkit maturity for tables/lists | Source |
|---|---|---|---|---|---|
| Godot | 4.7.2 (2026-08-18); 4.6 Jan 2026, 4.7 ~Jun 2026 | 120.4k | GDScript, C# (.NET), C++/Rust via GDExtension | Built-in Control/Container/Theme/Tree/ItemList/RichText; 4.7 adds layout-safe transform animation | [GitHub](https://github.com/godotengine/godot), [4.7 notes](https://godotengine.org/releases/4.7/) |
| Bevy | 0.20.1 (2026-10-28) | 49.9k | Rust | Headless widgets, Feathers (Scrollable List View, dropdown), BSN; no editor, no stability promise | [Bevy 0.20](https://bevy.org/news/bevy-0-20/) |
| Unity | 6.3 LTS (2025-12-04); 6.7 last Mono; Unity 7 preview Dec 2026 | n/a (closed) | C# | UI Toolkit (USS/UXML) + uGUI; used by FM26 | [Unity blog](https://unity.com/blog/unity-6-3-lts-is-now-available), [Unite Seoul](https://unity.com/blog/unite-seoul-keynote-2026-recap) |
| Fyrox | 1.0.0 (2026-03-29) | 9.7k | Rust | Own UI framework (powers its editor) | [GitHub](https://github.com/FyroxEngine/Fyrox) |
| Defold | 1.14.1 (2026-11-10) | 6.5k | Lua | GUI nodes; no data-grid **[bg]** | [GitHub](https://github.com/defold/defold) |
| Love2D | 11.5 (2023-12-03) | 9.0k | Lua | None built-in | [GitHub](https://github.com/love2d/love) |
| Raylib | 6.2 (2026-10-15) | 35.7k | C (+bindings) | raygui immediate-mode **[bg]** | [GitHub](https://github.com/raysan5/raylib) |
| MonoGame / FNA | 3.8.6.1 (2026-11-04) / 26.11 (2026-11-01) | 14.7k / 3.1k | C# | None built-in (third-party libs) | [MonoGame](https://github.com/MonoGame/MonoGame), [FNA](https://github.com/FNA-XNA/FNA) |
| Stride | 4.4.3 (2026-11-17) | 8.0k | C# | 3D-centric UI **[bg]** | [GitHub](https://github.com/stride3d/stride) |
| godot-rust gdext | v0.5.5 (2026-08-09) | 5.4k | Rust↔Godot | n/a (binding) | [releases](https://github.com/godot-rust/gdext/releases) |

### Inferences
- In terms of licensing risk, Godot (MIT), Bevy (MIT/Apache), Fyrox (MIT), MonoGame/FNA and Raylib carry no fee or terms risk, which fits a free fan project. Unity is free under its Personal terms for a non-commercial project, but it is closed source and has a history of terms changes.
- **[background, unverified]** Linux support:
  - Godot: Linux is a first-class editor and export target.
  - Unity: the Linux editor exists but is less polished.
  - Bevy, Fyrox and Raylib: work natively on Linux.

### Gaps
- Contributor counts and commit cadence beyond "last push" were not collected.
- Reddit and HN 2025–2026 sentiment threads were not sampled within the tool budget.
- Unity's current exact version and Personal-license terms were not verified.
