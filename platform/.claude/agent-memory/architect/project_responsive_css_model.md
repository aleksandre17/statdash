---
name: responsive-css-model
description: Canonical config-driven responsive model — honest panel height band (no aspect-ratio), count-aware KPI strip (no auto-fit), binding spine + staged follow-ups
metadata:
  type: project
---

The platform's binding CSS/responsive spine is `platform/work/DESIGN-css-responsive-standard.md`
(HARD 300-line ceiling — a post-edit hook blocks past it; split by concern, don't append).

<a id="rsp"></a>
## RSP status (updated 2026-07-01)
- **Band is now `clamp(380px, 64cqi, 560px)`** (cqi, container-proportional — NOT the interim 56vh; the note below saying 56vh is superseded). `--ar-*` inert DOM vars are RETIRED at the resolver (a286833); the `data-aspect` band-alias flag stays. Both locked in `packages/styles/src/panel-sizing.fitness.test.ts` (CSS-absence + resolver-output assertions).
- **Panel sizing is body-only** (SHIPPED ade152b, [[chrome-panel-section-unification]]): height on `.panel__body`/`.section__body`, never the `.panel-col` wrapper. Real-browser layout-verified.
- **RSP-R1/R2/R3 were already FIXED in code** (the CLOSE-BOARD 2026-06-28 "OPEN" snapshot is stale — verify-against-code). This session added the missing guards: `app-header.overflow.fitness.test.ts` (FF-HEADER-NO-OVERFLOW, R2 flex min-width:0 contract) + `pages/inner-page/default/page-measure.fitness.test.ts` (FF-PAGE-MEASURE-SSOT, R3 `--page-measure` clamp SSOT + no-800px). R1 already had `ChartDataTable.reflow.fitness.test.tsx`.
- **Config gap fixed:** the plugins vitest `include` never scanned `pages/**` — added `pages/**/*.test.{ts,tsx}` (bc865af).
- **Verification limit this session:** docker api+db stack unavailable in-shell → no live-render screenshot; verified via a real-browser (chromium) LAYOUT probe over the actual stylesheets. A post-deploy screenshot pass (live Leaflet + donut legend + map padding:0) is the outstanding real-browser step.

**Two root-cause decisions made (both guarded by static fitness functions):**

1. **Panel sizing = ONE honest height band, never aspect-ratio.** A data panel (chart/table/treemap/map)
   is `width:100%` + `height: var(--size-panel-height)` = `clamp(380px, 56vh, 560px)` (token spine in
   `tokens.css`: `--size-panel-h-floor/-fluid/-cap`). **Why:** `aspect-ratio` + `max-height` were
   contradictory (height∝width, then capped → declared ratio silently violated past a crossover width — the
   owner's "it's a lie"); ratio is also meaningless under nesting (16:9 in a 1/3 column = useless sliver).
   The band is one monotonic constraint, width-independent (verified 504px at 360→2400px @ h=900).
   `aspectRatio` stays a `NodeStyle` for genuine ratio-locked *media* only (no max-height cap there).
   Ratio tokens (`data-height:"16:9"`) + the `data-aspect`/`--ar-*` path are now DEPRECATED ALIASES → band
   (Strangler-Fig). The dead `--ar-*` @media/@container cascade + the `≤1280→height:auto` reset were
   deleted from `node-styles.css`. Guard: `packages/styles/src/panel-sizing.fitness.test.ts` (asserts the
   engine contains NO `aspect-ratio`, no `--ar-`).

2. **KPI strip = count-aware @container ladder, never `auto-fit`.** `.kpi-strip` is the query container;
   `.kpi-strip__grid[data-kpi-count="N"]` resolves to a column count that always DIVIDES N (4→4/2×2/1,
   3→3/1 never 2). **Why:** `auto-fit` packs as-many-as-fit and strands an orphan when N doesn't divide the
   fitted count (the recurring "3+1 dead space" at laptop widths). `auto-fit` is correct only for
   count-UNBOUNDED grids. Guard: `packages/plugins/panels/kpi-strip/default/kpi-count-clean.fitness.test.ts`.

**Verification method:** real-browser Playwright harnesses in scratchpad (sweep + screenshot) — the
count-cleanness was proven by a 240→2400px offsetTop-row sweep (zero orphans); the band by a
width-independence + floor/cap sweep. The live :3002 site builds from committed HEAD (orchestrator deploys
+ verifies after).

**How to apply:** for any new multi-item strip with a KNOWN count, follow the KPI count-clean pattern (not
auto-fit). For any panel, use the height band; never reintroduce aspect-ratio as a sizing mechanism.

**Staged (platform-architect follow-ups, precise):**
- Migrate provisioning `"height":"16:9"`/`aspectRatio` → a `size` token (e.g. `"panel"`); then delete the
  alias rules + the now-inert `--ar-*` output in `@statdash/styles` `node.ts`/`panel.ts`.
- Container-fluid upgrade: swap `56vh` → `64cqi` in the band (height scales with column, not viewport) —
  audit every panel's `container-type` ancestor first (maps render outside one).
- Config-driven layout-node: `columns` gains `mode:"count-clean"` over `ResponsiveVal<number>` (lift the
  KPI pattern into `resolveColumns`) so any author gets gap-free reflow.
- Retire off-scale breakpoints `1100px`/`700px` (snap to scale or name as tokens) in: `inner-sidebar`,
  `hero`, `stats-carousel`, `container-page/landing` CSS (per-shell, browser-verified).
- Mobile-first authoring migration (shells are desktop-first `max-width`-down today) + `@custom-media`
  SSOT projection from `BREAKPOINTS` — Strangler-Fig per node.
