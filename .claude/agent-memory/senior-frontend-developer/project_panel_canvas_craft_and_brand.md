---
name: panel-canvas-craft-and-brand
description: "Studio canvas craft punch-list (P3/P5/P6/P7/L2 seams) + AR-52 W1 brand-in-manifest (portable themeOverrides, dark-safe apply mechanism). Consolidated distillate."
metadata:
  type: project
---

> Consolidated 2026-07-22 from 2 sibling files (canvas-craft-batch, canvas-brand-faithful).

## Craft-batch seams (reusable, apps/panel only, zero object-model change)
- **Governed dimension labels:** `cubeEnumOptions.dimensionOptions(profile, resolveGovernedLabel?)`
  drops the `${code} (${conceptRole})` echo (conceptRole is a plumbing token). Bilingual label
  comes from `semanticCatalogOptions.governedDimensionLabels` (inverts the catalog to
  `cube-code → label(locale)`). Fallback = bare code, never blank.
- **No doubled context:** `RightDock` gained `siteContext?: boolean` — when a project-scope left
  surface owns the dock and nothing is selected, it renders a `kind='site-context'` empty-state
  instead of the page-config tree (respects FF-ONE-EMPTYSTATE/OCP).
- **Outline sibling disambiguation:** `OutlineRow.subtitle?` = the node's bound measure, derived
  generically from `props.data.query.measure` (the canonical bind location).
- **Dark-mode canvas preview — THE reusable mechanism:** a `CanvasToolbar` light|dark radiogroup
  flips `data-theme="dark"` on `canvas-root` — the ONE sanctioned dark scope (same attr the
  runner sets on `<html>`), applied on the SAME element as the brand inline `themeVars` so brand
  tokens still win and the rest goes dark (byte-identical to how the runner composes brand+dark,
  no parallel path). Only canvas-root darkens; Studio chrome stays light.
- **Collapse affordance:** `KeyboardDoubleArrowRight/Left` (»/«) — the conventional
  collapse/expand-PANEL idiom, not a disclosure caret.
- **Observations flagged (unfixed):** `KpiStripShell.tsx` throws on a mock kpi-strip with no data
  (caught by NodeErrorBoundary, fail-soft OK, but a real null-guard gap); raw i18n keys
  (`empty.title`/`empty.desc`) can render unresolved in a canvas empty-state; `LayersSurface.tsx`
  overline was hardcoded Georgian-only (Law-4 violation, see [[project_i18n_map]]).

## Brand-in-manifest (AR-52 W1) — the portable themeOverrides channel
**Root cause (Law-5 erosion):** the site's accent family was baked into the runner APP as
`[data-tenant="geostat"]` CSS, not carried in portable config. The Constructor canvas (config
only) had no brand input, so it painted the panel's own Strata tool-skin instead of the published
brand.

**Fix — ONE shared apply mechanism both canvas and runner use:**
`@statdash/styles/utils/themeVars.ts` — `buildThemeVars(...layers)` maps
`{tokenKey→value}[] → {--css-var→value}` via `TOKENS_CATALOG[key].cssVar` (later layers win).
Moved here from `apps/panel` so the runner can share it without importing apps/panel (Law 3).
**Keep styles tenant-generic** — `no-tenant-content.fitness` scans packages/styles for
`/geostat/i` with an empty allowlist; comments must say "the runner app", never the tenant name.

**Dark-safe apply (key nuance):** `applyThemeOverrides(overrides, doc?)` maintains ONE
`<style id="statdash-theme-overrides">:root{…}</style>` in head. The selector is a single `:root`
(specificity 0,1,0) DELIBERATELY — it LOSES to `[data-theme=dark]` (0,2,0), so a light-tuned
brand map never freezes the dark cascade (the [[project_dark_mode_theming]] tenant-cascade trap,
designed around). StudioShell's inline `:root:root` is 0,2,0 and would tie/beat dark — that's why
the runner uses a stylesheet rule, not inline.

**Wiring:** `SiteManifest.themeOverrides?` (optional/additive, camelCase key — the
`theme_overrides` snake-case in old api comments was aspirational, never real) → api bootstrap
projects it verbatim → `apps/geostat/App.tsx` boot applies it before first render (baked
`[data-tenant]` CSS still ships as Strangler fallback) → CanvasView gained `themeVars?` on
`.canvas-root`, StudioShell feeds `buildThemeVars(site.themeOverrides)` (the SITE's brand; Strata
stays on `:root:root` for the tool + MUI portals). Residual: non-brand base neutrals (text) still
inherit Strata on the canvas — accent/chrome faithfulness exact, base neutrals close-not-identical.

Gates: `chromeFaithful.fitness.test.tsx` (FF-CHROME-FAITHFUL — canvas brand ≡ runner brand, both
via the same transform, dark-safe, brand-less→byte-identical). Live-verify needs a DB reprovision
with the `themeOverrides` seed + a geostat dev-image rebuild (packages change ⇒ dev-server
rebuild, empirically proven by a `504 Outdated Optimize Dep`).

See also [[project_panel_canvas_chromeconfig_defect]] (chrome reach/render, sibling thread) and
[[project_semantic_token_spine]] (the Tier-2 token layer themeOverrides rebinds).
