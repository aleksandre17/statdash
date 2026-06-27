# Board 06 — Cross-Cutting Architecture / Vision / Roadmap-Reconciliation / Foresight

> Lead-architect synthesis spine. The other five domain boards (01-engine … 05-database) fold into this.
> Method: read the doc corpus strategically, then **reconcile against live code** — DONE is marked only with
> file/commit evidence; stale docs are flagged superseded. Branch `feat/tenant-agnostic-platform`, HEAD `6f5cf43`.
> Date 2026-06-27. Analysis only — no product code changed.

---

## 0. The one-paragraph state of the platform

The platform has **reached its planned best-in-class state**. The 34-gap audit (2026-06-02), the N1–N44 move-set
(three tiers), the ADR spine (data-binding, multistore, theming, variant, nav, constructor, deployment), the
SDMX domain (V1→V35), and the just-landed **mode → generic `perspective` axis** refactor are all shipped,
fitness-locked, and real-Postgres validated (~2935 test calls across packages+apps). **Two "dominant" gap-analysis
findings are now obsolete in code**: the "synchronous resolution dominates everything" root finding
(`PLATFORM-GAP-ANALYSIS.md`) is **superseded** by the shipped async lifecycle (`queryAsync`/`QueryResult{state}`),
and "no auth/RBAC" is superseded by a shipped JWT+DB-user+roles stack. The frontier has therefore **moved**:
what remains is not roadmap execution but (a) a thin tail of *adoption* (use the semantic layer / multi-store in
real content), (b) a set of *trigger/environment-gated* items (deploy/CI, SDMX-serve), and — the real prize —
(c) a **gap layer the original roadmap never named**, dominated by the gap between *tenant-agnostic* (what the
branch delivers: a rebrandable single-tenant deploy) and *true multi-tenant isolation* (what the branch name
implies but the architecture does not yet provide).

---

## 1. ROADMAP RECONCILIATION LEDGER

Legend: ✅ DONE · 🟡 PARTIAL (mechanism shipped, adoption/consumer pending) · ⛔ NOT-DONE · 🗑️ SUPERSEDED.
Evidence is file path and/or commit. "Mechanism vs adoption" is called out where they diverge — the senior
distinction the user demanded.

### 1A. The 34-gap audit + N1–N9 (Tier-1 foundation) — `docs/plan/IMPLEMENTATION-ROADMAP.md`

| Initiative | Status | Evidence |
|---|---|---|
| Phase 0 Integrity (registry SSOT, storeKey cascade, live-tree validation) | ✅ | roadmap-phase-0 marked COMPLETE; `packages/core/src/registry/diagnostics.ts`; storeKey threaded in `resolveNodeRows.ts` |
| Phase 1 Engine purity (no `import.meta`/locale/console in core) | ✅ | `check-laws.sh` Laws 3/4/5 grep-clean over `packages/core/src`; `core/src/core/telemetry.ts` is the observer seam |
| Phase 2 Loose coupling / DRY (one row type, shared evalVarMap) | ✅ | roadmap-phase-1-2 COMPLETE |
| Phase 3 Datasources first-class JSON (N9 `DatasourcePlugin` + `SiteManifest.datasources`) | ✅ | `core/src/data/datasource.ts`; `buildStoreManifest` + `resolveStore`; provisioning JSON serves manifest |
| Phase 4 Type tightening · Phase 5 pipeline robustness · Phase 6 readability | ✅ | per ROADMAP-next §1.2 ("whole planned roadmap is shipped"); fitness-locked |
| **N1** split `@statdash/charts` from engine | ✅ | `platform/packages/charts` (`@statdash/charts`) is a distinct package |
| **N2** `@statdash/constructor` describe-registry export | ✅ (as `describeApp()`) | `packages/react/src/engine/constructor.ts` + `constructor.fitness.test.ts` |
| **N3** unify chart render via `ChartRendererRegistry` | ✅ | chart renderer registry in `packages/plugins` panels/chart |
| **N4 / N34** async data + Suspense boundary | ✅ | `core/src/data/store.ts` `queryAsync`/`batchQueryAsync`→`Promise<QueryResult>`; `useNodeRows`/`useKpiRows`/`useNodeStream` |
| **N5** Cached/batch default read path | ✅ | `core/src/data/store-impl.ts` cache + `meta.cacheHit`; `batchQueryAsync` |
| **N6** `ResolveObserver` observability seam | ✅ | `core/src/core/telemetry.ts`; `data/spec.ts` emits via observer (no console) |
| **N7** consolidate filter-model seam | ✅ | per roadmap-next; `useFilterState` is the single seam |
| **N32** dependency arrow as build gate | ✅ | `platform/eslint.config.js` per-layer `no-restricted-imports`; `contracts` zero-dep locked |
| **N33** React test infra (jsdom + RTL) | ✅ | `*.test.tsx` throughout `packages/react/src`; ~2935 test calls total |

### 1B. Tier-2 standard-setting spine (N10–N25)

