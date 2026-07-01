---
name: reading-session-2026-06-13
description: Full read of IMPLEMENTATION-ROADMAP, ARCHITECTURE-TARGET, and future architecture docs. Axis terminology search results.
metadata:
  type: reference
  date: 2026-06-13
---

## Files Read

### Task 1 — IMPLEMENTATION-ROADMAP.md (complete, all 1124 lines)
- Full roadmap from Phase 0 (Integrity) through Phase 10 (Tier 3 North Star)
- Operating Rules, root causes, all 27 layers with Definition of Done
- Coverage table mapping all 34 gaps to layers
- Sequencing and start-here guidance

### Task 2 — ARCHITECTURE-TARGET.md (complete, all 687 lines)
- Design Principles (7 axes driving operations)
- Detailed layer-by-layer target state (Layers 0–7)
- Tier-1 structural moves (N1–N9)
- What is deliberately kept (do not "improve")
- Tier 2 standard-setting moves (N10–N25)
- Tier 3 north-star moves (N26–N31)
- Tier-3 anti-recommendations
- Conformance to generic protocols (N32–N33)

### Task 3 — Future Architecture Directory (8 files)

#### 01-database/overview.md
- SDMX-based database architecture
- Kimball hybrid schema
- Physical columns: time_period, geo_code, obs_value, obs_status, dataset_code
- JSONB for extra_dims with GIN index
- TODO: ER diagram, DSD storage, Catalog API

#### 02-backend-java/overview.md
- REST API + SDMX data serving
- Endpoints: /api/site-manifest, /api/catalog, /api/sdmx/{id}, POST /api/pages
- fromSDMX() boundary — only SDMX adapter
- Phase 2: isCarryForward computed server-side, CODE_MAP canonical
- TODO: Spring Boot vs Quarkus, SDMX-JSON parsing, auth, Constructor API full spec

#### 03-constructor/overview.md
- Admin UI for page creation without code
- Confirmed: schemaCompiler (Option B) — Constructor depends on ConstructorSchema only
- ParamDef as augmentable ParamDefMap (like NodeTypeMap)
- Per-key filter hooks (useFilter<T>(key))
- FilterCodec includes normalize()
- Completed: ConstructorSchema + ConstructorFieldDef, ParamDefMap patterns, FilterControlRegistry rewrite
- editor? slot (Phase 2) for custom config panels
- TODO: Constructor UI framework, page builder UX, schemaCompiler.compile() impl, live preview

#### 04-dep-graph/dep-graph-impl.md
- Filter dependency graph implementation (Phase 1 minimal)
- dependsOn? field on ParamMeta for cascade blocking
- Per-renderer blocking (Phase 1) → centralized graph (Phase 2)
- Uses existing Effects system for parent-change reset
- Kahn's algorithm + cycle detection in buildDependencyGraph()
- TODO: Phase 2 centralization in useFilterState.ts

#### 05-async-options/async-options-impl.md
- Async select options loading (Phase 1)
- useAsyncOptions hook for state-dependent dropdowns
- optionsQuery on ParamSelect (new field)
- ParamSelectRenderer integration with loading/error states
- Phase 2: async multi-level cascade (DynamicCascadeSelect, separate component)
- TODO: verify interpretSpec async contract before impl

#### 06-mode-system/phase2.md
- Mode system Phase 2: full isolation
- Removes FilterContext.state containing mode key
- SectionContext.timeMode removed
- interpretSpec(spec, ctx, store, mode?) — mode as own param
- VisibilityExpr unified: FilterCondition + ModeCondition + TreeOp
- evalVisibility split: evalFilterCondition + evalModeCondition + tree walker
- ModeProvider excludes mode key from FilterProvider
- Complete working examples + tests at bottom

#### 07-framework-gaps/overview.md
- Comparison: ჩვენი vs Grafana vs Retool
- Gap 1: Query-level caching (Phase 3, >50k rows)
- Gap 2: Format-agnostic ObsQuery (Phase 3, non-SDMX plugins)
- Gap 3: Streaming/real-time (Phase 4+, not needed yet)
- Gap 4: Plugin sandboxing (Phase 4+)
- Verdict: production-ready for Phase 1/2, gaps emerge at scale/marketplace

### Task 4 — Axis/Axes Search Results (11 files found)

Files containing axis/axes references:
- `docs\architecture\examples\chart-def.md` — x-axis categories, axis mapping
- `docs\architecture\examples\data-spec.md` — rows/label → axis/legend, categories
- `docs\architecture\examples\encoding.md` — row.time → x-axis labels, row.value → bar height/y-axis
- `docs\architecture\examples\data-nodes.md` — ChartDef encoding (mark, encoding, axes, title)
- `docs\architecture\examples\vertical-slice.md` — D2 taxes on products reference
- `docs\architecture\examples\showcase.md` — encoding.x/y with axis format, axis title expressions
- `docs\architecture\subsystems\20-data-nodes.md` — chart encoding with axes
- `docs\architecture\subsystems\29-i18n-architecture.md` — unitShort as chart axis label
- `docs\architecture\types\all-types.md` — 4 axis references in ChartDef/EncodingSpec docs

**No file named "axis" found. All references are within documentation of data-encoding and chart rendering.**

**ღერძი (Georgian for "axis") — NOT FOUND in docs.**

---

## Key Observations

### Architecture Flow
1. **Phase 0–2**: Fix integrity, purity, coupling (27 layers, all gaps)
2. **Phase 3**: JSON-first datasources (Constructor readiness)
3. **Phase 4–6**: Type tightening, robustness, readability
4. **Phase 7–8**: Platform power, architecture moves (N1–N9)
5. **Tier 2 (Phase 9)**: Standard-setting spine (N10–N25) — self-describing components + provenance + accessibility
6. **Tier 3 (Phase 10)**: North star synthesis (N26–N31) — semantic layer + multi-target + reactive DAG

### Critical Decision Points
- **N1** (chart split): package-level ISP → headless deployment drops chart code
- **N2** (@geostat/constructor): one schema-export entry point
- **N3** (ChartRendererRegistry): one swappable render-lib seam
- **N10/N11** (Tier-2 spine): self-describing components + manifest export → Constructor real
- **N26** (Tier-3 highest): semantic layer — metrics defined once over DSD

### Future Phases Status
- **Phase 1 complete** (as of 2026-06-02 per ROADMAP)
- **Phase 3 readiness**: datasources first-class JSON in progress
- **Constructor Phase 2**: UI framework TBD, schema compilation pending
- **Mode system Phase 2**: architecture designed, not yet implemented
- **Async options & dep-graph**: design complete, implementation guides written

### Terminology: "Axis"
All axis references are in **data-encoding and chart contexts**:
- `encoding.x` → temporal/ordinal axis (categories)
- `encoding.y` → value axis (bar height, position)
- Chart `axes` = axis configuration in ChartDef rendering
- `FieldEncoding.axis` = axis formatting (e.g., date format 'd')

No architectural "axis" concept. Not a first-class abstraction, just chart rendering vocabulary.
