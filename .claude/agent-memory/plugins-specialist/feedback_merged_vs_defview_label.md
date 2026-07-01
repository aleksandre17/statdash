---
name: merged-vs-defview-label
description: defineShell gives a `merged` prop (VIEW_DEFAULTS + def.view) — read view fields off `merged`, never `def.view` raw; the one exception is a node with an EXTENDED view shape
metadata:
  type: feedback
---

`defineShell` passes a `merged: ViewParams` prop = `{ ...VIEW_DEFAULTS, ...def.view }`. The documented contract (defineShell.tsx header) is **"never read def.view raw"** — read view-level fields (e.g. `merged.label`, `merged.subtitle`) off `merged`.

**Why:** centralizes the defaults merge so a shell can't diverge from the standard VIEW_DEFAULTS. Byte-identical for fields VIEW_DEFAULTS omits (`label`, `subtitle`, `position`, …): `merged.label === def.view?.label` value-wise, but it's the contract-correct seam.

**How to apply** when cleaning a panel/node shell:
- Shell reads `def.view?.label` → switch to destructuring `merged` from the render fn (`render({ def, ctx, vs, merged })`), pass it down to the inner control, read `merged.label`. Import `ViewParams` type for the control's prop.
- EXCEPTION — a node whose `view` is an EXTENDED ViewParams (e.g. `MapNode.view = ViewParams & { geoDim, valueField, scale, topology, palette }`): `merged` is typed as base `ViewParams` and LOSES the extra fields, so reading `def.view` raw there is correct and NOT a smell. Justify it, don't churn it.
- ChartShell keeps `def.label ?? merged.label`: `def.label` is the chart's OWN header (ChartDef field, real fallback), only the second operand was the raw `def.view` read.

Related: `accentStyle(color)` from `@statdash/react` replaces any inline `color ? { '--sc': color } as CSSProperties : undefined` projection — including per-row data colors in table sub-components (SimpleTable bar-cell), not just node `def.color`. It does NOT apply to other custom props like KpiCard's `{ '--kc': color }` (different property).