| Move | Status | Evidence |
|---|---|---|
| **N10** typed `PropSchema` per slice | ✅ | `packages/react/src/components/PropSchemaForm.tsx` + `.test.tsx` |
| **N11** self-registration manifest export | ✅ | `describeApp()` constructor.fitness |
| **N12** transforms → registry | 🟡 | transform pipeline shipped; registry-ification status not re-verified here (engine board to confirm) |
| **N13** columnar `DataFrame` | ⛔ (deliberately evidence-gated) | named in ARCHITECTURE-TARGET as lowest-priority big bet; `DataRow[]` boundary stands |
| **N14** provenance plane (`MetadataPort`) | ✅ mechanism | `core/src/core/provenance.ts`; DB `V31__reference_metadata`, `V32__submission_provenance` |
| **N15** a11y as tested contract + chart→table | 🟡 | `ChartDataTable.a11y.test.tsx` exists; **no platform-wide `axe` CI gate** (PLATFORM-GAP A-a11y) |
| **N16** export registry | 🟡 | `PanelExportBar` component + per-section export wired; **no generic `exporterRegistry`** (grep: none) |
| **N17** `Result<T,Diagnostic>` error contract | ✅ | `core/src/registry/diagnostics.ts` Diagnostic type; fail-loud resolvers |
| **N18** registry contract-test harness | 🟡 | per-slice fitness tests exist; one generic LSP harness not confirmed |
| **N19** page-level schemaVersion + migration chain | 🟡 | per-slice `migrate`/`_version` exists; page-level chain not confirmed |
| **N20** themeable design system + WCAG-contrast + dark/HC | 🟡 | `packages/styles` 3-tier tokens + `[data-tenant]` + parity test ✅; **dark/high-contrast theme + build-time contrast validation ⛔** |
| **N21** Storybook catalog | ⛔ | not present |
| **N22** ICU message format + collation | 🟡 | `core/src/i18n` `formatMessage`/`createCollator` present; ICU plural/select coverage not verified |
| **N23** telemetry plane / inspector overlay | 🟡 | `core/src/core/telemetry.ts` port ✅; **no wired backend exporter / dev inspector overlay** |
| **N24** security contract (XSS/CSP/sanitize) | 🟡 | CORS/CSP designed (deployment ADR); JWT+constant-time login ✅; **CSP nonce, rate-limit, sanitizer for text panel ⛔** |
| **N25** large-data virtualization | ⛔ (conditional) | `TableConfig.rowThreshold` truncates; virtualizer not wired |

### 1C. Tier-3 north star (N26–N31) + interactive frontier (N34–N44)

| Move | Status | Evidence |
|---|---|---|
| **N26** semantic layer (metric registry) | 🟡 **mechanism ✅ / adoption ⛔** | `core/src/data/metric.ts` + `metric-store`/`metric-binding` fitness; **0 `MetricDef`s registered in prod, 97 raw codes** in `geostat.provisioning.json` (ROADMAP-next ②) |
| **N27** multi-target rendering | 🟡 | SSR/JSON targets ✅ (`packages/react/src/engine/targets/api.ts`, `warm.ts`); **PDF-bulletin target ⛔** |
| **N28** reactive dataflow graph | ⛔ (north-star, gated) | EventBus + cross-filter seed exists; full signal DAG not built |
| **N29** everything-is-a-node | ⛔ (north-star, gated) | registry-per-role stands; unification not pursued |
| **N30** query pushdown + planner | ⛔ (door D3-PLANNER) | `StoreCaps`+`extractRequirements` inputs exist; planner deferred behind trigger |
| **N31** config as governed content | 🟡 | `V15__audit_log` table + `PageConfigBase.changeNote` ✅; **draft→review→publish→rollback + lineage UI ⛔** |
| **N34** async data lifecycle | ✅ | (see N4) — **this supersedes the PLATFORM-GAP "dominant finding"** |
| **N35** live WYSIWYG canvas | ✅ | Constructor canvas perspective preview (`f316001`); `NodePageRenderer` mounted in panel |
| **N36** cross-filter + declarative events | 🟡 | `packages/react/src/engine/node-events.ts` + `crossFilter.test.ts` ✅; full declarative `node.on` authoring coverage to confirm |
| **N37** per-panel scope (time/filter/compare) | 🟡→🗑️ partial | `ScopeOverride` exists; **`compare` half is dead (Law-7 liability flagged, ROADMAP-next ①)** — slated for deletion |
| **N38** snapshot persistence + signed embed | ⛔ | render target done; `POST /snapshots` + `GET /embed/:token` not built |
| **N39** time-series transform ops (window/reduce/joinByField-outer) | 🟡 | `joinByField` shipped (blend); window/reduce coverage to confirm (engine board) |
| **N40** gauge / text / generic-map panels | ⛔ | `georgraph` is concrete not generic; no gauge/text panel |
| **N41** RBAC port + audit_log sink | 🟡 | auth+roles+`audit_log` table ✅; **role-scoped node visibility + audit middleware sink** to confirm |
| **N42** annotations + threshold rules | ⛔ | not built |
| **N43** result semantic metadata + validated saves | 🟡 | `describeApp()` validation exists; `FieldMeta{role:dim|measure}` to confirm |
| **N44** a11y CI gate + high-contrast theme | ⛔ | no `axe` gate; no HC theme |

