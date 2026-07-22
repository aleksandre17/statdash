---
name: project-panel-w1-honest-canvas
description: AR-52 Wave 1 "Honest Canvas" — CLOSED/merged to main. Live-by-default + honest veil, honest UNBOUND KPI, honest token placeholder, honest chart empty-state, and chrome-faithful brand. What's still deferred.
metadata:
  type: project
---

AR-52 Wave 1 (Canon C2 "the canvas never lies"). **CLOSED 2026-07-17, merged to `main`**
(card `work/items/0071`). Live-proven on :3013: liveDefault true, veil honest, ONE perspective,
real KPIs render, tokenLeakCount 0, canvasAccent matches the runner, 0 console errors.

**SHIPPED + gated:**
- **Live-by-default.** `CanvasView` mode defaults to `'live'` (was `'structural'`). Structural is
  now an explicit opt-out with an honest **veil** (`.canvas-veil`, diagonal hatch + a bilingual
  label pill, `data-testid=canvas-structural-veil`). Live fail-soft unchanged (no cube/API →
  structural + badge).
- **One perspective control.** Removed the CanvasToolbar's OWN perspective radiogroup (was a
  duplicate of the page's own perspective-bar node). The preview SSOT is `previewPerspectiveId`,
  driven by the dock `PerspectivesPane`, not the toolbar.
- **Honest UNBOUND KPI** — `kpiBinding.ts::isKpiSpecBound` (static predicate over KpiSpec.value
  discriminants, mirrors core `resolveValue` reads). `KpiStripShell` partitions bound/unbound
  BEFORE `useKpiRows` (unbound never hits an empty-code warm read → no fake 0); unbound renders
  `KpiUnboundCard` (an honest affordance, door to a later "bind me" journey). Gate:
  `FF-CANVAS-NEVER-LIES` (`canvas/canvasNeverLies.fitness.test.tsx`).
- **Token leak `{spanFrom}/{spanTo}/{time}` — fixed via an honest core placeholder.** Root: these
  are Tier-3 hidden-param defaults derived from the `time` data extent, resolved by
  `resolveDefaults` against the page store — they leak only when the store has no extent (empty
  structural preview, live-loading, live-unavailable). Rather than build a representative extent
  for every no-data state (deferred, needs a typed-row seam), the floor lives at the PRIMITIVE:
  `packages/core/src/config/template.ts resolveTemplate` returns the platform missing-value glyph
  `'—'` for any unresolvable `{key}` instead of echoing braces. Platform-wide but safe — on the
  live/published path vars always resolve (byte-identical); the placeholder only fires where the
  old code leaked plumbing.
- **Chart silent-blank — fixed via a no-rows short-circuit.** An UNBOUND chart (no `chartType`/
  `data`) THREW inside `useChartOutput.resolveChartType` (reads `.$ctx` off `undefined`) → the
  node error boundary rendered an empty box (the silent-blank lie). `TableShell` was already
  honest (`EmptyState` on empty rows) — `ChartShell` had the same guard but it sat AFTER the
  throwing hook. Fix: `useChartOutput` short-circuits `rows.length===0` → returns
  `placeholderOutput({type:safeType})`, so the shell falls through to its declared `EmptyState`.
  The kpi-strip's richer unbound-vs-no-data distinction was NOT replicated for charts (an
  EmptyState is the accepted declared state there).
- **Chrome-faithful brand** — landed in the same wave: `buildThemeVars`/`applyThemeOverrides` in
  `@statdash/styles`, `themeVars` prop on `CanvasView`, gate `chromeFaithful.fitness.test.tsx`
  (canvas `--color-accent` ≡ runner accent, dark-safe). Full detail:
  [[project_panel_canvas_craft_and_brand]].

**Still DEFERRED:** no-data KPI vs true-0 — distinguishing a bound-but-no-observation KPI read
from a genuine 0 (the engine `Cell` honest-state seam exists; consumer wiring is the open half).

**Deploy topology reminder (load-bearing for any live-verify of this wave):** the :3013 dev line
src-mounts ONLY `apps/panel/src` — panel changes reach it live via HMR, but `packages/*`
(plugins/react/core) changes need a container image rebuild. See
[[reference_dev_line_panel_3013]].
