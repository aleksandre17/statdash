# CLOSE-BOARD — the complete distance to "done" + highest-level no-degradation audit

> READ-ONLY deep audit. No product code touched. Author: chief-engineer (Opus, oversight).
> Date: 2026-06-28 · Branch: `feat/tenant-agnostic-platform` · HEAD ≈ `ba24c79`.
> Method: green baseline measured (typecheck / lint / test / check-laws), then every open thread + every
> prior board/memory finding **re-verified against the live code** (file:line). The board (`work/MASTER-BOARD.md`,
> `work/board/*.md`) is **no longer on disk** — this supersedes it from source truth, not from the stale snapshot.

---

## 0. GREEN BASELINE (measured this pass — the solid ground)

| Gate | Result | Note |
|---|---|---|
| `pnpm typecheck` (tsc -b) | **EXIT 0** | clean |
| `pnpm lint` (eslint .) | **EXIT 0** | 0 errors, 43 `react-refresh/only-export-components` warnings (accepted, non-blocking) |
| `pnpm test` (vitest) | **EXIT 0** | **1981 passed · 0 failed · 74 skipped** (skips = `DATABASE_URL`-gated RLS/pg-audit fitness) |
| `check-laws.sh` | **EXIT 0** | all 13 law gates clean (Law 1/2/3/4/5 + System-A retirement + effects-subsystem retirement) |

**The prior `lint-RED` launch-blocker (finish-line recon, 2026-06-24) is RESOLVED.** This is a genuinely green tree.
The remaining distance to "done" is **unbuilt commitments + one design wave**, not defects in shipped code.

**Prior findings re-verified as RESOLVED (the bar did not drop — it rose):**
- First-tenant erosion → `GeostatEventMap` renamed to `PlatformEventMap`, `geostat-snapshot` class gone, **locked by `no-tenant-content.fitness.test.ts`**.
- `xlsx` dead type-promise → now a **real OOXML SpreadsheetML serializer**, registered (`core/src/data/export/index.ts:23`). Law 9 Excel-export satisfied.
- `georgraph` typo → survives **only** in the forward-migration shim (`core/src/config/migration.ts`), correct (Postel/expand-contract).
- ENG-10 `scope.metric` authored-but-inert → **wired at runtime** (`perspective-axis-parser.ts:210`), proven by `perspective-metric-swap.fitness.test.ts`.
- Semantic-layer "cathedral" → has a **live congregation**: `registerMetrics` wired at boot (`apps/geostat/src/data/site-manifest.ts:94`); calc-metric `accounts.laborShare` runs live (`geostat.provisioning.json:303`, DC-01).
- API operational/security floor → **built**: durable pg audit-log port (`lib/audit-log.ts`, V15), persisted snapshot-store (`lib/snapshot-store.ts`, V36), rate-limit, observability, redaction, OpenAPI doc.
- Dependency arrow → **clean**; `apps/api` references to `@statdash/react` are all comments explaining the deliberate non-import.

---

# PART 1 — COMPLETE REMAINING-WORK BOARD (the true distance to "done")

Ranked by priority × effort. Status verified against code this pass. Effort: S ≤1d · M 2–4d · L 1–2wk · XL >2wk.

### P0 — gating decisions & accessibility breakage

| ID | Thread | Status (verified) | Next concrete action | Effort |
|---|---|---|---|---|
| **MT-DECISION** | Multi-tenancy one-way fork | `ADR-multi-tenancy.md` = **PROPOSED**, unsigned. Data plane is **placeholder-only**: only `tenant_id` in 37 migrations is the V6 nullable seam on `stats.dataset` under `USING(true)` RLS (`V6:159`). No `stats.agency`, no agency_scheme, no other `tenant_id`, no `current_tenant` GUC. | **Owner sign-off on §0 of the ADR** (per-deploy-agnostic vs hosted-SaaS). This gates MT-1…MT-7, DB-08 agency SSOT, tenant-scoped RBAC, JWT `tid`, per-request theming, governance. Until signed, the branch name over-promises. | decision → **L** to build |
| **RSP-R1** | sr-only AT-table phantom h-scroll | **OPEN.** `ChartDataTable` renders the AT mirror as `<table class="sr-only">`; computed width 1327px leaks `scrollWidth` → draggable scroll into empty space on **every dashboard**, WCAG 1.4.10 Reflow + 1.4.4 **fail**. | Wrap the table in a `.sr-only` **div**; harden `.sr-only` `clip`→`clip-path: inset(50%)`; add the `scrollWidth ≤ clientWidth` Playwright fitness. (AUDIT-responsive R1/P0.) | **S**, highest-ROI |

