# MASTER BOARD — One Authoritative Synthesis

> Chief-engineer merge of six parallel senior domain boards (01-engine · 02-react · 03-constructor · 04-backend · 05-database · 06-architecture-vision). Read-only synthesis: no product code changed. Branch `feat/tenant-agnostic-platform`. Date 2026-06-27.
> Method: de-duplicate ruthlessly, mark what is DONE, separate correctness defects from missing features, unify priority. Three load-bearing claims spot-verified against source (metric no-op, zero registered MetricDefs, single placeholder `tenant_id`). Source boards hold the exhaustive per-card detail; this board is the navigation layer.
>
> **Overseer verdict up front:** the planned roadmap is essentially *built and fitness-locked* to a genuinely high standard. The remaining work is three things the roadmap never fully owned: (1) **one undecided one-way fork** (multi-tenancy) that gates a whole tier; (2) an **adoption tail** — real capabilities with zero production consumers, now at risk of bit-rot; (3) an **operational/security/a11y floor** that "green CI" masks. None of these is an architecture defect — the seams are right. They are *unfinished commitments*.

---

## 1. RECONCILIATION LEDGER — what is DONE

Legend: ✅ DONE (mechanism + adoption) · 🟡 PARTIAL (mechanism shipped, adoption/consumer/hardening pending) · ⛔ NOT-DONE · 🗑️ SUPERSEDED. Evidence = card-id + file/commit. "Mechanism vs adoption" is called out where they diverge — the distinction the user demanded.

### 1A. Engine / data-pipeline (`packages/{contracts,expr,core,charts}`)
| Initiative | Status | Card · Evidence |
|---|---|---|
| DataSpec union + `interpretSpec` registry dispatch (8 discriminants, no switch) | ✅ | ENG-01 · `core/src/data/spec.ts:53`, `registry/resolvers.ts:348` |
| Transform-step registry (19 ops, schema co-located) | ✅ | ENG-03 · `transform/step-registry.ts:32` |
| `$`-ref resolution taxonomy (5 scopes, one dispatcher) | ✅ | ENG-04 · `core/src/ref/ref.ts:40` |
| Perspective time-binding ownership (System-A replacement) | ✅ | ENG-09 · `config/perspective-axis-parser.ts:106` (verified: `scopeCtxByPerspective`) |
| Classifier / display pipe (`$cl`/`$d`, SDMX codelist→view) | ✅ | ENG-11 · `core/src/data/codelist.ts:40` |
| Three-tier defaults (literal/expr-topo/options + pendingKeys) | ✅ | ENG-13 · `config/filter-eval.ts:157` |
| `extractRequirements` warm=read-key SSOT (GAP-4) | ✅ | ENG-15 · `core/src/data/spec.ts:112`, `time-dimension.ts:216` |
| Export registry + expr/derive engine | ✅ | ENG-17 · `data/export/registry.ts`, `expr/src/` |
| Desugar seam (only `pivot` lowers; 3 specs blocked on store-port primitive) | 🟡 by design | ENG-02 · `core/src/data/desugar.ts:94` |
| **Semantic layer** MetricDef/registry — *fully built + wired, ZERO prod consumers* | 🟡 mech ✅ / adopt ⛔ | ENG-05 · `core/src/data/metric.ts`; **verified `registerMetric` only in tests** |
| Metric-driven store routing (`dataSource`) — gated on ENG-05 adoption | 🟡 mech ✅ / adopt ⛔ | ENG-06 · `metric-store.ts:79` |
| Declarative blend / cross-store join — B0 core, B1 react; B2 grain deferred | 🟡 | ENG-07 · `transform/index.ts:42`, react `resolveNodeRows.ts:105` |
| First-class time (`timeDimension`) — shape folded; legacy forms still primary; `granularity` decorative | 🟡 additive | ENG-08 · `core/src/core/time-dimension.ts` |
| Perspective scope-key registry — `timeBinding` ✅, **`metric` authoring-only/runtime-DEAD**, 4 doors deferred | 🟡 / **defect** | ENG-10 · runtime in `perspective-axis-parser.ts:196` (verified no `scope.metric` fold) |
| Options-source resolvers (sync done; HREF deferred to store-port) | 🟡 by design | ENG-12 · `core/src/data/resolve.ts` |
| DataStore async envelope (sync+async done; streaming/subscribe type-only) | 🟡 | ENG-14 · `core/src/data/store.ts:36` |
| `custom` spec type — declared in union, **no resolver registered (dead discriminant)** | ⛔ GAP | ENG-16 · `data-spec.ts:190` vs `resolvers.ts:348` |

