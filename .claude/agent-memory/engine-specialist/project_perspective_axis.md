---
name: perspective-axis
description: The perspective-axis refactor (P0-P7, SHIPPED, grep-clean) — retired privileged timeMode/mode System A into a generic perspective=f(state) OLAP axis. Durable seam shape, recurring hazard classes, and gotchas that still bind. Superseded further by [[project_tm_strangler]].
metadata:
  type: project
---

# Perspective-axis refactor — durable record (shipped across P0-P7, 2026-06-27)

One-way-door refactor replacing the privileged `timeMode`/`mode` weave ("System A") with a
generic `perspective = f(state)` OLAP named-query-view axis ("System B"). Fully landed and
**grep-clean** (P6 deleted every legacy surface: `ModeContext`, `modeRegistry` alias,
`mode-bar` node, `modeOrder`, `KpiSpec.mode`, `mode-is/-in/-not`, `ScopeOverride.compare`,
`SectionContext.timeMode`). Current names: `PerspectiveContext`, `perspectiveRegistry`,
`perspective-bar`, `perspectiveKey`, `perspective-is/-in/-not`. Detailed phase-by-phase
history lived in `project_perspective_axis_p0..p7` — deleted; git log holds it if ever needed.

## Landed shape (read the code for exact fields; this is the *why*, not a field list)
`page.perspectives: Record<param, {perspectives: PerspectiveDef[]}>`. `PerspectiveDef =
{id, label, icon?, when?, scope?, available?}`. `perspectives[0]` IS the default (no separate
`default` field — one SSOT, array order). `scope` is a **registry-keyed Record**
(`registerPerspectiveScopeKey`), never a closed interface — a new scope door is always an
additive registration (OCP), never an interface-widen. Registered keys today: `binding`
(canonical, TM-STRANGLER's `DimBinding`+`Selection` discriminant — see
[[project_tm_strangler]]), `timeBinding` (deprecated Postel alias, pin/targetKeys shape),
`metric` (a measure-SWAP, e.g. `{$ctx:'measure'}` pin — NOT the point↔cagr carrier, that's
node-local `KpiValueSpec.type`).

**Type trap (still load-bearing):** core's `PerspectiveScope` is `ContractPerspectiveScope &
{...}` — an **intersection**, never `interface extends Contract...`. An interface lacks an
implicit index signature, which breaks assignability back to the contracts-side
`Record<string,unknown>` (the widen⇄refine invariant every `Contract*`⇄core-refined pair needs).

## Recurring hazard classes (apply these lessons to ANY future per-mode/per-bar design)
1. **Default-resolution gate ≠ render-visibility gate.** A UI collapse (e.g. two bars → one)
   silently breaks if default-value resolution is keyed off the CONTROL's visibility
   (`bar.showWhen`) rather than semantic OWNERSHIP of the param. Fix pattern:
   `perspectiveOwnedParamKeys` — an ownership-keyed gate in `useFilterState`, fully decoupled
   from `ParamMeta.visibleWhen` (render-only, added separately). **Keep these two concerns on
   two different fields, always** — see [[reference_alwaysresolve_seam]].
2. **A generic axis can't replace a hand-rolled multi-field UI until the engine can express
   the UI's primitives declaratively.** Collapsing the geostat two-bar time UI onto
   `scope.binding` required the engine to first gain (a) a ctx-ref **single-period pin**
   (`resolveTimePin`) and (b) **configurable window target-keys** (write `fromYear`/`toYear`,
   not just `${dim}From/To`) — without those, byte-identical migration is impossible; the
   correct order is engine-capability-first, config-migration-second.
3. **Verify a live control's rendered ground truth before trusting a spec's "derives from X."**
   The perspective-bar toggle's live labels/icons came from `manifest.modes` (site-manifest),
   NOT from the newly-authored `PerspectiveDef.label` the plan assumed — grep the actual Shell
   component's data source before believing an architect's spec. Resolution here: the axis
   ABSORBED presentation (`PerspectiveDef.icon` added, labels re-authored to match ground
   truth) rather than silently accepting a visual regression.
4. **Sequence "migrate every live consumer" strictly BEFORE "delete the legacy machinery."**
   Three separate STOP-and-escalate blockers (byte-identical bar collapse, toggle label
   conflict, System-A retirement) all had the same root cause: a delete task assumed dead code
   that was still live in one un-migrated config surface. Full grep-zero retirement only became
   safe once literally every config site had migrated (P5/P5.1/P5.2 before P6).
5. **Alias-then-retire, not big-bang rename.** `perspective-*` visibility ops shipped ALONGSIDE
   `mode-*` as behavioral aliases (`activeForExpr`, param-less perspective-* ≡ mode-*); `mode-*`
   was deleted only once config grep-zero. Same pattern applied to `scope.timeBinding` →
   `scope.binding` (TM-STRANGLER) — deprecated alias kept, Postel-folded via one dispatcher.

## EAGER vs LAZY render/warm split (discovered here, not timeMode-specific — still true)
The LIVE React render path is LAZY: `renderNode` evaluates `view.visibleWhen` and returns
`null` BEFORE resolving rows/KPIs — hidden nodes never warm on the client. The SSR/warm path
(`warm.ts` collectRequirements + `api.ts` walkNode) is EAGER: it walks the WHOLE tree and calls
`extractRequirements`/`interpretSpec` on every node regardless of visibility. **A "lazy render"
optimization has zero effect on SSR/warm cost** — only a warm-side visibility gate (which
nothing implements today) would prune that.

## Gotchas that still bind
- **no-tenant-content gate scans COMMENT TEXT**, not just string literals, in `packages/core`
  and `packages/react`. Never write a tenant name (e.g. "geostat") into a comment — reword
  generically ("an un-migrated page"). See [[reference_tenant_content_gates]].
- Editing a core export used by `apps/api`? See [[reference_apps_api_engine_dist]] (dist-only
  consumption, needs a rebuild).
- **400-line bloat ceiling** repeatedly forced new sibling fitness files instead of appending —
  when a fitness file is near-ceiling, start a new file rather than trip the hook.

## Adjacent seams
[[reference_no_privileged_literal_guard]] · [[reference_alwaysresolve_seam]] (same gate family)
· [[reference_time_dim_ssot]] · [[project_tm_strangler]] (the DimBinding+Selection
generalization superseding `PerspectiveTimeBinding`/`scope.timeBinding`).
