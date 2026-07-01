---
name: perspective-axis-p4-blocker
description: P4/P5 geostat config migration — the byte-identical BLOCKER found 2026-06-27. The two-bar collapse + effects-removal cannot be byte-identical while System A internals (bar-gated default resolution) stay live (task constraint #5). Escalated to architect with a concrete alternative path.
metadata:
  type: project
---

# Perspective-axis P4 (config migration) — byte-identical BLOCKER (found 2026-06-27)

Orchestrator's "P4" = the PLAN's **P5** (migrate geostat.provisioning.json 3 pages). Builds on landed P1-P3 + the parser/scopeCtx wiring ([[perspective-axis-p1]]/[[perspective-axis-p2]]/[[perspective-axis-p3]]). Task demands BYTE-IDENTICAL render in both perspectives × both locales × 3 pages, with FF-SNAPSHOT-VIEW-EQUIV.

## The conflict (three task constraints are mutually inconsistent)
1. "Collapse the two bars (year-bar/range-bar) into ONE filter set."
2. "Remove the mode-clearing `effects`."
3. "Leave System A engine internals for P6 — do NOT remove the bar-visibility gate / alwaysResolve / ContextMapping.timeMode."
+ "BYTE-IDENTICAL is the law of this phase."

## Why (1)+(2) break byte-identical while (3) holds — the mechanics
- **Default-resolution gate is BAR-scoped, not filter-scoped.** `useFilterState.ts` `defaultParams` filter (packages/react/src/filters/useFilterState.ts:104-112) gates default resolution on `bar.showWhen` ONLY (`barShowWhen`). Per-filter `showWhen` (ParamMeta.showWhen) is RENDER-ONLY (FilterRenderers), never consulted for default resolution.
- Today: year-bar `showWhen:{mode≠range}` owns `year`/`account`/`sector`; range-bar `showWhen:{mode:range}` owns `fromYear`/`toYear`. In range mode the year-bar is HIDDEN ⇒ its `year` default (pick:last=2025) is NOT resolved ⇒ `ctx.dims.time` stays unset ⇒ the dynamics timeseries renders the FULL span (the parity fix). Symmetric for year mode.
- Collapse to ONE bar ⇒ that bar has no (or trivially-true) `showWhen` ⇒ EVERY param default resolves in BOTH perspectives. `year`=2025 pins `ctx.dims.time` even in range mode ⇒ **timeseries collapses to one year** = render REGRESSION (exactly the gate's documented hazard, useFilterState.ts:89-97).
- **Effects removal also regresses**: effects clear stale cross-mode URL keys on switch; without them a user-picked `year` persists in URL state into range mode → stale pin. Not byte-identical.

## Why `scope.timeBinding` can't yet carry the binding byte-identically (engine gap)
`scopeCtxByPerspective` (perspective-axis-parser.ts:128-163):
- **Year PIN fires ONLY for a literal one-element NUMBER list** (`isYearsSpec` + len 1). geostat year is a USER param (`year`, pick:last) → needs to track `ctx.dims.time`, not a literal. A ctx-ref pin (`{$ctx:year}`) is NOT isYearsSpec → falls to the WINDOW branch (wrong). **Ctx-ref single-period pin is unsupported.**
- **Window writes to `${dim}From`/`${dim}To` = `timeFrom`/`timeTo`.** geostat range resolvers read `fromYear`/`toYear` (KPI cagr `from:{$ctx:fromYear}`; queries `fromDim:'fromYear'`/`toDim:'toYear'`; context.dims maps them). No field redirects the window to the legacy from/to keys. So a declared range binding writes keys NOBODY reads (no-op) — the legacy bar params still do the real binding.

⇒ `scope.timeBinding` is the P6 end-state mechanism; in P4/P5 it cannot REPLACE the legacy bar binding byte-identically without engine changes (ctx-ref pin support + configurable window target keys), which constraint #3 defers to P6.

## The escalation alternative (offered to architect)
Byte-identical-safe P4 = the SUBSET that is render-neutral NOW:
- ADD `page.perspectives` Record (SYNTHESIS shape: `{ mode: { perspectives:[{id:year,scope:{timeBinding:pin}},{id:range,scope:{timeBinding:window}}] } }`) DECLARATIVELY — but it's inert today (scopeCtx writes unread keys / identity), so render-neutral. Param stays `mode` (permalink-identical).
- CONVERT the 11 `{op:eq,param:mode}` gates → `{op:'perspective-is',perspective:...}` (param-less ≡ eq-on-mode per P2 alias; byte-identical).
- KEEP the two bars, KEEP effects, KEEP KpiSpec.mode tags OR convert KPI gating — but DO NOT collapse bars / remove effects until the engine owns the binding (P6, or a dedicated pre-P6 engine step).
- Full bar-collapse + effects-removal needs EITHER (a) engine: filter-scoped default-resolution gate + ctx-ref pin + configurable window keys in scopeCtxByPerspective, OR (b) doing it WITH P6 (transfer binding to scope.timeBinding + delete the bar-gate together). This is a DataStore/interpretSpec-adjacent design call = architect's.

## Gate state: NOTHING changed yet (investigation only; no edits made)
