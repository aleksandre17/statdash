---
name: panel-live-boot-verification
description: A panel/app feature is not DONE on unit/fitness green — it must be proven through the REAL app-boot path (live or an integration smoke); jsdom/unit suites mask boot-wiring defects
metadata:
  type: feedback
---

A panel/app feature claim of DONE requires proof through the **real application boot path**, not just unit/fitness green. Unit + jsdom suites mask boot-wiring defects.

**Why:** AR-49 M0 (metric palette + bind) passed 2675 unit/fitness tests AND a chief-engineer QC pass, yet was **completely non-functional in the running panel** — two boot-wiring gaps the suite hid: (A) `apps/panel` had **no metric/dimension registration boot seam** (palette reads `describeApp()`, which only `apps/geostat`'s `bootstrapSite()` ever populates → empty palette live); (B) `apps/panel/src/main.tsx` **omits `i18next.init()`** (geostat's has it) → the live canvas throws "addResources is not a function" and white-screens the Page step. Both invisible because `vitest.setup.ts` calls `i18next.init()` and unit tests register catalogs manually. Only a live-browser check (owner asked to "see it live") caught it.

**How to apply:**
- For ANY panel/app-level feature, before claiming DONE add a **real-boot verification**: either run the app, OR an integration test that exercises `main.tsx` boot + `setupCanvasRegistry` + `describeApp()` population — not the per-test manual registration.
- Add a **boot-parity fitness**: `apps/panel` must register the same engine channels (metrics/dimensions/i18n) that `apps/geostat` does; the two app boots must not silently diverge.
- Treat "green tests" as necessary-not-sufficient for feature completeness — extends [[gate-render-suite-on-data-changes]] and the jsdom blind-spot in [[localestring-leak-apex-blindspot]]. When the owner says "show me live," that is a QC instrument, not a formality.
- Orchestrator process fix: for feature-complete milestones, route a live/boot smoke step (a specialist that actually runs it) BEFORE declaring done — don't let test-green + code-review QC stand alone.
