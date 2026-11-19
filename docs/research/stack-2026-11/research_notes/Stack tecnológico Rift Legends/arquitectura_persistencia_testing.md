# Architecture, persistence, deterministic simulation and testing for the Rift Legends core (as of 2026-11-19)

Scope: the single-player simulation core of Rift Legends (IDEA.md §7, §10). The requirements in §10 drive this research: modular design, game rules separate from UI and storage, "what happened is the source of truth" (store facts, derive stats and history), a deterministic seeded simulation, content as data, and living documentation and domain contracts.

Method notes:
- Version numbers and dates come from the crates.io, npm, NuGet and PyPI registry APIs, queried on 2026-11-19.
- "NuGet upper" means the highest version listed in the registration index. The publish date was not read.
- Some links are canonical references cited from background knowledge and were not re-fetched in this session. They are marked "(canonical, not re-fetched)".
- No final recommendation is made, as requested.

---

## 1. Architecture patterns (hexagonal, functional core/imperative shell, ECS vs domain model, event sourcing, command pattern, state machines)

### Takeaway
The requirements match a "functional core, imperative shell" with ports and adapters:
- **Core:** pure, seeded `(state, command, rng) -> events` functions.
- **Shell:** UI, storage and clock adapters.
- **Persistence:** an append-only log of facts with rebuildable projections.

Event sourcing in single-player games is a known but niche pattern. Its main risk, per the general ES literature, is evolving event schemas across versions. ECS fits real-time simulations with many homogeneous entities better than a turn- and day-based management sim with rich relationships. That last point is an inference, not a sourced claim.

