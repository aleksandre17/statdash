# `.claude` Operating-System Audit — read-only recon

Explorer recon, 2026-07-01. READ-ONLY: nothing changed. Evidence = hooks, git, filesystem mtimes/sizes.
Scope: what auto-loads, the two memory homes, duplication, bloat, current taxonomy.

---

## 1. What loads every session (the auto-load truth)

**Finding: the SessionStart auto-load is LEAN (~5–6 KB text). The 86 KB `context.md` and 38 KB `token-log.md` are NOT hook-injected.** I read all 6 hooks; none inject those files into context.

Auto-load path = `.claude/settings.json` → `SessionStart` → `.claude/kit/hooks/session-start.py`. Exactly what it prints into context:

| Injected string | Source | Size |
|---|---|---|
| `§Current State` slice of opus-brief | `.claude/context/opus-brief.md` (lines between `## Current State` and `## Last Session`) | 47 lines / ~3.6 KB (whole file is only 52 lines) |
| OPERATING MODE line | `.claude/session/mode` (1 word) + hardcoded posture table in hook | ~1 line |
| OPERATING CONTRACT block | **hardcoded in `session-start.py`** (lines 28–34) | ~7 lines |
| THINKING DISPOSITION block | **hardcoded in `session-start.py`** (lines 35–43) | ~9 lines |
| STALE-RESUME warning (conditional) | compares `resume_marker` in `project.json` vs repo glob | 0–2 lines |

Other hooks and what they inject:
- `pre-edit-gate.py` (PreToolUse Write|Edit): injects a one-line Class-M reminder **only when** a path matches `class_m_triggers` in `project.json`. Cheap.
- `post-edit-laws.py` (PostToolUse): law enforcement, exit 2 on violation. (Not read in full; not an auto-loader.)
- `stop-check.py` (Stop): **reads** `token-log.md` and `opus-brief.md` to emit stderr warnings — does **not** inject them into model context. WARN_ONLY=True.
- `session-end-tokenlog.py` (SessionEnd): appends one rollup line to `token-log.md`. No injection.

**Verdict on the two big files:** `context.md` (86 KB) and `token-log.md` (38 KB) are **not auto-injected**. `context.md` is referenced only in `.claude/kit/strategy/*` protocol docs (load-on-demand), never in a hook or in `CLAUDE.md`. **BUT** the context-protocol (`05-context-protocol.md`, `03-opus-mandate.md`) frames it as the durable session handoff, so the workflow likely has the lead **read it manually every session** → that is the real ~86 KB effective sink, not a hook. Same pattern makes `token-log.md` a manual pull. Fix = rotation, not de-hooking.

Biggest single auto-load payload today: the opus-brief `§Current State` (47 lines), which `stop-check.py` itself caps at 80 lines before nagging to rotate. Auto-load is healthy; the disorder is downstream (sections 2–4).

---

## 2. The two memory homes — which is canonical?

