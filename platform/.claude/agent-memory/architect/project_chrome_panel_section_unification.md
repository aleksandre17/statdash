---
name: chrome-panel-section-unification
description: SHIPPED 2026-07-01 — body-only panel-sizing (height on the content box, not the wrapper); map-collapse blocker resolved, real-browser layout-verified, committed
metadata:
  type: project
---

## STATUS (2026-07-01): the body-only height model SHIPPED (commit ade152b).
The §3 map-collapse blocker is RESOLVED and real-browser-verified. What landed:
- applyPanelStyles = width/placement ONLY (no more data-height double-emission on the .panel-col wrapper); the `.panel-col[data-height]{height:auto}` counter-rule is DELETED (root-fixed, not neutralised).
- PanelLayout gains `bodyProps?: BodyStyleAttrs` spread onto `.panel__body`; GeographShell threads `bodyProps={vs.body}`. GeographShell is the ONLY `<PanelLayout>` consumer among plugins (grep-confirmed) → that single thread = completeness for the panel path. Charts/tables/gauge/kpi live inside `.section` and already thread `vs.body` onto `.section__body` (unchanged).
- `.panel__body` padding 1.25rem→0 (flush; matches `.section__body` near-flush 0.25rem).
- The OTHER 3 PanelLayout extensions this doc proposed (controlled collapse isOpen/onToggle, disclosure slot, rootProps) were NOT needed for the map fix and are NOT built — only `bodyProps` shipped. SectionShell still renders its own `<section>` chrome (NOT yet an adapter over PanelLayout); the "single chrome primitive" unification is still aspirational, not done.
- Verification: docker/api unavailable in-shell (runner is pure API-SDUI → no bundled data), so used the cached Playwright chromium for a REAL-LAYOUT probe over the actual stylesheets — `.panel__body[data-height="16:9"]`+`.chart-wrap` resolve definite non-zero heights at every ladder width (380 floor→560 cap, cqi-proportional; half-width col=444@1440), siblings equal via align-items:stretch. Leaflet cannot collapse. Live-tile/legend/padding aesthetics = deferred to a docker-stack screenshot pass.
- Adjacent (a286833): the inert `--ar-*` DOM vars are retired at the resolver (data-aspect band-alias flag kept). FF-locked in panel-sizing.fitness.test.ts.
- Canonical "panel" size-token migration (16:9 + responsive aspectRatio→"panel", drop ratio/data-aspect aliases) still DEFERRED (needs live-render verify).

## Decision (2026-06-29)

PanelLayout (`packages/react`) = the SINGLE chrome primitive. SectionShell (`packages/plugins`) = thin engine-hooks adapter over PanelLayout. Zero parallel chrome implementations permitted after migration.

## Root cause of the map collapse revert (cad9f77)

The prior attempt stopped `applyPanelStyles` emitting `data-height` on `panel-col` (correct). BUT PanelLayout never receives `vs.body` — it has no `bodyProps` mechanism. So when the wrapper lost `data-height`, the CSS rule `.panel-col[data-height] > .panel > .panel__body { flex: 1 1 band }` died, and the body had no sizing basis. GeoMap uses `.chart-wrap` (same rule as charts via `[data-height] .chart-wrap { height: 100% }` in node-styles.css), so the fix is: add `bodyProps?: BodyStyleAttrs` to PanelLayout, thread `vs.body` through GeographShell → PanelLayout, add `.panel-col > .panel > .panel__body[data-height] { flex: 1 1 band }` CSS, delete the wrapper CSS rules.

## The 4 PanelLayout extensions required

1. `bodyProps?: BodyStyleAttrs` — spreads on `.panel__body`; height arrives here not on wrapper
2. Controlled collapse: `isOpen?: boolean` + `onToggle?: () => void` (presence = controlled mode)
3. `disclosure?: ReactNode` — renders between head and body (SectionMethodology slot)
4. `rootProps?: Record<string, string>` — extra data-attrs on root (variantAttrs from SectionShell)

GeographShell change: add `bodyProps={vs.body}` to PanelLayout call (minimal; rest unchanged).

## Height double-emission fix (resolver layer)

`applyPanelStyles` MUST NOT accept `styles` / MUST NOT emit `data-height`. Only `width` modifier.
`applyViewStyles` passes only `width` to `applyPanelStyles`.

## Canonical height token

`"panel"` (NOT `"16:9"`, NOT `"lg"`). Semantic = "the standard panel sizing band". The band is cqi-based (`--size-panel-height`), NOT a fixed 480px pixel, so `"lg"` would be wrong. Migration: add `[data-height="panel"]` alias, migrate 6 provisioning configs, then delete ratio aliases.

## SectionShell migration approach (Strangler-Fig)

SectionShell passes to PanelLayout:
- `isOpen={collapsible.open}`, `onToggle={collapsible.headProps.onClick}`, `noCollapse={merged.noCollapse}`
- `actions` slot = view toggle rendered by SectionShell itself (role-based, not index-based)
- `disclosure` slot = `<SectionMethodology>` when info.open
- `rootProps={variantAttrs}` (for data-emphasis etc.)
- `bodyProps={vs.body}` (height lands on body)
- prependLabel stays OUTSIDE PanelLayout (in `<div {...vs.panel}>` wrapper)

**Why:** SectionShell's view toggle is ROLE-based (chart/table roles via useViewToggle + GlobalVar),
PanelLayout's built-in toggle is INDEX-based. Passing it as `actions` content bypasses index gating.

## SectionSchema gap (for Constructor Phase 2)

Fields in SectionGroups but missing from SectionSchema:
- `view.toggle` → type: 'boolean', default: true
- `view.defaultOpen` → type: 'boolean', default: true
- `view.noCollapse` → type: 'boolean', default: false
- `view.width` → type: 'string', options: full/half/third

## Why: See work/AUDIT-BRIEF-styles-responsive.md §3 for the map blocker detail.
