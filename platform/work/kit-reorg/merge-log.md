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

---

## Phase 2 — Giant ADRs → first-class docs/architecture/decisions/ (SSOT)

**Home created:** `docs/architecture/decisions/ADR-NNN-<slug>.md` (repo root; the framework files `00-06-*.md` already there use a distinct non-ADR namespace, no collision). **18 ADRs created**, ~524KB of design-doc content moved OUT of native memory. Each ADR = frontmatter + Status/Context/Decision/≥2 Rejected-Alternatives/Consequences (authored top-matter) + the verbatim original record preserved under "Detailed Record(s)". No content lost — the doc is the new SSOT, memory keeps a ≤ 5-line pointer.

**Method:** header top-matter written per ADR; original bodies concatenated with YAML frontmatter stripped (awk: print after the 2nd `---`, later `---` section rules preserved). Consolidated families joined under `### A/B/C` sub-sections.

### Consolidation mapping (families → ADR-NNN)
| ADR | Slug | Source memory files | Status |
|---|---|---|---|
| ADR-001 | data-binding-architecture | adr_data_blending_decision + adr_data_reference_render_vision + adr_data_source_reference_spectrum | Accepted (partial) |
| ADR-002 | platform-and-constructor-vision | adr_config_and_render_vision + adr_constructor_vision_north_star | Proposed (vision) |
| ADR-003 | constructor | adr_constructor_phase2 + adr_constructor_g3_live_preview | Accepted (built) |
| ADR-004 | ingestion-pipeline | adr_ingestion_build_ready (0031) + adr_excel_ingestion (0030, → SECONDARY) | Proposed (build-ready) |
| ADR-005 | mode-as-perspective-axis | adr_mode_as_view_axis | Proposed (final) |
| ADR-006 | semantic-token-theming-spine | adr_semantic_token_theming_spine | Proposed |
| ADR-007 | sdmx-p1-frontier | adr_sdmx_p1_frontier | Proposed |
| ADR-008 | deployment-topology | adr_deployment_topology | Proposed |
| ADR-009 | element-config-schema-seam | adr_element_config_schema_seam | Proposed |
| ADR-010 | multistore-storeid-reintroduction | adr_multistore_storeid_reintroduction | Accepted (implemented) |
| ADR-011 | time-range-readiness-seam | adr_time_range_readiness_seam | Proposed |
| ADR-012 | platform-structure-rearchitecture | adr_platform_structure_rearchitecture | Proposed |
| ADR-013 | shell-variant-style-spine | adr_shell_variant_style_spine | Proposed |
| ADR-014 | no-privileged-element-capability-nav | adr_no_privileged_element_capability_nav | Proposed |
| ADR-015 | statistical-platform-north-star | adr_statistical_platform_north_star | Proposed (vision) |
| ADR-016 | content-constraint | project_content_constraint_adr (orig. ADR-0027) | Accepted (implemented) |
| ADR-017 | geostat-detenant-phase-c | project_detenant_phase_c_adr (orig. ADR-0028) | Proposed |
| ADR-018 | bootstrap-phase-b | project_bootstrap_phase_b (orig. ADR-0026 Phase B) | Designed |

**4 families consolidated** (ADR-001 from 3 files; ADR-002/003/004 from 2 each). 20 `adr_*` files → 15 ADRs; plus 3 in-scope `project_*_adr` design docs ≥8KB → ADR-016/017/018.

### Pointer files created (18, ≤5 lines, `type: project`, one per ADR)
project_data_binding_architecture · project_platform_constructor_vision · project_constructor · project_ingestion_pipeline · project_mode_as_perspective_axis · project_semantic_token_theming_spine · project_sdmx_p1_frontier · project_deployment_topology · project_element_config_schema_seam · project_multistore_storeid · project_time_range_readiness_seam · project_platform_structure_rearchitecture · project_shell_variant_style_spine · project_no_privileged_element_capability_nav · project_statistical_platform_north_star · (in place, rewritten) project_content_constraint_adr · project_detenant_phase_c_adr · project_bootstrap_phase_b.
- 20 `adr_*.md` source files deleted (content now in docs). Naming canon restored: no `adr_` prefix remains in memory (prefix ≡ frontmatter `type`; there is no `adr` type).
- `architect/MEMORY.md` rewritten: new "Architecture Decisions — migrated to docs/" section of slim pointer lines; all `adr_*` links replaced; size 27.6KB → 9.8KB (back under the 24.4KB index budget). Verified: zero dead links, zero unindexed files.

### project.json wiring — DONE
`paths.decisions_file`: `docs/architecture/decisions.md` (never existed as a file) → `docs/architecture/decisions/` (the ADR home dir).