### P1 — ratified architecture & visible layout breaks

| ID | Thread | Status (verified) | Next concrete action | Effort |
|---|---|---|---|---|
| **TM-STRANGLER** | Time-mode orthogonal-axis Strangler | **RATIFIED, UNBUILT.** `DESIGN-time-mode-decision.md` decides Option C. Code still has `timeBinding` (no `DimBinding`/`Selection`); the fused-mode literal **survives at `template.ts:74-75`** (`if 'year' in tpl && 'range' in tpl … === 'year'`). | Execute P0→P-final: add `DimBinding`+`Selection` discriminant, register `binding` scope-key, open `TimeGranularity`→registry string, retire the `template.ts` literal → `Record<perspectiveId,string>`, migrate live config, add `FF-NO-MODE-LITERAL`. | **M** |
| **RSP-R2** | AppHeader flex overflow @~1024 | **OPEN.** `app-header.css` flex `space-between` + `flex-shrink:0`, no `min-width:0` → actions pushed 72px off-edge, `ENG` clipped on every page in the 960–1100 band. | `min-width:0` on header flex children + tagline truncation at the existing 1024 breakpoint token. | **S** |
| **RSP-R3** | No shared content measure | **OPEN.** `page-layout.css` splits 800px-cap / uncapped / full-width; ultrawide over-stretch + stranded 800px ribbon; `--size-container-wide` defined but **unwired**. | Wire `--size-container-wide` into a shared `--page-measure` on `.page-content`; retire the cap split. | **S–M** |
| **RSP-F7** | gdp ultrawide empty-panel placeholder | **IN FLIGHT** (concurrent responsive lane). Giant solid-blue empty blocks ≥1440. `EmptyState.tsx`/`ChartPlaceholder.tsx` exist — graceful-degradation shell available to adopt. | Let the in-flight lane land; re-audit in a real browser post-deploy. Do **not** re-run the harness here. | (in flight) |

### P2 — duplication kill, grain completion, density

