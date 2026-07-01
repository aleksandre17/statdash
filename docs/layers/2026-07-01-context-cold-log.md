# Cold session log — rotated out of `.claude/session/context.md` on 2026-07-01

> Rotation (kit `05` context protocol / `/rotate`): the hot resume head stays in `.claude/session/context.md`;
> this file holds the older/landed layers (06-27 → 07-01) verbatim. Read on demand only. Nothing was deleted.

---

# ════════════════ (older log below) ════════════════

# Session context — CRASH-RECOVERY + OVERNIGHT (2026-06-27 night)

> If the editor closes again: read THIS file first. Everything below is recoverable from git + agent-memory.

## What happened
User accidentally closed the editor mid-session. NOTHING was lost — the whole day's plan
is committed + pushed.

## Today's plan = DONE ✅ (the "perspective-axis" refactor)
`mode` (privileged year/range) → generic declarative `perspective = f(state)` axis.
- 13 commits `99dcb12` (vision) → `f316001` (final polish) + `e01bcbd` (check-laws twin sync).
- Branch `feat/tenant-agnostic-platform`, HEAD pushed to origin (0/0). Suite 1779 green.
- Retired ALL System A; added perspective-bar node, KpiSpec.when, permalink-from-registry,
  Constructor "Perspectives" pane. Phase records: agent-memory/engine-specialist/MEMORY.md (P0..P7).
- The ONE loose end (check-laws Law-4 twin) is now committed (`e01bcbd`).

## Overnight mission (user asked: complete + perfect to best-in-class, parallel Opus, no quality drop)
A refactor isn't "done" until validated on the real stack (user's standing rule).
- **Wave 1 (running):** chief-engineer = deep quality audit of the batch → `work/REVIEW-perspective-batch.md`.
  project-manager = roadmap reconstruction → `work/ROADMAP-next.md` (morning decision menu).
- **Green gate:** running in background (build/typecheck/lint/test/check-laws); logs in /tmp/gate-*.log.
- **Wave 2 (after green + Wave 1 reports):** real-browser visual validation of perspective behavior
  (toggle / KPI-when / filter-visibility / permalink / Constructor pane) across GDP+Accounts+Regional
  in ka+en; fix any audit findings at root; advance the top SAFE-TO-START roadmap item.
- **Server note:** deploy builds from `main`; feat branch is NOT on main. Validate on an isolated
  staging twin, NOT the live :3002 demo, until proven. See agent-memory/orchestrator/project_server_deploy_build_context.md.

## Wave results so far (2026-06-27 night)
- **Green gate: PASS** — build/typecheck/lint/check-laws/test all exit 0, 1779 pass (empirically verified).
- **Roadmap (project-manager → work/ROADMAP-next.md):** planned roadmap is essentially ALL SHIPPED;
  no large designed+direction-free initiative remains. Honest night = canon-hardening, not new scope.
  PM's "#1 delete ScopeOverride.compare" was STALE — compare already deleted in P6; only clean generic
  `ScopeOverride.dimOverride` remains (fully wired in renderNode:268, NOT a liability). Verified in code.
- **Audit (chief-engineer → work/REVIEW-perspective-batch.md): SHIP-READY, HIGH 0 / MED 2 / LOW 5.**
  - MED-1: orphaned `effects`/`applyEffects` — zero non-test callers, silent no-op footgun → DELETE wholesale + fitness guard. (engine-specialist; AFTER validation finishes — avoid render-path interleave)
  - MED-2: `ManifestMode`/`SiteManifestContract.modes` survive (contracts+api/bootstrap+App.tsx:40+DB site_config.modes). One-way DB door → DESIGN tonight (architect, running), EXECUTE only on user greenlight.
  - LOW: 2 hardcoded 'mode' literals (SiteRenderer:99, FiltersContext:20) [Law-1]; kpiVisible when-ctx (dims vs filterParams) SSOT; perspective-bar partial ARIA-tabs (a11y door, parity); ka-only authoring labels (setupCanvasRegistry:45, meta.ts:8) [Law-4]. → fold into engine/frontend cleanup wave.

## Validation result: ✅ PASS (plugins-specialist → work/VALIDATE-perspective-render.md)
jsdom full-render harness (Docker/DB unavailable here): toggle/KPI-when/visibleWhen/permalink/Constructor-preview
all correct, 12/12 combos × 3 pages × 2 locales, real DOM read. Added durable fitness test
(apps/geostat/src/data/perspective-render-validation.test.tsx). Caveat: data VALUES not re-verified
(no seeded stack) — but refactor doesn't change values. Close value-loop via stg-render-probe.js on seeded stack.

## MED-2 design DONE (architect → work/PLAN-perspectiveKinds-migration.md): verdict = DELETE-THE-ISLAND (not rename)
manifest.modes is write-with-no-read (dead pipe). S1–S6 = code+artifact deletes (TWO-WAY, do overnight).
S7 = Flyway V35 `DELETE … key='modes'` (ONE-WAY DB door → USER GREENLIGHT; must ship S6+S7+api same release).

## IN FLIGHT (editing — do NOT launch same-file work concurrently)
- engine-specialist (a716...): MED-1 effects delete + LOW 'mode' literals (SiteRenderer:99/FiltersContext:20) + kpiVisible SSOT.
- senior-frontend (a584...): ka-only authoring labels → bilingual (plugins meta.ts + panel setupCanvasRegistry).

