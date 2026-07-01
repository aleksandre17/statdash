---
name: sna-table-is-pivottable
description: The live /ka/accounts "National Accounts" table renders via PivotTable (not SimpleTable) — why AR-15/27/34 table fixes kept missing it, and the two roots fixed in AR-35
metadata:
  type: project
---

The `/ka/accounts` "National Accounts" table (SNA resources/uses, columns row-label | რესურსები | გამოყენება) renders via **`PivotTable`**, NOT `SimpleTable`/generic `.data-table`.

**Why:** its DataSpec has a `series` encoding (R/U), so `DataTable.tsx` dispatches `isMultiSeries ? PivotTable : SimpleTable`. The owner was frustrated across many turns because AR-15/27/34 table fixes all hit the SimpleTable/`.data-table` CSS path and never the PivotTable component — a prior verification probe even mis-measured a 2-col SimpleTable elsewhere on the page (`document.querySelector('table')` grabs the FIRST table).

**How to apply:** when a `/ka/accounts` (or any series-carrying) table bug is reported, look at `PivotTable.tsx` first. Two roots fixed in AR-35 (commit `a592cc6`): (1) alignment was an SSOT violation — flat pivot header hardcoded `.r` while body keyed on `col.align`; now one `alignClass(col)` (numeric → right default) feeds header+body identically; (2) the table is UNBOUNDED (no AR-8 `[data-height]` band), so a bounded `max-height:var(--data-table-max-h,70vh)` on `.data-table__wrap` is what makes the sticky header actually freeze.

**Probe gotchas** (`platform/work/probe-sna-table.mjs`): select the table by its Georgian series-header text AND filter to VISIBLE tables (`getBoundingClientRect().width>0`) — hidden export tables also contain რესურსები. Pick a real data row by `td-count === series-count` (separator/group rows render a single colSpan td). A "frozen:true" reading is VACUOUS unless `boundedTaller` (scrollHeight>clientHeight) is also true — otherwise the wrap can't scroll and the page does.

**Real-page verify without redeploy:** `cd apps/geostat && VITE_STORE_MODE=stats VITE_API_STATS_URL= npx vite --config <wrapper>` where the wrapper spreads `./vite.config` and adds `server.proxy['/api'] → http://192.168.1.199:3002`. Same-origin `/api` proxy is REQUIRED — the index.html CSP `connect-src 'self' https:` blocks a cross-origin http API URL. Dev aliases resolve `@statdash/*` to source, so edits show without rebuild. See [[render-path-browser-verify]].
