---
name: perspective-axis-p52
description: P5.2 LANDED 2026-06-27 — migrated the 3 surviving System-A surfaces onto the perspective model. Architect ruled (B) on the toggle-label conflict: the perspective AXIS owns its toggle presentation (PerspectiveDef.label+icon). RESOLVES [[perspective-axis-p52-blocker]]. Builds on [[perspective-axis-p51]].
metadata:
  type: project
---

# Perspective-axis P5.2 — last System-A surfaces migrated (LANDED 2026-06-27)

Resolves the [[perspective-axis-p52-blocker]]: architect ruled DECISION (B) — the perspective axis OWNS its toggle presentation (label+icon authored on PerspectiveDef, the SSOT). RENDER-AFFECTING; NOT committed/deployed (orchestrator deploys + visually verifies, then commits).

## Migration (1) — perspective-bar toggle (decision B)
- **`icon?: string` added to PerspectiveDef** — contract (`packages/contracts/src/perspective-axis.ts`, agnostic icon-registry KEY, never SVG). Core `PerspectiveDef extends Omit<Contract..., 'when'|'scope'|'available'>` so `icon` flows through automatically (NO core type edit). Rebuild contracts→engine dist (apps/api uses dist).
- **`perspectiveModeDefs(axis, locale, fallback) → ModeDef[]`** (perspective-axis-parser.ts, exported from index) — maps each PerspectiveDef → `{id, label: resolveLocaleString(...), icon}` in array order. Returns EXISTING ModeDef shape (the `mode` triad's `available` element; field renamed to `perspective` in P6).
- **NEW `perspective-bar` plugin node** (`packages/plugins/nodes/perspective-bar/`, mirrors mode-bar). Shell reads `ctx.mode` triad + REUSES `mode-bar.css` (same DOM classes `.mode-tab-group/.mode-tab-btn/.mode-tab-icon` = byte-identical). i18n namespace = node type ('perspective-bar') with SAME aria-label content. No `modes` field (options come from the axis), optional `key`.
- **SiteRenderer** (`packages/react/src/engine/SiteRenderer.tsx`): `activeAxis = axes?.[timeModeKey]`; `modeList = activeAxis.perspectives.map(id)` (feeds useModeContext for current/set); `mode = {...useModeContext(...), available: perspectiveModeDefs(activeAxis, locale, fallbackLocale)}` (axis-owned label/icon OVERRIDE). useModeContext STILL used for current/set (constraint: keep working until P6).
- **REGISTRATION (the many-barrel rule for a node):** nodes/index.ts (auto-registers at runtime via setupRegistrations `Object.values(Nodes)`) + registry.ts + catalog.ts (+PALETTE_META import & array) + emit-page-config-schema.ts ALL_METAS + 3 fitness ALL_METAS (page-config-schema, schema-completeness, defaults-guard) + no-privileged-node PLUGIN_NODE_TYPES. Then `pnpm gen:schema` regenerates page-config.schema.json (adds node_perspective-bar__default).
- geostat config: `{modes,type:mode-bar}` → `{type:perspective-bar}` ×3; PerspectiveDef labels set to manifest.modes: year→{ka:წლიური,en:Annual}+icon:calendar, range→{ka:დინამიკა,en:Dynamics}+icon:calendar-range (replaced P5 placeholders წელი/შუალედი). Byte-identical ka; en now locale-correct (closes the ka-only-in-en gap).

## Migration (2) — KpiSpec.mode → when:perspective-is (byte-identical-clean)
- **REMOVED `KpiSpec.mode: 'year'|'range'|'both'`** (`data/kpi.ts`), added `when?: VisibilityExpr`.
- **Factored ONE `kpiVisible(spec, ctx)`** (data/kpi.ts) = `!spec.when ? true : evalVisibility(spec.when, ctx.dims, ctx.perspectiveState)`. Wired into BOTH `interpretKpis` (render) AND `extractKpiRequirements` (warm) — warm===render SSOT (the §0b kpi-strip-crash invariant). Both already receive sectionCtx (carries perspectiveState) — NO signature change. evalVisibility import added (kpi.ts is core, visibility is core — same layer).
- byte-identical proof: old `s.mode==='both'||s.mode===ctx.timeMode`; new param-less perspective-is resolves via activePerspective(perspectiveState) reading perspectiveState['mode'] (LEGACY_MODE_PARAM) = currentMode = old timeMode. Same flip.
- geostat: 22 kpi `"mode":"year"/"range"` → `"when":{op:perspective-is,perspective:X}`; no "both" existed.
- **Migrated EVERY KpiSpec literal in tests** (mode was REQUIRED → removal = TS excess-prop error): roundtrip-kpispec, roundtrip-pages, kpi-value-binding, useKpiRows.async (+ added perspectiveState:{mode:'year'} to its makeCtx — new predicate reads perspectiveState not timeMode).

## Migration (3) — modeOrder → perspectives[].id order (byte-identical-clean)
- SiteRenderer navSections: `extractNavSectionsFromChildren(children, timeModeKey, modeList)` (modeList = axis ids) instead of `page.modeOrder`. No navUtils signature change (3rd arg is the same ordered id list).
- Deleted `modeOrder` from geostat config ×3 + `generatePageConfigSchema.buildPageBaseProperties` (wire schema). Engine `NodePageConfig.modeOrder?` STAYS (Postel desugar for un-migrated pages, deleted P6); parsePerspectiveAxes still accepts modeOrder input (inert for migrated).
- panel `pageSchemaSource.ts` modeOrder authoring field UNTOUCHED (out of scope, legacy authoring field until P6).

## NEW FITNESS (avoid appending to 215+-line files)
- `packages/core/src/config/perspective-p52.fitness.test.ts` — FF-PERSPECTIVE-BAR-FROM-AXIS + FF-PERSPECTIVE-BAR-EQUIV + FF-KPI-WHEN-NOT-MODE (stub DataStore, ka-byte-identical oracle, warm===render code-set, legacy-mode-filtered equivalence, no `mode` field survives).
- `packages/react/src/engine/navOrderFromPerspectives.fitness.test.ts` — FF-NAV-ORDER-FROM-PERSPECTIVES (sort by perspectives[].id === legacy modeOrder order; non-vacuous reversed).
- **Updated the P5 equiv harness** (`apps/api/.../perspective-migration-equiv.fitness.test.ts` deriveCtx): mode-id list now `axes?.['mode']?.perspectives.map(id) ?? modeOrder ?? []` (mirrors new SiteRenderer; modeOrder param now optional) — else `.includes` threw on the now-undefined `cfg.modeOrder`. FF-SNAPSHOT-VIEW-EQUIV stays green.

## GOTCHA (re-confirmed): no-tenant-content gate scans engine+react comment TEXT (see [[tenant-content-gates]]). My react navOrder fitness comments said "geostat [year,range] axis" → reworded to "a [year,range] axis". (Core IS NOT scanned — perspective-p52.fitness keeps "geostat" in comments like pre-existing core files.)

## Green: typecheck (tsc -b, exit 0) · lint 0-err (44 react-refresh warns = 43 baseline +1 PerspectiveBarShell, same accepted Shell pattern as ModeBarShell) · check-laws · full suite 1759 (+13 from 1746). NOT committed/deployed.

## NOT done in P5.2 (per scope / for P6)
KpiSpec.mode union grep-clean is DONE (removed). NOT done: useModeContext/ModeContext/modeRegistry deletion + `mode`→`perspective` triad rename + mode-bar node deletion + panel pageSchemaSource modeOrder field + NodePageConfig.modeOrder type field (all P6, the System-A retirement — see [[perspective-axis-p6-blocker]]).