| | ROOT `.claude/agent-memory/` | PLATFORM `platform/.claude/agent-memory/` |
|---|---|---|
| Files | 244 | 135 |
| Git tracked? | **No — gitignored** (`.claude/.gitignore:7 agent-memory/`, comment: "Per-agent native memory (machine-local)") | **Yes — 121 files tracked** |
| Git history | none (ignored) | active; last mem commit `301eedf` 2026-06-27, plus c59a778/855a8c6/69cdef8 |
| Newest mtime | 2026-07-01 (senior-frontend-developer/*) | 2026-07-01 (this session's live edits, per git status) |
| Has kit/hooks/settings? | Yes — this is the full kit install (`kit/`, `settings.json`, `context/`, `session/`) | No — **agent-memory only**, no kit |
| Content vintage | **pre-rename** (`@geostat`, geostat-kit) | **current** (`@statdash`, contracts layer, current epics) |

**Content divergence (same agent, both homes):**
- **explorer** — ROOT = 19 files, all `geostat-kit-*`, MEMORY.md references `C:/Users/Test-User/CursorProjects/geostat-chat-ai/` → **stale, from a DIFFERENT project**. PLATFORM = 16 files, `config_*`/`engine_*`/`datastore_*` for THIS statdash codebase. **Total divergence, zero overlap.**
- **architect** — ROOT index = `@geostat`, perspective-axis, data-blending ADRs. PLATFORM index = authoring-schema SSOT, API-demo-parity, ingestion, de-tenant ADRs. Different eras; **diverged, not synced.**

**RECOMMENDATION — PLATFORM is canonical.** Evidence: (1) it is version-controlled and shared with the team (the memory doctrine's own requirement); (2) this session's live edits landed there; (3) it sits next to the code (`platform/`); (4) its content matches the current `@statdash`/contracts reality; (5) ROOT is explicitly gitignored "machine-local".

**Stale-vs-keep split of ROOT (244 files):**
- **Stale-duplicate / wrong-project:** explorer geostat-kit set (19 files incl. 41 KB + 18 KB maps) — belongs to `geostat-chat-ai`, safe to drop from this repo.
- **Unique-worth-keeping (migrate to platform):** ROOT architect holds ~28 files incl. large ADRs (`adr_mode_as_view_axis`, `adr_constructor_*`, `adr_data_*`) that have **no platform twin** and describe live/near-live architecture. These are the real loss risk if ROOT is deleted blindly — **triage architect + engine-specialist (47 files) + senior-frontend (40) before any cleanup.**

**Caveat / disorder root-cause:** the native memory tool is pointed at ROOT (my own explorer prompt names `.claude/agent-memory/explorer/`), so the tool keeps writing to the *gitignored* home while the *committed* home is `platform/`. That split is why they diverge. The reorg must repoint the native memory home to the canonical (platform) location — otherwise divergence resumes.

---

## 3. Duplication & redundancy map

**Rendered layer vs `.claude/kit/` source:**
| Layer | Kit | Rendered | State |
|---|---|---|---|
| agents | 10 (+`module-specialist.md.template`) | 10 | **In sync** (architect/chief-engineer/database-architect byte-identical); rendered `engine-specialist.md`+`plugins-specialist.md` = template instantiated |
| commands | 15 | 17 | **DRIFTED — rendered is STALE.** All 15 differ; e.g. `mode.md` kit=19 rich lines, rendered=5 old lines. Rendered wasn't re-rendered after kit updates. Extra rendered: `dev.md`, `laws.md` (project-local) |
| skills | 1 | 1 | in sync |
| strategy | 9 (`01,02,03,05,06,07,08,09,11`) | **1** | rendered has ONLY `03-A-examples.md` — an **orphan**: no `03-A` in kit; the other 8 strategy docs are unrendered. Dead/partial layer |

**explorer geostat-kit overlap (ROOT, all stale — recommend delete-as-set, or merge if kept for reference):**
| Topic | Numbered (split v1.0) | Unnumbered twin | Mega-doc |
|---|---|---|---|
| overview/system | `01-geostat-kit-overview` | `geostat-kit-system.md` (18 KB) | `geostat-kit-complete-systems-map.md` (**41 KB**) |
| manifest | `02-geostat-kit-manifest` | `geostat-kit-manifest.md` | ↑ |
| drivers | `03-geostat-kit-drivers` | `geostat-kit-drivers.md` | ↑ |
| compose | `04-geostat-compose-generation` | `geostat-kit-compose.md` | ↑ |
| lib | `07-geostat-kit-lib` | `geostat-kit-lib.md` | ↑ |
Three generations of the same content (numbered split + unnumbered twins + two mega-maps). **Merge target if retained: the `01–07` numbered set is the intended canonical (its MEMORY.md calls the unnumbered ones "legacy"); the 41 KB + 18 KB maps are the biggest redundant payloads.** Cleanest: drop the whole set (wrong project).

---

## 4. Bloat & staleness — 15 largest memory/session files

| Size | File | Verdict |
|---|---|---|
| 86 KB | `.claude/session/context.md` | **Rotate** — session handoff, manually re-read each session (§1). Split oldest layers to `docs/layers/` |
| 41 KB | ROOT `explorer/geostat-kit-complete-systems-map.md` | **Stale (wrong project)** — delete or archive with geostat-kit set |
| 40 KB | PLATFORM `architect/adr_ingestion_build_ready.md` | Load-bearing (tracked, current) but **oversized** — an ADR/design doc living as "memory"; consider `docs/adr/` |
| 38 KB | `.claude/session/token-log.md` | **Rotate** — append-only ledger; SessionEnd keeps growing it. Truncate/archive per period |
| 37 KB | ROOT `architect/adr_constructor_vision_north_star.md` | Likely load-bearing but **gitignored + huge** — migrate to platform, slim to memory |
| 36 KB | ROOT `architect/adr_data_source_reference_spectrum.md` | Merge-candidate — one of 4 overlapping `adr_data_*` (see below) |
| 34 KB | ROOT `architect/adr_data_reference_render_vision.md` | Merge-candidate (data-reference family) |
| 33 KB | ROOT `architect/adr_data_blending_decision.md` | Possibly **superseded** — root index says data-binding "SHIPPED 2026-06-26"; verify then archive |
| 31 KB | PLATFORM `architect/adr_excel_ingestion.md` | Load-bearing (tracked); large — ADR belongs in `docs/adr/` |
| 30 KB | ROOT `architect/adr_config_and_render_vision.md` | Merge-candidate (vision family overlaps north-star) |
| 30 KB | ROOT `architect/adr_mode_as_view_axis.md` | **Load-bearing** — active perspective epic (matches platform P0 commit) — migrate, keep |
| 24 KB | ROOT `architect/adr_constructor_phase2.md` | Load-bearing-ish; overlaps north-star vision — consolidate |
| 24 KB | ROOT `architect/adr_semantic_token_theming_spine.md` | Verify vs recent theme commits; likely current |
| 23 KB | ROOT `architect/adr_multistore_storeid_reintroduction.md` | Root index says storeId "SHIPPED" → likely **archive as decided** |
| 21 KB | ROOT `architect/adr_sdmx_p1_frontier.md` | Forward-looking; keep, migrate |

Cross-cutting: **the giant 20–40 KB ADRs are full design docs stored as agent-memory, mostly in the gitignored ROOT home** — worst-of-both (huge + unshared). They are also a clustered family (`adr_data_*`, `adr_*_vision`, `adr_constructor_*`) with heavy conceptual overlap → consolidation + move to a tracked `docs/adr/` is the highest-value bloat fix.

**Empty / orphan dirs:**
- `.claude/worktrees/` — empty
- `.claude/agent-memory/junior-executor/` — empty (both homes)
- `.claude/agent-memory/project-manager/` — empty (ROOT); platform has 4 files
- ROOT `explorer/reading-session-2026-06-13.md`, `national-accounts-workspace-structure.md` — dated one-offs, likely stale

---

## 5. Current taxonomy (for the architect's redesign)

```
.claude/                         (ROOT install — kit + machine-local memory)
├── settings.json                # hooks wiring + permissions + agent:orchestrator
├── project.json                 # domain manifest read by all generic hooks (zero literals in kit)
├── README/HISTORY/GETTING-STARTED.md
├── kit/                         # DOCTRINE SOURCE (portable, project-agnostic)
│   ├── hooks/*.py               # session-start / pre-edit-gate / post-edit-laws / stop-check / session-end / _manifest / selftest
│   ├── agents/  commands/  skills/  strategy/  feedback/  templates/  tools/
│   ├── INDEX.md  B.md  VERSION  project.schema.json  settings.template.json
├── agents/  commands/  skills/  strategy/   # RENDERED layer (kit instantiated) — commands stale, strategy near-empty (orphan 03-A)
├── context/opus-brief.md        # durable resume; §Current State is the ONLY hook-injected memory
├── session/                     # context.md (86 KB), token-log.md (38 KB), mode  — machine-local, gitignored area
├── agent-memory/  (244, GITIGNORED)   # native per-agent memory — MACHINE-LOCAL, pre-rename, partly wrong-project
└── worktrees/  (empty)

platform/                        # THE CODE (packages/, apps/, work/)
└── .claude/agent-memory/  (135, TRACKED)   # CANONICAL shared team memory — current @statdash content
```

Top-level purpose, one line each:
- `kit/` = portable doctrine + enforcement engine (the product being reorganized)
- rendered `agents|commands|skills|strategy/` = per-project instantiation of kit (currently drifted)
- `context/` + `session/` = resume state + running ledgers (machine-local)
- ROOT `agent-memory/` = native per-agent memory, gitignored, stale
- `platform/.claude/agent-memory/` = tracked, canonical project memory

**Memory conventions actually in use (both homes):**
- Frontmatter `type:` values: `project` (255), `reference` (64), `feedback` (33). (The `type:'query'/'transform'` hits are DataSpec code snippets inside explorer memories, not memory frontmatter.) **No `user`, `adr`, or `reference`-vs-`ref` inconsistency in frontmatter.**
- Filename prefixes: `project_` (186), `feedback_` (32), `reference_` (30), `adr_` (20), plus explorer inventory prefixes `config_`/`engine_`/`page_`/`data_`.
- Note mismatch: `adr_*` is a **filename** convention but ADRs carry frontmatter `type: project` (no `adr` type). Redesign should decide: is ADR a memory type or a `docs/adr/` artifact? (Recommend the latter given their 20–40 KB size.)

---

## Top 5 disorder problems, ranked by token-waste impact

1. **Two divergent memory homes** — 244 gitignored ROOT (stale, wrong-project, pre-rename) vs 135 tracked PLATFORM (current). The native tool writes to the ignored one; agents can load stale/duplicate context. **Pick platform, repoint the native home, triage-migrate ROOT's unique architect/engine files, drop the rest.**
2. **Giant ADRs stored as memory (20–40 KB × ~12), mostly in gitignored ROOT** — huge, unshared, and a clustered overlapping family. Move to tracked `docs/adr/`, consolidate the `adr_data_*`/`adr_*_vision` overlaps, leave slim pointers in memory.
3. **`context.md` (86 KB) + `token-log.md` (38 KB) never rotated** — not hook-injected but manually re-read every session per the context-protocol → effective 120 KB recurring pull. Rotate on a cadence (oldest layers → `docs/layers/`, ledger → periodic archive).
4. **Stale geostat-kit explorer set (19 files, incl. 41 KB + 18 KB maps) from another project** — three redundant generations of the same content. Delete-as-set (or keep only the `01–07` numbered canonical).
5. **Rendered layer drifted from kit** — `commands/` all 15 stale vs kit (e.g. `mode.md` 5 vs 19 lines), `strategy/` has only the orphan `03-A-examples.md` while 8 kit strategy docs are unrendered. Re-render or delete the rendered layer so there is one source of truth.