### 1B. React render / charts / styling / layout / a11y / i18n (`packages/{react,charts,styles}` + plugin shells)
| Initiative | Status | Card · Evidence |
|---|---|---|
| `renderNode` 12-step zero-switch pipeline | ✅ | RX-01 · `react/src/engine/renderNode.ts:135` |
| Sync fast-lane vs async Suspense (capability-transparent warm-read) | ✅ | RX-02 · `renderNode.ts:198` |
| NodeView / lazy children proxy / named multi-slots | ✅ | RX-03/04 · `NodeView.tsx`, `lazyRendered.ts` |
| Perspective-aware prefetch planner + renderPageToJSON target | ✅ | RX-05/06 · `targets/warm.ts:35`, `targets/api.ts:130` |
| KPI/node warm hooks | ✅ | RX-07 · `useKpiRows.ts`, `useNodeRows.ts` |
| Semantic-token spine (300 tokens, 4-tier dark cascade, TS↔CSS parity) — *high-contrast tier missing* | ✅ / 🟡 HC | RX-08 · `styles/src/css/tokens.css:324` |
| Variant spine (runtime-zero data-attr projection) | ✅ | RX-09 · `styles/src/resolvers/variant.ts:43` |
| No-privileged-node nav (NavContribution) | ✅ | RX-10 · `react/src/engine/nav-contribution.ts` |
| Section-nav anchors — **a11y-incomplete** (focus-move, reduced-motion unverified) | 🟡 | RX-11 · `context/AnchorNavContext.tsx` |
| Chart interpreter registry (13, neutral ChartOutput) + neutral-color seam | ✅ | RX-12/13 · `charts/src/registry.ts`, `colors.ts` |
| ApexCharts adapter + interactions | ✅ | RX-15 · `plugins/.../ApexRenderer.tsx` |
| Engine a11y discovery gate (engine stand-in slices only) | ✅ scope-limited | RX-24 · `react/src/engine/__tests__/a11y.test.tsx:199` |
| i18n compose-boundary (LocaleString/useT/useFmt) — *RTL/ICU missing* | ✅ / 🟡 | RX-20 · `context/SiteContext.tsx:182` |
| Layout container-queries + shell-state hooks | ✅ | RX-18/19 · `layout.css`, `engine/hooks/*` |
| Deferred chart kinds — **sankey genuinely unbuilt**; map/scatter/heatmap absent | 🟡 | RX-14 · `charts/src/interpreters.ts:31` |
| **Two competing map node types** — geograph(real Leaflet) vs panels/map(SVG stub) | 🟡 / **Law-6 defect** | RX-16 · `geograph/GeoMap.tsx` vs `panels/map/MapShell.tsx` |
| geograph worker.js — wiring/test unverified | ⛔ GAP | RX-17 · `geograph/.../worker.js` |
| chip-select control; tabs/accordion container | 🟡 missing | RX-25 · `plugins/controls/*` |
| **Perspective-bar keyboard pattern incomplete** (no roving tabindex / arrow keys) | 🟡 / **a11y defect** | RX-21 · `PerspectiveBarShell.tsx:19` |
| **Plugin shells have ZERO axe gates** | ⛔ | RX-22 · `find plugins -name "*a11y*"` empty |
| **No `prefers-reduced-motion` anywhere** | ⛔ | RX-23 · grep empty |
| Code-split ApexCharts(~500KB)/Leaflet(~150KB) — scaffolding exists, unused | ⛔ | RX-26 · `ApexRenderer.tsx:1`, `GeoMap.tsx:15` |

### 1C. Constructor / authoring (`apps/panel`)
| Initiative | Status | Card · Evidence |
|---|---|---|
| Coverage gate (engine-capability ⊆ authoring-surface, 5 axes from SSOT) | ✅ flagship | CON-01 · `data-layer/coverage.fitness.test.ts` |
| Schema-driven generic Inspector + FieldControlRegistry (6 surfaces, 1 renderer) | ✅ | CON-02 · `inspector/Inspector.tsx`, `FieldControlRegistry.ts` |
| Capability-gated palette (dataset-aware discovery) | ✅ | CON-03 · `discovery/capabilityGate.ts` |
| Round-trip fidelity (flat store ⇄ tree, byte-identical) | ✅ | CON-04 · `canvas/canvasPageAdapter.ts` |
| Live WYSIWYG preview (real engine in-process, fail-soft live store) | ✅ better-than-spec | CON-05 · `canvas/CanvasView.tsx`, `useLivePreviewStores.ts` |
| Filters/ParamDef authoring · DataSpec+transform editors · Page inspector+badges · Visibility builder | ✅ | CON-06/07/08/09 |
| Outline + Cmd-K/slash (one insert path, 4 surfaces, byte-identical) | ✅ | CON-11 · `command/insertByteIdentity.fitness.test.ts` |
| Perspectives pane (registry-driven scope, OCP) | ✅ | CON-13 · `features/perspectives/*` (`f316001`) |
| Field-wells + Show-Me recommender — *analyst-grade, not Tableau-depth* | 🟡 | CON-10 · `fieldwells/*`, `showme/*` |
| Starter templates + data-first generate — *thin (all charts), valid* | 🟡 | CON-12 · `features/templates/*` |
| Dataset catalog browse + broken-ref check (per-source only) | 🟡 | CON-16 · `discovery/*` |
| **Single-locale PropSchema labels** across ~20 node files (Law-4 latent, undefended, drifting) | ⛔ GAP | CON-14 · `prop-schema.ts:94` + mixed `*Node.ts` labels |
| **PerspectiveOption.label resolves at parse, not render** (i18n timing inconsistency) | ⛔ GAP | CON-15 · `core/src/perspective/types.ts:21` |
| Citizen-grade UX (device preview, keyboard DnD, expr assist) — *architecturally complete, experientially mid-tier* | 🟡 | CON-17 |
| Stored-config migration runner (`migrate(config,from→to)`) — *version field exists, no runner* | 🟡 / one-way | CON-18 · `schemaVersion:1` but nothing reads it |
| Field-level no-raw-JSON safety gate (object/array→JsonControl unguarded) | 🟡 | CON-19 · `FieldControlRegistry.ts:97` |

