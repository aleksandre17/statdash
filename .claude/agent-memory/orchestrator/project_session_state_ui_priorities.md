---
name: session-state-ui-priorities
description: Owner's CURRENT priorities + running work (2026-07-11 late) — foundation-first panel canonicalization, right-side fix, pipelines-visible, dedup; NOT AI/vintage-now
metadata:
  type: project
---
**Owner's current directive (2026-07-11, after deep dissatisfaction with the AR-49/AR-50 overnight run — he sees specs/studies, not implemented VISIBLE results). This is the active priority stack; honor it next session.**

**Priorities (foundation-first, in order — NOT fancy features):**
1. **DATA — one source of truth.** VERDICT: the data foundation is SOUND (audit `SPEC-vintage-revision-dimension.md`/`ADR-036`: already ALFRED-grade bitemporal — V8 capture + V25 release intervals + `queryAsOf`; Law 1 honored). Two small integrity gates noted (R1 release-context guard not enforced; R2 pre-image `dim_key` not preserved). **Data is not the blocker.**
2. **Dedup scattered/duplicated functionality** ("same thing in several places"). First instance fixed: stats base-URL was hardcoded `localhost:3001` in TWO places → unified to same-origin `/api` (commit fixes CORS on :3013 + dedup). KEEP HUNTING for more duplication in the panel authoring.
3. **Pipelines VISIBLE** — the query-builder/data-pipe (`features/data-layer`, `DataModelingPanel`, `PipelineBuilder`) is STILL buried behind the Steward "Model" lens. Owner wants it prominent.
4. **The RIGHT SIDE of the Constructor "doesn't fit"** (overflow) — recurring. The Placement Law (SL-track) didn't satisfy him. → Fable UI benchmark commissioned to design the world-class right-panel/overflow, best-of-all-reference-platforms.
Also live-hit: **chrome authoring not visible; left-bar nav not editable** (deep-authorability gaps).

**Hard rules he re-stated:** be the LEADER/ARCHITECT who sees the FULL PICTURE (don't make him teach you) · NEVER build on an anti-pattern (foundation-first) · ACTIVATE architecture, don't leave it in shadow ([[activate-not-shadow]]) · do the CANONICAL form not shortcuts · IMPLEMENT, don't produce shelf specs · ideas by PRIORITY (no AI now; vintage = a data-viz feature, deferred) · optimize tokens/time via logistics (he flagged my scatter/detour). Empower seniors to surface problems (observation duty).

**Running when the limit was hit (DO NOT relaunch; await + review):**
- `react-specialist` — ACTIVATE the object model so the KPI card is a first-class selectable/editable OBJECT, live on dev :3013 (owner's original grievance). Review its result; it may need the deploy.
- `platform-architect` (Fable-5) — `SPEC-worldclass-authoring-ui.md`: benchmark ALL reference platforms' UI+functionality → the unified best authoring UI that SOLVES the right-side + surfaces pipelines + kills duplication. **The lead OWNS implementing this — it must NOT become a shelf doc.**

**Fable's UI design DELIVERED + committed (`57221e6`): `docs/architecture/proposals/SPEC-worldclass-authoring-ui.md` + `ADR-037`.** THE design to IMPLEMENT (owner: not a shelf doc). It nails all his complaints. Three findings (why the right side still doesn't fit after SL-0..5): the Placement Law is NEGATIVE (evicts heavy → invisibility; filters shrank to a button, encoding absent; rich values fall back to raw-JSON `JsonControl`); the focus-view loses the subject (form in a void); the law weighs incomplete schemas. Three moves (best-of-breed combined, all grounded in seams we own — projections not hand-designed):
1. **Summary-Card Inspector** (the acute right-side fix): dock = sections from ONE registry; every rich subject renders a constant-size POPULATED **SummaryCard** ("bar · GDP (current) · by year", "3 bars · 7 controls") with an "Open →" affordance — NOT raw JSON. Dock is constant-weight → cannot overflow AND nothing buried. `FF-DOCK-CONSTANT-WEIGHT`, `FF-NO-RAW-JSON-DEFAULT`. (Figma value rows, generalized.)
2. **The Stage** (focus-view v2): the live subject rides along with its editor + breadcrumb (Grafana/Explore triptych, `FF-STAGE-HAS-SUBJECT`). Named: Chart Studio, Filters, Perspectives, Metric Calc, Model. Placement Law kernel KEPT; §3.4 form-only realization SUPERSEDED.
3. **Data-Flow Spine** (pipelines VISIBLE — kills the Model-lens burial = Metabase's mistake): Model stage = a flow map `source→spec→metric→used-by` (from registries we own) + a lineage summary card on every data-bound element (with agency/unit/preliminary badges, Law 9).

**object-model activation = WIP `a43b3c6`** (kpi-card-as-object, cut by limit, UNVERIFIED, may conflict with the Summary-Card Inspector) — review vs the SPEC, then complete-or-revert.

**TRIAGED LEDGER — every owner-raised open item (nothing lost; drive each to done, do not defer):**
| # | Item (owner raised) | Status / route |
|---|---|---|
| 1 | Right side "doesn't fit" | 🔄 Move 1 Summary-Card Inspector (building, agent) |
| 2 | CORS fix (`46730eb`) not on dev :3013 | → lands with the Move-1 dev-line image REBUILD+redeploy (branch HEAD has it) |
| 3 | live-sync INCOMPLETE — only `apps/panel/src` mounted, packages/* baked → packages changes need rebuild | 📋 CANONICAL fix: expand the dev mount to the whole workspace source (packages/*/src, exclude node_modules) so ANY change HMRs. Do after Move 1 (avoid dev-line collision). |
| 4 | object-model WIP `a43b3c6` HAND-WIRES projection per-plugin (`registerNodeProjector('kpi-strip',{toNode: kpiSpecToCardNode})` + `id ?? ''` id-less-node bug) — special-casing, NOT Fable's generic "every element is a node" | 🔄 Move-1 agent tasked to reconcile (revert→GENERIC: projection derived from each promoted type's registered META/codec, no per-plugin wire). VERIFY it went generic. `enablePromotion('kpi-card')` itself is FINE (app-boot activation of a generic engine flag, Law 1/3). |
| 5 | Chrome authoring STILL not visible | 📋 tracked → deep-authorability wave (SPEC-deep-authorability §7 + the completeness gate; after Move 1/3) |
| 6 | Left-bar nav NOT editable | 📋 tracked → same deep-authorability wave |
| 7 | Pipelines STILL not visible (buried behind Steward Model lens) | → Move 3 Data-Flow Spine (flow map + lineage cards) |
| 8 | Scattered/duplicated functionality (DRY) | 🔄 ongoing HUNT — CORS/stats-base was one instance (fixed+deduped); keep finding + consolidating |

**Immediate next steps (next session):** (a) IMPLEMENT the SPEC **right-side-first** = Move 1 the Summary-Card Inspector (the acute fix), then Move 3 Data-Flow Spine (pipelines visible), then Move 2 the Stage — this is the owner's mandate, VISIBLE not shelf. (b) deploy CORS fix (`46730eb`, packages) + the UI work to dev :3013 (dist rebuild + dev-line panel redeploy; statdash-dev ONLY; prod/staging untouchable), verify CORS gone. Env: [[three-tier-environments]] (:3013 dev, admin/dev_admin_pw_123). Toolchain: [[remote-dev-cli]]. Don't relaunch the cut agents; drive the build.
