---
name: verify-render-with-real-browser
description: For "data doesn't render" symptoms, probe the LIVE app with a real headless browser (network + console + DOM) and peel root causes one layer at a time — never guess
metadata:
  type: feedback
---

When the user reports the front/panel "renders no data" (or charts/tables empty), the symptom
is usually a STACK of independent root causes, not one. Diagnose empirically with a real
headless browser against the LIVE deploy, not by theorizing.

**Why:** A single "no data" report turned out to be SIX distinct layered bugs (config.data_source
empty → store-builder registration regression → async store sync-render gap → year-default
resolves to 0 → KPI YoY warm gap → CSP image block). Each was invisible until the one above it
was fixed (e.g. the async/querySync bug couldn't surface until stores actually built). I twice
stated a wrong root cause ("data-sources is unrelated to rendering") from reading code alone; the
user pushed back, and the browser probe proved the real chain. Code-reading alone misleads when
the failure is a runtime stack.

**How to apply:**
- The server has Docker but no local browser. Run a real probe: `docker run --network <net>
  mcr.microsoft.com/playwright:latest` (pin the playwright npm version to the image's, e.g.
  `npm i playwright@1.46.1`, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`). Capture every `/api/*` request
  (status+body), all `console`/`pageerror`, and a DOM summary (svg/canvas/table/.apexcharts counts,
  "Failed to load" count). Scripts kept at `work/probe.js` (front) + `work/panel-probe.js` (panel,
  logs in via `/api/auth` → sessionStorage token). For the panel, drive the wizard to the Pages
  step + open a page (page IDs are UUIDs, not names).
- Peel ONE layer per cycle: probe → read the exact console error → fix that root → rebuild that
  image → re-probe. The error message MOVES to the next layer when a layer is fixed — that's
  progress, not failure.
- Two recurring architectural traps this exposed, worth checking proactively: (a) an async (API)
  store rendered through a SYNC render path throws cold `querySync` — the render must warm via
  `queryAsync` first (CachedStore must be capability-transparent, not hardcode `sync:true`); (b) a
  filter default that depends on data loaded async (a year-select `pick:'last'` from a cube) must
  source that data at store-build (awaited), never gate on a classifier that's never populated
  (that hangs). See [[verify-board-empirically]], [[parallel-interleave-false-alarms]].
- A strong agent that REFUSES a prescribed fix because it would degrade (e.g. "this gate hangs
  forever") is doing exactly the right thing — escalate to the architect for the non-degrading
  seam rather than forcing it.