## Queued (STRICT ORDER — avoid SiteRenderer/App.tsx collision)
1. After engine + i18n agents return → FULL green-gate → commit (logical chunks).
2. THEN launch MED-2 S1–S6 execution (senior-backend): delete ManifestMode/site modes pipe + create V35 file (DO NOT apply). green-gate + commit.
3. MED-2 S7 (DB delete) + deploy: HOLD for user greenlight.
4. Morning menu: a11y tabs door · semantic-layer adoption (#2, needs direction) · value-loop on seeded stack ·
   SYSTEMIC i18n: ~20 node *Node.ts PropSchema labels are single-locale (Law-4 latent, pre-existing, NOT caught by
   check-laws which scans only packages/core/src) → platform-wide normalization + extend check-laws scope (architect call).

## COMMITTED + PUSHED (HEAD f610fc0, origin sync 0/0) — night work safe on remote
- e01bcbd check-laws twin · 4ccd042 engine canon-hardening (effects delete + mode-SSOT + kpiVisible)
- d934d76 i18n bilingual labels · 7c23350 render-validation fitness test · f610fc0 docs (REVIEW/VALIDATE/ROADMAP/PLAN)
- Combined gate GREEN incl panel-tsc: build/geostat-tsc/panel-tsc/lint/check-laws all 0, 1799 tests pass.
- Parallel-interleave defect caught + fixed: i18n put LocaleString into string-typed PerspectiveOption.label
  → panel-tsc TS2322 → reverted setupCanvasRegistry labels to plain strings (junior). PerspectiveOption.label
  localization (LocaleString end-to-end) = deferred architect decision (morning).

## NIGHT COMPLETE ✅ — HEAD 6f5cf43, origin sync 0/0, all 7 commits pushed
- MED-2 S1–S6 DONE + committed (1b95ba8): last System-A island retired, "grep-clean ALL System A" now literal.
  V35__drop_site_config_modes.sql committed but UNAPPLIED (greenlight = merge-to-main + deploy; ship w/ 1b95ba8).
- OVERNIGHT-6.md written (6f5cf43) = the morning report. Gate re-verified GREEN incl panel-tsc, 1799 tests.
- No further safe/direction-free work remains; rest = morning-menu greenlight/direction items. Did NOT manufacture scope.

## MORNING MENU (for the user)
1. MED-2 S7: apply V35 (one-way DB door) + deploy S6+S7+api same release → makes "grep-clean ALL System A" literal.
2. PerspectiveOption.label i18n architecture: LocaleString-at-render vs resolved-string-at-boundary (panel palette ka-only).
3. SYSTEMIC i18n: ~20 node *Node.ts PropSchema labels single-locale (Law-4 latent) + extend check-laws scope. Architect call.
4. perspective-bar a11y: partial ARIA-tabs pattern (parity-carried, not regression) → full WCAG tabs. Own validation.
5. Value-loop: re-verify data VALUES (104598/CAGR 10.6%…) on a seeded stack (stg-render-probe.js) — needs Docker/DB.
6. semantic-layer adoption (#2 roadmap) — needs a direction/content call (which measures, units/provenance).

## SERVER STATE (probed via ops/config/ssh/config → geostat-deploy 192.168.1.199, read-only)
- Live stack RUNNING + healthy: statdash-geostat :3002, statdash-panel :3003, statdash-api (internal 3001), statdash-postgres.
- Build clone /tmp/statdash-build = branch `main` reset to `f316001` (perspective final) → **refactor is LIVE**, built ~2h ago.
- origin/main = 8a05420 (32 commits BEHIND feat; perspective work is NOT on origin/main — server main was hard-reset to feat HEAD).
- feat HEAD 6f5cf43 is a CLEAN DESCENDANT of origin/main (fast-forward possible). My 7 overnight hardening commits NOT deployed.
- Value-loop CLOSED at data level: live /api/stats serves real 3 datasets (GDP_ANNUAL 4-dim, ACCOUNTS_SEQUENCE, REGIONAL_GVA),
  real obs (geo:GE, approach:PROD/INC, obs_status:P preliminary, contribution_role) + bilingual labels. Exact rendered KPI
  pixel-values still need a browser (server has a chromium container; not yet driven).
- ssh key copied to /tmp/sd_key (chmod 600) for probes.

## DEPLOY DECISION (needs user greenlight — one-way door + release call)
Deploying the hardening = FF origin/main to 6f5cf43 (or fetch feat on server) + rebuild + V35 applies (one-way DB delete,
LOW blast radius). NO user-facing change (refactor already live). LOW urgency. Do WITH pg_dump backup safeguard ON greenlight.

## BIG OP IN FLIGHT — COMPLETE BOARD (user mandate: deep file-by-file analysis of ALL docs/work + complete remaining-work board)
Corpus mapped: docs/ (105 active .md: architecture/{subsystems×24, examples, future×11, decisions×7, packages}, plan/{ARCHITECTURE-TARGET,
IMPLEMENTATION-ROADMAP, roadmap-phase-0..10, SYSTEM-PIPELINE-TREE}, knowledge/), work/, platform/docs/plan/{N34, PLATFORM-GAP-ANALYSIS,
JSON-TARGET-GAPS}, platform/work/ (perspective corpus=DONE), memory/. Much of docs/ is LEGACY — board must verify doc-vs-CODE.

6 parallel senior Opus agents, each → work/board/0N-*.md with shared card schema (Status ✅/🟡/⛔/🆕/🗑️, file:line evidence,
critical analysis, REFERENCE-PLATFORM parallels, foresight, CONCRETE plan, raises-the-bar):
- a2a68 engine-specialist → 01-engine.md   · a6e52 react-specialist → 02-react.md   · ad0da platform-architect → 03-constructor.md
- a07a4 senior-backend → 04-backend.md      · a4e27 database-architect → 05-database.md · ae486 architect → 06-architecture-vision.md (synthesis spine + roadmap reconciliation ledger + GAP layer + INNOVATION THESIS)

ALL 6 DOMAIN BOARDS DONE (work/board/01..06). chief-engineer (a2751) SYNTHESIZING → work/MASTER-BOARD.md.

### Domain board headlines (verified vs code):
- 01 engine: 8✅/8🟡/1🆕. BUG ENG-10 metric scope-key authorable-but-NOT-wired (authored≠wired). Semantic-layer 0 registered MetricDefs. custom-spec dead. Net-new: static spec-typing.
- 02 react: 14✅/7🟡/3⛔/1🆕. A11y shell-layer UNVERIFIED (perspective-bar keyboard-broken tabs, 0 shell axe gates, no reduced-motion). No code-split (~650KB viz). 2 competing map nodes (Law-6). Sankey/scatter/heatmap missing. Net-new: neutral-output a11y twin.
- 03 constructor: 10✅/6🟡/2🆕. Crown jewel: coverage.fitness closure proof (no builder has it). GAPs: i18n labels, NO stored-config migration runner (one-way door!), field-level no-raw-JSON, citizen UX. Net-new: capability-diff authoring trace.
- 04 backend: 9✅/7🟡/1⛔/2🆕. WINS: as-of bitemporal vintage (beats all refs), ingestion FSM, Problem Details, ETag. GAPs: rate-limiting ZERO, no OpenAPI, observability logs-only, pagination limit-only, in-mem audit/snapshot. BUG: ingest crash-recovery reclaim hole. Net-new: revision-triangle delta endpoint.
- 05 database: 12✅/5🟡/2⛔/1🆕. WINS: Law-1 dim_key cube, deep SDMX model, expand-contract craft. DB-16 multi-tenant ABSENT (P1). DB-08 AgencyScheme stored nowhere. DB-17 TimescaleDB mis-tuned (quick win). Unbounded revision/blob growth. Net-new: as-published SDMX-CSV serializer.
- 06 arch/vision: ~46✅/~18🟡/~14⛔/7🗑️. P0 FORK: tenant-agnostic ≠ multi-tenant (NO tenant_id in 35 migrations; SaaS-vs-per-deploy one-way door gating everything). Innovation: Perspective Lattice (N-axis 2^N views, build-next), pixel-to-observation lineage.

### CROSS-CUTTING CONVERGENCE (multiple boards agree):
1. Multi-tenancy P0 one-way fork (ARCH+DB) — decide BEFORE stacking features. 2. Adoption-debt "cathedrals w/o congregations" (ENG+ARCH).
3. i18n LocaleString-at-boundary (ENG+CON+RX). 4. A11y shell-layer (RX+CON). 5. Operational/security floor (API+DB). 6. Real bugs (ENG-10, API reclaim, RX-16).

NEXT: present MASTER-BOARD + my strategic framing; surface multi-tenancy P0 fork as the gating user decision. Then card-ify on confirmation.
User wants to be AMAZED by genuine independent thinking + net-new reference-beating capabilities. Raise standards, never lower.

## OPEN USER DECISIONS (from prior turn, still pending)
- MED-2 keep-the-delete vs revert-to-rename/door (wire-contract; tenant-agnostic first-tenant-erosion check). My rec: delete is clean.
- Deploy hardening + V35: my principled rec = DO NOT deploy tonight (zero user benefit, irreversible V35, 32-commit main FF = release call).
- Real-browser pixel validation still NOT done (jsdom + live-API only); server has chromium — value-loop not closed to the user's screenshot standard.

## ★ AUTONOMOUS NIGHT MANDATE (user left 2026-06-28, "don't stop, don't ask, finish everything, maximal adoption, highest level, no quality drop, be principled")
DECISIONS I OWN (bold, vision-led, Law 7 architecture-serves-vision):
- Tenancy = TRUE MULTI-TENANT PLATFORM (architect ADR ad0087 designing the generic seam). Build reversible Strangler phases on the branch; prod-apply = user/deploy only.
- Maximal adoption (feedback_maximal_adoption_doctrine): every built capability fully wired every layer + real consumer + fitness. Nothing half-built/unused.
SAFETY ENVELOPE (still principled): all work on feat branch (git-reversible); FULL green-gate incl panel-tsc before EVERY commit; one-way DB migrations = staged files only (apply on deploy, not by me); principled refusal still active (reject any quality-degrading shortcut); disjoint-area parallelism only (interleave lesson); root-cause not patch.

### EXECUTION WAVES (gate+commit between each; I run authoritative combined gate, agents self-verify):
- E1 (LAUNCHED): senior-backend → API floor+correctness epic (rate-limit/bulkhead, request-id+metrics, secret-redaction, pg snapshot+audit, ingest-reclaim migration, OpenAPI). ∥ engine-specialist → engine ADOPTION epic (register all MetricDefs 3 pages every-layer + wire scope.metric ENG-10 + remove dead custom-spec + no-authoring-without-runtime fitness). DISJOINT (api vs core+provisioning).
- E2 (next): frontend floor — a11y (plugin axe gates, perspective-bar keyboard, reduced-motion), i18n labelCompleteness fitness+migrate, code-split RX-26, MetricDef picker. ONE coordinated area (plugins/react/panel overlap) — sequence sub-areas.
- E3: RX-16 two-map consolidation (architect node-API call first). multistore/blend real 2-store page. timeDimension primary.
- E4: multi-tenancy Strangler (after ADR) — expand-contract reversible phases, first-tenant byte-identical.
- E5: innovation crown — Perspective Lattice (vintage axis #2 WITH real toggle consumer) + coverage-complete fitness + pixel-to-observation lineage.
- FOLD IN: concept-hunt results (work/scan/*.md, agents a000/a0ec) → adopt the strong ones fully; SKIP incumbent-cruft.
DONE+PUSHED: E1 engine-adoption (d26f772) + api-floor (6613543) + B-a11y/reduced-motion subset (a2e06ee). HEAD a2e06ee, ~1869 tests green. (V36/V37 migrations.)
NOTE: wave-2 hit session-limit (reset 2:10am); A(metric-delivery) left nothing, B(frontend) partial → fixed 1 test-type cast, committed the green a11y/motion subset. Re-dispatched the rest.
DONE+PUSHED through 41a5f9d: A metric-delivery (0c86578) + B2 frontend i18n/value-mappings/axe (41a5f9d). 1900 tests green. Clean base.
WAVE-3 status: a3868 withMetricProvenance DONE (uncommitted, self-green; files=packages/plugins/datasources/{stats-registrations.ts, stats-metric-provenance.fitness.test.ts}; badge chain closed, core untouched).
a39a provisioning-i18n DONE (uncommitted, self-green on its 2 files=provisioning/geostat.provisioning.json + src/provisioning/config-label-completeness.fitness.test.ts; 255 strings→{ka,en}). The typecheck=1/lint=1 it saw are GRAIN's mid-edit (data-spec.ts TS6192, resolvers.ts unused storeValAt/PointSeriesSpec) — NOT i18n's.
ab0a responsive-audit DONE+COMMITTED (5752261, AUDIT-responsive.md; 54 shots untracked on disk).
grain ae671 DONE — G0–G2 byte-identical (valAt port + timeseries→point-series lowering, 516 core tests); G3 ESCALATED (point-series stays internal-not-public-discriminant=correct; ratio-list mis-grouped=different primitive; growth needs new transform-op out of core-scope → G3 redesign deferred). uncommitted, self-green.
REGRESSION found by grain: a39a's {ka,en} provisioning labels crash apps/geostat perspective-render-validation (19 fail, "Objects not valid as React child {ka,en}") — render path doesn't resolve LocaleString. a39a self-verify MISSED it (didn't run geostat render suite). BLOCKING — tree can't go green without the render-fix.
IN FLIGHT: a0ab render-fix (engine-specialist, solo) — resolve LocaleString at resolveTemplate + perspective-parse + all manifest-label render boundaries; geostat render-validation→green + permanent no-raw-LocaleString fitness. ON GREEN → commit grain + provenance + i18n + render-fix as 4 logical commits.

QUEUED — RESPONSIVE FIX wave (phase-2, from AUDIT-responsive.md; all in-system, ZERO magic numbers):
- R1 (P0, WCAG 1.4.10): packages/react ChartDataTable wrap SR-table in .sr-only DIV + harden a11y.css .sr-only with clip-path:inset(50%) + FF scrollWidth≤clientWidth. (root of all phantom horizontal-scroll)
- R2 (P1): packages/plugins app-header.css → min-width:0 + tagline truncate (~1024 clip).
- R3 (P1): wire existing --size-container-wide token into .page-content (styles+plugins page-layout) — fixes ultrawide over-stretch + centered ribbon.
- P2/P3: FilterBar <select> sizing @360-414, polish. Lane=packages/react+styles+plugins → run as its own wave (disjoint from core).
QUEUED — non-responsive defects (from audit): (a) gdp y-axis raw-float "120000.000000000000" → number-format/axis formatter (charts/plugins); (b) gdp ultrawide bottom = empty blue placeholder blocks → investigate (debugger).
QUEUED (render-side i18n catch-up, full-priority): teach the render layer to resolve LocaleString in the 6 spots a39a left bare — data-pipe series (encoding.series/inject), KpiCard.trendValue (trend.value), derive-expr literals, evalVarMap (vars.tmpl), page-header badge {year,range} template, geograph labelOverrides. Touches packages/core (resolveTemplate/evalVarMap/derive) + packages/plugins (KpiCard/GeoMap). Then bilingualize those 6.
+ ab0a responsive-design AUDIT (read-only): real-browser screenshots across 360→2560+ ladder × all pages/shells → platform/work/AUDIT-responsive.md + audit-shots/. Phase-2 = a dedicated responsive FIX wave (design-system fixes: clamp() fluid type/space, container queries, breakpoint tokens — NO magic numbers/static/hardcode) AFTER wave-3 frees the styles/plugins lane.
NEXT (design-ready / queued): RESPONSIVE FIX wave (from AUDIT-responsive.md) · RX-16 map consolidation (DESIGN-map-consolidation.md, plugins lane) · grain G4–G6 (cross-grain blend + GrainRouter + DC-03 pre-agg) · DC-01 calculated metrics (MetricDef=expr over measures, now delivery exists) · DC-02 accounting-identity validation (B1G=Σ publish gate) · EXP-01 dashboard actions (NodeAction union 1→N) · multi-tenancy MT-1+ (bold true-multitenancy) · Perspective Lattice crown (vintage axis #2 + real consumer).
FOUNDATIONAL TOPIC (owner, 2026-06-28, NOT rushed, IRREVERSIBLE — owner decides): MAXIMALLY DECOUPLE time-modes (year/range) without privileging time (Law 1), guided by proven reference concepts (SDMX TIME_PERIOD+FREQ, Vega-Lite timeUnit, Tableau date-part/value, Cube granularities, Harel/XState orthogonal regions). Law 7 hard: existing code adapts to the plan, not vice-versa; no degradation; no less agnosticism. MUST be the COMPLETE VERTICAL — renderer + Constructor/panel authoring + API/provisioning, no tier second-class; competitive (Tableau/PowerBI/Looker/Cube), future-proof, flawless. a10f architect exploration running (read-only → DESIGN-time-mode-decoupling.md); on return CHECK it covers Constructor/panel + API vertical, else commission complement. OWNER DELEGATES THE JUDGMENT (2026-06-28): will NOT answer clarifying Qs — the team OWNS the decision with senior conviction (not a menu), reference-grounded, critical (future + problem lenses, multiple logics). KEY SIGNAL: yesterday's perspective-axis decoupling was NOT ENOUGH — owner wants MORE RADICAL separation; push maximal-decoupling to its limit (time-modes as fully independent orthogonal views/state-regions, or time fully de-privileged) and pick the strongest defensible one. Process: a10f exploration → CRITICAL red-team/synthesis pass (stress from future+problem angles, extend to FULL vertical renderer+Constructor/panel+API) → ONE DECIDED architecture brought to owner for ratify (veto=guardian-check, NOT a menu). Guardian: do not allow under-decoupling or degradation. DO NOT BUILD until decided + owner ratifies the irreversible doors.
ADOPTION-GAP FINDING (verified in geostat.provisioning.json, 2026-06-28): perspective-axis architecture is adopted on ~1 real axis only (time: mode=year/range — 22 when + 22 visibleWhen + 6 timeBinding + 3 bars = good single-axis use), BUT the orthogonal multi-axis LATTICE (the crown) is used at 1 axis. Smoking guns: (a) _geoMode is a genuine 2nd-axis need (single/multi region view) implemented as a computed VAR-HACK instead of a first-class perspective axis — genuine consumer EXISTS (regional page branches on it), so promoting it is NOT speculative; (b) dimOverride = 0 uses (built, zero congregation → use-or-delete). Principled maximal-adoption fix: promote _geoMode (+ other GENUINE domain axes if data warrants, e.g. current-vs-constant prices) to first-class perspective axes → exploit the lattice; resolve dimOverride. FOLD INTO the time-mode/perspective architecture decision (same binding/axis story) — ensure a0006 covers lattice-adoption + dimOverride; else focused perspective-lattice-adoption pass after. Guardrail: adopt axes only WITH a genuine consumer, never speculative.

STANDING BAR (owner reaffirmed): maximal quality on EVERY tier incl panel/Constructor + API — platform-level, competitive-with-reference-platforms, forward-leaning, flawless. (extends [[maximal-adoption-doctrine]].)

WAVE-4 status: DC-01 calc-metrics DONE (uncommitted, self-green; packages/core only: metric.ts, metric-calc.ts+fitness, kpi.ts, index; 526 core tests; real consumer = Labour-share KPI byte-identical). IN FLIGHT: a6a0 responsive-fix (react/styles/plugins — owns ChartDataTable + reflow.fitness, the typecheck red DC-01 saw) · a36d DC-02 identity-validation (api/db). WAIT both → converged gate → commit DC-01 + responsive + DC-02.
QUEUED: CALC-METRIC DELIVERY (mirror metric-delivery): ManifestMetric.calc (contracts) + registerManifestMetrics refinement (geostat) + provisioning calc entry + KPI share→metric swap. Capability+consumer fitness-proven; only plumbing deferred.
time-mode decision RATIFIED by owner (2026-06-28): "I want best/strongest concepts AND use everything we create, the maximum" = ratifies orthogonal-axis law + selection discriminant + grain DEFERRED (deferring unused grain IS "use everything"; D-GRAIN opens the instant sub-annual data exists) + _geoMode→1st-class axis + dimOverride resolved. Build = DESIGN-time-mode-decision.md Strangler phases, PHASE-BY-PHASE (each green, live byte-identical, separate commit, owner-confirmed per phase — foundational/irreversible, do NOT rush). Touches core+panel+api+plugins → CANNOT start until responsive (a6a0) + DC-02 (a36d) commit (lane collision). START after lane-clearance.

PARALLELISM RULE (reaffirmed): only disjoint areas concurrently; DB-migration agents never concurrent (V-number collision); design/analysis always safe.

HEAD now 0e51ad0 (+ 2 design docs committed). a1c4 architect DONE → designs build-ready:
- DESIGN-map-consolidation.md (RX-16): survivor=geograph + fold map-panel choropleth/SVG-variant/topologyRegistry; 5 phases M0-M4; FRONTEND/plugins lane → run AFTER B2.
- DESIGN-grain-store-port.md: add valAt(at/grain/rollup) to DataStore port; unblocks ENG-02/07/08+blend-B2+granularity+DC-03; 7 phases G0-G6; G0 touches core/store.ts → run AFTER metric-delivery (A) frees core/api.

QUEUED (user-flagged 2026-06-28): PROVISIONING-I18N SWEEP — geostat.provisioning.json has ~130+ user-facing ka-only strings (Law-4 gap; titles/KPI labels/"დიაგრამა"/"ცხრილი"/"მლნ ₾"/section labels). Column-key labels ("time","accountLabel","label") stay BARE (bindings, not display). Fix = bilingualize all DISPLAY strings → {ka,en} faithful EN + add CONFIG-TIER labelCompleteness fitness (permanent guard). RUN AFTER A commits (A owns the file now — no concurrent editor).
IN FLIGHT (wave 2, disjoint): A a41d metric-delivery pipeline (contracts→api→geostat-boot→provisioning, semantic-layer end-to-end + page raw→metric-id byte-identical) · B ae3d frontend-floor (a11y APG shell-gate + perspective-bar keyboard + reduced-motion + i18n labelCompleteness + value-mappings).
NEXT after A+B gate+commit: tenancy MT-1 AgencyScheme (V38, after A's any migration) · code-split RX-26 (after A frees apps/geostat) · DC-01 calculated metrics (after A registers metrics) · DC-02 accounting-identity validation · RX-16 map consolidation (architect).
COMMIT-MSG LESSON: never use unescaped backticks in `git commit -m "..."` (bash command-substitution ate `custom`/`fn` words in d26f772 msg — cosmetic only).

### E1-ENGINE DONE (a0324, self-verified all gates exit 0, UNCOMMITTED — waiting on E1-api converge):
- custom-spec DELETED (registerSpec = sole extension path). scope.metric WIRED (ENG-10 fixed: scopeCtxByPerspective folds metric→resolveMeasureRef→MEASURE_DIM pin; FF-PERSPECTIVE-METRIC-SWAP).
- FF-NO-CAPABILITY-WITHOUT-CONSUMER added (3 families, empty shrinking deferred-lists) — the doctrine is now CI-enforced.
- registerMetrics(catalog) seam added; engine consumers all wired (resolveMeasureRef/withMetricProvenance/specDataSource/describeApp().metrics).
- ⚠️ Files: packages/core/src/{config/perspective-axis-parser.ts, config/data-spec.ts, data/metric.ts, no-capability-without-consumer.fitness.test.ts, config/perspective-metric-swap.fitness.test.ts} + discriminant-manifest, spec.ts, metric-store, validation/*, panel coverage.fitness, packages/CLAUDE.md.

### QUEUED WAVE — METRIC-DELIVERY PIPELINE (Act-1 fork, the real Act-1 completion): contracts SiteManifestContract.metrics? → api bootstrap projection + DB persist + provisioning loader → apps/geostat boot registerMetrics(manifest.metrics) (mirrors datasources bootRegistrations) → config-cube validates metric.code∈DSD → migrate gdp/accounts/regional raw codes→metric-ids byte-identical (FF-RAW-CODE-IDENTICAL) → lights up provenance/methodology badges + dataSource store-routing. RUN AFTER E1-api commits (touches api bootstrap = collision). THEN DC-01 calculated metrics builds on it.

### MULTI-TENANCY ADR DONE (platform/work/ADR-multi-tenancy.md). DECISION = BUILD (POOL + RLS, agency=tenant, below-the-port).
Build order (Strangler MT-0..7, Geostat=tenant-0 byte-identical FF-7): MT-1 AgencyScheme/DB-08 (prereq SSOT) → MT-2 expand nullable tenant_id+backfill → MT-3 request-boundary resolver+GUC (SET LOCAL!)+tid claim → MT-4 ENFORCE (RLS policy + FORCE RLS + non-owner app role — the airtight gate) → MT-5 per-request theming → MT-6/7 onboard tenant#2 + contract(NOT NULL). MT-1..3 two-way (build on branch); MT-4+ enforce gated on proven 2nd tenant (build reversibly, DON'T flip prod). core+react = ZERO change (port hides it).
2 RLS correctness gates (found in our ops config): FF-3 owner connects→RLS bypassed without FORCE+non-owner-role; FF-5 pgBouncer txn-pooling→GUC must be SET LOCAL in txn. DB-migration agents must NOT run concurrently (V-number collision) — sequence after E1-api commits to know next free V#.

### EXPERIENCE-CONCEPT HUNT DONE (work/scan/experience-concepts*.md, 13 cards). Adopt-fully (queue):
- EXP-01 DASHBOARD ACTIONS (crown) — interaction layer is empty cathedral: `NodeAction` union = 1 member (FilterAction only, node-events.ts:25), node.on[] not authorable, not in coverage gate. Complete union (filter/highlight/set-perspective/drill/url/set-param) + Interactions Inspector tab + 6th coverage axis listNodeActions(). Rides EventBus+perspectiveState. → E5/interaction (P1).
- EXP-09 APG interaction-pattern registry + reduced-motion — clone RX-24 a11y gate into packages/plugins on REAL shells; LAUNCH-BLOCKER (Law-9). → E2-a11y (P1).
- EXP-06 value mappings (value→{text,token,icon}, tenant-token-bound, no-literal-color fitness) — cheapest. → E2 (P2).
- CROWN SYNERGY: drill/field-params/what-if/story-points all = orthogonal axes in the Perspective Lattice → compose+permalink free (no incumbent matches). Lattice (E5) absorbs EXP-02/03/04.
- SKIP (principled): Observable notebooks (paradigm), Grafana alerting (scope), LLM-in-render (official stats), full responsive-breakpoints (our container-queries beat it), RBAC-on-components (gated on tenancy).

### DATA-CONCEPT HUNT DONE (work/scan/data-concepts.md, 11 cards). Adopt-fully (queue into waves, sequence after E1 engine — same core/metric files):
- DC-01 CALCULATED/DERIVED METRICS (MetricDef = expr over measures) — TOP: gives semantic-layer its reason, unifies growth/ratio-list into ONE governed no-code vocab no incumbent has visually. → E2-engine (P1).
- DC-02 ACCOUNTING-IDENTITY VALIDATION (VTL semantics, NOT parser) — GDP 3-approach reconciliation, B1G=Σ; publish-gate on identity fail; Law-9 trust capstone. National-accounts-shaped. → new DB/api workstream (P1).
- DC-03 PRE-AGGREGATIONS/rollup-routing (TimescaleDB continuous aggregates) — makes timeDimension.granularity real, closes ENG-08+DB-17. → E3/perf (P1/P2).
- Next tier: DC-05 selection/cross-filter-as-permalink-data, DC-06 facet algebra (the deferred facet door, WITH consumer), DC-07 pushdown IR (architect-gated, unblocks ENG-02/07/08), DC-04 join-relationships.
- SKIP (principled, recorded): VTL grammar frontend, Liquid/Jinja templating (we beat w/ typed $-refs), 2nd reactive runtime, DuckDB-default, custom.fn escape (custom being removed).

## Standing rules in force
Opus on every agent · root-cause not symptom · no antipatterns/hardcodes/stubs · metric-green ≠ correct
(READ screenshots for value correctness) · principled refusal (guard canon even vs user instructions).

## TM-STRANGLER — time-mode orthogonal-axis Strangler (engine-specialist, LANDED green)
Executed CLOSE-BOARD P1 (DESIGN-time-mode-decision Option C) P0→P3 + template-literal kill + TimeGranularity open + FFs. All in packages/core + the ONE live provisioning JSON + core/api fitness. NOT committed.
- **Discriminant model:** `Selection = {kind:'point',at} | {kind:'window',from,to,targetKeys?} | {kind:'all'}`; `DimBinding = {dim, selection, granularity?:string}` (perspective-axis.ts). Illegal `pin&window` state now UNREPRESENTABLE (was shape-inferred pin? XOR range?).
- **Postel/Strangler:** legacy `scope.timeBinding` LOWERED to DimBinding via `bindingFromTimeBinding` (new `resolveDimBinding` in perspective-axis-parser.ts) → ONE fold path (scopeCtxByPerspective) + ONE ownership walk (perspectiveOwnedParamKeys). `binding` primary, `timeBinding` kept as deprecated alias (parser fallback + registration + panel authoring). Full timeBinding DELETION = deferred P-final (cascades into apps/panel + its tests; out of this pass' lane).
- **template.ts:74-75 literal GONE:** `resolveCarrier` now does generic `activePerspective(state) in tpl` key-lookup (Record<perspectiveId,string>) — no `=== 'year'`, no `'year' in tpl && 'range' in tpl`. Byte-identical (current=available[0].id='year', never undefined on axis pages). `PerspectiveCarrier` type exported. Badge config was ALREADY perspective-keyed JSON → no config change needed.
- **TimeGranularity** opened `'year'|...` → `string` (open registry grain, D3). Inert; no exhaustive switch consumers.
- **`binding` scope-key registered** (perspective-scope-schemas.ts) alongside timeBinding: selection.kind dropdown + showWhen-gated sub-fields. Coverage/no-capability fitness pass by construction.
- **Live config migrated** (geostat.provisioning.json, 6 sites, replace_all): 3 year→point{$ctx:year}, 3 range→window{$ctx:fromYear/toYear}+targetKeys. JSON valid; timeBinding=0 in config.
- **FFs added:** FF-NO-MODE-LITERAL (vitest `no-mode-literal.fitness.test.ts` scanning core+react src, excludes doc-comments + the legit `i18n/format.ts` `format==='year'` date-kind; + bash twin in check-laws.sh) · FF-BINDING-SELECTION-EQUIV + FF-SELECTION-EXPLICIT (@ts-expect-error) + FF-GRAIN-OPEN (`perspective-binding.fitness.test.ts`). Updated no-capability-without-consumer.fitness (non-vacuous mirror: binding+timeBinding+metric, scope.binding/scope.timeBinding access forms).
- **Gates:** build:engine ✅ · typecheck (my files) ✅ · lint (my files) ✅ · check-laws ✅ (incl new gate) · test **2045 passed / 0 failed / 74 skip**.
- **BLOCKER (not mine):** shared-tree typecheck+lint RED from concurrent responsive lane's UNTRACKED `packages/plugins/chrome/app-header/default/app-header.overflow.fitness.test.ts:24` (`existsSync` unused, TS6133 + no-unused-vars). Forbidden lane; not touched. My changes are green in isolation.
- **Follow-ons:** (1) P-final: delete PerspectiveTimeBinding/timeBinding wholesale + migrate apps/panel authoring (perspectiveScopeSchemaSource, PerspectivesPane/perspectiveModel/coverage tests) + swap panel badge type `{year,range}`→Record. (2) FF-BINDING-DIM-EXISTS: config-cube-contract gate does NOT currently walk perspective scope dims (neither did timeBinding) — additive. (3) GRAIN-G4 adjacency: TimeGranularity now open-string, still inert at resolveTimeDimension (time-dimension.ts:124) — thread granularity→point-series.grain when D-GRAIN lands.

## STYLES/RESPONSIVE/PANEL-SIZING audit + in-flight fix (architect, LANDED green, 4 commits)
Owned the styles/responsive/panel-sizing subsystem (AUDIT-BRIEF-styles-responsive.md). Verdict on the in-flight fix + closed the RSP defect follow-ups. All committed to feat/tenant-agnostic-platform.
- **In-flight body-only panel-sizing fix = CANONICAL + COMPLETE → COMMITTED (ade152b).** Height token lands on the content box (.panel__body / .section__body) via bodyProps={vs.body}, never the .panel-col wrapper. applyPanelStyles = width/placement only (stops double-emitting data-height); PanelLayout gains bodyProps; GeographShell threads vs.body (the ONLY <PanelLayout> consumer among plugins — grep-confirmed, so completeness = that one thread). Section path was already body-based + behaviorally unchanged (diff doesn't touch section CSS; the wrapper data-height was always inert, neutralized by the now-deleted counter-rule). padding 1.25rem→0 aligns the map body with section__body's near-flush (0.25rem) model. No live CSS rule depended on wrapper data-height (grep empty); fixed one stale tabs.css comment.
- **Real-browser verification (docker unavailable → targeted layout probe).** The geostat runner is a pure API-driven SDUI shell (no bundled data → vite preview renders only the offline page); full screenshot verify needs the docker api+db stack, which is NOT on PATH this shell. Used the cached Playwright chromium (ms-playwright/chromium-1228) to run a REAL-LAYOUT probe loading the ACTUAL stylesheets (tokens/node-styles/PanelLayout/panel-layout/section css) over the width ladder. DISPOSITIVE on the §3 map-collapse: .panel__body[data-height="16:9"] and its .chart-wrap resolve identical DEFINITE non-zero heights at every width — 380 floor (narrow), 470@768, 560 cap (≥1024), 444 in a half-width col @1440 (correct cqi). Side-by-side siblings equal-height (498/498, 518/518 via align-items:stretch; header deltas absorbed by body). Leaflet cannot collapse. NOT covered (honest bound): live Leaflet tiles / donut-legend / padding aesthetics — need the docker stack; flagged for a post-deploy screenshot pass.
- **RSP-R1/R2/R3 were ALREADY FIXED in code** by the prior responsive lane (CLOSE-BOARD 2026-06-28 snapshot is STALE — verify-against-code). R1: ChartDataTable div-wrap + a11y.css clip-path:inset(50%) + reflow fitness (done+guarded). R2: app-header brand/nav min-width:0 + shrink-enabled + nav reveal ≥1280 (no tagline exists). R3: --page-measure clamp(1280,90vw,1760) SSOT consumed by header/content/footer, 800px cap retired. Gap = fixed-but-UNGUARDED.
- **Added the missing fitness locks (622410f, bc865af):** FF-HEADER-NO-OVERFLOW (app-header.overflow.fitness.test.ts, static flex-overflow contract) + FF-PAGE-MEASURE-SSOT (page-measure.fitness.test.ts, clamp SSOT + no-800px). The R3 guard surfaced a config gap — the plugins vitest include never scanned pages/** (inner-page/tab-page/container-page untested); added pages/**/*.test.{ts,tsx}.
- **--ar-* dead-var retirement (a286833):** provisioning DOES use responsive aspectRatio (8 sites), so data-aspect is LIVE (band alias) but the --ar-{bp} vars node.ts emitted are read by NOTHING (node-styles [data-aspect] uses var(--size-panel-height)) → inert DOM residue. Retired the var loop, kept the data-aspect flag (Strangler alias). Resolver-level fitness assertion added beside the CSS-absence gate. NOTE: real aspect-ratio for media is never applied today (engine emits zero aspect-ratio) — a separate additive future capability.
- **Gates (each commit):** build:engine ✅ · typecheck ✅ · tsc -b apps/panel ✅ · lint 0-err ✅ · check-laws ✅ · vitest 2049 pass / 0 fail / 74 skip (coexists green with the concurrent TM-STRANGLER core changes live in the tree).
- **Worktrees:** agent-aa65bc89b4210f841 + agent-a56d1d4bcf8bd2c96 are BOTH at 8a05420 (an unrelated ingestion HEAD), NOT the styles/map-collapse attempt described in AUDIT-BRIEF §5 — that branch content is not their current checkout. Stale scratch; safe to prune (git worktree remove) — flagged, NOT deleted.
- **Remaining in subsystem (recommended next owner = styles/plugins lane, needs the docker stack):** (1) post-deploy real-browser SCREENSHOT pass (live Leaflet + donut legend + map padding:0 aesthetics) — the one thing this shell couldn't do. (2) Strangler: migrate provisioning responsive aspectRatio (8 sites) + "height":"16:9" → the canonical "panel" size token, then drop the ratio/data-aspect aliases. (3) P2 RSP-R5 (chart container-fluidity @768 F11 / bar-label density F13), RSP-F5/F9 (FilterBar mobile + progressive disclosure). (4) Mobile-first authoring migration + @custom-media BREAKPOINTS projection (shells still desktop-first max-width). (5) L1 Constructor canvas responsively un-audited.

## 2026-07-01 — engine CLUSTER② closed (Law-1 leaks + declared-but-inert seams, all packages/core)

Three disjoint commits, each reverts independently. Full-green gates: build:engine, `tsc -b apps/geostat` + `tsc -b apps/panel/tsconfig.json`, eslint, check-laws (17 ✅), core vitest 554/554, second-tenant.fitness 8/8.

**Root A (ac64523) — privileged-dim + tenant-field leak in the crown layer.** `packages/core/src/registry/resolvers.ts` GrowthResolver multi-code branch:
- `filter: { time: years[0] }` → `filter: { [TIME_DIM]: years[0] }`. NOTE the hunt suggested "atTime/TIME_DIM path" — but `atTime` writes ctx.dims and `_observe` (store-impl.ts:314) filters on `query.filter`, NOT ctx.dims. So the honored path here is TIME_DIM as the **filter key**, not atTime.
- `meta['accountColor'] ?? meta['color']` → `meta['color']`. The `accountColor` read was **DEAD**: grep-verified zero growth specs ship in geostat.provisioning.json; `accountColor` is a transform-pipe rename (lines 435/483/624/672) the GrowthResolver never sees (it reads raw obs). No test/consumer exercised it.
- Guard: new `packages/core/src/registry/no-privileged-literal.fitness.test.ts` (FF-NO-PRIVILEGED-LITERAL) — vitest scan of `registry/**` + bash twin in check-laws.sh. Forbids quoted/bare privileged dim keys (time/geo/sector/region) + tenant `<x>Color`/`<x>Label`. `{ measure: … }` (ObsQuery field name) deliberately exempt. Probe-verified the guard bites the exact two leak lines and ignores `{ measure: code }` / `{ [TIME_DIM]: y }`.

**AD-6 (4bba0a3) — PerspectiveDef.available inert at its consumer.** `perspectiveOptions()` (perspective-axis-parser.ts) now filters the offered list by `available` via `evalVisibility` (same evaluator as node visibleWhen). New OPTIONAL 4th arg `gate?: { filterParams, perspectiveState? }` — omitted ⇒ every perspective offered (byte-identical; react SiteRenderer caller + p52 fitness untouched). FF-PERSPECTIVE-AVAILABLE proves exclude/offer/no-gate paths. **FLAG:** the react caller (SiteRenderer.tsx:141) does not yet thread `gate` (fr not in scope until after perspectiveState is computed), so the guard is capability-complete in core but **not yet activated at runtime** — react-lane follow-up to pass filterParams. This is the correct core-scoped honoring (seam now reads the field); full activation needs a react edit out of my lane.

**GRAIN-G4 (a195a79) — granularity decorative at the resolve seam.** `desugarTimeseries` (desugar.ts) threads a NON-default `timeDimension.granularity` → `point-series.grain[TIME_DIM]`. New `DEFAULT_GRANULARITY`/`isDefaultGranularity` in time-dimension.ts (a **constant**, not a `=== 'year'` literal — FF-NO-MODE-LITERAL safe). Annual/default ⇒ NO grain ⇒ byte-identical `val` path (no valAt port query, warm-key safe). Sub-annual ⇒ `valAt` port query carrying grain. **DATA-GATED honesty:** no sub-annual dataset or grain-aware store exists, so the quarter→year value roll-up is NOT exercised against real data; FF-GRANULARITY-ROLLS-UP proves (a) annual no-op byte-identity + (b) the grain reaches the store port (spy store records the exact valAt StoreQuery). The aggregation itself is the grain-aware store's job (`rollupValues` reducer already exists).

**Hunt mis-statements flagged:** (1) Root A — "use atTime" is wrong for the obs-meta lookup (obs filters by query.filter, not ctx.dims); TIME_DIM as filter key is the honored path. (2) AD-6 — honoring in core is capability-complete but runtime activation is react-gated (fr threading), not a pure-core change as the framing implied.

---

## CLUSTER ③④ (database-architect) — AgencyScheme SSOT (V38) + api boundary-vocab DRY

**③ V38__agency_scheme.sql (Class-M, EXPAND-only, TWO-WAY reversible; NOT multi-tenancy).**
DB-08 identity normalization justified TODAY (free-text `agency`/`source` copy-repeated, no SSOT), independent of MT. Shape:
- `stats.agency_scheme(code PK, label i18n '{}', …)` — SDMX AgencyScheme namespace (concept_scheme idiom); seed `'AGENCIES'` (real bilingual label).
- `stats.agency(id UUID PK gen_random_uuid, scheme_code FK, code UNIQUE=agencyID, name JSONB NOT NULL, contact_name/email, parent_id self-FK, …)`. **id is a UUID surrogate** (stable FK target; code is mutable business identity). `name` wired to V13 **REQUIRED** `config.enforce_locale_string('name')` (stats.dataset.label posture). Seeds **GEOSTAT** + **SDMX** (both root, complete ka+en names) — SDMX seeded so the backfill maps `agency='SDMX'` **faithfully** (not lossily into GEOSTAT).
- **EXPAND**: nullable `agency_id UUID` FK→`stats.agency(id)` on the **3** real carriers — `stats.concept_scheme` (V27.agency), `stats.metadataflow` (V31.agency), `stats.dataset` (V4.source). **V29 category_scheme has NO agency column** (verified file:line) → intentionally omitted. Old TEXT columns **KEPT** in parallel.
- **BACKFILL**: faithful — `UPPER(TRIM(text)) = UPPER(agency.code)` first (SDMX→SDMX, Geostat→GEOSTAT), GEOSTAT fallback for unmatched/NULL. Migration-internal DO-block assertion: 0 rows left NULL after backfill (fail-fast).
- **CONTRACT (drop TEXT / NOT NULL) OUT OF SCOPE** — later door after a 2nd agency (same posture as deferred MT). **V6 tenant_id + USING(true) RLS UNTOUCHED** (agency_id = identity; tenant_id = isolation-scope; distinct columns).
- Provisioning: idempotent GEOSTAT re-assert in `apps/api/scripts/seed.ts` (guarded on V38, `ON CONFLICT(code) DO UPDATE`, complete i18n name).
- Fitness: `apps/api/src/routes/stats/agency-scheme.fitness.test.ts` — DB-gated (code-unique teeth, re-point FK validity+backfill completeness, name completeness reject/all-valid, self-parent CHECK) + **no-DB EXPAND-only guard** (asserts V38 has no `DROP COLUMN`, no `agency_id … NOT NULL`, and NO MT machinery: FORCE RLS / current_setting / app.current_tenant / tenant_id in logic).

**④ api boundary-vocab DRY collapse.** (a) 4 copy-pasted `type LocaleString = Record<string,string>` → alias to SSOT `ContractLocaleString` from `@statdash/contracts` (arrow-legal): `provisioning/types.ts:51` (exported alias — importers unchanged), `routes/cube/index.ts:61`, `routes/stats/datasets.ts:24`, `routes/catalog/index.ts:33`. (b) reserved measure dim-code magic string → **new neutral SSOT** `apps/api/src/lib/cube-keys.ts` `export const KEY_MEASURE='measure'` (placed in `lib/`, NOT exported from `ingest/canonical/parse.ts`, to avoid a delivery-route→ingest-internal coupling); consumed by `parse.ts:65` (was module-private const), `ingest/rules/registry.ts:159` (`dim: KEY_MEASURE`), `routes/cube/index.ts:235` (SQL `$2` param).

**Green gate:** typecheck (geostat) ✓ · build:engine ✓ · tsc -b apps/panel ✓ · tsc -b apps/api ✓ · lint (0 err, 43 pre-existing react-refresh warns) ✓ · check-laws (17 ✓, incl FF-NO-PRIVILEGED-LITERAL) ✓ · vitest apps/api **318 pass / 81 skip (DB-gated) / 0 fail**. **apply-migrations + DB-gated agency fitness = DB-SKIPPED** (DATABASE_URL unset; no live PG). Migration written to the verified V13/V27/V29/V31 idempotent-additive idiom; apostrophes `''`-escaped; ordering scheme→agency→expand→backfill→assert.

**⑤ P1 config-semantics SSOT (DESIGN-authoring-schema-ssot §4 P1, commit c1a635e).** Killed the DRY/SSOT duplication in the authoring path. Extracted the pure semantics into `packages/core/src/config/`: `prop-path.ts` (`getAtPath`/`setAtPath` — one dot-path grammar, read=write parity, numeric segment=array index) + `prop-visibility.ts` (`evalShowWhen` — the one `lhs === rhs` parser, Postel-liberal). Re-exported through `@statdash/react/engine` (engine/index.ts `export { getAtPath, setAtPath, evalShowWhen } from '@statdash/engine'`) so NO consumer import path changed. Rewired + retired 4 forked bodies: `PropSchemaForm.tsx` (dropped local getAtPath+isVisible→consume core; DEMOTED to headless reference fallback, header marked for retirement per §3, NOT made the panel's surface = Law-3-correct), `validateNodeConfig.ts` (dropped local getAtPath), `apps/panel/inspector/showWhen.ts` (now a THIN re-export: `export { getAtPath, setAtPath, evalShowWhen as isVisible } from '@statdash/react/engine'` — keeps the panel's local `isVisible` name + `./showWhen` import path stable for Inspector+7 setAtPath editor importers), `apps/panel/save/saveGuard.ts` (retired the divergent `getAt` reduce reader → shared array-safe `getAtPath`, both call sites :173/:205). Naming: `evalShowWhen` (not `isVisible`) — `isVisible` is already taken in core by `config/filter` (VisibilityExpr evaluator); collision-free. FF-NO-FORKED-ISVISIBLE = `packages/core/src/config/no-forked-isvisible.fitness.test.ts` (grep scan core+react+apps/panel: showWhen parser in exactly 1 file=prop-visibility.ts; `function getAtPath`/`function setAtPath` each declared exactly once=prop-path.ts; retired `function getAt(` exists nowhere; gate-bites synthetic check). Note on the "array-index bug": all 4 readers happened to reach array elements via JS bracket access (`arr['0']===arr[0]`), so no runtime divergence manifested TODAY — the fix is eliminating the structurally-divergent 4th copy so it can never drift; write-grammar (`setAtPath`) explicitly creates/descends arrays for numeric segments, so read=write parity is now provable from ONE source. **Green gate:** build:engine ✓ · typecheck geostat ✓ · tsc -b apps/panel ✓ · lint (changed files, 0) ✓ · check-laws (17 ✓) ✓ · **full vitest 2070 pass / 81 skip / 0 fail (264 files)**. P2 (saveGuard capability-registered 5th check) / P3 (chart colorMode+thresholds schema) / P4 (dataLinks authorable) now sit cleanly on the shared path/visibility helpers — P1 was the only hard prerequisite; the three fan out in parallel.

---

**ADR-0028 FAIL-SOFT REPAIR (senior-frontend, 2026-07-01).** Fixes the blank-white-page discovered in the prior STATIC-MODE VERIFY: when `/api/bootstrap` is unreachable the runner falls back to `emptyManifest()`, but the fallback itself crashed and unmounted the whole tree.

- **ROOT CAUSE (two layers).** (1) `resolveChrome.ts:63` iterates `chromeRegistry.listSlotMeta()` — ALL registered chrome slots — NOT the site `chrome` map, so `app-header`'s `default` shell mounts even when `emptyManifest()` sets `chrome:{}`. (2) `AppHeaderShell.tsx` rendered the brand block UNCONDITIONALLY: `t(config.logoAlt)` with `chromeConfig={}` → `resolveLocaleString(undefined,'en','en')` → `undefined['en']` throw at `packages/core/src/i18n/types.ts:66` (`Cannot read properties of undefined (reading 'en')`). (3) No app-root error boundary → React unmounts the tree → blank page at every route. Footer/sidebar/locale-switcher already guard their config reads (`config.x &&` / `?.`) — app-header was the SOLE unguarded dereference.
- **FIX ① (root, shell null-guard).** `AppHeaderShell`: `const hasBrand = Boolean(config.logoUrl && config.logoAlt)`; brand `<Link><img/>` renders ONLY when `hasBrand` — absent ⇒ brand-free minimal header (nav + actions still render). No brand/locale literal in the shared shell (Law 4); the neutral state IS the empty brand slot.
- **FIX ② (defense-in-depth boundary).** New generic `packages/react/src/components/AppErrorBoundary.tsx` — class boundary, MECHANISM only (`getDerivedStateFromError`/`componentDidCatch`→log+`onError`→swap). Fallback is INJECTED as a prop so the app-agnostic react layer carries no tenant/locale literal. Exported from `@statdash/react`. Mirrors the per-node `NodeErrorBoundary` one level up.
- **FIX ③ (app root).** `apps/geostat/src/app/App.tsx` wraps EVERY render path (skeleton · suspense · rendered tree) in `<AppErrorBoundary fallback={<AppUnavailable/>}>`. `AppUnavailable` = neutral English framework copy ("Something went wrong…"), `role="alert"`, SELF-CONTAINED inline styles (no token/stylesheet/i18n dependency — the failure may have taken those down). Visual polish deferred to real-stack verify.
- **Fitness (locks the guarantee).** `packages/plugins/chrome/app-header/default/app-header.failsoft.fitness.test.tsx` (FF-CHROME-FAILSOFT): empty `{}` chromeConfig → header renders, no throw, no `<img>`/`.app-header__brand`, no `geostat`/Georgian-script leak, + positive-control (real config still renders the logo, guard is scoped). `packages/react/src/components/AppErrorBoundary.test.tsx`: throw → fallback shown, raw error hidden, `onError` fired.
- **Green gate:** build:engine ✓ · typecheck-geostat ✓ · tsc -b apps/geostat ✓ · lint (changed, 0) ✓ · check-laws (17 ✓) ✓ · vitest new 7/7 + chrome+geostat suites 73/73. Scope honored: only `packages/plugins/chrome/app-header/**`, `packages/react` (new component + barrel), `apps/geostat/src/app/App.tsx`. No touch to core/config, PropSchemaForm, apps/panel, apps/api.

## 2026-07-01 — Choropleth flat-map + monochrome-donut color defect (debugger)
Server-verify (real data) exposed value-correctness the metric-green missed.
- **ROOT-1 (regional map flat single color):** `packages/plugins/nodes/geograph/default/components/GeoMap.tsx` — `baseStyle()` returned the same `fillColor()` (`--color-accent`) for every feature; opacity varied only by selection. No value→color scale was ever implemented in the geograph. The `buildColorScale` utility exists ONLY in the distinct `packages/plugins/panels/map` stub — never imported by geograph. WHY uniform: single constant fill, zero per-datum color.
- **ROOT-2 (donuts monochrome grey):** `packages/plugins/panels/chart/default/components/donutGeometry.ts` `build()` — `color = pt.thresholdColor ?? cssVar('--color-text-muted')`. A plain single-measure donut (pie interpreter) carries no `thresholdColor`, so every slice fell to grey, while the sibling `TreemapChart.tsx` already distributes `chartPalette()` for the same no-color case. Genuine palette-not-applied defect (not deliberate).
- **FIX:** new agnostic, token-derived `sequentialRamp()` + `quantileColors()` in `packages/styles/src/utils/choropleth.ts` (ramp derived from `--color-accent`, rebrands under `[data-tenant]`; quantile spreads a Tbilisi-dominant skew across the full ramp). GeoMap builds `colorByGeo` and shades per region; selection now uses opacity+weight (orthogonal to the value/color encoding). Donut mirrors the treemap's `distribute = distinct.size <= 1` palette guard.
- **Fitness:** `choropleth.fitness.test.ts` (real region spread → distinct fills, Tbilisi darkest/Racha lightest, flat map impossible) + `donutPalette.fitness.test.ts` (plain donut → 5 distinct hues, never grey; semantic threshold colors still respected).
- **Green:** build:engine, typecheck, `tsc -b apps/panel`, lint (0 err), check-laws, token-cohesion, 76 existing + 5 new tests all pass.
- **Re-verify pages:** `ka-regional` (choropleth map + sector donut) and `ka-gdp` (production-approach donut).

---
## plugins-specialist — layout-node composition Strangler (adcc0de, 367e7e9)
Executed the owner's #1 ask (compose sections/pages via OUR layout nodes, uniformly). Two coherent commits:
- **adcc0de (P2+P4):** wired the dead `align` capability end-to-end (columns/grid/stack: schema field + i18n options + `resolveAlign` in @statdash/styles + shells emit `data-align` + stack `[data-align]` CSS; `stretch`=attribute-less default); collapsed the two competing grid primitives to ONE — retired the legacy `row` node + `.panel-row` viewport-media grid (hardcoded 1280px), converged on the container-query columns/grid family. Config already used 0 rows (Strangler B3). columns/grid/stack ABSORB row's `nav-transparent` cap (fixes a latent gap — columns had caps:[] so gdp's columns-nested sections never reached the nav extractor). Regenerated `packages/contracts/schema/page-config.schema.json` (gen:schema). Fitness: FF-NO-DEAD-CAPABILITY (layout-align-capability), FF-NO-DUP-COLUMN-PRIMITIVE (one-grid-primitive).
- **367e7e9 (P5):** InnerPageShell now composes children inside `.layout-stack[data-dir=column]` (the page body IS a layout node, not a bespoke `.page-content` flex); `.page-content` is viewport chrome only (measure/gutter); arrangement+gap moved to the stack. Fill chain: `.page-content__stack` = flex:1 1 auto; min-height:0 (fills inner-page height; composable with the per-panel node-styles [data-height]/[data-aspect] fill the chart `height:100%` seam plugs into — left untouched, debugger owns Apex config). Fitness: FF-NO-BESPOKE-SECTION-DIV (no-bespoke-body).
- **Did NOT touch** geograph/** or chart color/Apex config (debugger lane). Did NOT do the @layer P0/P1 cascade (A-axis — architect territory; out of this charge's scope).
- **Green:** build:engine · typecheck(geostat+panel) · lint · check-laws · vitest (plugins 403 · react-engine 502 · styles · geostat render) · build:geostat — all pass.
- **SERVER RE-VERIFY (real browser):** ka-gdp (sections nest in `columns` → now appear in section nav; paired equal-height cards must still hold), ka-regional (mixed direct sections + columns; map keeps definite height), ka-accounts (direct sections + repeat). All three page bodies now render as `.layout-stack`; confirm spacing/sticky filter-bar unchanged and gdp section-nav now populated.

## Section-authoring uniformity (config-level, owner's #1 section complaint)
- **Charge:** the layout lane fixed the page BODY (InnerPageShell→stack, P5) but left per-section provisioning configs as direct children ("redundant"). Owner disagreed — every section must be authored the SAME canonical way. This is the deeper config fix.
- **Inconsistency mapped (geostat.provisioning.json):** `gdp` composed EVERY section group through a `columns` node (pairs count:2, singles count:1) — already canonical. `accounts` authored sna-hero, the `repeat`, sna-hero-range as DIRECT children of the page body; `regional` authored regions-bar + sector-history as DIRECT children (its other groups were already in columns).
- **Canonical form:** ONE composition primitive — `columns`. Pairs → count:{default:2,md:1,sm:1}; singles → count:{default:1,md:1,sm:1}. Group perspective gate (`view.visibleWhen {op:perspective-is}`) hoisted onto the columns WRAPPER; inner single section carries only content view (subtitle/styles/noCollapse). Chose columns-for-singles over stack: it's the established verified convention (gdp), ONE primitive = strongest uniformity, single→pair is a one-field flip (OCP). **gdp left byte-untouched** (preserves verified work); accounts/regional converged to it via a parse→wrap→serialize transform (round-trip byte-identical baseline confirmed first).
- **Nav-safe:** `navUtils._extract` descends exactly ONE level into a `nav-transparent` container; `repeat` is not nav-transparent so columns→repeat→sections never reached nav before or after (unchanged). `getNavMode` fires only on `{op:'eq'}`, not `perspective-is` → moving visibleWhen is nav-identical.
- **Fitness:** `apps/api/src/provisioning/config-uniform-section-authoring.fitness.test.ts` (no-DB, committed artifact) — THE INVARIANT: every inner-page section/geograph has a columns|grid|stack ancestor (subsumes direct-child + top-level-repeat); + no section/geograph/repeat is a direct page-body child; + no single-wrapper inner section carries a redundant perspective gate. 16 sections, 0 violations.
- **Did NOT touch** packages/charts, packages/plugins/panels/chart, chart.css, node-styles.css (chart-fill lane), or layout-node internals. Only the JSON artifact + the new fitness test.
- **Green:** build:engine · typecheck(geostat) · tsc -b apps/panel · lint · check-laws · vitest (new fitness 12 · geostat render + nav caps + inner-page 85) — all pass.
- **SERVER RE-VERIFY (real browser):** ka-accounts (was direct sections+repeat → now 3 `columns` wrappers; single-column spacing/sticky filter-bar unchanged, sna-hero 16:9 hero intact), ka-regional (regions-bar + sector-history now wrapped; paired map/section equal-height + map definite height must still hold), ka-gdp (UNCHANGED — regression check only). Widths 360/768/1024/1440/1920. Confirm section nav still lists the same anchors on all three.

## plugins-specialist — CHART-FILL vertical bar (owner headline, 84999e2)
- **Charge:** REDO the un-landed chart-fill fix (prior lane hit session limit, no commit). Server-verify @367e7e9 confirmed the defect PERSISTS on-branch: ka-gdp expenditure VERTICAL bar (contribution) frozen ~176px while the paired production-donut card stretches it → white gap GROWS with width (150@1024→193@1440→319@1920). Horizontal bars/donuts/map fill fine.
- **Root cause (traced through the real DOM):** the chart's band is on the LEAF, not a container. expenditure `section` → `wrap`(styles.aspectRatio {default:16/9, sm:4/3}) → `chart`(contribution)/`table`. WrapShell is TRANSPARENT (no DOM) + floors aspectRatio via WrapStyleContext onto the chart's own view.styles → `data-aspect` lands on `.chart-wrap` (Chart.tsx spreads bodyAttrs there), a DIRECT child of `.section__view[data-view="visible"]` (SectionShell). node-styles' base `[data-aspect]{height:var(--size-panel-height)}` FROZE the leaf; the panel-layout.css container growable-band rules only fire when the band is on `.section__body` (bandless here → `.section__body:not([data-height]){flex:1}`). So the leaf couldn't grow into the equal-height-stretched card.
- **Fix (both halves, prior-lane work verified + landed + guarded):** (1) Apex config — contribution/cartesian vbars already emit `chart.height:'100%'`; pinned `BASE.chart.parentHeightOffset:0` (base.ts) so no phantom offset re-opens the gap once the parent is definite. (2) CSS — mirrored the container growable-band model for the LEAF (node-styles.css): `[data-view="visible"]:has(> .chart-wrap[data-aspect])` → fill-flex column, `[data-view="visible"] > .chart-wrap[data-aspect]` (and ratio data-height aliases) → `flex:1 1 var(--size-panel-height); height:auto` — grows past the band, defeats the frozen base height. chart.css `.chart-wrap` = flex column, `.chart-wrap__render` = flex:1 → unbroken chain to the Apex mount div.
- **Chain (now closed):** `.panel-col>.section`(flex:1 col) → `.section__body:not([data-height])`(flex:1 col) → `.section__view[data-view=visible]:has(>.chart-wrap[data-aspect])`(flex:1 col) → `.chart-wrap[data-aspect]`(flex:1 1 band; height:auto) → `.chart-wrap__render`(flex:1) → Apex measures definite stretched box, height:'100%' fills.
- **No regression:** horizontal bars keep `categoricalChartHeight`→px per row (ApexRenderer height prop overrides options); donuts/treemap (height:100% roots) + map (definite height) untouched; mobile BP_SM/XS keep their fixed 280/240 (single-column, no pairing). Only band-leaf chart bodies gained the growable leaf.
- **Fitness (frozen-176 can't regress):** `packages/plugins/panels/chart/default/utils/apex/chart-fill.test.ts` — pins `chart.height:'100%'`+`parentHeightOffset:0` for contribution/cartesian vbar, the ≥1024 responsive bps never pin a numeric height, and `categoricalChartHeight` vbar→'100%'/hbar→px. `packages/styles/src/panel-sizing.fitness.test.ts` (+3 tests) — pins the node-styles leaf growable-band rule (flex-basis + height:auto), a revert turns red.
- **Stayed in lane:** only chart.css, base.ts (Apex config), node-styles.css (chart-leaf rule), + 2 guards. Did NOT touch the concurrent lane's PanelLayout/resolvers/panel-layout.css (container model already committed at HEAD — verified self-sufficient), layout nodes, map, or provisioning.
- **Green:** typecheck(geostat) · tsc -b apps/panel · lint(0 err) · check-laws(17✓) · vitest packages/plugins 351 + packages/styles 83 — all pass.
- **SERVER RE-VERIFY (real browser, the owner's headline):** ka-gdp — the **expenditure vertical bar** (production donut ⋈ expenditure bar, paired equal-height) must now FILL its card with NO white gap at widths **1024 / 1440 / 1920** (was 150/193/319px gap). Confirm horizontal bars (regional-comparison, ka-accounts T-account) still fill, donuts stay categorical-colored, map keeps definite height, and mobile (360/768) single-column has no gap.

## AR-5 — Maximal JSON grammar of CSS Grid (platform-architect, 0b10f90)
- **Wrap audit (Chesterton's fence):** all 6 `wrap` nodes are the SAME shape — distribute responsive `aspectRatio` to a chart↔table TOGGLE (SectionShell renders each child in `.section__view[data-view]`, only one visible). That is distributed-STYLE (WrapStyleContext → the FILL-vbar band on `.chart-wrap[data-aspect]`, locked by `panel-sizing.fitness.test.ts`), NOT layout. **KEEP + JUSTIFY** — grid/columns compose side-by-side VISIBLE children; converting would break the toggle and regress verified definite-height. Refused metric-gaming.
- **Grid elevated to MAXIMAL:** `resolveGrid` (`packages/styles/src/resolvers/layout.ts`) → `{style,data}`. `templateColumns/Rows/Areas` are `ResponsiveVal` on the shared dual-route (flat→inline intrinsic auto-fit; responsive→`--grid-<axis>-<bp>` vars + `data-grid-<axis>-responsive` flag). `autoFlow/autoColumns/autoRows` flat-inline; `columns` shorthand→`repeat(N,minmax(0,1fr))`; `gap`→`--layout-gap`. `layout.css` `@container grid` cascade (large→small). `align`→align-items, `justify`→justify-items (data-*). `GridNode` schema declares the full vocab (Constructor-introspectable); `GridShell` pure interpreter; per-child colSpan/rowSpan/order rides `LayoutItemProvider`.
- **Adopted on real sections:** 8 gdp+regional groups `columns`→`grid`. Pairs use `repeat(auto-fit, minmax(min(100%, 24rem), 1fr))` — continuous 2-up↔1-up reflow by container width; singles `1fr`. Zero `count>=2` ladder remains. 3 accounts-page `columns count:1` KEPT (deliberate full-width stacking; one wraps a `repeat` fan-out). Mobile single-column + equal-height (`align-items:stretch`) preserved.
- **Guards:** FF-GRID-MAXIMAL (`grid.fitness.test.ts`) + FF-GRID-COMPOSITION (`config-grid-composition.fitness.test.ts`). Stayed OUT of the chart lane + sizing resolvers.
- **Green:** build:engine · typecheck · tsc -b apps/panel · lint(0 err) · check-laws(17✓) · vitest 31 FF + 104 pkg.
- **SERVER RE-VERIFY (real browser):** ka-gdp + ka-regional at 360/390/414/768/834/1024/1280/1440/1680/1920/2560/3440 — paired sections must reflow 2-up↔1-up SMOOTHLY as width changes; singles full-width; equal-height holds; mobile (360/768) single-column, no gap.

---

## Dark-mode theming defect sweep (senior-frontend, 2026-07-01)

**Owner defect:** time/perspective switcher rendered as a frozen LIGHT box in dark mode (invisible/wrong-contrast). Slipped because all verification was light-mode only.

- **Switcher root cause:** `.perspective-tab-group { background: var(--color-surface-frame) }` (`perspective-bar.css:6`). `--color-surface-frame` (#F0F3F3) was NOT in either dark override block, while unselected label text (`--color-text-secondary`) DID flip to light → light text on a frozen light track.
- **CLASS (systemic root):** the two dark blocks in `packages/styles/src/css/tokens.css` (`@media prefers-color-scheme:dark` + `[data-theme="dark"]`) covered only a SUBSET of Tier-2 roles. ~30 semantic roles stayed frozen at light values: `--color-surface-frame`, accent extras (`-hover/-bg/-secondary/-chip-border`), `--color-heading-display`, `--color-trend-*`, `--color-chart-frame/-grid`, `--color-surface-hover` (was black-darken; on dark must lighten), `--color-skeleton`, the SDMX `--status-obs-*` + `--status-total-*` families, and the `--color-error-*` family.
- **Root fix:** gave EVERY semantic role an explicit dark value in BOTH dark blocks (kept byte-identical). Component CSS was otherwise token-clean → completing the token layer fixes every consuming component at once.
- **Other component-CSS defects fixed:** `map.css` swatch border raw `rgba(0,0,0,.1)`→`var(--color-border)`; `text.css` dangling `--color-primary`/`--color-surface-2`/`--space-*` (→ real tokens, was resolving to `initial`); `gauge.css` `--space-2` (no fallback, 0 padding)→`--spacing-sm`. Switcher selected-tab shadow `rgba`→`var(--shadow-card)` (dark-aware).
- **PROCESS (fitness):** (1) **FF-DARK-COMPLETE** (`packages/styles/src/tokens.parity.test.ts`) — every `--color-*/--status-*/--chart-color-*` role must be dark-safe (redefined in dark OR transitively derived from a flipping role); the two dark blocks must be identical; key control pairs (incl. switcher text-on-track) clear WCAG AA 4.5:1 on the DARK hex values. (2) **FF-NO-UNTHEMED-COLOR** (`packages/plugins/__tests__/no-unthemed-color.fitness.test.ts`) — no raw hex/rgb/hsl/named color in any color-bearing property in plugins/react CSS (shadows exempt).
- **Green:** build:engine · typecheck · tsc -b apps/panel · lint(0 err) · check-laws(17✓) · vitest (all new FF pass; 391 plugins/styles pass). The ONE failing test `page-config-schema.fitness.test.ts` is FOREIGN — the concurrent grid lane's uncommitted `resolvers/node.ts,panel.ts` schema drift (grid templateColumns/Rows), not touched here (CSS can't alter a generated JSON schema).
- **BOTH-MODES RE-VERIFY (after redeploy, real browser, toggle OS/`data-theme` dark):** ka-gdp + ka-regional + ka-accounts at 360/768/1280/1920. Controls to check dark: perspective/time switcher (track+selected+unselected legible), filter-bar, KPI strip, section headings (heading-display), trend arrows, OBS_STATUS + total-row table badges, node-error card, map legend swatches, chart axis/grid. Hunt: white-on-dark, invisible controls, low contrast.
- **FUTURE/BEST (flagged, not done):** the two dark blocks are duplicated (no cross-media DRY). Truly systemic fix = CSS `light-dark()` (one def per token, drift-impossible). Deferred: rewrite + baseline + touches parity harness; fitness gates close the risk meanwhile.

---

## AR-8 — Contextual Aspect Band (senior-frontend, 2026-07-01)

**Owner defect:** panel height was UNIFORM (`64cqi` = a frozen `0.64` coefficient on every panel/role/context), not context-proportional — a SOLO panel must be TALLER than a PAIRED one. Followed the architect's reconciled verdict (`DESIGN-proportional-sizing.md`): KEEP the honest single-clamp band + the retired-`aspect-ratio` decision (fence honored), REFINE the frozen coefficient into a role/context/authored token. Did NOT re-litigate aspect-ratio.

- **Root cause:** the band was width-proportional but not *proportion*-proportional — `64cqi = 0.64 × 100cqi` with fixed px bounds, so the SHAPE was constant and the cap flattened wide solos into letterboxes.
- **Model (`packages/styles/src/css/tokens.css`):** band middle term is now `calc(var(--panel-ratio) * 100cqi)`; bounds retuned to GUARD-only (`--size-panel-h-floor:320px`, `--size-panel-h-cap:640px`); `--size-panel-h-fluid`/`64cqi` deleted.
- **ARCHITECTURAL CORRECTION (senior, beyond the literal design):** the design's single `--panel-ratio` overridden by BOTH role and context would CONFLICT — equal-specificity same-property writes, so context `0.42` would beat role `0.72` and re-letterbox the map at wide widths. Solved as **three orthogonal INPUT vars that compose by fallback + multiply (zero specificity fight):** `--panel-ratio-role` (baseline `0.58`) · `--panel-ratio-scale` (context) · `--panel-ratio-authored` (config), with `--panel-ratio: calc(var(--panel-ratio-authored, var(--panel-ratio-role)) * var(--panel-ratio-scale))` — authored WINS role, context ALWAYS scales. Each axis writes a DISTINCT var, so nothing conflicts.
- **Context axis (`node-styles.css`):** `@container (min-width:680px)`→scale `.84`, `(min-width:1040px)`→scale `.68` on the band carriers. Wider OWN width → smaller scale → shorter ratio → yet TALLER absolute (height = ratio × width). **Solo ≠ paired by construction.** Binds to `.section`/`.panel` (both `container-type:inline-size`).
- **Role axis (plugin-owned, `data-content` token):** `geograph.css` `.panel__body[data-content="geo"]{--panel-ratio-role:.72}` (near-square, kills the map letterbox) + `GeographShell` emits `data-content=geo`; `chart.css` `.chart-wrap[data-content="chart"]{--panel-ratio-role:.52}` + `Chart.tsx` emits `data-content=chart`. Keyed on a content-role token, never a node-type list (Law 1/4).
- **Authorable axis (`resolvers/node.ts`):** revived the retired inert `--ar-*` emission with a real consumer — `aspectRatio` → `--panel-ratio-<bp>` (CSS width/height INVERTED to the band's height/width via `toPanelRatio`, Postel on slash/colon/number: `"16 / 9"`→`0.5625`); `node-styles.css` `[data-aspect]` `@media` cascade collapses them into `--panel-ratio-authored`. Proportion is now Constructor-ready config.
- **NO REGRESSION:** map keeps its definite Leaflet height (a `clamp()` of concrete lengths — the `83d117a` revert can't recur); chart-fill growable band (`84999e2`) UNTOUCHED (only the ratio coefficient changed); equal-height `align-items:stretch` untouched; AR-5 grid width untouched.
- **Guards (7 FFs, `panel-sizing.fitness.test.ts`):** FF-RATIO-DRIVEN-BAND · FF-BAND-MONOTONIC · FF-RATIO-CONTEXT-AWARE · FF-RATIO-AGNOSTIC · FF-MAP-DEFINITE-HEIGHT · FF-EQUAL-HEIGHT-SIBLINGS · FF-BAND-IS-FLEX-BASIS. (The RATIO-AGNOSTIC banned-word regex is built from fragments so the test file itself carries no tenant literal → passes the `packages/{react,styles}` no-tenant-content scan.)
- **Green:** build:engine · typecheck · tsc -b apps/panel · lint(0 err) · check-laws(17✓) · vitest 262 files / 2136 tests.
- **REAL-BROWSER RE-VERIFY (batch redeploy, deferred):** `/ka/gdp` + `/ka/accounts` at 630 / 1024 / 1440 / 2560 — a SOLO map must be TALLER than a PAIRED one AND near-square (no letterbox); paired cards equal height; chart-fill shows no white gap.
