---
name: panel-sizing-cqi-model
description: Panel height = CONTEXT-PROPORTIONAL band (AR-8) — ratio × own-width as flex-BASIS; --panel-ratio composes role×context×authored as 3 orthogonal vars (no specificity fight); wrapper NEVER carries height
metadata:
  type: project
---

Panel sizing. Base equal-height model landed 2026-06-28; ELEVATED to AR-8 context-proportional 2026-07-01.

**The band-carrier gotcha (still true):** `applyViewStyles(view)` can emit the height token on
BOTH the outer `.panel-col` wrapper AND the content body. The band must live ONLY on the body
(`section__body` / `panel__body` / `chart-wrap`) as a flex-BASIS; the `.panel-col` wrapper is a
pure flex column (`height:auto`) that stretches via the row's `align-items:stretch`. If the
wrapper freezes at the band while header+body exceed it → overflow/letterbox.

**AR-8 context-proportional band (`packages/styles/src/css/tokens.css`):**
- Band middle term is `calc(var(--panel-ratio) * 100cqi)` (was the frozen `64cqi` = a fixed 0.64
  coefficient — that was UNIFORM, not proportional; the owner's persistent complaint). `100cqi` =
  the panel's OWN inline-size (`.section`/`.panel` both `container-type:inline-size`). Bounds are
  GUARD-only: `--size-panel-h-floor:280px`, `--size-panel-h-cap:720px` (retuned 2026-07-01 from
  320/640 — see the differential note below). `--size-panel-h-fluid` is DELETED.
- **`--panel-ratio` composes THREE orthogonal INPUT vars — do NOT collapse back to one var.**
  Role + context both overriding a single `--panel-ratio` at equal specificity would CONFLICT
  (context 0.42 beats role 0.72 → map re-letterboxes at wide). Solved by fallback+multiply, each
  axis a DISTINCT var so nothing fights:
  `--panel-ratio: calc(var(--panel-ratio-authored, var(--panel-ratio-role)) * var(--panel-ratio-scale))`
  - `--panel-ratio-role` (baseline 0.58) — plugin sets it per `data-content` role.
  - `--panel-ratio-scale` (1) — context; `@container` shrinks it as own width grows.
  - `--panel-ratio-authored` — config `aspectRatio`; WINS role via the fallback order.
- **Solo ≠ paired BY CONSTRUCTION:** height = ratio × own-width, so even a constant ratio makes a
  wide solo taller than a narrow paired; the context axis shrinks the ratio when wide so the solo
  lands a content-shape instead of slamming the cap.

**Context axis (`node-styles.css`):** `@container (min-width:680px)`→`--panel-ratio-scale:.90`,
`(min-width:1040px)`→`.80` on the band carriers (`.section__body[data-height]`,
`.panel__body[data-height]`, `.chart-wrap[data-height]`, `[data-aspect]`). Retuned 2026-07-01
from .84/.68.

**Differential retune (2026-07-01, `3f86251`) — "too subtle" fix.** Owner confirmed on the live
site that 8b32357's .84/.68 + floor 320 made a solo only ~30% taller than paired (reads uniform).
Reasoned from `height = ratio × scale × own-width`; a solo gets ~2× a paired cell's own-width
(2-up), so `solo/paired ≈ 2 × scale1040`. Levers used TOGETHER: floor 320→280 (a narrow paired
cell settles at its natural ~301px @1440 instead of being propped to the floor — this alone lifts
the @1440 gap 1.53→1.63×); scale .68→.80 at ≥1040 (solo lands ~0.416 effective = the design's
ideal 2.4:1 focus shape, NOT a letterbox); cap 640→720 so the widest solo keeps 2.4:1. Result:
@1440 **1.63×**, @2560 **1.80×**; 360/768 single-col (no pairing, floor governs). **No 3rd
`@container` step** — `--page-measure` (1760 ceiling − gutters) caps a solo's OWN inline-size at
~1644px, so the .80 plateau already spans the whole solo range at 2.4:1; a 3rd step would be inert
or non-monotonic (a wider panel getting shorter). Map (geo .72) stays definite-height + near-square
at paired/moderate-solo; cap 720 actually helps the map (2.28:1 vs 2.57:1 at the old cap).

**Role axis (plugin-owned, `data-content` token — NOT a node-type list, Law 1/4):**
`geograph.css` `.panel__body[data-content="geo"]{--panel-ratio-role:.72}` (near-square, kills the
map letterbox) + `GeographShell` emits `data-content:'geo'` on `bodyProps`. `chart.css`
`.chart-wrap[data-content="chart"]{--panel-ratio-role:.52}` + `Chart.tsx` emits `data-content="chart"`.

**Authorable axis (`resolvers/node.ts`):** `aspectRatio` → `--panel-ratio-<bp>` (revived the retired
inert `--ar-*` emission). CSS aspect-ratio is width÷height; the band coefficient is height÷width, so
`toPanelRatio` INVERTS (Postel: `"16 / 9"`|`"16:9"`|number → `0.5625`). `node-styles.css`
`[data-aspect]` `@media` cascade collapses `--panel-ratio-<bp>` → `--panel-ratio-authored`.
`aspectRatio` NodeStyle is string-typed (the number branch in `toPanelRatio` is defensive only).

**Where height is authored:** `geostat.provisioning.json` sets `view.styles.height:"16:9"` on the
SECTION/geograph node (map body = `.panel__body[data-height="16:9"]`, NOT `data-aspect`); chart
wraps use responsive `aspectRatio` (→ `data-aspect` on `.chart-wrap`). Both are band carriers.

**Do NOT touch:** the chart-fill growable-band chain (`84999e2`) — only the ratio coefficient
changed; the map's definite Leaflet clamp-of-lengths height (the `83d117a` revert can't recur).

**Hardened by** `packages/styles/src/panel-sizing.fitness.test.ts` — 7 AR-8 FFs
(RATIO-DRIVEN-BAND / BAND-MONOTONIC / RATIO-CONTEXT-AWARE / RATIO-AGNOSTIC / MAP-DEFINITE-HEIGHT /
EQUAL-HEIGHT-SIBLINGS / BAND-IS-FLEX-BASIS). **RATIO-CONTEXT-AWARE was STRENGTHENED 2026-07-01**
from "≥1 `@container` rule exists" to assert a MINIMUM modelled differential (`2 × scale1040 ≥ 1.5`),
a no-letterbox floor (`chartRole × scale1040 > 0.34`), monotone scale (`scale1040 ≤ scale680 < 1`),
and the guard bounds (`floor ≤ 300`, `cap ≥ 700`) — so "too subtle" cannot regress silently.
RATIO-AGNOSTIC builds its banned-word regex from
fragments so the test file carries NO tenant literal (passes the `packages/{react,styles}`
no-tenant-content scan — a trap when asserting agnosticism). See [[responsive_audit_systemic_roots]]
(architect) for the broader responsive model.
