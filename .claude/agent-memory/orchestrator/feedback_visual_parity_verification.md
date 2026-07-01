---
name: visual-parity-verification
description: "Renders + 0 errors + 0 empty" ≠ correct; visually READ screenshots (and compare to a known-good reference) to verify render VALUES + completeness
metadata:
  type: feedback
---

For any render/UI work, "the page loads with no console errors and non-empty API calls" is NOT proof it is correct. VISUALLY read the screenshots (the Read tool renders PNGs) and check the actual VALUES and completeness — and compare against a known-good reference when one exists.

**Why:** In the API-demo parity session, automated probes reported `obsEmpty=0 / noDataMarkers=0 / consoleErrors=[]` and agents repeatedly declared "done" — while the live demo showed: all 3 GDP KPIs collapsed to the same per-capita value, the accounts/regional panels rendered empty axes with no bars, dynamics mode showed "No data", and a treemap/map were blank. None of that is an error or an empty API call, so the probe passed. Only **reading the screenshots** (and comparing to the old static-config version the user pointed to as the correctness yardstick, `:5171/ka`) surfaced each real defect. The user had to push twice ("the charts must DISPLAY like the old version") because metric-green kept hiding value/completeness bugs.

**How to apply:** (1) When the user has an OLD/reference version that "worked", treat it as the SPEC — capture both old + new screenshots and read them side by side, page by page, BOTH UI modes. (2) Encode value-correctness as fitness functions (e.g. a KPI pinning measure=X resolves X's value, not rows[0]; a per-member query excludes the `_T` rollup) — not just "non-empty". (3) Give the debugger the full fix→deploy→screenshot→READ loop so it iterates to visually-correct, not blind. (4) Independently read a couple of key screenshots myself before accepting an agent's "verified" — agents (and probes) over-trust metrics. Relates to [[verify-render-with-real-browser]] (peel one layer per cycle) and [[resolve-dont-defer]] (don't downgrade a real gap to "baseline parity").