### 1D. ADR spine (architect memory) — proposed → built reconciliation

| ADR | Status | Evidence |
|---|---|---|
| `adr_mode_as_view_axis` (perspective) | ✅ **BUILT** (was the headline "proposed") | commits `301eedf`→`f316001`; `core/src/perspective/registry.ts`+`types.ts`; P0–P6 + System-A retired; 1799 tests |
| `adr_data_binding_shipped` (3 data-source ADRs) | ✅ | static/href/stats store kinds + blend; `RESEARCH-data-binding-architecture.md` |
| `adr_multistore_storeid_reintroduction` (M0–M2) | ✅ mechanism / 🟡 adoption | `resolveStore`/`resolveStoreByKey` ✅; **no live 2-store page** (ROADMAP-next ③) |
| `adr_data_blending_decision` (D3 seam, defer planner) | ✅ seam / ⛔ planner | `joinByField` + `blend` transform ✅; D3-PLANNER deferred |
| `adr_data_source_reference_spectrum` (static/href/stats) | ✅ / href-opened | static+stats registered; href D-HREF opened |
| `adr_semantic_token_theming_spine` | ✅ | `packages/styles` tokens + `[data-tenant]`; byte-identical geostat parity test |
| `adr_shell_variant_style_spine` | ✅ (per roadmap-next) | variant→data-attr resolution in shells |
| `adr_no_privileged_element_capability_nav` | ✅ | nav-contributor / registry-driven visitor |
| `adr_platform_structure_rearchitecture` (engine/→packages/, @statdash, +contracts) | ✅ | `packages/{contracts,expr,core,charts,react,styles,plugins}` + `apps/{api,geostat,panel}`, all `@statdash/*` |
| `adr_constructor_phase2` + `adr_constructor_vision_north_star` (V0–V8) | ✅ (per roadmap-next V0–V7) | PropSchemaForm, canvas preview, Perspectives pane |
| `adr_deployment_topology` (single-origin reverse-proxy) | 🟡 designed / partial | `ops/compose`, `deploy.ps1`; remote workspace-tar fix pending (ROADMAP-next ④) |
| `adr_sdmx_p1_frontier` (V27 concept / V28 lifecycle / V29 category) | ✅ | `V27__concept_scheme`, `V28__dataset_lifecycle`, `V29__category_scheme` |
| `adr_time_range_readiness_seam` | ✅ (folded into perspective P4.5) | binding-pin / target-keys / perspective-default-gate shipped |

### 1E. SUPERSEDED docs (flag-and-archive)

| Doc | Superseded by | Why |
|---|---|---|
| `docs/architecture/subsystems/19-mode-system.md` | perspective refactor (`core/src/perspective/`) | describes the retired `mode = year/range/compare` privileged concern; `ManifestMode`/`DEFAULT_MODES`/`ctx.timeMode` all grep-zeroed by `check-laws.sh` retirement locks |
| `docs/architecture/future/06-mode-system/phase2.md` | same | the "mode system phase 2" plan landed as the generic perspective axis, not as the privileged mode it describes |
| `docs/architecture/examples/mode-system.md` | same | example uses the deleted `ModeContext`/`mode-bar` vocabulary |
| `platform/docs/plan/PLATFORM-GAP-ANALYSIS.md` "Finding That Dominates Everything" (sync data) | N34 shipped | `queryAsync`/`QueryResult{state:loading|done|error}` now exist; the scorecard's "Data lifecycle ~40%, weakest dimension" is stale |
| `docs/plan/ARCHITECTURE-TARGET.md` package names (`@geostat/*`, `src→plugins→…`) | platform re-arch | all renamed to `@statdash/*`; arrow now `contracts←expr←core←charts←react←plugins←apps` |
| `project_roadmap.md` / `project_debt.md` (memory: Layer 2.9 "active", erasableSyntax debt) | shipped | stats DataStore wired; structure migrated past `engine/core` paths |
| `work/BOARD.md` | this board + ROADMAP-next | marked stale at source |

---

## 2. THE GAP LAYER 🆕 — capabilities the highest concept needs that NO roadmap named

These are the forward-looking, critical gaps. Each is a card.