| ID | Thread | Status (verified) | Next concrete action | Effort |
|---|---|---|---|---|
| **RX-16** | Two map node types → one | **OPEN, DESIGN READY** (`DESIGN-map-consolidation.md`). `geograph` (live, real Leaflet) **and** `panels/map` (stub) both registered; `map` is **palette-visible** (`catalog.ts:38`, `meta.ts category:'data'`, no `hidden`) yet **always renders a placeholder table** — even with topology registered (`MapShell.tsx:76`, "Phase 2: implement SVG projection here"). `buildColorScale` paints nothing. **Law-6 duplication + a stub authored into the palette.** | Build M0–M4: fold choropleth + `topologyRegistry` + SVG-variant into the `geograph` slice, delete `panels/map`, add `FF-ONE-MAP-NODE`. | **M (3–4d)** |
| **GRAIN-G4** | `timeDimension.granularity` rolls up | **PARTIAL.** Port surface built (`valAt`, `point-series`, `grain.ts`, `StoreCaps.grains`, `GrainLevel`; timeseries/growth/ratio-list are desugar delegates — G0–G3 done). **But `time-dimension.ts:124` still: "granularity … does not affect resolution in this pass."** The field is decorative at the resolve seam despite the port supporting it. | Thread `timeDimension.granularity` → `point-series.grain['time']`; add `FF-GRANULARITY-ROLLS-UP`. | **S–M** |
| **GRAIN-G5/G6** | Cross-grain blend + rollup-router | **UNBUILT.** No `blend.from.grain` in `resolveNodeRows.ts`/`transform/types.ts`; no `GrainRouter`/pre-agg registry. | Build G5 (`blend.from.grain` cross-grain rollup in react) + G6 (`GrainRouter` below the port in `store-impl`/`api`, trivial router + `FF-ROLLUP-RAW-TWIN`). Gated on a real sub-annual dataset (none today — DESIGN §1). | **M**, data-gated |
| **RSP-R5** | Charts not container-fluid mid-widths | **PARTIAL.** y-axis raw-float (F6) fixed (`e64795a`, `02192da`). Remaining: SVG honor `width:100%` @768 (F11), bar-label density @768–1024 (F13). | Container-fluid chart shell + responsive label rotation/truncation. | **M** |
| **RSP-F5/F9** | FilterBar mobile + progressive disclosure | **OPEN.** `.filter-select` no `max-width` → hidden-scrollbar bar overflow (≤414); secondary sections all-expanded on mobile (`scrollH≈5568px`). | Constrain select width / use the existing `--strip` wrap variant; collapse secondary sections at small widths (the platform's own ONS law). | **S** |

### P3 — design-promotions, the crown, polish

| ID | Thread | Status (verified) | Next concrete action | Effort |
|---|---|---|---|---|
| **PERSP-LATTICE** | Perspective Lattice (crown, ARCH-INNOV-01) | **VISION ONLY.** N orthogonal axes → 2^N permalink views, rides the shipped `perspectiveState` seam. | **Build WITH a real second consumer** (a vintage/revision toggle — V31/V32 provenance exists) or it becomes adoption-debt itself. Spec the consumer first. | **L** |
| **GEOMODE-AXIS** | `_geoMode` → 1st-class axis | **OPEN (smell).** `_geoMode` is an **expr-derived page var** (`geostat.provisioning.json:4678`, `if region includes ',' → multi`) used as a perspective `param` (`:3686`,`:3830`). Works, but an underscore-private computed var driving an axis is the ad-hoc form of a declared axis. | Promote to a declared perspective axis (single-member/derived) once the lattice lands; until then it is functional, not a defect. | **S–M** |
| **EXP-01** | Dashboard actions / cross-filter / drill | **PARTIAL.** `useChartInteractions.ts` + event bus exist; full drill/cross-filter authoring not delivered. | Scope against the lattice + link types (`core/src/links/types.ts`). | **M** |
| **i18n-RENDER** | Render-side bilingual catch-up | **MOSTLY CLOSED.** check-laws Law-4 green for engine; the only `// i18n boundary` sites (`MultiSelectShell`, `SelectShell`, `DataTable`) are **correct content-resolution points**, not drift. | Targeted re-grep of node defaults/provisioning for single-locale literals before close; likely a thin polish pass, not the "6 bare cases" of the old snapshot. | **S** |
| **SDMX-completeness** | Ref-metadata / DQAF | Ref-metadata **built** (V31). Quality-indicator (DQAF) + SDMX-REST surface still absent — judge need per tenant. | Decide scope vs gold-plating. | M–L if pursued |

**Distance-to-done summary:** the *planned roadmap is essentially built and fitness-locked*. What remains is **one P0 decision (multi-tenancy)**, **one ratified-but-unbuilt refactor (time-mode Strangler, M)**, **one responsive fix wave (P0/P1, ~1 sprint)**, **one duplication kill (RX-16, M)**, **grain G4 completion + G5/G6 (data-gated)**, and **the lattice crown (L, needs a consumer)**. Roughly **2–3 focused sprints** of build + one owner decision to reach "everything closed."

---

# PART 2 — HIGHEST-LEVEL NO-DEGRADATION AUDIT (all apps)

Hunted agnostically for: arrow violations, boundary leaks, SOLID breaks, hardcodes/tenant-coupling, frozen-where-it-should-be-declarative, privileged-dim leaks (Law 1), partial-standard adoption (Law 4), closed-where-it-should-be-open (Law 8), cathedrals.

## Certified at the highest level (the solid ground)

- **Dependency arrow intact.** No `@statdash/react|charts|plugins` import in `core/charts/expr/contracts/src` or `apps/api/src`; eslint `no-restricted-imports` gate live; `apps/api` deliberately refines engine blobs at its own boundary rather than importing across the arrow.
- **Law 1 (no privileged dims) holds end-to-end.** check-laws green; the `second-tenant.fitness.test.tsx` (BrewMetrics — coffee retail, dims product/channel/quarter, locales en/de) **proves the runner renders a completely different tenant with zero code change**. Tenant/locale/perspective are all boundary scopes, never `ctx.dims[...]`. This is reference-grade neutrality.
- **Registry/OCP discipline is real.** Metrics, specs (`registerSpec`), nodes, panels, perspective scope-keys, export formats, topologies — every extension point is a registration, interpreter unchanged. The semantic layer, calc-metrics (DC-01), and `scope.metric` swap are all wired with live consumers.
- **Declarative-config integrity (Law 2).** No `getRows`/`val`/`fetch`/function-in-config leaks (check-laws + manual). Calc-metric algebra rides `@statdash/expr` (sandboxed), refined at the engine-owning layer — not tunneled.
- **Operational floor (api).** Durable audit (pg port + V15), persisted snapshots (V36), rate-limit, observability, redaction, OpenAPI, DC-02 accounting-identity publish gate (`ingest/validate-integrity.ts`). Fail-fast at the boundary.
- **Fitness-function culture.** Invariants are encoded as build gates (check-laws + ~250 test files), not comments. Evolutionary-architecture posture is genuine.

## Findings (file:line → why it degrades → canonical fix)

| Sev | App | Finding | Why it degrades | Canonical fix |
|---|---|---|---|---|
| **HIGH** | panel | **`panels/map` is a palette-visible stub** — `catalog.ts:38` registers it (`category:'data'`, no `hidden`); `MapShell.tsx:76` returns `<MapPlaceholder>` (a table) **even when topology is registered** (line 71-75 comment "Phase 2: implement SVG projection"). `buildColorScale` (`mapColorUtils.ts:72`) computes a colorMap that paints nothing. | A non-engineer can pick "map" from the Constructor palette and author a **non-functional node**. Two node types for one concept (Law 6) + a cathedral with a visible door (Law 8 inverse). Shotgun-surgery risk. | RX-16 (DESIGN-map-consolidation): fold into `geograph`, delete `panels/map`, `FF-ONE-MAP-NODE`. Interim de-risk: mark the stub `hidden` in `meta.ts` until consolidated. |
| **HIGH** | geostat | **sr-only AT-table phantom scroll** (`ChartDataTable` + `a11y.css` `white-space:nowrap`) | WCAG 1.4.10 Reflow + 1.4.4 **fail on every dashboard at most widths** — the only true a11y breakage in the runner. | RSP-R1 (above). |
| **MED** | core | **Fused-mode literal survives** — `template.ts:74-75` branches `=== 'year'` over a two-arm `{year,range}` union. | The exact anti-pattern the perspective refactor exists to kill; re-privileges the two-mode assumption in the badge carrier. | TM-STRANGLER P2 → `Record<perspectiveId,string>` + `FF-NO-MODE-LITERAL`. |
| **MED** | core | **`granularity` decorative at the resolve seam** — `time-dimension.ts:124` "does not affect resolution," though the `valAt`/grain port supports it. | A standard (OLAP/Cube grain) adopted at the port but **not threaded** at `resolveTimeDimension` = partial adoption (Law 4). Latent until sub-annual data. | GRAIN-G4 (above). |
| **LOW** | api | **Multi-tenancy promise vs placeholder** — branch `feat/tenant-agnostic-platform`; data plane is V6 `USING(true)` only. | Not erosion — the runner is *agnostic* (proven) but not *isolated*. The gap is a **pending decision**, not a defect; flagged so the name doesn't over-claim at ship. | MT-DECISION sign-off. |
| **LOW** | panel | **`_geoMode` underscore-private var as an axis** (`geostat.provisioning.json:4678`) | Ad-hoc derived var doing an axis's job — works, but not the declared form. | GEOMODE-AXIS (promote with the lattice). |
| **INFO** | panel | **Constructor canvas never responsively audited** (L1) — auth-gated at `:3003`. | Unknown responsive posture on the authoring surface. | Concurrent responsive lane: obtain a session / local current-branch build, run the 360–3440 ladder over canvas/outline/inspector/cmdk. |

## RESPONSIVE posture (owner's top concern)

The design system is **fundamentally sound** — it already ships fluid `clamp()` type tokens, a full `@media`+`@container` aspect/padding/gap cascade, container-queried cards, and a breakpoint scale. The defects are **not a missing system**: they are (a) one mis-applied a11y utility (R1/P0), (b) two missing `min-width:0`/`max-width` guards (R2/R3), (c) under-use of fluid tokens that already exist, and (d) chart container-fluidity at mid widths. The y-axis raw-float (F6) and `fmtNum` integer-zero data-integrity bugs are **already fixed** this session (`e64795a`, `02192da`); the gdp-ultrawide placeholder (F7) is **in flight**.

**Remaining responsive risks for the post-deploy real-browser re-audit (do NOT re-run the harness here):**
1. R1 sr-only phantom scroll (P0, every dashboard) — until the `.sr-only` div-wrap lands.
2. R2 header 72px overflow + clipped `ENG` in the 960–1100 band.
3. R3 ultrawide over-stretch / stranded 800px `centered` ribbon at 2560–3440.
4. F11 chart SVG clip @768; F13 bar-label crowding @768–1024.
5. F5 FilterBar hidden-scrollbar overflow ≤414; F9 5568px mobile stack (progressive disclosure under-applied).
6. **L1 — the Constructor canvas is entirely un-audited responsively.** This is the biggest unknown; prioritize it in the responsive lane.

## Per-app verdict

- **geostat (runner): HIGHEST-GRADE, one P0 a11y fix outstanding.** De-tenanting is proven (second-tenant fitness), metric delivery + calc metrics live, i18n boundaries correct, PlatformEventMap rename complete. Most serious: **RSP-R1 sr-only WCAG breakage** (rendered, surgical). No architecture erosion. **Verdict: SHIP-grade post-R1.**
- **panel (Constructor): SOLID architecture, one HIGH stub-in-palette.** Registry-driven authoring is reference-quality. Most serious: **RX-16 — `panels/map` palette-visible stub** (an author can build a dead node). Plus the un-audited responsive canvas (L1). **Verdict: SHIP-grade once the map stub is hidden/consolidated.**
- **api: HIGHEST-GRADE, no degradation found.** Arrow clean, operational/security floor built, declarative validation, durable persistence. The only "gap" is the multi-tenancy **decision**, not a defect. **Verdict: SHIP-grade; isolation spine is a decision away, not a rewrite away.**

## Overall verdict

**SHIP-GRADE on the green baseline, with zero architecture erosion found.** Every prior board/memory finding I could re-check has been resolved, and the new code (perspective axis, calc metrics, grain port, operational floor) is at the platform's standard — registry-driven, fitness-locked, Law-1-clean. The remaining distance to "close everything" is **unbuilt commitments and one design wave**, not quality debt: (1) the multi-tenancy decision, (2) the ratified time-mode Strangler, (3) the responsive P0/P1 fix wave, (4) the RX-16 map consolidation, (5) grain G4-G6, (6) the perspective-lattice crown.

The **two things that should not ship as-is**: **RSP-R1** (WCAG failure on every dashboard — S effort) and **the `panels/map` stub being palette-visible** (hide it in one line until RX-16 lands). Neither is erosion; both are closable now.

**Confidence: 0.88.** The 0.12: the Constructor canvas is responsively un-audited (L1), the 74 RLS/pg fitness tests are DATABASE_URL-skipped (green-by-absence, not green-by-proof), and concurrent edits in `packages/{react,plugins,styles}` + `contracts/api/geostat` were live during this audit — a re-verify on a quiesced tree is warranted before final tag.
