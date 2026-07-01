---
name: responsive-fix-wave
description: State of the AUDIT-responsive.md fix wave + the aspect-ratio panel height-cap design-system invariant
metadata:
  type: project
---

The responsive fix wave (driven by `platform/work/AUDIT-responsive.md`, authored against the **live :3002 server which builds from `main`**) is being applied incrementally on `feat/tenant-agnostic-platform`.

**Why the audit overstates some findings:** the audit shots are from `main`. The branch already applied **R3** — `.page-content` now caps at `--page-measure` (defaults to `--size-container-wide`=1280px) in `pages/inner-page/default/page-layout.css`. So the audit's "giant ~1766px ultrawide treemap" (F7) is a main-only artifact; on-branch the page-content (hence every section) is already width-bounded to 1280. **Always re-render the current branch before trusting an audit finding — don't act on the main-rendered shots.**

**Aspect-ratio panel height cap (added for F7):** `[data-aspect]` (and fixed-aspect `[data-height="16:9|4:3|1:1|21:9"]`) in `packages/styles/src/css/node-styles.css` now carry `max-height: var(--size-panel-max-height)` (token = `clamp(380px, 56vh, 560px)` in tokens.css). Root cause of "giant empty blue blocks": aspect-ratio gives height ∝ width, so a full-width panel grows unbounded — R3's width cap only saves the sidebar layout, not full-width/wider-measure layouts. The cap is the layout-independent guard.
- **Gotcha:** `max-height` alone makes aspect-ratio *preserve the ratio off the capped height* → the panel shrinks its WIDTH (e.g. 1198→996, centered, ratio-correct) instead of staying full-width. Fix: also pin `width: 100%` on `[data-aspect]` so the capped panel stays full-bleed and the ratio simply yields (full-width × capped-height). Proven in real Chromium: 1198×674 → 1198×560 at 1920/2560/3440.

**How to apply:** for any "panel too tall / dominates page at ultrawide" report, the in-system lever is `--size-panel-max-height` + the aspect mechanism — not a per-shell magic height. Treemap "looks empty" was compounded by tiles showing name-only; `panels/chart/default/components/TreemapChart.tsx` Block/total now render name + `item.formatted` value + pct. Per-tile COLOR (all flat accent blue) is a charts-interpreter/provisioning concern (`packages/charts` special.ts `buildDataPoint` + measure-dim color field) — **out of the {react,plugins,styles} lane; report, don't fix.**

Also landed: F4 — inner `.page-header__title` was a fixed `1.0625rem`; now `var(--font-size-fluid-lg)`.
