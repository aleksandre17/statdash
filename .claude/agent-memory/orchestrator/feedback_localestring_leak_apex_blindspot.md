---
name: localestring-leak-apex-blindspot
description: A field typed `string` but bilingual `{ka,en}` in config is a silent render crash (React #31); jsdom render-guard can't catch chart-shell leaks because it doesn't run ApexCharts — guard the toApexOptions tree + real-browser verify dashboards before redeploy
metadata:
  type: feedback
---

When config gets bilingualized (scalar string → `{ka,en}` LocaleString), every CONSUMING type must change too — and the chart path needs its own guard.

**The bug class (shipped despite an all-green gate, 2026-06-28):** a node-schema field typed `unit: string` but supplied as `{ka,en}` in provisioning. The wrong scalar type made TS think it was already resolved → the missing `resolve()` at the render boundary was never compiler-flagged → raw `{ka,en}` reached React as a child → **React error #31 "Objects are not valid as a React child (found: object with keys {ka,en})"** → swallowed into the per-node error boundary's "Failed to load component" banner. Live on the deployed landing carousel + (per owner report) most dashboard charts.

**Why every gate was green yet the live site was broken (the blind spot):**
- The `localeString-render-guard` fitness rendered in **jsdom, which does NOT execute ApexCharts** → chart-shell LocaleString leaks (title/unit/axis/tooltip/dataLabels/series-name) render fine in the test but crash in a real browser.
- The render-guard's `PAGES` was a **hand-listed array** that omitted the index/landing page entirely.
- A field typed `string` (not `LocaleString`) **removes compiler coverage** — the type lies, so TS can't flag the missing resolve.

**Why:** this is the exact failure my [[feedback_visual_parity_verification]] + [[feedback_gate_render_suite_on_data_changes]] memories warn about — "build:engine=0 + 1985 tests green" is NOT "the site renders." The control point missed it because the test environment ≠ the runtime (jsdom ≠ ApexCharts/real DOM).

**How to apply:**
1. On ANY config bilingualization, audit EVERY consuming type — change `string`→`LocaleString` so the compiler re-gains coverage; resolve at the boundary via ctx locale (Law 1, byte-identical passthrough for plain strings). A `string|LocaleString` half-measure is also a leak.
2. The chart path needs a guard the DOM-render can't give: assert the **`toApexOptions` output tree contains NO raw LocaleString object** anywhere ApexCharts renders text. This makes chart-shell leaks unit-testable WITHOUT a browser.
3. Derive render-guard page matrices from the **manifest** (`prov.pages[].slug`, index included), never a hand-listed array.
4. **Real-browser verify DASHBOARDS (not just landing) before any redeploy** — navigate to a real chart page and READ the screenshot. Green gate is necessary, not sufficient.
5. If a deploy exposes a live regression, ROLLBACK to known-good first (protect stakeholders), then fix-forward + real-browser verify, then redeploy. See [[project_server_deploy_build_context]] for the rollback recipe.