### 1D. Backend / API / ingestion (`apps/api`)
| Initiative | Status | Card · Evidence |
|---|---|---|
| Bootstrap composition (one atomic SiteManifest, forward-migrate-on-read) | ✅ | API-01 · `routes/bootstrap/index.ts:156` |
| Medallion ingestion (Bronze→Silver→Gold, DB-as-queue, idempotent) | ✅ | API-02 · `ingest/{submit,worker,publish}.ts` |
| Approval FSM + server-authoritative publish gate | ✅ | API-03 · `routes/ingest/index.ts:203` |
| ETag/304 conditional-GET (version-counter validator) | ✅ | API-05 · `routes/stats/observations.ts:121` |
| RFC 9457 Problem Details (registry-as-SSOT, exemplary) | ✅ | API-07 · `lib/problem.ts:46` |
| Idempotency (content-hash + converge-on-retry FSM) | ✅ | API-12 · `ingest/submit.ts:85` |
| Error taxonomy (RFC-type + domain-code extension) | ✅ | API-15 · `lib/problem.ts:46` |
| MED-2 ManifestMode deletion (V35, co-ship documented) | ✅ | API-17 · `V35__drop_site_config_modes.sql` |
| **As-of vintage + SCD-2 revision reconstruction** (the differentiator) | ✅ | API-18 · `observations.ts:134`, V8 |
| Auth/RBAC core (HS256, 401/403, anti-enum) — *no rotation/refresh/revocation, no login rate-limit* | 🟡 | API-06 · `lib/auth.ts:50` |
| Datasource kinds — *config JSONB shipped to anon boot client, no secret redaction* | 🟡 / **latent sec** | API-08 · `routes/data-sources/index.ts:32` |
| Snapshots + signed embed — correct crypto, **in-memory store (dies on deploy)** | 🟡 | API-09 · `routes/embed/index.ts:46` |
| Observability — structured logs only; **no metrics, no traces, no request-id** | 🟡 | API-10 · `index.ts:25` |
| Pagination — `limit` only; no cursor/offset/total (silent truncation >10k) | 🟡 | API-13 · `observations.ts:100` |
| OpenAPI — config JSON-Schema exists; **no API OpenAPI doc** | ⛔ GAP | API-16 · grep `openapi` none |
| **Rate limiting / load shedding — none anywhere** | ⛔ GAP | API-11 · grep zero |
| Async/backpressure (N34) — renderer design only; **server bulkhead absent** | ⛔ design-only | API-14 |
| SDMX-REST serve — negotiation port reserved, **only `json` wired** | 🟡 by design | API-04 · `serialize/registry.ts:52` |

### 1E. Database / SDMX model / migrations (`ops/postgres/migrations` V1→V35)
| Initiative | Status | Card · Evidence |
|---|---|---|
| ConceptScheme/Concept (expand-contract; *contract step still open*) | ✅ | DB-02 · `V27` |
| Codelist/Classifier (LTREE, SCD-2, same-dim parent) | ✅ | DB-03 · `V4`/`V18`/`V23-24` |
| CategoryScheme/Categorisation · ContentConstraint · Reference-metadata (ESMS-lite) | ✅ | DB-04/06/07 · `V29`/`V26`/`V31` |
| Observation hypertable (generic `dim_key`, writer-provided partition) | ✅ | DB-09 · `V4` |
| Dataset lifecycle FSM · Release/vintage + revision log · Submission pipeline + PROV · Unit/measure · SCD-2 · Config schema | ✅ | DB-10/11/12/13/18/20 · `V28`/`V25`/`V11+V32`/`V16-21` |
| SDMX IM coverage — model stores artefacts but **cannot serialize** (no `/structure`,`/data`) | 🟡 | DB-01 |
| DSD+Dataflow collapsed into `stats.dataset` (no shared DSD, no DSD versioning) | 🟡 | DB-05 · `V4`/`V34` |
| Data integrity — several referential edges **fitness-only, not DB-enforced** | 🟡 | DB-14 |
| Migration hygiene — reference-grade; **rollback scripts are prose, not CI-executed** | 🟡 | DB-15 |
| Partitioning/scale — **mis-tuned** (`dim_key_hash` in segmentby defeats compression; 3-mo chunks wrong for annual); no continuous aggregates | 🟡 | DB-17 |
| Governance — audit immutability DB-enforced; **RBAC flat, no per-tenant scope** | 🟡 | DB-19 |
| **AgencyScheme — NOT modeled** (free TEXT everywhere; tenancy prerequisite) | ⛔ | DB-08 |
| **Multi-tenant isolation — NOT delivered** (one placeholder `tenant_id` on `stats.dataset`, `USING(true)` RLS; verified absent elsewhere) | ⛔ | DB-16 · `V6:159` |
| `observation_revision` + bronze blobs — **unbounded growth, no retention** | 🟡 latent | DB-11/12 |

