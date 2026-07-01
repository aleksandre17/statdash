---
name: perspective-axis-review
description: 2026-06-27 capstone pre-code review of VISION #2 time-mode → generic perspective-axis plan; naming drift + contract-requiredness + viewState-vs-evalVisibility wiring gaps found
metadata:
  type: project
---

Capstone adversarial review of the time-mode → generic perspective-axis reframe (VISION #2), reviewed BEFORE any code written. Docs: `platform/work/VISION-mode-as-view-axis.v2.md` + `.v2-PLAN.md`.

**Why:** one-way-door foundational decision; user demands IDEAL end-state, zero degradation, no agnosticism loss, research-grounded, code adapts to plan (Law 7).

**How to apply:** when this work resumes, the plan is sound in thesis but had these gaps to fix in Vision #3:
- NAMING DRIFT (HIGH): user's confirmed decision = `perspective`; both plan docs still say `view`/`viewAxis`/`viewState`/`view-is`. Docs predate the decision. Vision #3 must rename throughout.
- CONTRACT REQUIREDNESS (HIGH): `ContextMapping.timeMode` is REQUIRED (`filter-params.ts:293` `timeMode: keyof P & string`), not optional. Configs can't drop it until the type goes optional first (expand-contract ordering: relax contract in P1, not P6).
- WIRING GAP (HIGH): `evalVisibility` (`config/visibility.ts:39`) reads mode from a SEPARATE positional param `mode?`, sourced at the renderNode callsite from `ctx.mode.current` (a ModeContext, `renderNode.ts:229`), NOT from any ctx slot. The plan's "view-is reads ctx.viewState" needs the new `viewState` slot threaded to evalVisibility's callsite — that's a real signature/callsite change the plan underspecifies.
- FILE-PATH ERRORS in plan: registry is `packages/core/src/mode/registry.ts` (plan says `packages/react/src/mode/registry.ts`); visibility evaluator is `packages/core/src/config/visibility.ts` (plan's §3.3 says `visibility.ts`/`engine/visibility.ts` loosely). `modeOrder` lives in 3 schema page defs + SiteRenderer + navUtils.

**VERIFIED-TRUE plan claims (good):**
- `by-mode` = 0 config uses (grep confirmed); member at `data-spec.ts:181`, resolver `resolvers.ts:141`, schema `page-config.schema.json:69`. Safe to delete.
- Live page already lazy: `renderNode.ts:228` gates visibleWhen before row resolution.
- SSR double-warm real: `warm.ts collectRequirements` + `api.ts walkNode` both recurse via `nodeWalk.collectChildNodes` with NO visibleWhen gate. `view` is in DATA_CARRYING_KEYS (nodeWalk.ts:25) so not walked as children, but visibility never consulted.
- mode-clearing effects, alwaysResolve gate (`useFilterState.ts:88-112`), dup bars — all real.

**Readiness call given:** plan is READY-WITH-REVISIONS (no blocking flaw in thesis; the 3 HIGHs are wiring/contract precision, fixable in Vision #3). [[project_ship_readiness]]