### Cited Findings
- **Functional core, imperative shell.** Gary Bernhardt's 2012 screencast "Functional Core, Imperative Shell" argues for pure decision logic surrounded by a thin I/O shell — [Destroy All Software](https://www.destroyallsoftware.com/screencasts/catalog/functional-core-imperative-shell) (canonical, not re-fetched).
- **Hexagonal architecture.** Alistair Cockburn's "Hexagonal Architecture" (ports and adapters, 2005) separates the application from drivers and driven adapters such as UI, DB and tests — [alistair.cockburn.us](https://alistair.cockburn.us/hexagonal-architecture/) (canonical, not re-fetched).
- **Event sourcing.** Martin Fowler's "Event Sourcing" (2005) describes capturing every change as an event and rebuilding state by replay. It discusses temporal queries, replay and the problem of external systems during replay — [martinfowler.com](https://martinfowler.com/eaaDev/EventSourcing.html) (canonical, not re-fetched).
- **Event-sourced game saves in practice:**
  - The Axiom narrative engine stores saves as event journals (one file per save). Visible state is computed from the Event_Log, and rewind and sharing work from the journal — [Axiom docs](https://frosoore.github.io/AxiomAI/en/api/saves.html).
  - The Fracturing Space architecture docs state that the event journal is authoritative and that projection state is derived and rebuildable — [Fracturing Space](https://louisbranch.github.io/fracturing.space/architecture/foundations/event-driven-system.html), [event replay](https://louisbranch.github.io/fracturing.space/architecture/foundations/event-replay.html).
  - An Elm Minesweeper uses event sourcing to give the player a rewind slider — [Medium](https://medium.com/@dfarr/event-sourcing-minesweeper-65f0d497e6a7).
- **Snapshot saves, for contrast.** Shadow Gambit (Mimimi) uses a conventional snapshot save that serialises everything, converting object references to IDs before serialisation — [Game Developer](https://www.gamedeveloper.com/programming/deep-dive-creating-and-fine-tuning-the-save-system-of-_shadow-gambit_).
- **Event-store libraries:**
  - Rust `cqrs-es` 0.5.0 (2025-12-30, about 187k downloads): a CQRS/ES framework with pluggable stores — [crates.io](https://crates.io/crates/cqrs-es).
  - TypeScript `@event-driven-io/emmett` 0.42.5 (2026-11-12): Oskar Dudycz's ES library, still pre-1.0 — [npm](https://www.npmjs.com/package/@event-driven-io/emmett).
  - .NET Marten (NuGet upper 10.0.0-alpha.5) is PostgreSQL-backed, so it is unsuitable for an embedded desktop save without a Postgres server — [NuGet](https://www.nuget.org/packages/Marten).
- **ECS options:**
  - Rust: `bevy_ecs` 0.20.1 (2026-10-28) and `hecs` 0.11.2 (2026-10-04) — [crates.io](https://crates.io/crates/bevy_ecs), [hecs](https://crates.io/crates/hecs).
  - C#: Arch 2.1.0 (2025-05-27). DefaultEcs's last release is 0.18.0-beta01 (2023-04), so it looks stale — [NuGet Arch](https://www.nuget.org/packages/Arch), [DefaultEcs](https://www.nuget.org/packages/DefaultEcs).
  - TypeScript: bitecs 0.4.0 (2025-12), koota 0.6.6 (2026-04). miniplex 2.0.0 (2023-07) has had no release since — npm registry.
- **State machines:**
  - TypeScript: XState 5.33.4 (2026-11-07), with actors, statecharts and a visual inspector. Also `@xstate/store` 4.3.0 and robot3 1.4.0 (2026-10) — [npm xstate](https://www.npmjs.com/package/xstate).
  - Rust: `statig` 0.4.1 (2025-07-05), a hierarchical state machine crate — [crates.io](https://crates.io/crates/statig).
  - C#: Stateless (NuGet upper 5.20.1) — [NuGet](https://www.nuget.org/packages/Stateless).
- **Immutable updates in TypeScript.** Immer 11.2.10 (2026-11-10) supports immutable state updates and patches, which are usable as a change log — [npm](https://www.npmjs.com/package/immer).

### Inferences
- **Command pattern and event sourcing.** The two compose naturally:
  - The UI emits commands (e.g. `SignPlayer`, `SubmitDraftPick`, `AdvanceDay`).
  - The core validates each command and returns domain events (`MatchPlayed`, `TransferCompleted`, `AwardGranted`).
  - Projections build stats, history, Hall of Fame and head-to-head records.
  - This matches IDEA §7 "Historial" ("all history is built from what really happened").
- **Granularity is the key design choice.**
  - Facts can be coarse, e.g. `MatchPlayed{seed, inputs, result summary}`. Full timelines can then be re-derived deterministically from the seed.
  - Or every timeline event can be stored.
  - Coarse facts plus a seed keep saves small but tie old saves to the old simulation code version. Storing the outcome facts avoids that coupling.
  - A hybrid is common in ES: store outcome facts, and use the seed for audit and replay tests.
- **Projections in SQLite.** Projections can be SQL tables kept in the same SQLite file, rebuilt when a projection schema version changes. This avoids a separate read store.
- **ECS fit.** The game models a world of about 10^3–10^4 entities (players, teams, matches) with rich relations (contracts, rosters, histories). A plain domain model plus relational projections probably fits better than ECS. ECS mainly pays off for per-frame iteration over many homogeneous components.
- **Where state machines fit.** They suit the draft phases (picks and bans, side rules, fearless draft), series and best-of flow, tournament formats (Swiss, double elimination) and the season calendar. They are optional where plain enums and match expressions suffice.

### Gaps
- No public postmortem was found from a sports-management game (Football Manager, OOTP, etc.) that describes its internal save architecture. The FM community only reports anecdotal sizes; see section 3.
- No source covered snapshotting strategies or event-schema migration specific to single-player game saves.

---

## 2. Deterministic RNG and numeric determinism

### Takeaway
Use an explicitly named, portable algorithm such as ChaCha8/12/20, PCG or xoshiro. Do not use a library's "default" RNG: Rust's `StdRng` and `SmallRng` are explicitly not portable across minor versions.

To keep the per-subsystem streams independent, derive them by hashing (seed, subsystem label, entity id or day) into new seeds. PCG's "streams" have documented correlation concerns.

The real portability risk is floating point. Basic IEEE ops are reproducible in practice, but transcendental functions, compiler flags and threading are not guaranteed to be. For a single-machine, single-player game this is mostly a test-reproducibility concern, not a desync concern.

### Cited Findings
- **Rust `rand` stability:**
  - `rand` 0.10.0 was released in Feb 2026; the latest is 0.10.4 (2026-11-15).
  - The 0.10 migration guide says there are no known value-breaking changes. StdRng is now backed by the `chacha20` crate.
  - The ChaCha{8,12,20}Rng types are direct replacements that keep reproducibility.
  - StdRng and ChaCha{8,12,20}Rng no longer implement `Clone` or serde. **This matters for saving RNG state.**
  - Sources: [Rand Book update-0.10](https://rust-random.github.io/book/update-0.10.html), [lib.rs](https://lib.rs/crates/rand).
- **Rand Book on portability:** "avoid SmallRng and StdRng if you care about reproducible results". It recommends ChaCha8Rng. Deterministic non-portable items may change in any minor release — [Rand Book](https://rust-random.github.io/book/print.html), [rngs docs](https://docs.rs/rand/0.10.0/src/rand/rngs/std.rs.html).
- **Rust RNG crates** (crates.io, 2026-11-18): `rand_pcg` 0.10.3, `rand_xoshiro` 0.8.2 (now in the `rust-random/rngs` repo) and `rand_chacha` 0.10.0 — [crates.io](https://crates.io/crates/rand_pcg).
  - Uncertainty: given the move of ChaCha into `chacha20`, it was not verified whether `rand_chacha` 0.10.0 is a thin re-export or a deprecation shim.
- **PCG vs xoshiro dispute:**
  - Vigna's 2018 "wrap-up on PCG generators" critiques PCG, and O'Neill rebutted it ("On Vigna's PCG Critique", "A Quick Look at Xoshiro256**") — [prng group](https://groups.google.com/g/prng/c/KeytKWDCShs), [pcg-random.org](https://pcg-random.org/posts/on-vignas-pcg-critique.html), [xoshiro post](https://pcg-random.org/posts/a-quick-look-at-xoshiro256.html).
  - O'Neill herself reported detectable correlations between PCG streams created by changing the increment — [Critiquing PCG's streams](https://pcg-random.org/posts/critiquing-pcg-streams.html).
  - Rust `rand` switched SmallRng to xoshiro, citing PCG stream correlations — [rand issue #905](https://github.com/rust-random/rand/issues/905).
  - These sources are partisan; for a game, either family has ample statistical quality.
- **TypeScript and other languages:**
  - `pure-rand` 8.4.2 (2026-07-10), maintained by the fast-check author, has immutable or pure generators (xoroshiro128+, mersenne, congruential) with `jump` support — [npm](https://www.npmjs.com/package/pure-rand).
  - `seedrandom` 3.0.5 has not been updated since 2019-09 — [npm](https://www.npmjs.com/package/seedrandom).
  - C# `System.Random` with a seed: the legacy seeded algorithm is kept for compatibility. **Unverified** whether it is guaranteed across .NET versions; it is common practice to implement PCG or xoshiro by hand. The NuGet package "PCGSharp" was not found in this session's lookup.
- **Fixed-point libraries:**
  - Rust: `fixed` 1.31.0 (2026-03-20) — [crates.io](https://crates.io/crates/fixed).
  - C#: FixedMath.Net 1.0.1 has not been updated since 2021 — [NuGet](https://www.nuget.org/packages/FixedMath.Net).
- **Float determinism evidence:**
  - An arXiv paper on lock-step simulation found basic float ops deterministic in practice; transcendental functions were the exception — [arXiv 1705.09704](https://arxiv.org/pdf/1705.09704).
  - Frontier's GDC 2024 talk (Warhammer Age of Sigmar: Realms of Ruin) shipped cross-platform deterministic floats under constraints, noting that multiple platforms mean multiple compilers — [GDC slides](https://media.gdcvault.com/gdc2024/Slides/GDC+slide+presentations/Pollard_Bradley_CrossPlatformDeterminism+2024-03-26+09.34.19.pdf).
  - Osmos desynced from float nondeterminism — [Game Developer](https://www.gamedeveloper.com/programming/osmos-updates-and-floating-point-determinism).
  - Some lockstep teams chose fixed point and trapped the FP inexact exception to catch accidental float use — [Game Developer](https://gamedeveloper.com/programming/minimizing-the-pain-of-lockstep-multiplayer).
- **Factorio's determinism practice:**
  - Its "heavy mode" test saves and reloads every tick and compares map CRCs (FFF #315, 2019).
  - It checks that save/load causes no observable change (FFF #270, 2018).
  - Debugging uses per-tick checksums on replays (FFF #47, 2014).
  - A threading determinism bug from 2017 surfaced only with different CPU core counts (FFF #415, 2024).
  - Sources: [FFF #270](https://cf-www.factorio.com/blog/post/fff-270), [FFF #47](https://cf-www.factorio.com/blog/post/fff-47), [FFF #415](https://direct.factorio.com/blog/post/fff-415), [FFF #340](https://factorio.com/blog/post/fff-340).

### Inferences
- **Seed splitting.** Hash-derive per-subsystem seeds, for example `seed(match_id) = H(world_seed, "match", season, match_index)`. This makes each match reproducible on its own and robust to call-order changes elsewhere.
  - One shared RNG stream means that adding a single new random draw (say in training) shifts every later match outcome. That breaks golden tests and DraftSim comparisons.
  - A ChaCha-based RNG has a native `set_stream` / word-position API that serves the same purpose.
- **Saving RNG state.** Since `rand` 0.10 removed serde from ChaCha RNGs, store the *derivation inputs* (seed, stream id, position) rather than serialised RNG state. Alternatively, wrap the RNG in your own type. This needs verification against the current docs.
- **Floats in a single-player game.** A JS engine (V8 and Node use an fdlibm port for `Math.sin` and similar, per background knowledge, unverified here) or Rust `f64` will reproduce results on the same build. Cross-OS golden tests in CI may expose differences in `exp`, `ln` and `powf` (e.g. logistic win probabilities). Mitigations:
  - Use a pure-software libm (Rust `libm` crate).
  - Use fixed point, or integer "rating points", in the hot simulation paths.
  - Round values before persisting facts.
  - Avoid iteration-order nondeterminism: HashMap with random seeds, parallel reductions.

### Gaps
- Not verified: the exact cross-version guarantees for .NET `new Random(seed)` in .NET 10 or 11.
- Not verified: whether `rand_chacha` 0.10.0 is deprecated in favour of `chacha20`.
- No 2025–2026 article was found specific to management-sim RNG design.

---

## 3. Persistence (SQLite family, DuckDB, KV stores, save formats, migrations, event stores)

### Takeaway
SQLite remains the default embedded choice in every candidate language. Its bindings are all active in late 2026, and it handles an append-only facts table, SQL projections, migrations (`PRAGMA user_version`) and single-file saves.

- **DuckDB** can attach SQLite files directly for heavy historical analytics.
- **Turso** (the Rust SQLite rewrite) is production-used but pre-1.0.
- **Binary blob formats** are fast but make schema evolution harder.
- **bincode is dead upstream** (tombstone 3.0.0).

### Cited Findings
- **Rust SQLite and storage crates** (crates.io, 2026-11):

  | Crate | Version | Note |
  |---|---|---|
  | `rusqlite` | 0.43.0 (2026-11-15) | |
  | `sqlx` | 0.9.1 (2026-11-18) | async, compile-time-checked SQL |
  | `diesel` | 2.4.0 (2026-11-13) | |
  | `sea-orm` | 2.0.4 (2026-09) | |
  | `rusqlite_migration` | 2.7.0 (2026-11-10) | |
  | `refinery` | 0.10.0 (2026-10) | |
  | `redb` | 5.0.0 (2026-11-18) | pure-Rust embedded KV |
  | `heed` | 0.23.1 (2026-10) | LMDB wrapper |
  | `duckdb` | 1.20000.2 (2026-11-13) | odd version scheme mapping DuckDB 2.0.x — inference |
  | `libsql` | 0.10.0 (2026-10) | |
  | `turso` | 0.8.3 (2026-11-12) | |

  Source: [crates.io API](https://crates.io/crates/rusqlite).
- **Turso** is an in-process Rust SQLite-compatible database targeting SQLite 3.50.4:
  - Existing SQLite files "work as-is", but it is "not at 100% yet"; "we have not yet reached 1.0"; and it advises "keep independent backups".
  - It has `BEGIN CONCURRENT` MVCC, CDC, and io_uring async on Linux.
  - Encryption at rest, DBSP incremental computation, full-text search and multi-process WAL are experimental.
  - Bindings: Go, JS, Java, .NET, Python, Rust and WASM.
  - The old `limbo` crate is superseded (last release 0.0.22, 2025-06).
  - Sources: [GitHub turso](https://github.com/tursodatabase/turso), [crates.io limbo](https://crates.io/crates/limbo).
- **TypeScript:**
  - `better-sqlite3` 13.2.0 (2026-11-14), synchronous and native.
  - `drizzle-orm` 0.45.4 (2026-10-08), still pre-1.0.
  - `kysely` 0.29.9 (2026-11-12).
  - `@sqlite.org/sqlite-wasm` 3.54.1-build1 (2026-10-19), the official SQLite WASM build with OPFS.
  - `@libsql/client` 0.18.0.
  - `@duckdb/node-api` 2.0.0-r.1 (2026-10-21); `@duckdb/duckdb-wasm` 1.33.1-dev57 (2026-06).
  - Source: npm registry.
- **.NET:** Microsoft.Data.Sqlite and EF Core Sqlite at NuGet upper 11.0.0 (the .NET 11 wave, Nov 2026 — publish date not read); Dapper 2.1.89 (2026-09) — [NuGet](https://www.nuget.org/packages/Microsoft.EntityFrameworkCore.Sqlite).
- **Python:** duckdb 2.0.0 (2026-10-21) — [PyPI](https://pypi.org/project/duckdb/).
- **DuckDB over SQLite files.** The `sqlite` core extension lets DuckDB `ATTACH 'file.db' (TYPE sqlite)` and query the tables in place. It can export to or import from Parquet.
  - Caveats: SQLite allows only a single writer at a time, and linking multiple SQLite copies into one app can cause errors.
  - Source: [DuckDB docs](https://duckdb.org/docs/current/core_extensions/sqlite).
- **bincode is a tombstone.**
  - bincode 3.0.0 (crates.io, 2025-12-16) is a final placeholder: "development on bincode has ceased due to a doxxing and harassment incident". It does not build on docs.rs.
  - The README suggests wincode, postcard or rkyv instead. A community fork, `bincode-next`, reached v3.1.1.
  - The GitHub repo was archived on 2025-08-15 and moved to sourcehut.
  - Sources: [docs.rs bincode 3.0.0](https://docs.rs/crate/bincode/3.0.0/source/README.md), [bincode-next 3.1.1 announcement](https://users.rust-lang.org/t/releasing-bincode-next-v3-1-1-v3-stabilization-release/140842), [GitHub](https://github.com/bincode-org/bincode).
- **Serialization formats** (registries, 2026-11):

  | Format | Rust | TypeScript | .NET |
  |---|---|---|---|
  | MessagePack | `rmp-serde` 1.3.1 (2025-12) | `msgpackr` 2.1.4 (2026-11), `@msgpack/msgpack` 3.1.3 | MessagePack-CSharp (NuGet upper 4.0.0-rc.1) |
  | Protobuf | `prost` 0.14.6 (2026-11) | `@bufbuild/protobuf` 2.17.0 (2026-11), `protobufjs` 8.8.1 (2026-10) | |
  | FlatBuffers | `flatbuffers` 25.12.19 | `flatbuffers` 25.9.23 | |
  | Cap'n Proto | `capnp` 0.28.1 (2026-11-19) | `capnp-es` 0.0.17, pre-release quality | |
  | Other binary | `postcard` 1.1.3 (2025-07), `rkyv` 0.8.18 (2026-08), zero-copy | | MemoryPack 1.22.0 (2026-11-11) |
  | Compression | | `fflate` 0.8.3 (2026-05) | |

  Source: registry APIs.
- **Save-size evidence from Football Manager** (anecdotal, community sources only):
  - A 100-year fan save with about 63k players was 772 MB.
  - A 2005-era save shrank from 217 MB to 144 MB after temporary match files were deleted.
  - FM26 warns above 125k players in the database.
  - Sources: [FMScout](https://www.fmscout.com/i-100-years-in-the-future-football-manager-2123.html), [Passion4FM](https://www.passion4fm.com/how-to-set-up-your-database-size-in-football-manager/), [SI forum](https://community.sigames.com/forums/topic/184035-fm-2011-saving-games-any-speed-improvements/).
  - Separately, FM saves can't carry over between yearly editions for tech and legal reasons — [PC Gamer](https://pcgamer.com/football-manager-save-files-cant-carry-over-year-on-year-for-tech-and-legal-reasons).

### Inferences
- **The save file is a SQLite database.** One SQLite file per save fits several needs: append-only `events` (seq, type, schema_version, payload JSON or MessagePack), projection tables, and `PRAGMA user_version` for migrations.
  - It is crash-safe through WAL and transactions, inspectable by modders, and queryable by DuckDB for "many seasons" analytics.
  - "Save as" becomes `VACUUM INTO` or the backup API (SQLite feature, background knowledge).
- **Payload encoding trade-off:**
  - JSON payloads (optionally zstd-compressed) maximise debuggability and evolvability.
  - Schema'd binary (Protobuf or MessagePack with explicit versioning) is smaller.
  - Positional binary formats (bincode, postcard, rkyv) are fragile for long-lived saves unless they are wrapped in explicit versioning.
- **Save versioning.** Store `game_version`, `content_version` (champions and patches), `sim_version` and `schema_version` per save. Old events need upcasters, since projections can be rebuilt. FM's year-on-year incompatibility shows that some games simply refuse old saves.
- **Embedded KV stores** (redb, LMDB/heed) add little over SQLite here unless raw blob throughput matters.
- **libSQL and Turso** matter mainly if sync or replication or `BEGIN CONCURRENT` are needed. That is out of scope per IDEA §9 (no online play).

### Gaps
- No benchmark was found for SQLite event-log sizes across simulated seasons. The project would need to measure it, e.g. events per season × bytes per event.
- No sourced data on the publish dates of the .NET 11 packages, or on whether the DuckDB 2.0 file format is stable.
- No dedicated, maintained embedded (non-server) event-store library was confirmed for .NET or Rust. Most ES libraries target Postgres or EventStoreDB.

---

## 4. Content as data (formats, schema validation, modding, hot reload)

### Takeaway
All candidate formats have maintained parsers in late 2026. The real choice is between:
- human-authored formats (TOML, YAML, RON, KDL, JSON5) for designers and modders;
- tabular CSV for balance sheets of champion stats;
- a schema layer (JSON Schema as the cross-language lingua franca, or Zod, Valibot or ArkType in TS, serde, schemars or garde in Rust, or Pkl or CUE as config languages).

### Cited Findings
- **Rust parsers and validators:**
  - `serde_json` 1.0.154 (2026-10), `toml` 1.2.1 (spec 1.1.0, 2026-11-06), `ron` 0.12.3 (2026-10-28), `kdl` 6.7.1 (2026-05).
  - `schemars` 1.2.3 (2026-10) derives JSON Schema from Rust types.
  - `jsonschema` 0.61.2 (2026-11-12) is a validator.
  - `garde` 0.23.0 (2026-05) and `validator` 0.21.0 (2026-07) handle field validation.
  - Source: [crates.io](https://crates.io/crates/schemars).
- **TypeScript parsers and validators:**
  - Zod 4.6.7 (2026-10-12), Valibot 1.5.0 (2026-09), ArkType 2.2.10 (2026-11-18), TypeBox 0.34.52 (2026-07), Ajv 8.20.0 (2026-04).
  - `yaml` 2.9.1, `smol-toml` 1.9.1 (2026-10).
  - `json5` 2.2.3 has not been updated since 2022-12. `kdljs` 0.3.0 dates from 2025-01.
  - Pkl JS bindings: `@pkl-community/pkl` 0.30.2 (2026-02), a community package.
  - Source: npm registry.
- **.NET:** NJsonSchema (NuGet upper 11.6.2) — [NuGet](https://www.nuget.org/packages/NJsonSchema).
- **Not re-fetched (canonical):**
  - Pkl is Apple's configuration-as-code language, open-sourced in Feb 2024, with codegen for Java, Kotlin, Swift and Go — [pkl-lang.org](https://pkl-lang.org) (canonical, not re-fetched).
  - CUE unifies schema and data — [cuelang.org](https://cuelang.org) (canonical, not re-fetched).

### Inferences
- **Typical split** for a LoL management sim:
  - Champions and patch deltas as TOML, RON or JSON files per champion or per patch, which are diff-friendly in Git and good for "patch notes generated between splits".
  - Teams and players as CSV or JSON, imported from community data with attribution (IDEA §11).
  - Meta tiers derived at runtime, not authored.
- **Schema-first contracts.** One JSON Schema, either hand-written or derived via schemars, Zod or ArkType, can validate content in CI, power editor autocompletion for modders (VS Code YAML or JSON schema association), and generate types for other languages.
- **Format trade-offs:**
  - RON is Rust-centric, which limits other tooling.
  - KDL has a smaller ecosystem.
  - YAML has well-known footguns (implicit typing).
  - TOML is weak for deeply nested data.
- **Hot reload.** A file watcher (`notify` in Rust, chokidar or native `fs.watch` in Node) re-validates content and swaps an immutable content snapshot. Determinism requires that saves record the content hash or version they ran with.

### Gaps
- `notify`, chokidar, CUE and Pkl versions were not looked up in this session.
- No source was found comparing modding friendliness of these formats in shipped management games.

---

## 5. Testing (property-based, snapshot/golden, statistical/Monte Carlo, fuzzing, mutation, benchmarks)

### Takeaway
Every language has mature tools:
- **Property-based testing:** proptest, fast-check, FsCheck/CsCheck, Hypothesis.
- **Snapshot/golden:** insta, Vitest, Verify.
- **Mutation:** cargo-mutants, Stryker.
- **Benchmarks:** criterion/divan, tinybench/mitata, BenchmarkDotNet.

Determinism turns golden-replay tests ("seed X → identical event log") into the backbone, as Factorio's save/reload-CRC tests show. Balance needs statistical tests over many seeds rather than exact assertions.

### Cited Findings
- **Rust:**
  - `proptest` 1.12.0 (2026-10-10), `insta` 1.49.0 (2026-10-03), `cargo-mutants` 27.1.0 (2026-06).
  - Benchmarks: `criterion` 0.8.2 (2026-02, repo moved to the criterion-rs org) and `divan` 0.1.21 (2025-04, possibly slowing).
  - Source: [crates.io](https://crates.io/crates/proptest).
- **TypeScript:**
  - `fast-check` 4.10.3 (2026-11-18), `vitest` 5.1.1 (2026-11-18, with built-in snapshot and file snapshots), `@stryker-mutator/core` 10.1.1 (2026-10-23).
  - Benchmarks: `tinybench` 6.2.4 (2026-11-18); `mitata` 1.0.34 dates from 2025-02.
  - Source: npm registry.
- **.NET:**
  - FsCheck 3.6.0 (2026-10-21), CsCheck 5.0.1 (2026-11-03).
  - Verify.Xunit (NuGet upper 31.12.5), BenchmarkDotNet 0.16.0-preview.2 (2026-09).
  - The Stryker.NET NuGet id was not resolved.
  - Source: [NuGet](https://www.nuget.org/packages/FsCheck).
- **Python:** Hypothesis 6.170.15 (2026-11-06) — [PyPI](https://pypi.org/project/hypothesis/).
- **Factorio's determinism testing:**
  - The heavy-mode save/reload-every-tick CRC comparison was run automatically on test servers.
  - Replays with per-tick checksums were used to find desyncs.
  - Replays break when mods or the game version change.
  - Sources: [FFF #270](https://cf-www.factorio.com/blog/post/fff-270), [FFF #47](https://cf-www.factorio.com/blog/post/fff-47), [forum](https://forums.factorio.com/viewtopic.php?p=487796).

### Inferences
- **Test layers that fit the IDEA §10 requirements:**
  1. **Pure unit tests on rules**, e.g. draft legality and fearless constraints.
  2. **Property tests.** Examples: "the draft always ends with 10 picks and no duplicates", "standings sum correctly", "projections rebuilt from events = incrementally maintained projections", "save → load → continue = continue without save" (Factorio-style).
  3. **Golden snapshots** of match timelines and season summaries for fixed seeds (insta, Vitest or Verify). These need deliberate re-blessing when sim_version changes.
  4. **Monte Carlo balance tests.** Simulate N thousand matches and series. Assert distributions within tolerance bands: favourite win rates, KDA ranges, champion pick and ban rates, comeback frequency.
  5. **DraftSim parity tests.** Compare distributions with DraftSim on the same inputs using KS or chi-square style tests. IDEA §10 says to use DraftSim as the reference.
  6. **Mutation testing** on the rules core.
  7. **Benchmarks** for "advance a season" time.
- **Avoiding flaky statistical tests.** Fixed seeds plus explicit, Bonferroni-style tolerances avoid flakiness.

### Gaps
- No 2025–2026 article was found on statistical balance testing specifically for sports or management sims.
- Fuzzing tools (cargo-fuzz, Jazzer.js, SharpFuzz) were not looked up. Fuzzing is mostly relevant for save, mod and content parsers.

---

## 6. Domain contracts/documentation (ADRs, typed schemas, cross-language codegen) and AI/rating libraries

### Takeaway
- **Contracts.** ADRs (Nygard or MADR format) plus schema-as-contract cover the "living documentation" requirement. Rust→TS codegen is active: ts-rs, specta (the 2.0 RC series is still running), typeshare (1Password). quicktype covers JSON Schema→many languages.
- **Ratings.** Rust's `skillratings` implements Elo, Glicko(-2), TrueSkill, Weng-Lin and more. JS and Python have openskill, glicko2 and others.
- **AI.** For draft AI and match simulation, utility scoring with explainable per-factor breakdowns maps directly to IDEA §7 (meta, role, synergy, counter, comfort, rival). MCTS is an optional extension. No sourced library data was gathered for it.

### Cited Findings
- **Codegen:**
  - `ts-rs` 12.0.1 (2026-01-31) — [crates.io](https://crates.io/crates/ts-rs).
  - `specta`: latest stable 1.0.5, but the 2.0.0-rc series is active (rc.28 on 2026-11-05) — [crates.io](https://crates.io/crates/specta).
  - `typeshare` 1.0.5 (2026-01-02, 1Password, Rust → TS/Swift/Kotlin/Go) — [crates.io](https://crates.io/crates/typeshare).
  - `schemars` 1.2.3 — see section 4.
  - `quicktype` 26.0.0 (2026-07-20), `json-schema-to-typescript` 16.0.0 (2026-08) — npm registry.
  - Protobuf (`prost`, `@bufbuild/protobuf`) gives schema-first multi-language contracts — section 3.
- **ADRs:**
  - Michael Nygard, "Documenting Architecture Decisions" (2011) — [cognitect.com](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions) (canonical, not re-fetched).
  - MADR template — [adr.github.io/madr](https://adr.github.io/madr/) (canonical, not re-fetched).
- **Rating libraries:**
  - `skillratings` 0.29.2 (2026-09-04, MIT or Apache-2.0) implements 13 algorithms: Elo, Glicko, Glicko-2, TrueSkill, Weng-Lin/OpenSkill, FIFA ranking, Sticko, Glicko-Boost, USCF, EGF, DWZ, Ingo and Yuksel. TrueSkill and Weng-Lin support team vs team and multi-team; the README makes no determinism claims — [GitHub](https://github.com/atomflunder/skillratings).
  - npm: `openskill` 5.0.1 (2026-06), `glicko2` 1.2.4 (2026-10-29); `elo-rank` 1.0.4 dates from 2020.
  - PyPI: `openskill` 6.2.0 (2026-01); `trueskill` 0.4.5 dates from 2018; `glicko2` 2.1.0 is from 2024-01.
  - Sources: registry APIs.
- **TrueSkill licensing.** TrueSkill is patented and trademarked by Microsoft (background knowledge, not re-verified this session). OpenSkill/Weng-Lin is the commonly cited unencumbered alternative. **Flag: verify before use.**

### Inferences
- **Draft AI.** Utility AI means a weighted sum of normalised considerations with recorded per-factor contributions. It matches the DraftSim "explainable scoring" and supports UI explanations ("picked X: +meta, +counter vs Y").
  - Personalities (meta, comfort, counterpick, pocket picks) become weight vectors.
  - Difficulty becomes noise and temperature, drawn from the seeded RNG stream.
  - MCTS or shallow lookahead over the remaining picks and bans could add depth, at the cost of explainability and CPU per draft.
- **Ratings.** A team or player rating system (Glicko-2 or Weng-Lin) can drive world rankings, seeding and match-sim priors. Ratings are a projection over `MatchPlayed` facts, so they can be recomputed.
- **Contracts.** If the core is Rust and the UI is TS (e.g. Tauri), ts-rs, specta or typeshare keep commands, events and DTOs in sync. If everything is TS, Zod or ArkType schemas can serve as both runtime validators and JSON Schema sources.

### Gaps
- No maintained, versioned utility-AI or MCTS library was looked up for Rust, TS or C#. Most game teams hand-roll these; unverified.
- The TrueSkill patent status as of 2026 was not verified.
- Whether specta 2.0 will reach stable before the project starts is unknown; it has been in RC since at least early 2026.