### Acceptance (§4.6) — PASS
`find .claude/agent-memory/architect -name '*.md' -size +8k -not -name MEMORY.md` = empty. Every `docs/architecture/decisions/ADR-*.md` has ≥2 numbered Rejected Alternatives (verified 2–4 each).

### Owner call / follow-ups
- Aggressive-consolidation was applied per owner approval (ADR-001 merged 3, and the ingestion pair ADR-0030/0031 → ADR-004 with Excel demoted to SECONDARY). If 1:1 preservation is preferred for any family, split is trivial (sub-sections already delimited).
- **Backend/DB ADR family is now split by size:** its ≥8KB members migrated (ADR-016/017/018), but the <8KB siblings (`project_classifier_code_path_adr` = ADR-0023, `project_vintage_release_adr` = ADR-0025, `project_bootstrap_runner_adr` = ADR-0026 Phase A) remain as memory pointers. Owner may want these three migrated too so the whole ADR-0023..0031 series lives in docs/ as one coherent set (recommended, but out of this phase's ≥8KB scope).
- ADR internal numbering: original loose `ADR-00NN` IDs in the source content were reused/inconsistent (multiple 0026/0028); docs use a clean sequential `ADR-001..018`. Original numbers preserved in titles where meaningful (ADR-016/017/018).

---

## Phase 4+5 — rendered layer single-sourced + rotation + small ADR migration (architect)

> Branch `chore/claude-os-reorg`. All reversible except the strategy-file relocation (git-recoverable).

### Render mechanism (the SSOT `render()`)
New `.claude/kit/tools/render.py` is the single render function; the re-render step, `bootstrap.py` (scaffold), and `doctor.py` (drift guard) all call it — so `rendered == render(kit)` holds by one definition (DRY). Per-layer rules:
- **commands** → deterministic shim: frontmatter `description` DERIVED from the kit command's H1 title (SSOT, e.g. `# /mode — operating-mode switch` → `operating-mode switch`) + generic `argument-hint: [scope/target]` + fixed "read the canonical kit procedure" body.
- **agents** → verbatim byte-copy of `kit/agents/<name>.md`, EXCEPT `orchestrator` (the `<module>-specialist` allowlist token is substituted with the project's present `*-specialist.md`, sorted).
- **skills** → verbatim byte-copy of `kit/skills/<sk>/SKILL.md`.
- Project-local files with no kit source (`commands/dev.md`, `commands/laws.md`, `*-specialist.md`) are preserved — never written, never flagged.
`bootstrap.py` §3e refactored to call `render.render_command` (was a divergent generic shim generator) so a freshly-scaffolded command matches the drift guard.

### Re-rendered (17 drifted files fixed by `render.py --apply`)
All 15 command shims (stale/inconsistent hand-tuned bodies → deterministic shims with meaningful descriptions), `agents/orchestrator.md` (restored the missing **Disposition** paragraph + fixed a `Conway'''s Law` corruption + refreshed the specialist allowlist), and `skills/architecture-standards/SKILL.md` (restored the missing "Benchmark sources" bullet). Project-local `dev.md`/`laws.md`/3 specialists preserved.

### Strategy (root-cause correction to the design's "orphan" premise)
`.claude/strategy/` deleted, BUT audit's "pure cruft" premise was WRONG for its one file: `03-A-examples.md` is referenced as an on-demand load by `INDEX.md` (×2) + `kit/strategy/{01,03}` + `kit/feedback/...` (8 sites). Blind deletion would dangle those references. Root-cause fix: **relocated `03-A-examples.md` into the SSOT `kit/strategy/`** and repointed all 8 references `.claude/strategy/…` → `.claude/kit/strategy/…`. Net result satisfies the design end-state (`.claude/strategy/` absent; strategy loads on demand entirely from `kit/strategy/`) with zero dangling references. `bootstrap.py` strategy-scaffold line removed (canonical now committed in kit); `doctor.py` slot updated to the kit path.

### Drift guard added (`doctor.py`)
Replaced the weaker ad-hoc "agent mirror (tuned: true)" guard with a comprehensive check: `subprocess render.py --check` → `ck(rc==0, "rendered layer == render(kit) [agents/commands/skills]")`, plus `ck(not isdir(.claude/strategy), ".claude/strategy/ absent")`. Verified: both PASS. Also root-fixed 4 latent cp1252 `open()` bugs in `doctor.py` (`project.json`/orchestrator/`INDEX.md`/`VERSION` reads) that a faithful UTF-8 render surfaced — the manifest one had been silently reporting "manifest invalid" and SKIPPING every live enforcement check (false green).

### Rotation (Phase 5)
- `session/context.md` 86KB → **13.6KB** (hot "SEAMLESS HANDOFF" head, lines 1–64, ≤15KB); cold 06-27→07-01 log → `docs/layers/2026-07-01-context-cold-log.md` (71KB, tracked) + one-line pointer left in context.md.
- `session/token-log.md` 38KB → **0.2KB** (fresh period header + pointer); closed-session 07-01 detail → `.claude/session/archive/token-log-2026-07-01.md` (37.3KB, gitignored — verified `git check-ignore`).
- New `/rotate` kit command (canonical procedure) + rendered shim + INDEX row; size-threshold nudge added to `stop-check.py` (context.md >~15KB / token-log >~20KB → "run /rotate"). Hook-read paths untouched.
- SessionStart auto-load re-measured = **5.98KB** (≤6KB, unchanged — opus-brief not touched). `selftest.py` 8/8; `stop-check.py`/`session-start.py` run clean.

### Small ADR migration (owner-approved; original DB numbers kept)
Migrated the 3 remaining backend/DB design docs into `docs/architecture/decisions/` in the exact Phase-2 format (Status/Context/Decision/≥2 Rejected Alternatives/Consequences + verbatim record), leaving slim `type: project` pointers + updated MEMORY.md index lines:
- `ADR-0023-classifier-code-path.md` (classifier code-chain LTREE)
- `ADR-0025-vintage-release.md` (vintage-as-release / real-time DB)
- `ADR-0026-bootstrap-runner.md` (generic SDUI runner, Phase A)
Numbers preserved (0023/0025/0026), no existing ADR renumbered; ADR-018's back-reference updated ("<8KB memory pointer" → "now ADR-0026").

### Doctor status after Phase 4+5
Drift guard ✓, strategy-absent ✓, kit-strategy slot ✓, hooks selftest 8/8 ✓. 3 PRE-EXISTING failures remain, all outside this phase's fences (surfaced — not caused — by fixing doctor's manifest-read bug): (a) pre-edit-gate live probe uses a hardcoded path that doesn't match this repo's `ops/postgres/...` migration trigger (the enforcement-path side-finding the design deferred to a separate ticket); (b) repo-top stray dirs `.pytest_cache`/`DATA`/`scriness`; (c) bloat in fenced `agent-memory/explorer/*` + two pre-existing kit strategy docs. FLAGGED for follow-up.

---

## Phase 6+8 — Closing quality gate (chief-engineer)

> Branch `chore/claude-os-reorg`. All deletes owner-approved + recoverable via tag `pre-reorg-snapshot`. Deletes are in the working tree (unstaged) → captured by the single Phase-6 commit.

### Step 1 — loose ends resolved BEFORE deleting
- **3 quarantined explorer files verified for unique live-kit detail, folded into canonical set:** confirmed `lib/deploy_paths.py` (`resolve_module_deploy_path` signature + structured runtime/config/storage layout), `lib/config_gen.py` (Spring `application.yml` gen, Java-only, modes `simple|postgres-profiles|env-profiles`), and `tests/test_toolkit_hardcodes.py` (the no-brand fitness function) are REAL files in the live `kits/geostat-kit` and were ABSENT from `01`–`07`. Folded: deploy_paths + config_gen → `reference_07-geostat-kit-lib.md`; hardcode-test fitness function → `reference_01-geostat-kit-overview.md`. (compose_identity/module_by_role/ProjectContext.field were already covered.) Quarantine now safe → deleted.
- **2 no-frontmatter files fixed:** `engine-specialist/project_transform_split.md` had a UTF-8 BOM before `---` (parsed as no-frontmatter) → BOM stripped; frontmatter (`type: project`, prefix-matched) now recognized. `senior-backend-developer/MIGRATION_PROGRESS.md` → renamed `project_migration_progress.md` with `type: project` frontmatter; its dead ADR back-link (`architect/adr_platform_structure_rearchitecture.md`, moved to docs in Phase 2) repointed to `docs/architecture/decisions/ADR-012-*`; MEMORY.md index line rewritten to the new name. Zero dead links / zero naming mismatches repo-wide after.

### Step 2 — deletes (owner-approved, recoverable)
- **6a** `platform/.claude/` deleted entirely (held only `agent-memory/`, fully merged into ROOT in Phase 1). 135 files removed from disk.
- **6b** `platform/work/kit-reorg/dropped/` deleted (9 quarantined files, unique detail folded in Step 1).
- **6c** empty `agent-memory/junior-executor/` removed. **`agent-memory/project-manager/` NOT removed — it is NOT empty** (holds 4 files merged from platform in Phase 1; the Step-2 instruction to delete it was stale). Kept.
- `explorer/reference_reading-session-2026-06-13.md` **deleted** (+ index line): pure dated snapshot of docs that still exist (`docs/architecture/*`, roadmap), pre-rename `@geostat`, "Phase 1 complete as of 2026-06-02" — the exact `reading-session-*` DROP archetype; zero unique durable value.

### Step 3 — project.json enforcement-path correction (engine → packages)
Verified real tree: `platform/engine/**` does NOT exist; code is `platform/packages/{contracts,expr,core,charts,react,plugins,styles}` + `platform/apps/{api,geostat,panel}` (CLAUDE.md law 3). Corrected every stale path so hooks match the real tree:
- `modules`: 5×`platform/engine/*` → `platform/packages/*`, and **added** the two real law-3 packages missing from coverage (`packages/contracts`, `packages/charts`).
- `shared_lib_root`: `platform/engine` → `platform/packages`.
- `law_patterns` globs+regexes (Arch-engine-no-react, Arch-react-agnostic, Arch-engine-react-locale-agnostic): `platform/engine/*` → `platform/packages/*`.
- `class_m_triggers`: core-data + public-API matches `platform/engine/(core|react)/...` → `platform/packages/(core|react)/...`.
- `module_law_docs`: `platform/engine/CLAUDE.md`/`plugins/CLAUDE.md` → `platform/packages/...` (both verified present).
Validates as UTF-8 JSON. (`resume_marker` migration glob was already correct — untouched.)

### Step 4 — acceptance scorecard + surfaced doctor failures
Two latent **cp1252 stdout crashes** found + root-fixed (same class as Phase-4's cp1252 `open()` fix, but on `print`): `session-start.py` printed `→` (U+2192, absent from cp1252) and crashed MID-injection — truncating the auto-load AND skipping the stale-check (this was the real cause of the selftest "STALE" fail, not a path/regex mismatch); `doctor.py` printed `✓/✗` and crashed on its first check line. Both fixed with a guarded `sys.stdout.reconfigure(encoding="utf-8")`. The other 4 hooks only emit cp1252-safe glyphs (§, —) → not crashing; FLAGGED for uniform hardening.
- **doctor finding (a) — pre-edit-gate live probe — FIXED (in-scope, safe):** doctor hardcoded a generic probe `apps/_probe/db/migration/...` that never matched this repo's `ops/postgres/migrations/` trigger (false-fail). Now derives the probe from the manifest's own `resume_marker.repo_glob` → true positive; enforcement really fires. doctor 70→71/73.
- **doctor findings (b) repo-top `.pytest_cache`/`DATA`/`scriness`, (c) bloat (2 explorer inventories + 2 canonical kit-strategy docs): FLAGGED only** — (b) hard-fenced (DATA/scriness are do-not-touch; `.pytest_cache` → recommend gitignore); (c) trimming canonical doctrine / union-merged inventories is out-of-scope + content-loss risk.

**Scorecard:** 1 Single-home **PASS** (platform/.claude gone; `check-ignore` empty = tracked). 2 Zero-wrong-place **PASS** (4 `geostat-kit` matches = the KEPT canonical numbered set 01/02/03/07 describing the live this-repo kit; `=0` literal was written for the retired unnumbered naming). 3 Auto-load **PASS** (5.98 KB ≤ 6 KB, rc 0, no stderr). 4 selftest **PASS** (8/8). 5 Drift guard **PASS** (`rendered == render(kit)` ✓, `.claude/strategy/` absent ✓). 6 No mem ≥8 KB **PARTIAL/FLAG** (all ADR-scale content in docs/; `reference_07` trimmed back <8 KB; 3 dense files remain >8 KB: 2 pre-existing explorer inventories + `project_migration_progress` (9.2 KB, kept-as-memory per Step-1 mandate — recommend rotate or accept as a progress-log exception; MEMORY.md indexes excluded per Phase-2's own filter). 7 Naming law **PASS** (0 prefix≠type). 8 Rotation **PASS** (context.md 13.6 KB ≤15 KB; token-log 0.25 KB).

**Residual (not closed):** (i) content-coherence contradiction between `engine-specialist/project_restructure_paths.md:10` ("@statdash Phase-5 rename NOW LANDED, 2026-06-23") and `project_migration_progress.md` ("Phase 5 NOT done, deferred one-way door") — out of reorg scope, needs a source-of-truth check on package.json scopes. (ii) doctor 71/73 by design — the 2 remaining ✗ are fenced/out-of-scope (above). (iii) the platform/.claude deletion is unstaged in git (working-tree delete) pending the Phase-6 commit — filesystem single-home is real now.