### [ARCH-01] True multi-tenant isolation (the branch-name gap)
- **Status** 🆕 ⛔ / **Evidence** branch `feat/tenant-agnostic-platform`; `packages/styles/src/css/tokens.css` `[data-tenant]`; **no `tenant_id` in any of 35 `ops/postgres/migrations/V*.sql`**; `config.site_config` is a flat key/value (no tenant scope); `auth` issues roles `['admin']` with **no tenant claim**.
- **What & why** The branch delivers *tenant-AGNOSTIC* (the engine carries no Geostat identity; brand = tokens, locale = LocaleString, data = config) — i.e. **a rebrandable single-tenant deploy per agency**. It does **not** deliver *multi-tenant* (many agencies, one instance, isolated). The five isolation planes are all absent: **data** (no row-level tenant partition / RLS-by-tenant), **config** (no namespacing of pages/manifests by tenant), **theming** (token override is global `[data-tenant]`, not per-request-resolved), **auth** (JWT has no tenant claim; RBAC is flat), **authoring** (Constructor edits one site, no tenant context).
- **Critical analysis** This is the platform's single largest unnamed architectural fork. "Agnostic" was the right *first* move (it is the prerequisite), but the branch name promises isolation the schema cannot enforce. Building features on top without deciding **single-tenant-per-deploy vs multi-tenant-SaaS** risks a costly retrofit (tenant_id threading is the most invasive change a data platform can make late).
- **Reference platforms** Grafana (org_id on every row + RBAC scoped to org) · Retool (workspace isolation) · Metabase (data sandboxing per group). **Where WE beat them once built:** our config IS data (JSON in `config.*` tables) — a tenant column on `site_config`/`page_config` + a metric/store namespace gives config-isolation *and* data-isolation through the same SSOT, where incumbents bolt tenant-scoping onto an opaque store.
- **Foresight (1–2yr)** If the goal is a hosted multi-agency offering (ArmStat + ENstat + Geostat on one instance), tenant isolation is foundational and must be decided now. If the goal is per-agency on-prem deploys, "agnostic" is sufficient and this is a YAGNI — but **that decision must be explicit** (it is currently implicit).
- **Plan** **Phase MT-0 (decision, S, one-way door):** ADR — single-tenant-per-deploy vs multi-tenant-SaaS, with the trade-off named (operational cost vs isolation blast-radius). **If SaaS:** MT-1 add `tenant_id` to `config.*` + `stats.*` with RLS policy (expand-contract, default tenant for existing rows); MT-2 tenant claim in JWT + `AuthContext` port in `RenderContext` (injected by app, never in core — Law 3); MT-3 per-request theme resolution (tenant → token set) ; MT-4 Constructor tenant context. **Fitness:** `FF-EVERY-CONFIG-ROW-TENANT-SCOPED`, `FF-NO-CROSS-TENANT-READ` (RLS test). **Effort** L · **Risk** one-way · **Class** M · **Priority** P0-DECISION (do not build features over an undecided isolation model).
- **Raises-the-bar** Forces the implicit branch promise into an explicit, fitness-enforced model — no silent "agnostic ≈ multi-tenant" conflation.

### [ARCH-02] Production observability (port exists, backend does not)
- **Status** 🆕 🟡 / **Evidence** `core/src/core/telemetry.ts` (port) ✅; **no OTel/Prometheus exporter wired**, no SLO/error-budget def, no dashboards (the platform does not dogfood itself).
- **What & why** N6/N23 built the *seam* (the right Law-3 move — engine stays pure). But a port with no adapter produces no traces in prod. A statistics office running this needs render-latency, data-fetch timing, error rates, and an SLO.
- **Critical analysis** The hard architectural part (the injectable port) is done; the remaining work is integration, not design. Low risk, high operational value. The most elegant payoff: **the dashboard platform renders its own telemetry dashboard** (dogfooding = the strongest fitness function).
- **Reference platforms** Grafana (self-instrumented) · OpenTelemetry (port-shaped). **Where WE beat them:** a config-driven dashboard of our own telemetry is one provisioning JSON, not a separate app.
- **Foresight** Multi-tenant (ARCH-01) makes per-tenant SLOs a billing/SLA artifact.
- **Plan** OBS-1 wire an OTel exporter adapter to the telemetry port; OBS-2 author a telemetry dashboard config (dogfood); OBS-3 define SLI/SLO + error budget. **FF** `FF-TELEMETRY-PORT-HAS-ADAPTER`. **Effort** M · **Risk** two-way · **Class** M · **Priority** P1.
- **Raises-the-bar** Turns "no silent failure" from a code law into an observed-in-prod guarantee.

