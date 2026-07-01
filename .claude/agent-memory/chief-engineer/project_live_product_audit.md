---
name: live-product-audit
description: 2026-07-01 exhaustive live-product sweep (:3002) — findings in work/AUDIT-live-product.md; architectural i18n root + live-vs-HEAD staleness; point-in-time
metadata:
  type: project
---

Exhaustive chief-engineer sweep of the LIVE product `http://192.168.1.199:3002` (Playwright, both themes ×
en/ka × landing/gdp/accounts/regional × 360→3440). Full ranked inventory (F1–F18) + synthesis lives in
`platform/work/AUDIT-live-product.md`. This memory keeps only the durable, non-obvious roots.

**Why:** owner kept finding defects reactively (chart white gap, time-switcher white-on-dark, no theme switcher,
weak wrap) — charged me to find EVERYTHING proactively so nothing slips to them again.

**How to apply / durable roots (verify current before acting — this was a 2026-07-01 snapshot):**
- **Live ≠ HEAD.** The deployed CSS bundle can lag HEAD (e.g. `--color-surface-frame` had no dark value live while
  FF-DARK-COMPLETE existed at HEAD). Always audit the DEPLOYED bundle, and re-verify after a redeploy before trusting
  any dark-mode verdict. `curl …/assets/<hash>.css | grep <token>` proves it fast.
- **Architectural i18n gap (likely to recur):** several user-facing text fields are typed **bare `string`, not
  `LocaleString`** — chart series `name` (`packages/charts/src/types.ts`), page-header badge `{year,range}` template
  (`PageHeaderNode.ts`), KPI trend `value`. A bilingual dashboard CANNOT localize these, and `geostat.provisioning.json`
  authored them Georgian-only → Georgian leaks into the EN product. Fix at the contract (promote to LocaleString) +
  fitness guard (no non-ASCII in a bare-string user-facing field). [[v13-v21-review]] i18n theme.
- **Missing first-class capabilities** (should be registerable config nodes): theme switcher (owner-flagged), per-section
  export CSV/XLSX (declared standard, still a stub), print, share, density, fullscreen, indicator search, data/API link.
- **Degraded states skip the design system:** error boundary renders raw RFC-9457 problem-details JSON; fail-soft
  empty state is English-only on /ka/; not-found is chrome-less. One "degraded-state kit" fixes all.
- **Sweep hazard:** a burst of rapid page loads trips the API rate limiter (429, retry-after 42s) and manifests as
  false "Page not found"/"Failed to load". Throttle multi-load sweeps and re-verify suspects with clean single loads.
