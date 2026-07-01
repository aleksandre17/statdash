---
name: perspective-axis-p6-blocker
description: P6 (retire System A) BLOCKED 2026-06-27 — items #4 (delete modeOrder/mode-bar) + #8 (retire useModeContext) + full KpiSpec.mode deletion hit LIVE deps the geostat config still uses (P5 deferred them). NOT dead code → deleting = regression. ESCALATED, no edits made. Builds on [[perspective-axis-p5]].
metadata:
  type: project
---

# Perspective-axis P6 — retire System A — BLOCKED + ESCALATED (2026-06-27)

Task: delete the FULL System A set byte-identically (8 items). Surveyed the whole surface; made NO edits. Split into SAFE-NOW vs LIVE-DEP-BLOCKED.

## The blocker (why I stopped, no edits)
P5 (see [[perspective-axis-p5]]) DELIBERATELY KEPT three System-A surfaces in geostat.provisioning.json as still-LIVE: `modeOrder:["year","range"]` (×3 pages), the `mode-bar` node (×3, renders the year/range TOGGLE), and `KpiSpec.mode:"year"/"range"` (every kpi-strip item partition). These are NOT dead code.
- **`mode-bar`** = `ModeBarShell` (plugins/nodes/mode-bar) reads `ctx.mode` (`useModeContext`) → renders the live user-facing perspective switcher. There is NO perspective-toggle replacement node. Deleting `mode-bar`/`modeOrder` from engine+schema+config (task #4) = removes the toggle UI = REGRESSION, not a byte-identical deletion. Requires a NEW perspective-bar node + config migration (P5-style) FIRST.
- **`useModeContext`/`ModeContext`/`ModeProvider`** (task #8) do NOT only seed `perspectiveState`. They ALSO drive `mode-bar` rendering (`ctx.mode`), the `modeSet`=`applyEffects` toggle, and nav. Load-bearing while `mode-bar`+`modeOrder` live in config.
- **`modeRegistry`** alias (task #7): consumers `ModeContext.tsx:20`, `constructor.ts:23,138`. Renaming is mechanical BUT `ModeContext` can't retire (above), so the alias chain stays entangled with live System A.
- **Full `KpiSpec.mode` deletion** (plan P6 line 131; NOT in task's explicit 8 but implied by "no surviving legacy"): geostat kpi-strips still partition by `mode:year/range` (kpi.ts:221,309 filter `s.mode===ctx.timeMode`). Deleting the FIELD breaks the config; must migrate kpi partition to `when:perspective-is` gating FIRST (P5-style).

## SAFE-NOW set (byte-identical dead-code, verified deletable — NOT yet done, awaiting architect nod on sequencing)
1. `ctx.timeMode` reads → `activePerspective(ctx.perspectiveState)` then DELETE `SectionContext.timeMode` + `TimeMode` type. Reads: kpi.ts:221,309 (interpretKpis + extractKpiRequirements partition), template.ts:28 ({year,range} badge union), mergeScope.ts:24. SiteRenderer seeds `perspectiveState[timeModeKey]=currentMode===old ctx.timeMode` → byte-identical. COST: ~50 test fixtures + STUB_CTX (useFilterState:64) + 3 plugin EMPTY_CTX construct `timeMode:'year'` → all need the field removed (Class-M type change).
2. Delete legacy `barShowWhen` default-gate branch (useFilterState.ts:119-129) → `isAlwaysResolve || ownsActive.has(key) || !ownsAny.has(key)`. Byte-identical for collapsed single-bar geostat: non-owned account/sector/measure/region still resolve via `!ownsAny`; spanFrom/spanTo via alwaysResolve.
3. `ContextMapping.timeMode`, `ParamYearSelect.rangeKey`/`rangeLabel`, `BarDef.timeToggle`/`timeModes`/`TimeModeItem` (filter-params.ts) — geostat grep=0 for all. Dead.
5. `mode-is`/`mode-in`/`mode-not` ops (visibility.ts:54-56,96-98) + panel registration — geostat grep=0 (uses `perspective-is`). Dead.
6. `ScopeOverride.compare`+`.timeMode` (scopeOverride.ts), `resolveCompareRows` (resolveNodeRows.ts:275), renderNode compare block (:264-270), `RenderContext.compareRows`/`compareLabel` (context.ts:76,78), exports (engine/index.ts:101). `view.scope.compare` set by 0 configs; compareRows/Label written-never-read. Dead.

## The entanglement (why I didn't land the SAFE set partially)
Even the safe deletions can't reach the task's "no surviving legacy" end-state: deleting `SectionContext.timeMode` is fine, but `modeRegistry`/`ModeContext`/`mode-bar`/`modeOrder`/`KpiSpec.mode` MUST stay (live config) — so System A does NOT fully retire. A partial P6 leaves a half-migrated tree (perspectiveState seeded BY the still-live `mode.current` toggle). The clean end-state needs a P5.2 config migration (perspective-toggle node + kpi when-gating + perspective-ordered nav) BEFORE the full System-A delete.

## Recommendation to architect
Either: (A) authorize a P5.2 config-migration phase (new perspective-bar toggle node + migrate geostat mode-bar→perspective-bar, KpiSpec.mode→when:perspective-is, modeOrder→perspectives[]-derived nav) BEFORE P6; THEN P6 deletes everything. OR (B) scope THIS P6 to the SAFE-NOW set only (items 1,2,3,5,6 + rename modeRegistry consumers but KEEP the singleton, KEEP mode-bar/modeOrder/KpiSpec.mode/useModeContext as the still-live toggle), explicitly accepting System A is NOT fully retired this phase. The task as written (full delete, byte-identical, no surviving legacy) is internally contradictory given P5's deferral.
