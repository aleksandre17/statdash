# Phase 1 Merge Log — agent-memory consolidation into ROOT `.claude/agent-memory/`

> Branch `chore/claude-os-reorg`, tag `pre-reorg-snapshot`. NO hard deletes — every DROP was **moved** to `platform/work/kit-reorg/dropped/<agent>/`. Fully git-recoverable.

## Method
- **Key structural finding:** across all 11 agents present in both homes, the ONLY same-name file is `MEMORY.md` itself. All content files are **disjoint** between ROOT and PLATFORM (different accumulated topics, not diverged twins). So Phase 1 is a **union merge**, not an overlay-with-conflict. Rule-1 "platform wins on same-name conflict" therefore only ever applied to `MEMORY.md`, which was instead **reconciled** into a merged index (Rule 4), never blindly overwritten.
- Per agent: copied every platform content file into root (no collisions), kept root-unique files, then rebuilt each `MEMORY.md` so the index lists exactly the surviving files. Verified: 14/14 agents have **zero dead links, zero unindexed files**.

## Per-agent result (final ROOT content-file count | platform-overlaid | root-unique kept | dropped)

| Agent | Final | Overlaid ← platform | Root-unique kept | Dropped |
|---|---|---|---|---|
| architect | 50 | 23 | 27 | 0 |
| chief-engineer | 16 | 7 | 9 | 0 |
| database-architect | 21 | 8 | 13 | 0 |
| debugger | 18 | 12 | 6 | 0 |
| engine-specialist | 54 | 8 | 46 | 0 |
| explorer | 24 | 15 | 9 (geostat set) | 9 |
| migration | 1 | 0 (root-only agent) | 1 | 0 |
| orchestrator | 23 | 2 | 21 | 0 |
| platform-architect | 5 | 0 (root-only agent) | 5 | 0 |
| plugins-specialist | 22 | 14 | 8 | 0 |
| project-manager | 3 | 3 (root was empty) | 0 | 0 |
| react-specialist | 20 | 2 | 18 | 0 |
| senior-backend-developer | 37 | 17 | 20 | 0 |
| senior-frontend-developer | 51 | 12 | 39 | 0 |
| junior-executor | 0 | 0 | 0 (empty both homes) | 0 |
| **TOTAL** | **345** | — | — | **9** |

Notes:
- `project-manager`: root dir was empty; copied platform's 4 files (incl. its `MEMORY.md` as the base index) verbatim — index already matched.
- `migration`, `platform-architect`: root-only agents with no platform twin; content describes live architecture (`repo-is-git`, style-system/grid/responsive/time-mode decisions) → kept untouched.
- Index reconciliation appended each platform index body under `[platform]`-labeled section headers to disambiguate from root's own sections while preserving both sets of rich descriptions.

## Un-indexed-in-source files rescued (Rule 4)
Some copied files were never listed even in platform's own `MEMORY.md` (pre-existing index gaps). Added entries for them:
- explorer: `config_shapes_discovered.md`, `engine_core_dataspec_capabilities.md`
- orchestrator: `project_types_ts_ceiling.md`
- plugins-specialist: `project_fieldconfig_shape.md`, `project_plugin_structure.md`, `project_plugin_tests.md`
- senior-frontend-developer: `project_panel_live_canvas.md`, `project_theming_seam.md`, `feedback_engine_react_no_registerslice_in_tests.md`

## geostat-kit dedup (Rule 3, KEEP + DEDUPE — NOT deleted)
- **KEPT (canonical numbered set + this-repo doc):** `01`–`07` numbered files, `national-accounts-workspace-structure.md`.
- **DROPPED (moved to `dropped/explorer/`) — 9 non-canonical copies:** `geostat-kit-system.md` (18KB mega-map), `geostat-kit-complete-systems-map.md` (41KB mega-map), and the unnumbered twins `geostat-kit-manifest.md`, `geostat-kit-drivers.md`, `geostat-kit-compose.md`, `geostat-kit-lib.md`, `geostat-kit-ops-pattern.md`, `geostat-kit-build-model.md`, `geostat-kit-dispatch-architecture.md`.
- **Path refs fixed:** `01-geostat-kit-overview.md` Location/Consumer lines `CursorProjects\geostat-chat-ai\…` → `kits/geostat-kit/` (this repo) + `national-accounts`. The stale project ref in the old geostat `MEMORY.md` was removed by the full index rewrite.
- Rebuilt explorer `MEMORY.md` as a two-family union index (A: geostat-kit; B: statdash data/capability inventory; C: this-repo workspace).

## Flagged for owner
1. **build-model / dispatch-architecture / ops-pattern (dropped):** unlike manifest/drivers/compose/lib, these are not clean 1:1 twins of a numbered file — they may carry unique detail not fully captured in `01`–`07`. They are safe in `dropped/explorer/`; owner may fold any unique content into the numbered set before Phase 6 deletion.
2. **`explorer/reading-session-2026-06-13.md` (KEPT):** a dated, pre-rename (`@geostat`) snapshot of roadmap/architecture reading — clearly stale but not a duplicate of any platform file. Kept per "KEEP-if-ambiguous" + phase boundary (dated one-offs are a Phase 6b concern), and FLAGGED in the index. Owner call whether to drop in Phase 6.
3. **Illustrative service-name examples in `04`/`07`** (`chat-api → geostat-chat-ai-api`, etc.): these are example OUTPUTS of the compose-naming algorithm applied to the other project's manifest, not path refs. Left as-is (fixing would require inventing this repo's manifest modules — out of Phase 1 scope). Flagged.
4. **Coexisting complementary pairs (NOT dropped):** the union places related-but-distinct entries from both eras under one agent (e.g. architect's `adr_platform_structure_rearchitecture` alongside platform's `project_detenant_phase_c_adr`; engine-specialist's perspective-axis `P0` (platform) + `P1`–`P7` (root) forming one coherent sequence; debugger's `choropleth_theme_frozen_memo` (platform) + `choropleth_flat_and_donut_monochrome` (root)). None are stale duplicates; kept per economy. Owner may consolidate overlapping ADR families in **Phase 2** (ADR extraction), which is explicitly out of Phase 1 scope.

## Verification
- 14/14 agents: `MEMORY.md` index ↔ directory match, 0 dead `](*.md)` links, 0 unindexed content files.
- Every platform content file confirmed present in root (union complete).
- Nothing deleted; 9 files relocated to `dropped/explorer/`.
