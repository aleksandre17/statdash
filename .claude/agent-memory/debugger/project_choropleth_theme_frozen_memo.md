---
name: choropleth-theme-frozen-memo
description: geograph map colors differ hard-load vs soft-nav — ONLY in dark mode; data-theme applied post-paint (useEffect) + map ramp memo frozen on [rows] bakes the pre-theme surface token
metadata:
  type: project
---

Regional choropleth showed DIFFERENT region fills on hard-refresh vs soft-nav — reproduced live :3002 (2026-07-01) ONLY in **dark mode** (localStorage `statdash-theme=dark`). Light mode: byte-identical across 7 nav paths (hard×3, home/gdp/accounts→regional, remount) — nav path alone does NOT diverge.

**Dark-mode diff (both end with data-theme=dark, surface=#15151f by probe time):**
- HARD-LOAD → LIGHT ramp, light end `rgb(217,236,245)` = `lerp(#0080be, #ffffff, .85)` (surface was still #fff)
- SOFT-NAV  → DARK ramp,  light end `rgb(18,37,55)`   = `lerp(#0080be, #15151f, .85)` (surface already #15151f)
Driven by `--color-surface`, NOT accent (geostat accent stays #0080be in dark).

**Two combined roots (both needed for the symptom):**
- D1 — `useTheme.ts:65` applies `data-theme` in a POST-PAINT `useEffect` (init from localStorage/OS). On hard-load the attribute is absent during first render, so any getComputedStyle-at-render consumer captures the LIGHT token. Soft-nav already has the attribute from the prior route. (Also causes a dark-mode FOUC + affects every cssVar-at-render sink, e.g. Apex SVG fills.)
- D2 — `GeoMap.tsx:120` `colorByGeo = useMemo(() => quantileColors(rows.map(r=>r.value), sequentialRamp()), [rows])`. Deps = `[rows]` ONLY; `sequentialRamp()` reads `--color-accent`/`--color-surface` via cssVar/getComputedStyle at memo-eval time but theme is NOT a dep → the ramp is FROZEN and never recomputes on any post-memo theme change (nav timing AND runtime toggle). The hard-load staying light-ramped while data-theme=dark is D2 in action.

**Fix applied (D1, root of the reported nav symptom):** `apps/geostat/src/main.tsx` — apply `data-theme` SYNCHRONOUSLY before `createRoot().render()` (stored choice → OS pref), mirroring the existing synchronous `data-tenant` seam (main.tsx:36). Idempotent with useTheme's later effect. Removes the wrong-first-paint window for the map AND all cssVar consumers + kills the dark-mode flash. NOT yet live-verified on :3002 (needs redeploy — re-run scratchpad diag3.cjs after deploy).

**Recommended complement (D2, not yet done):** make the map ramp reactive — a theme-epoch signal (MutationObserver on documentElement data-theme/data-tenant + matchMedia change) added to the colorByGeo memo deps, so the map recolors on RUNTIME theme toggle too. Promote to a shared `@statdash/react` hook when charts need it (M-5). Cf. [[softnav-scroll-parity]] (sibling hard-vs-soft determinism, also invisible to goto-only probes) and [[cachedstore-async-gap]].

**Method note:** goto-only probes hard-load and would've shown light-mode SAME → miss it. Repro required seeding localStorage theme=dark via addInitScript, then diffing hard-load vs click-navigated soft-nav fills.
