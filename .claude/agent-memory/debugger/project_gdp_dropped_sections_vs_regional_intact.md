---
name: gdp-dropped-sections-vs-regional-intact
description: Owner-reported "missing top chart on regional" is actually two GDP sections (structural GFCF donut + noe-share bar) dropped from provisioning; regional is fully intact
metadata:
  type: project
---

Owner insisted a top chart on the **regional** page went missing. Rigorous OLD (git `191bc0e`, pre-platform snapshot `apps/geostat/src/pages/*.sections.ts`) vs CURRENT (`platform/apps/api/provisioning/geostat.provisioning.json` == live `GET /api/bootstrap`) diff showed:

- **Regional: fully intact.** Same chart set + order in both modes (KPI → [geograph MAP | sector donut/multi-bar] → regional-comparison hbar; range → [map snapshot | GVA dynamics bar] → sector-history area). Top chart = geograph#geo-map, renders (now a graduated choropleth). Only visible drift: the regional-comparison **hbar went monochrome grey** (was per-region multi-color at 191bc0e) — a color regression, not a missing chart.
- **GDP: two sections genuinely MISSING** vs 191bc0e — `structural` (GFCF structure donut, %) and `noe-share` (non-observed-economy share bar). Removed in commit **52738a3** (2026-06-26, "rework GDP + REGIONAL to render real canonical data") and never re-added. A **dangling nav anchor "structural / Structural indicators"** survives in the live manifest (provisioning ~line 4756) with no matching section — proof the drop was incomplete/unintended.
- **Accounts: 3 per-account sections removed INTENTIONALLY** (commit d172eae, 2026-07-01, "redundant — duplicated SNA pivot"); sna-hero + sna-hero-range remain. Not a bug.

**Why:** owner perception mislocated the loss to regional; the real regression is on GDP.
**How to apply:** when the owner reports a "missing regional top chart," the actual defect to restore is GDP `structural`+`noe-share`; use the orphaned nav anchor as a fitness check (every nav anchor must resolve to a section id). Config was NEVER the same as OLD for GDP — do not self-reference the current manifest.