### 1F. Cross-cutting / superseded
| Item | Status | Evidence |
|---|---|---|
| Perspective axis (mode→generic) — the headline refactor | ✅ BUILT | ARCH-1D · `301eedf`→`f316001`, System-A grep-zeroed |
| Async lifecycle (N34) — supersedes PLATFORM-GAP "dominant sync finding" | ✅ / 🗑️ finding | ARCH-1C |
| Package re-arch (`@statdash/*`, dependency-arrow build gate) | ✅ | ARCH-1A · `eslint.config.js` |
| Mode-system docs (`19-mode-system.md`, `future/06-mode-system`, examples) | 🗑️ | superseded by `core/src/perspective/` |
| `PLATFORM-GAP-ANALYSIS.md` sync-finding · `ARCHITECTURE-TARGET.md` pkg names · `work/BOARD.md` | 🗑️ | per ARCH-1E |
| `ScopeOverride.compare` half | 🗑️ slated | dead Law-7 liability (ROADMAP-next ①) |
| True multi-tenant · prod observability backend · governance workflow · plugin SDK · perf harness · security perimeter · collaboration | ⛔/🟡 gap layer | ARCH-01…07 |

**Overseer honesty on the DONE column:** ARCH board's "~46 DONE (mechanism+adoption)" *over-counts* — at least N26 semantic layer, M0–M2 multistore, and the `timeDimension`/`metric` doors are mechanism-only with zero adoption (ARCH itself marks them 🟡 in detail; the headline rounds up). CON board's "0 NOT-DONE" is literally true but elides two latent i18n GAPs (CON-14/15) and a one-way migration-runner debt (CON-18). Engine board's count line is internally inconsistent (says 9 DONE, lists 8). None of this is dishonest — it is optimism at the summary altitude. The per-card detail is sound.

---

## 2. CROSS-CUTTING CONVERGENCE — where multiple boards independently hit the same wall

The highest-value section: six boards, authored blind to each other, converged on six themes. Each is ONE finding (the contributing cards are folded in, not triple-counted).

### [X-1] Multi-tenancy P0 fork — *agnostic ≠ isolated* (the one-way door gating a tier)
**Convergence:** ARCH-01 + DB-16 + DB-08 + DB-19 + API-06 (tenant claim) + RX-08/CON (per-request theming/authoring).
**Finding:** The branch is `feat/tenant-agnostic-platform`. It delivers *agnostic* (the engine carries no Geostat identity; brand=tokens, locale=LocaleString, data=config) — a **rebrandable single-tenant-per-deploy**. It does **not** deliver *isolation*. Verified: the only `tenant_id` in all 35 migrations is a nullable placeholder on `stats.dataset` (`V6:159`) under `USING(true)` permissive RLS; no tenant column on `config.*`, no tenant claim in JWT, theming override is global `[data-tenant]` not per-request, AgencyScheme (the structural-ownership SSOT, DB-08) is unmodeled. All five isolation planes (data/config/theming/auth/authoring) are absent.
**Why it dominates:** `tenant_id` threading is the most invasive change a data platform can make *late*. Stacking features on an undecided isolation model risks a costly retrofit. The decision is **single-tenant-per-deploy vs multi-tenant-SaaS** — a one-way door. If per-deploy, "agnostic" is sufficient and most of this is YAGNI; if SaaS, it is foundational. **The decision is currently implicit and must be made explicit.**
**Cross-cutting blast radius:** DB-08 (agency=tenant), DB-19 (tenant-scoped RBAC), API-06 (tenant JWT claim), CON-16 (per-tenant catalog), ARCH-02 (per-tenant SLO), ARCH-03 (governance rides it). → **P0-DECISION (USER).**

### [X-2] Adoption debt — "cathedrals without congregations" (the bit-rot risk)
**Convergence:** ENG-05 (semantic layer, 0 consumers — *verified `registerMetric` only in tests*) + ENG-06 (store routing, gated on ENG-05) + ENG-10 (`metric` scope dead) + ENG-16 (`custom` dead) + ENG-08 (`timeDimension` un-adopted) + ARCH multistore M0–M2 (no live 2-store page) + N26 (97 raw codes, 0 MetricDefs in `geostat.provisioning.json`).
**Finding:** A cluster of *fully-built, fully-wired, fitness-locked capabilities with zero production consumers.* The architecture is correct and the seams are proven — but no config exercises them, so they risk drifting from real needs (Lehman: unused code rots).
**Overseer nuance (brutal honesty, both directions):** the ENG board frames this as alarm ("the cathedral bit-rots"). But `VISION-...v3-PLAN.md:265` shows semantic-layer non-adoption was a **conscious deferral** ("optional later cleanup, not a blocker; P5 gate deliberately not taken"), not an oversight — Postel byte-identity (FF-RAW-CODE-IDENTICAL) means raw codes work today and metric-ids slot in later without breakage. So this is *deferred adoption*, not *broken adoption*. The real risk is not "it's wrong" but "the seam was never pressure-tested by a real second caller, so we don't yet know if it's right." **The antidote is one cross-cutting fitness invariant** (proposed independently by ENG-10, CON-14, CON-19, ARCH-INNOV-03): ***no registered/authorable capability without a runtime consumer or an explicit, shrinking deferred-list.*** Make adoption debt a CI-visible, shrinking number, exactly as the coverage gate already does for authoring surfaces. → **P1** (register a real MetricDef slice + the meta-fitness).

