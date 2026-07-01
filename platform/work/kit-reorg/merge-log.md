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