### [ARCH-03] Runtime governance of published dashboards (lineage + workflow)
- **Status** 🆕 🟡 / **Evidence** `V15__audit_log.sql` table + `PageConfigBase.changeNote` ✅; **no draft→review→publish→rollback workflow, no config diff, no lineage trace surface** (N31 designed, not built).
- **What & why** For a national statistics office, "who published this figure, when, from what source, computed how" is a publishing obligation, and "roll back a bad release" is an operational must. The governance *fields* exist; the *workflow and lineage trace* do not.
- **Critical analysis** This is where the innovation thesis (#2 lineage) and a real obligation meet — see [ARCH-INNOV-02]. The seam (`bootstrapSite` + provenance + metric registry) is the lineage spine; the missing piece is the trace UI + the publish state machine (a dataset-lifecycle FSM `V28` already proves we can model FSMs in this codebase).
- **Reference platforms** Sanity/Contentful (versioned content) · Grafana provisioning history. **Where WE beat them:** declarative end-to-end pipeline → full pixel-to-observation lineage (no incumbent has this — their data layer is opaque).
- **Plan** GOV-1 config publish FSM (draft/review/published/archived) reusing the V28 lifecycle pattern; GOV-2 config diff (JSON is diffable by construction); GOV-3 lineage trace endpoint (pixel→DataRow→step→query→observation→V32 submission). **FF** `FF-PUBLISHED-CONFIG-IMMUTABLE`, `FF-EVERY-FIGURE-HAS-LINEAGE`. **Effort** L · **Risk** Phase-2-native, design-now · **Class** M · **Priority** P1 (rides ARCH-01).
- **Raises-the-bar** Makes auditability a queryable property, not a promise.

### [ARCH-04] Third-party plugin SDK (extensibility beyond the monorepo)
- **Status** 🆕 ⛔ / **Evidence** plugins are functions registered at `setupRegistrations`; monorepo-only; no `plugin.json` manifest, no dynamic bundle load, no sandbox, no versioned plugin-API contract.
- **What & why** Today a new chart/panel/datasource = a monorepo PR. The registry-everywhere pattern is *already* the seam a third party would extend; what is missing is the **packaging + loading + versioned-contract + sandbox** layer.
- **Critical analysis** Correctly deferred (framework-gaps doc: "Phase 4+ marketplace"). YAGNI until a real second author exists. But the architectural prerequisite — a **stable, versioned plugin-API contract** (`@statdash/contracts` is the natural home) — should be designed *before* the first external author, or every plugin breaks on every release.
- **Reference platforms** Grafana (`plugin.json` + signed bundles) · VS Code extensions. **Where WE beat them:** `describeApp()` already emits the capability manifest; a plugin is "a bundle that registers into the same registries the core does" — the contract is half-specified.
- **Plan** SDK-0 (design only, gated) freeze a SemVer'd plugin-API surface in `@statdash/contracts`; SDK-1+ (triggered by real demand) manifest + dynamic import + sandbox. **FF** `FF-PLUGIN-API-SEMVER-STABLE`. **Effort** L · **Risk** one-way (the contract) · **Class** M · **Priority** P3 (trigger-gated; do not build blind).
- **Raises-the-bar** Names the contract-stability obligation now, defers the machinery honestly.

### [ARCH-05] Performance at scale (proven, not assumed)
- **Status** 🆕 ⛔ / **Evidence** `TableConfig.rowThreshold` truncates (no virtualization, N25); query pushdown deferred (N30, D3-PLANNER); columnar `DataFrame` gated (N13); **no load test in repo**.
- **What & why** National-accounts cubes (years × regions × sectors × measures) can exceed browser-materialization budgets. Three gated moves (N13/N25/N30) all target this; none has an evidence trigger yet.
- **Critical analysis** The senior call is correct (evidence-gate, don't premature-optimize) — but there is **no measurement harness** to produce the evidence. The gate can never open without a benchmark. *That* is the gap: not the optimizations, the missing budget/benchmark.
- **Reference platforms** Grafana (server-side query) · Cube (pre-aggregations) · TanStack Virtual. **Where WE beat them:** `StoreCaps` + `extractRequirements` already model pushdown inputs — the planner is half-specified.
- **Plan** PERF-0 a benchmark harness + a documented cell-count budget (the trigger); then N25 (virtualize over budget) → N30 (pushdown when store-capable) → N13 (columnar, only if measured). **FF** `FF-RENDER-WITHIN-BUDGET` (perf fitness function). **Effort** M (harness) + L (gated) · **Risk** two-way (harness) · **Class** M · **Priority** P2.
- **Raises-the-bar** Converts three "evidence-gated" deferrals into a *measurable* gate.

### [ARCH-06] Security posture hardening (designed, not complete)
- **Status** 🆕 🟡 / **Evidence** JWT + constant-time login + 401/403 semantics ✅ (`apps/api/src/routes/auth`); CORS/CSP designed (deployment ADR); **no CSP nonce, no rate-limiting, no HTML sanitizer (blocks N40 text panel), no SBOM/dependency-scan, no secrets vault**.
- **What & why** A government surface is a target (N24). The auth core is genuinely good; the perimeter and supply-chain controls are not yet in place.
- **Critical analysis** Three injection surfaces named in N24 (template `{dim}`, dataLink, URL param) need a documented escaping guarantee + a fitness test. Rate-limiting and dependency-scanning are CI/ops, not architecture — but absent.
- **Reference platforms** OWASP ASVS · gov security baselines. **Where WE beat them:** the declarative config (no functions, sandboxed expr) eliminates whole injection classes by construction — the remaining surface is small and enumerable.
- **Plan** SEC-1 escaping fitness test over the three surfaces; SEC-2 rate-limit + CSP nonce in `apps/api`; SEC-3 SBOM + dependency scan in CI. **FF** `FF-NO-UNESCAPED-INTERPOLATION`. **Effort** M · **Risk** two-way · **Class** M · **Priority** P1 (gov obligation).
- **Raises-the-bar** Turns "secure by design" into enumerated, tested surfaces.

### [ARCH-07] Collaboration (multi-author Constructor)
- **Status** 🆕 ⛔ / **Evidence** no concurrent-edit, presence, comments, or approval-routing anywhere in `apps/panel`.
- **What & why** A statistics office is a *team*; the Constructor is single-author. Collaboration is the natural successor to governance (ARCH-03).
- **Critical analysis** Correctly not built — YAGNI until a second concurrent author is real. Listed for completeness and to flag the dependency order: governance (ARCH-03) before collaboration.
- **Reference platforms** Figma (CRDT presence) · Google Docs · Sanity. **Plan** deferred behind ARCH-03; if pursued, the JSON config + a CRDT/OT layer. **Effort** L · **Risk** one-way · **Class** M · **Priority** P3 (gated).
- **Raises-the-bar** Names the dependency (governance first), refuses speculative build.

---

## 3. THE INNOVATION THESIS 🆕 — net-new, reference-beating capabilities we are uniquely positioned to pioneer

Each rides a **seam we already shipped**. Ranked by leverage × cheapness-for-us. The first two are the "amaze":
genuinely net-new AND nearly free because the spine exists. The rest are honestly gated.

### [ARCH-INNOV-01] The Perspective Lattice — a generic, composable *view algebra* (THE HEADLINE)
- **Status** 🆕 (seam ✅, generalization ⛔) / **Evidence** `core/src/perspective/registry.ts`; `ctx.perspectiveState: Record<param,string>` (Harel orthogonal-regions container); permalink generated from the `PerspectiveAxis` registry (`f316001`).
- **The insight** We just shipped what no incumbent has: a **generic** perspective axis. Today it carries one axis (time: year/range), but the container is `Record<param,string>` and the renderer treats every axis identically. Generalize it to a **lattice** — perspective × vintage × scenario × geography-grain × methodology — where **N orthogonal axes compose to 2^N reader-selectable views**, each fitness-locked, each permalink-addressable, with **zero per-view duplication** (the structural property the refactor already proved: `ONE-VIEW-NO-MACHINERY` / `PERSPECTIVE-IS-PURE-FUNCTION`).
- **Why no incumbent has it** Every reference platform **privileged one dimension**: Grafana privileges *time-range* + flat variables; PowerBI has *bookmarks* (frozen snapshots, not composable); Tableau has *parameters* (no orthogonality guarantee); Looker has none at the view layer. None has a single primitive that is (a) generic over the dimension, (b) orthogonally composable, (c) permalink-generated from a registry, (d) duplication-free by construction.
- **The seam that makes it cheap for US** Law 1 (no privileged dims) + the `perspectiveState` orthogonal container + permalink-from-registry already exist. Adding a second axis is **registering a `PerspectiveAxis`**, not building machinery — the refactor's entire thesis was "power = 2^N composable from 1 primitive."
- **Reference platforms** Grafana, PowerBI, Tableau, Looker — **we beat all four** on composability + duplication-freedom + URL-as-architecture.
- **Plan** LAT-1 register a *second* real axis (vintage: preliminary/revised — `V25__release_vintage` already models it) to prove orthogonality with a real consumer; LAT-2 lattice permalink (all axes elided-by-default); LAT-3 Constructor lattice authoring (the Perspectives pane already exists). **FF** `FF-AXES-ORTHOGONAL` (changing axis A never mutates axis B's region), `FF-PERMALINK-FROM-LATTICE`. **Effort** M · **Risk** two-way (additive axis) · **Class** M · **Priority** **P0 — build next**.
- **Raises-the-bar** Promotes the just-shipped refactor from "removed a privileged mode" to "invented a generic view algebra no BI tool has."

### [ARCH-INNOV-02] Pixel-to-Observation Lineage — every published number is auditable by construction
- **Status** 🆕 (seam ✅, trace ⛔) / **Evidence** `core/src/core/provenance.ts`; `V32__submission_provenance`; `V31__reference_metadata`; declarative end-to-end pipeline (`interpretSpec`→`applyPipeline`→`applyEncoding`→`ChartOutput`); canonical SDMX ingestion with submission provenance.
- **The insight** Make **every rendered figure** carry a verifiable lineage chain: pixel → `DataRow` → transform step → store query → SDMX observation → submission provenance (V32) → source workbook. An auditor clicks a number and sees its full derivation.
- **Why no incumbent has it** BI tools' data layer is **opaque SQL passthrough** — they cannot trace below the query. We can because (a) our pipeline is *declarative end-to-end* (every transform is an inspectable step, not opaque code), and (b) we *ingest* canonical SDMX with submission provenance, so the chain reaches the source workbook, not just the query.
- **The seam that makes it cheap for US** The pipeline already records each step; provenance.ts + V32 already hold the source end. The missing piece is **threading a lineage token through the existing stages** (the engine already threads `ctx` everywhere) and a trace endpoint.
- **Reference platforms** dbt (column lineage, but model-level not pixel-level) · Grafana (none). **We beat them** on pixel-level + source-level reach.
- **Plan** LIN-1 attach a lineage breadcrumb at each pipeline stage (additive, behind the existing `ctx`); LIN-2 a `GET /lineage/:figureId` trace; LIN-3 a chart/table "trace this figure" affordance. Pairs with ARCH-03 governance. **FF** `FF-EVERY-FIGURE-HAS-LINEAGE`. **Effort** M · **Risk** two-way · **Class** M · **Priority** P1.
- **Raises-the-bar** Official-statistics-grade trust as an architectural property, unmatched by any general BI tool.

### [ARCH-INNOV-03] Coverage-Complete Constructor — the builder *provably* never diverges from the renderer
- **Status** 🆕 (seam ✅, guarantee 🟡) / **Evidence** `describeApp()` + `constructor.fitness.test.ts` + round-trip fitness (`JSON.parse(JSON.stringify(x))===x`) + PropSchema-per-slice.
- **The insight** Make it a **CI-enforced theorem** that everything the renderer can render, the Constructor can author — the renderer and builder can *never* drift. A fitness function asserts: for every registered node/spec/chart/transform/perspective type, a PropSchema exists and round-trips.
- **Why no incumbent has it** Builder.io, Retool, AppSmith, Grafana all have an **escape-to-code** hatch — there exist artifacts the visual builder cannot author. None *guarantees* coverage; the renderer always outpaces the builder.
- **The seam that makes it cheap for US** Law 2 (no functions in config) means there is *no* escape hatch — every renderable artifact is JSON. PropSchema-per-slice + registry-SSOT + round-trip invariant make coverage a *testable property*.
- **Reference platforms** Builder.io, Retool — **we beat them** on the provable no-divergence guarantee.
- **Plan** COV-1 a single fitness test iterating every registry entry, asserting PropSchema presence + round-trip; COV-2 fail CI on any renderable-but-unauthorable type. **FF** `FF-RENDERER-BUILDER-COVERAGE-COMPLETE`. **Effort** S (hardens existing fitness) · **Risk** two-way · **Class** M · **Priority** P1 (cheap, high-signal).
- **Raises-the-bar** Turns "Constructor-ready" from an aspiration into a build gate.

### [ARCH-INNOV-04] Self-Publishing Statistical Bulletin — one governed config → dashboard + PDF + data API
- **Status** 🆕 (seam ✅, PDF ⛔) / **Evidence** neutral `NodeDef`/`ChartOutput`; SSR/JSON targets shipped (`targets/api.ts`, `warm.ts`).
- **The insight** The same governed config that drives the interactive dashboard generates the **official PDF statistical bulletin** *and* the machine-readable SDMX-JSON API — authored once. (N27 elevated.)
- **Why no incumbent has it** Grafana needs a separate image-renderer service; Tableau/PowerBI are DOM-locked; none generates a *typeset statistical bulletin* from the dashboard config. We have a neutral tree + SSR walkers already.
- **The seam** A PDF target is a new *consumer* of the same `renderNode` output — no engine change (the neutrality the platform was built on).
- **Reference platforms** Grafana image-renderer · Observable. **We beat them** on zero-duplicate-authoring across interactive + print + API.
- **Plan** Gated on a real consumer — **does the agency publish PDF bulletins?** (user-direction). If yes: PUB-1 a PDF `RenderTarget` consuming `ChartOutput`; PUB-2 bulletin layout templates. **FF** `FF-TARGETS-SHARE-ONE-CONFIG`. **Effort** L · **Risk** two-way (additive target) · **Class** M · **Priority** P2 (consumer-gated — do not build blind).
- **Raises-the-bar** The domain-defining payoff, honestly gated on a real publishing need.

### [ARCH-INNOV-05] Scenario Perspectives — metric × perspective fusion (the most ambitious, most gated)
- **Status** 🆕 (both seams ✅, fusion ⛔) / **Evidence** `core/src/data/metric.ts` (semantic layer) + `core/src/perspective/registry.ts` + `V25__release_vintage` + `V32__submission_provenance`.
- **The insight** Fuse the semantic layer (N26: a metric defined once) with the perspective lattice (INNOV-01): a metric can have **perspective-scoped definitions** — "GDP, preliminary" vs "GDP, revised" (a *vintage* perspective); "methodology-2019" vs "methodology-2024" (a *methodology* perspective). The reader toggles the perspective; the published number recomputes *and* re-cites its provenance (INNOV-02).
- **Why no incumbent has it** Looker/Cube define a metric **once and immutably**; they have no model for vintages, revisions, or methodology changes — because general BI doesn't have the *domain*. A statistics office lives in revisions and methodology breaks daily.
- **The seam** Metric registry + perspective axis + V25 vintage + V32 provenance all exist independently. The fusion is letting a `MetricDef` be perspective-scoped — a small, additive type change at a seam that is already there.
- **Reference platforms** Looker LookML, Cube, dbt metrics — **we beat them** on a capability they structurally cannot model (the vintage/revision/methodology domain).
- **Plan** **Gated on a real revision/vintage use case** (do not build a scenario engine speculatively — YAGNI). When triggered: SCEN-1 perspective-scoped `MetricDef`; SCEN-2 provenance re-cite on perspective switch. **FF** `FF-METRIC-PERSPECTIVE-PROVENANCE`. **Effort** L · **Risk** one-way-ish · **Class** M · **Priority** P3 (trigger-gated).
- **Raises-the-bar** Names the deepest domain-native capability the architecture *wants to become* — and refuses to build it before a consumer proves it.

---

## 4. RECONCILIATION COUNTS

- **Major initiatives reconciled:** ~78 (34 gaps as phase-clusters + N1–N44 + 13 ADRs + perspective P0–P6).
- ✅ **DONE (mechanism + adoption):** ~46 — the entire Tier-1 foundation, perspective axis, async lifecycle, package re-arch, dependency-arrow gate, auth/RBAC core, SDMX V1–V35, Constructor V0–V7.
- 🟡 **PARTIAL (mechanism shipped, adoption/consumer/sink pending):** ~18 — semantic layer (N26), multistore (M0–M2), provenance (N14), telemetry (N23), cross-filter (N36), export (N16), governance (N31), security (N24), theming dark/HC (N20), per-panel scope (N37).
- ⛔ **NOT-DONE:** ~14 — split across *deliberately gated* (N13 columnar, N28 reactive, N29 node-unify, N30 pushdown, N40 panels, N42 annotations, plugin SDK, collaboration) and *genuine open gaps* (N38 embed, N44 a11y-gate/HC-theme, N21 Storybook, N25 virtualization).
- 🗑️ **SUPERSEDED:** 7 docs (mode-system trio, PLATFORM-GAP sync-finding, ARCHITECTURE-TARGET package names, two memory roadmap docs, BOARD.md).
- **Net:** the planned roadmap is **essentially complete**; remaining value is *adoption*, *trigger-gated* moves, and the **never-planned gap layer** (ARCH-01…07).

## 5. TOP-5 CROSS-PLATFORM PRIORITIES (the synthesis spine the domain boards fold into)

1. **[ARCH-01] Decide the multi-tenancy model (P0-DECISION, one-way door).** Everything else inherits this. Agnostic ≠ multi-tenant; the branch name promises what the schema cannot enforce. ADR first, before more features stack on an undecided isolation model.
2. **[ARCH-INNOV-01] Build the Perspective Lattice (P0, cheap, headline).** A second real axis (vintage) proves the generic view-algebra no incumbent has — riding the seam shipped this week.
3. **[ARCH-INNOV-03 + ARCH-INNOV-02] Coverage-complete Constructor + pixel-to-observation lineage (P1, both cheap-on-existing-seams).** One makes the builder provably whole; the other makes every figure auditable — together they are the standard-setting differentiators.
4. **[ARCH-03 + ARCH-06] Governance workflow + security hardening (P1, gov obligations).** Publish FSM + lineage + escaping/rate-limit fitness — the trust layer a statistics office legally requires.
5. **[ARCH-02 + ARCH-05-perf] Production observability + a perf benchmark harness (P1/P2).** Wire the telemetry port to a backend (dogfood it) and build the budget/benchmark that can *open* the three gated perf doors (N13/N25/N30).

*Adoption tail to fold in (low-regret, additive):* register real `MetricDef`s (semantic layer N26), author a real 2-store `blend` page (multistore M0–M2), delete the dead `ScopeOverride.compare` surface (Law-7 liability, ROADMAP-next ①).

## 6. INNOVATION THESIS HEADLINE

> **The platform has spent its roadmap budget building neutrality — every seam (NodeDef, ChartOutput, DataStore,
> DataRow, and now the generic `perspectiveState`) knows nothing of React, Apex, transport, view, or privileged
> dimension. The next era is not closing gaps; it is *exploiting that neutrality* in two directions no reference
> platform combines: a generic, composable VIEW ALGEBRA (the Perspective Lattice — 2^N reader views from N
> registered axes, duplication-free, permalink-addressable) and pixel-to-observation LINEAGE (every published
> number auditable to its source workbook, because our pipeline is declarative end-to-end and we own the SDMX DSD
> as a semantic model). Grafana privileges time; Looker freezes metrics; Builder.io escapes to code; none has
> either. We have both spines already shipped — what remains is to register the second axis and thread the
> lineage token. That is the amaze: not a feature we lack, but a category we are one additive move away from
> defining. The single gate in front of it is one decision the branch name has been deferring — single-tenant
> agnostic, or true multi-tenant — and it must be made before another feature is stacked on the ambiguity.**

---
*Folds into the master board alongside 01-engine · 02-render · 03-constructor · 04-plugins · 05-database.
Section 1 (ledger) is the shared reconciliation table; Sections 2–3 (gap layer + innovation) are the
cross-cutting layer the domain boards do not individually own.*