### [X-3] i18n — LocaleString half-adopted at the boundary (Law-4 latent, drifting)
**Convergence:** CON-14 (~20 node files single-locale PropSchema labels, mixed ka/en) + CON-15 (PerspectiveOption.label resolves at parse not render) + RX-20 (no RTL/ICU) + ENG-11 (LocaleString positive-tagging at codelist join — the *good* reference pattern that proves the standard is reachable).
**Finding:** `PropField.label` is typed `LocaleString` so the *authoring UI itself* localizes — but ~20 `*Node.ts` files ship plain single-locale strings (several mixing `'სათაური'` and `'Gap'` in one file), and the perspective toggle resolves its LocaleString *at parse time* while every other carrier resolves *at render*. Invisible today (single-locale runtime), a real defect the moment client-side locale switching or a non-Georgian tenant ships, and **actively drifting** because no fitness gate holds the line. The engine already demonstrates the correct discipline (ENG-11 resolve-at-render + provenance tagging) — the shells just haven't caught up.
**Root cause → fix:** not the labels — the *absence of a fitness function*. One `labelCompleteness.fitness.test.ts` (asserting every shipped label is a complete LocaleString over active locales) goes RED on current files, then migrate to green. Same shrinking-list pattern as the coverage gate. → **P1** (cheap, drift-stopping).

### [X-4] A11y shell-layer gap — green CI ≠ accessible output (Law-9 integrity)
**Convergence:** RX-22 (zero axe gates on real shells) + RX-21 (perspective-bar keyboard-broken) + RX-23 (no prefers-reduced-motion) + RX-11 (anchor-nav focus/motion unverified) + RX-24 (engine gate covers only stand-in slices) + CON-17/CON-10 (pointer-centric authoring DnD) + RX-08 (no high-contrast tier).
**Finding:** The engine a11y discovery gate (RX-24) is excellent — but it walks the *test's* stand-in registry, not the real plugin shells (Law 3 prevents the engine importing them). The shells users actually see (chart, kpi, table, filter-bar, **perspective-bar on every multi-perspective page**, map, gauge, hero) have **zero axe coverage**, the most-used control is missing roving-tabindex + arrow keys (a blanket WCAG 2.1.1 Level-A failure), and nothing honors reduced-motion. axe cannot detect missing keyboard handlers — so this passes any axe gate while failing keyboard users. For a Law-9 / public-sector-legal platform this is the single largest *integrity* gap.
**Fix:** clone the RX-24 discovery pattern into `packages/plugins` (where importing real shells IS allowed) + co-located interaction tests for keyboard shells + a global reduced-motion baseline. → **P1.**

### [X-5] Operational / security floor — the edge "green" hides (production-readiness)
**Convergence:** API-11 (no rate-limit anywhere) + API-10 (no metrics/traces/request-id) + API-16 (no OpenAPI) + API-13 (no real pagination) + API-08 (datasource secret leak to anon boot) + API-09 (in-memory snapshot dies on deploy) + API-03 (in-memory audit, non-durable governance trail) + DB-11/DB-12 (unbounded revision-log + bronze-blob growth) + ARCH-02 (telemetry port, no adapter) + ARCH-06 (no CSP nonce / sanitizer / SBOM).
**Finding:** The *core* data/governance tier is reference-grade; the gaps cluster at the operational edge. The login is brute-forceable (no rate-limit), a 25MB synchronous upload is a DoS vector (no bulkhead), you cannot stitch one request across the async pipeline (no request-id), a minted embed URL dies on the next deploy (in-memory store), the regulated approval trail is a ring buffer lost on restart (in-memory audit), and two tables grow forever with no retention. Several of these are "the port exists — swap the adapter" (audit, snapshot, telemetry), i.e. cheap. → **P1** (rate-limit + request-id + durable audit/snapshot are the launch-blockers).

