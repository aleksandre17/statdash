---
name: authoring-canon-program
description: "AR-52 circle-break program (2026-07-15): lead's personal live-probed study; Canon C1-C4; waves W1-W5 WIP=1; owner doors pending"
metadata:
  type: project
---

# AR-52 — The Authoring Canon program (the circle-break, 2026-07-15)

Owner directive: lead PERSONALLY probe the panel critically and lay a circle-breaking plan. Done — live gesture-probes vs :3013 (real auth, real data), evidence in `work/authoring-truth/` + reusable probe `work/probe-authoring-truth.mjs` (run it from inside `platform/apps/panel` so `@playwright/test` resolves).

**Verdict:** ADR-041/042 object model HOLDS — never reopen it as "the problem". The circle = (a) broken product canon ON TOP of the substrate, (b) WIP pathology (~12 open strata; DoD=gate-green, never journey-complete).

**Live-probed facts (don't re-derive):** structural canvas default paints fake 0s + empty charts (live-data toggle WORKS — real values flow); unbound KPI renders 0 even in live mode; `{spanFrom}` tokens leak; chrome IS part-anchored (AppHeader/Banner/Switchers) but renders as a degenerate unstyled strip; page inspector leaks system plane (`vars` = `_mark/_xDim/_byDims/_selKey`, `presentation.crumbs` raw-object escapes — `pageSchemaSource.ts:67`); `/studio/model` default lens = read-only dictionary, raw upload buried behind lens-flip (hasUpload:false); dictionary is a cul-de-sac (no drag-to-bind); metric select on cards is EMPTY (corpus never migrated to handles); moveNode only in outline; two drag transports; FilterBarControlsBridge dead code kept by its own fitness.

**Canon C1–C4:** Data first, always · The canvas never lies · Projection with a plane (PropField gains `plane: author|steward|system`) · A journey is the unit of done (J1 onboard → J2 define metric → J3 compose → J4 bind → J5 restyle → J6 publish; each = live Playwright walk `FF-JOURNEY-*`).

**Program (WIP=1, strict order, each wave deployed + journey-walked + owner-shown):** W1 honest canvas (0071) → W2 semantic spine lived (0072) → W3 inspector instrument D4+plane (0073) → W4 Manipulate = ADR-042 S1–2 + dead-code sweep, ⚠️ one-way transport flip owner-GO (0074) → W5 publish loop J6 (0075). Umbrella 0070. Registry row AR-52. Study: `docs/architecture/proposals/STUDY-authoring-canon-circle-break.md`.

**Parked with reason:** AR-49 M3.1+, AR-50 M4/lifecycle, AR-42 P3/P4, MUI-exit, AR-51 generalization — reopen one at a time AFTER W5.

**Why:** owner felt "we're circling" despite 40+ branch commits of accepted architecture — the felt product (dead-default canvas, form-wall dock, buried data door) was never walked as a user journey by anyone.
**How to apply:** before ANY authoring work, check which wave is in flight; refuse new strata mid-wave (registry card instead); wave-DoD = journey walked live on :3013, never gate-green alone.

**OWNER GO (2026-07-15, verbatim intent):** "I did what I could — full freedom given; be the ideologue/architect/senior scientist-engineer and FINISH this project as ONE BODY, a 0→100% platform/framework-grade whole; be bold." → Canon C1–C4 blessed (now CLAUDE.md **Law 11**); WIP=1 + wave order blessed; live-data default approved; one-way doors PRE-AUTHORIZED with on-record notice + revert-net (git tag) at each flip — do not block on per-door replies. The lead drives to completion, shows each wave landed on :3013. The owner should receive RESULTS to look at, never homework.
**W1 launched 2026-07-15** (senior-frontend-developer, Opus). Branch: feat/ar49-m0-metric-first-authoring. ⚠️ working tree carries owner deletions (scriness/*, docx) — agents must stage explicitly, NEVER `git add -A`.

**AR-53 — Conservation of Declared Truth (2026-07-15, five-lens deep expedition + lead synthesis).** Five parallel read-only studies (`docs/architecture/audit/DEEP-2026-07-15-*.md`) + synthesis `CONCEPT-power-of-the-core.md`. THE wound: declaration carries truth, system loses it at 4 gates (engine seams discard state/lineage; surfaces lack STATE/PLANE axes + EXPLAIN projection; storage: catalog blind-write blob, zero config↔stats FKs, pixel lineage island; process: **NO EXECUTING CI** — ci.yml self-declares never-executed + filters dead @geostat/* names, 18 DB-gated suites never ran, 12 e2e in no workflow, corpus metric-ref=0). Key designs ready: engine `Cell{value,state}` honest-state seam (W1's engine dependency, in DEEP-engine-core PM-1); PLANE axis = W3's contract (platform PM-B); `Publishable` identity = W5's substrate. P0 integrity hole: confidential `c` values NEVER masked (engine F7). Dominant disease named: "ship mechanism, gate-lock, defer adoption into invisibility."
**Pending owner doors:** bless AR-53 law · **Tier-0 CI resurrection GO** (fix ci.yml package filters + execute DB-gated/e2e — hours, the floor under all waves). Owner ordered "no more launches, wait" — W1 still building; nothing else launches without his word.

**Predecessor AR-49 (authoring reconception, 2026-07-09 — history distilled; detail is git/SPEC-derivable).** Owner mandated the holistic reconception (vision leads, code adapts; disliked the 3-step wizard — root flaw was role-conflation); M0 metric-first + M1 "The Studio" (wizard deleted, react-admin retired) + M2 steward/Model + M3.0 calc editor all BUILT and live-verified; Playwright+axe adopted (caught 3 live-only defect classes). **Still-live residue:** M3 remaining awaits owner one-way-doors (growth-as-governed-noun engine change · recipe-library placement · honesty-boundary blessing); AR-49 registry carries open follow-ups (agg-consumer, live-delete unregister seam, server-side PUT validator, calc editor M2.5, dimension authoring M2.4). Brand "Strata" provisional (rebrand = token preset). Key law guard held: grow OUR SDMX/OLAP semantic layer; REFUSE Cube/Malloy as runtime (Laws 2+5).