### [X-6] Genuine correctness defects — separate these from "missing features"
**Convergence:** ENG-10 + API-02 + RX-16 (+ RX-06, API-08 as latent). These are not absent features — they are *authored≠wired*, *data-loss*, and *duplicate-implementation* defects.
| Defect | Class | Why it's a bug, not a gap | Card |
|---|---|---|---|
| Perspective `scope.metric` is authorable, persists, validates, round-trips — **and does nothing at runtime** | authored≠wired | Worst failure mode for a config-as-SSOT platform: looks authored, isn't. *Verified.* | ENG-10 |
| Ingest worker dies mid-`parsing` → row stranded (not `received`, boot-drain won't re-claim) | data-loss / stuck | A crash silently orphans a submission; needs `claimed_at` + reclaim sweep | API-02 |
| Two map node types for one concept (geograph real, panels/map stub) | dup-implementation | Law-6 violation; author can't tell which to use; dead colorScale code | RX-16 |
| JSON-snapshot target re-implements truncation the DOM path doesn't | divergence | Same config → DOM and JSON snapshot can disagree on rows | RX-06 |
| Datasource `config` JSONB (incl. future `auth.token`) served to anon boot client | latent sec | No server-side redaction; contract permits secret leak | API-08 |

These lead the priority board because correctness precedes features.

---

## 3. UNIFIED PRIORITY BOARD — every non-DONE item, de-duplicated, prioritized

Class: **M**=Class-M API/data (architect-gated) · **G**=cross-cutting/fitness asset. Door: 1-way=hard to reverse. MT?=blocked-on-multi-tenancy-decision [X-1].

### P0 — strategic fork + correctness (do/decide before stacking features)
| id | Title | Domain | Status | Class | Eff | Door | MT? | Why now |
|---|---|---|---|---|---|---|---|---|
| X-1 / ARCH-01·DB-16 | **DECIDE multi-tenancy model** (ADR: per-deploy vs SaaS) | arch+db | ⛔ | M | S(decide) | 1-way | — | One-way door gating a whole tier; **USER decision** |
| X-6 / ENG-10 | Wire `scope.metric` OR unregister it (+ "no authoring without runtime" fitness) | engine | 🟡 defect | M | M | 2-way | — | Silent declarative no-op — corrodes config-as-SSOT trust |
| X-6 / API-02 | Ingest `parsing`-reclaim crash-recovery (`claimed_at` + sweep) | api | 🟡 defect | G(migration) | S | 2-way | — | Worker crash silently orphans a submission |
| X-6 / RX-16 | Consolidate two map nodes → one node, Leaflet/SVG as variants | react | 🟡 defect | M | L | 1-way | — | Law-6 dup; **escalate architect** (node-API) |

### P1 — operational/security/a11y floor + adoption + cheap fitness (own these next)
| id | Title | Domain | Class | Eff | Door | MT? | Why now |
|---|---|---|---|---|---|---|---|
| API-16 | OpenAPI from the Zod SSOT | api | M→G | M | 2-way | — | Unlocks clients + contract tests + docs, near-free |
| API-11 | Rate-limit + ingest bulkhead (+429 problem kind) | api | M | S | 2-way | — | Login brute-forceable; upload = DoS vector |
| API-10 / ARCH-02 | request-id hook + `/metrics` + wire telemetry adapter (dogfood) | api+arch | M | M | 2-way | — | Cannot debug or SLO without it |
| API-08 | Server-side datasource secret redaction | api | M | S | 2-way | — | Latent credential leak to anon boot client |
| API-09 / API-03 | pg-backed Snapshot + durable Audit (swap adapter, port exists) | api | G | M | 2-way | — | Embed dies on deploy; governance trail lost on restart |
| RX-26 | Code-split ApexCharts/Leaflet (scaffolding exists) | react | M | S | 2-way | — | ~650KB off every KPI/table page — best ROI in render |
| RX-22 | Plugin-shell axe discovery gate (clone RX-24 into plugins) | react | M | L | 1-way | — | Real shells untested for a11y (Law-9) |
| RX-21 | Perspective-bar full APG keyboard + interaction test | react | M | S | 2-way | — | Blanket WCAG 2.1.1 fail on most-used control |
| RX-23 | Global `prefers-reduced-motion` baseline + Apex/scroll | react | G | S | 2-way | — | Vestibular harm; trivial now, costly later |
| RX-11 | Anchor-nav focus-move + reduced-motion | react | M | M | 2-way | — | Long publication pages fail a11y audit |
| RX-02 / RX-06 | Memoize AsyncRows + `useWarmOnce`; renderPageToJSONAsync + truncation parity | react | M | M | 2-way | — | Async waterfalls; DOM/JSON divergence (X-6) |
| CON-14 | `labelCompleteness` fitness + migrate ~20 node files (X-3) | constructor | G | M | 2-way | — | Stops i18n drift; shrinking-list pattern |
| CON-19 | No-raw-JSON field-level safety gate + sub-editors | constructor | G | M | 2-way | — | §12 citizen-safety promise unenforced at field level |
| CON-18 | Stored-config migration runner (identity at v1) | constructor | G | M | **1-way** | — | Must exist before first breaking schema change |
| ENG-05 / N26 | Register a real MetricDef slice (5–10, unit+methodology) + adoption fitness (X-2) | engine | M | M | 1-way-ish | — | Pressure-test the semantic seam with a real caller |
| ARCH-INNOV-03 | Coverage-complete Constructor fitness (hardens existing) | arch | G | S | 2-way | — | Cheap CI theorem: builder can't drift from renderer |
| ARCH-INNOV-02 | Pixel-to-observation lineage (thread token + trace endpoint) | arch | M | M | 2-way | rides | Gov-statistics audit obligation |
| ARCH-03 | Config publish FSM + diff + lineage trace | arch | M | L | design-now | **yes** | Publishing obligation; rides X-1 |
| ARCH-06 | Escaping fitness over 3 injection surfaces + CSP nonce + SBOM | arch | M | M | 2-way | — | Government attack surface |
| CON-15 | PerspectiveOption.label resolve-at-render (X-3) | constructor | G | S | 2-way | — | i18n timing uniformity |
| RX-14 | Sankey interpreter + adapter | react | M | L | 2-way | — | Core national-accounts viz (supply-use flows) |

### P2 — structural depth, scale, escalations
| id | Title | Domain | Why |
|---|---|---|---|
| ENG-02/07/08 | Grain/store-port frontier — `valAt` point-read, blend B2 cross-grain, `granularity` rollup (**escalate architect**) | engine | One root unblocks 3 stalled items; Class-M data-layer design |
| ENG-06 | Metric→store routing end-to-end (after ENG-05) | engine | Exercise `dataSource` with a 2nd store |
| ENG-13 | Verify topoSort rejects cyclic `$ctx` defaults | engine | Potential infinite-loop, unverified |
| DB-17 | TimescaleDB tuning (segmentby, chunk interval) + continuous aggregates | db | ~1-line changes, large effect; highest ratio-to-effort in DB |
| DB-11/12 | Retention policy on `observation_revision` + bronze blobs | db | Unbounded growth; storage-driven |
| DB-08 | AgencyScheme SSOT (pairs with X-1) | db | Tenancy prerequisite | 
| DB-02 | Close concept_role expand-contract (schedule the contract migration) | db | Parallel-change window left open = Lehman rot |
| DB-05/01/15 | Shared DSD (when 2nd caller real) · SDMX serialize · CI-execute rollbacks | db | YAGNI/trigger-gated |
| RX-08/09/13/15/18/25 | HC tier+primitive audit · variant validation · chart-color tokens · in-place update · CQ fallback · chip-select | react | Polish + correctness hardening |
| RX-05 | Multi-axis perspective warm (single-key fallback breaks at 2 axes) | react | Needed for X-1 lattice / INNOV-01 |
| CON-01/02/03/05/07/10/12/13 | Semantic-depth coverage · control-coverage fitness · explain-don't-hide · device preview+error boundary · expr assist · keyboard DnD · generation breadth · reorder signpost | constructor | The "citizen-grade UX" epic (CON-17) |
| API-04/13 | First sdmx-csv→sdmx-json serializer (trigger-gated) · keyset pagination | api | Strategic SDMX unlock; reserve until federation trigger |
| ARCH-05 | Perf benchmark harness + cell-count budget | arch | The missing gate that can *open* N13/N25/N30 |
| ENG-NEW | Static spec-typing (DataSpec→output FieldSchema) | engine | See INNOV §4 |

### P3 — hygiene, docs, trigger-gated
ENG-16 (remove dead `custom` — single extension path) · ENG-01 (`_specTag`→registry hook) · ENG-03/04/11/12/14/17 (op-executability fitness · ref docs · missing-codelist diagnostic · async-options doc · streaming doc · PDF export) · RX-03/04/07/10/17 (NodeView warn · lazy-slot test · requirement-registry at 3rd surface · nested-nav test · worker.js verify) · CON-06/08/09/11/16 (cascade-authoring · methodology publish-gate · nested-tree UX · inline slash · catalog browse) · DB-03/07/13 (locale-generic index · metadata partial-unique · UNIT_MULT) · API-05/07/12/15/17 (format-in-ETag · dereferenceable type URIs · Idempotency-Key · domain-code catalogue · provisioning CI assert) · **ARCH-04 plugin SDK** (design contract only, gated) · **ARCH-07 collaboration** (gated behind ARCH-03).

---

## 4. INNOVATION THESIS — six net-new proposals, ranked

Each rides a **shipped seam**, so the cost is *assembly, not invention*. Ranked by leverage × cheapness-for-us × consumer-reality.

| Rank | Proposal | Insight | Shipped seam (why cheap for us) | Why no incumbent has it | YAGNI verdict |
|---|---|---|---|---|---|
| **1 (CROWN)** | **Perspective Lattice** (ARCH-INNOV-01) | N orthogonal axes (perspective×vintage×scenario×grain) → 2^N reader views, duplication-free, permalink-addressable | `ctx.perspectiveState: Record<param,string>` Harel container + permalink-from-registry already shipped (`f316001`); a 2nd axis = one `registerPerspectiveAxis` call | Grafana privileges time; PowerBI bookmarks freeze snapshots; Tableau params lack orthogonality guarantee; Looker has none | **BUILD-NEXT — but bound to a real consumer.** Register *vintage* (preliminary/revised, V25 already models it) as axis #2. ⚠️ overseer caveat: a 2nd axis with no real toggle consumer is itself X-2 adoption-debt. Build it *with* the vintage UI, not as speculative machinery |
| 2 | **Pixel-to-observation lineage** (ARCH-INNOV-02) | Every figure carries pixel→DataRow→step→query→SDMX-obs→submission→workbook | Declarative end-to-end pipeline threads `ctx` everywhere; `provenance.ts` + V32 hold source end | BI data layer is opaque SQL — cannot trace below the query | **BUILD (P1).** Gov-statistics obligation; pairs with ARCH-03 governance |
| 3 | **Coverage-complete Constructor** (ARCH-INNOV-03) | CI theorem: everything renderable is authorable — builder can *never* drift | `describeApp()` + round-trip fitness + PropSchema-per-slice already exist | Builder.io/Retool/Grafana all have escape-to-code; none guarantees coverage | **BUILD (P1, cheapest).** Hardens existing fitness; the meta-fitness for X-2 |
| 4 | **Bitemporal revision-triangle serve** (API net-new + DB-21) | `?asOf=D2&vsAsOf=D1` → per-series `{value@D1,value@D2,delta,revisedBy,reason}` with PROV; SDMX-CSV vintage views | Pre-image log (V25/V8), release anchors, immutable ETags, as-of SQL builder all exist — pure projection | Cube/Grafana/Looker do no bitemporal; even .Stat exposes it clumsily | **GATED** on first external citation/audit need AND DB-11 retention + DB-08 agency first (else fast path to a slow query). 2-yr capstone |
| 5 | **Static spec-typing** (ENG net-new) | Infer a DataSpec+pipe's output FieldSchema pre-execution → author-time encoding validation, role-aware pickers, blend-grain catch | `extractRequirements` static-pass + per-op PropSchema registry already exist; add a pure type-transfer fn per op | No no-code builder types a transform pipeline's output pre-execution (Malloy/dbt do it in code, for engineers) | **BUILD-NEXT-TIER (P2).** Constructor-only, additive, inert-when-absent. Reuses infra; start 6 ops + the encoding picker |
| 6 | **Neutral-output a11y twin** (RX net-new) | Each visual node emits a structured accessible projection from the same neutral interpretation that draws the pixels | Neutral `ChartOutput` (RX-12) + `renderPageToJSON` walker already structured; MapShell already does it ad-hoc | Grafana/Tableau/PowerBI bolt on a11y per-component; none derives the twin from one neutral source | **BUILD after RX-22 floor (P2).** Optional registry hook; charts fall back to existing table. Turns X-4 from remediation into architecture |

**Crown rationale (skeptical):** The Perspective Lattice is the most *defensible* because it (a) rides a seam shipped *this week*, (b) promotes a refactor the team already paid for from "removed a privileged mode" to "invented a view algebra no BI tool has," and (c) has a **genuine domain consumer** — national accounts *is* the revision/vintage domain, so axis #2 is not speculative. The single discipline that keeps it from becoming another X-2 cathedral: **ship it with a real vintage toggle, measured by `FF-AXES-ORTHOGONAL`, not as a second empty door.** Runner-up #3 (coverage-complete) is cheaper still and is the meta-fitness that disciplines the whole adoption-debt theme — do both; they compose.

---

## 5. RECOMMENDED SEQUENCE — principled order of attack

Principles enforced: **correctness before features · the one-way door is DECIDED (not necessarily built) first · two-way doors before one-way · never lower the existing quality bar — raise it (every step ships its fitness function).**

**Gate 0 — the decision (USER, this week).** Write the **multi-tenancy ADR** (X-1): single-tenant-per-deploy vs multi-tenant-SaaS, trade-off named (operational cost vs isolation blast-radius). *Nothing below that is marked MT? proceeds until this is decided.* Everything else in Gate 0 is correctness the **team owns** without waiting: wire-or-unregister `scope.metric` (ENG-10), the ingest reclaim sweep (API-02), and the datasource secret redaction (API-08, cheap insurance). Escalate the map-node consolidation (RX-16) to architect for a node-API call.

**Gate 1 — the floor, in parallel (team-owned, two-way doors).** The operational/security/a11y floor (X-4, X-5) and the cheap drift-stopping fitness gates (X-2, X-3):
- Security/ops: API-11 rate-limit+bulkhead → API-10 request-id+metrics → API-08 redaction → swap API-09/API-03 to durable adapters.
- A11y: clone RX-24 into plugins (RX-22) → perspective-bar keyboard (RX-21) → reduced-motion baseline (RX-23) → anchor-nav (RX-11).
- Render perf: RX-26 code-split (highest ROI).
- Fitness gates (each goes RED then green-by-migration): `labelCompleteness` (CON-14/X-3) · no-raw-JSON field gate (CON-19) · coverage-complete (INNOV-3) · "no authoring without runtime" (ENG-10/X-2).
- Contract: API-16 OpenAPI (unlocks contract tests for everything after).

**Gate 2 — adoption + the crown (team-owned, prove the seams).** Register a real MetricDef slice (ENG-05) — pressure-tests the semantic seam and feeds provenance. Then the **Perspective Lattice** (INNOV-1): register *vintage* as axis #2 *with its real toggle UI*, guarded by `FF-AXES-ORTHOGONAL`. Pixel-to-observation lineage (INNOV-2) + governance FSM (ARCH-03) land together as the trust layer. CON-18 migration runner before any breaking schema change.

**Gate 3 — depth & scale (escalations + measured gates).** Architect-gated: the grain/store-port frontier (ENG-02/07/08), DSD versioning (DB-05), AgencyScheme (DB-08, if SaaS). Measured: DB-17 TimescaleDB tuning + the ARCH-05 perf harness that can finally *open* N13/N25/N30. Static spec-typing (INNOV-5) and the a11y twin (INNOV-6) as additive Constructor/render wins. The citizen-grade UX epic (CON-17).

**Gate 4 — trigger-gated (do not build blind).** SDMX serializers (API-04) on a federation trigger; bitemporal revision-triangle (INNOV-4) after retention+agency exist; plugin SDK (ARCH-04, design the contract early, build the machinery on real demand); collaboration (ARCH-07) after governance; PDF bulletin (INNOV/N27) on a real publishing need.

**USER-decision items (cannot be team-owned):** (1) multi-tenancy model [X-1] — gates the tier; (2) does the agency publish PDF bulletins? [INNOV/N27]; (3) is external SDMX federation real? [API-04]; (4) is there an external citation/audit consumer? [INNOV-4]. Everything else the team can drive on reversible, fitness-gated steps.

> **The one-line state of the platform:** the roadmap budget bought *neutrality* — every seam (NodeDef, ChartOutput, DataStore, DataRow, perspectiveState) knows nothing of React, transport, view, or privileged dimension. The next era is not closing gaps; it is finishing three commitments — **decide tenancy, give the cathedrals a congregation, and raise the floor to the ceiling the architecture already reached** — and then exploiting that neutrality in the two directions no incumbent combines: a composable view algebra and pixel-to-source lineage. Both spines are already shipped. That is the work.
