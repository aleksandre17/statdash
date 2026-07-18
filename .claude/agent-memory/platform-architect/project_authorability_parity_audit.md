---
name: authorability-parity-audit
description: The 2026-07-18 corpus⇄panel parity audit I own — verdict = element parity is COMPLETE, every gap is an opaque sub-object or a wiring gap, not a missing element; ranked top-lists
metadata:
  type: project
---

I OWN `docs/architecture/audit/AUTHORABILITY-PARITY-2026-07-18.md` — two-direction authorability
audit of `platform/apps/api/provisioning/geostat.provisioning.json` (the corpus SSOT) vs the panel.

**The load-bearing verdict (non-obvious):** ELEMENT parity is COMPLETE — every corpus `type` maps to
a registered meta in `catalog.ts`. Zero missing-element holes. EVERY Direction-A gap is one of two
shapes: (1) a rich sub-object declared as opaque `type:'object'`/`plane:'system'` that falls back to
raw JSON, or (2) a capability that EXISTS but isn't projected onto a field. This is consistent with
ADR-038/041 holding — gaps are depth/wiring, never grammar.

**Direction A top-5 (what the owner will want next & cannot author):**
1. **Structured Trend builder** — `trend` union (yoy/cagr/share num-denom) is raw JSON in ~33 places
   (KPI strips + featured-slider). `KpiValueItemSchema` has no num/denom for `type:'share'`. Highest
   frequency. Ships as a `TrendField` PropFieldType (the ThresholdField template).
2. **Prior-period `$prev` input in CalcBuilder** — MetricInput `at.time.$prev` lag not surfaced →
   the gdp.growthYoy growth-by-lag class can't be composed visually.
3. **Wire the EXISTING VisibilityBuilder onto item `when`** — it's built + wired to
   filters/perspectives/page but NOT KPI/featured item `when` (opaque) nor node `view.visibleWhen`
   (42 occ). A projection, not a new build — lowest cost.
4. **Filter options-source + default-from-options + spanRole** — `selectSchema.options` is a raw
   `type:'object'` escape hatch; `{from:'options',pick}` default + from→to span pairing absent.
5. **Perspective onEnter/onExit set-bags (6 occ) + page-header perspective-keyed badge map**
   (`{range,year}` + `{fromYear}` tokens flattened to a scalar `string`).

**Direction B (modernization, all expand-contract):** (B1) flip default emission query+pipe →
`pipeline`+`source` head after FF-PIPELINE-EQUIV (0082 ⛔ door); (B2) bind governed growth metrics in
place of hand `type:'yoy'` trends (gdp.growthYoy exists); (B3) move redundant `value.filter` coord
into the metric passport (0090/0084); (B6) **CHECK-4 VERIFIED PASS** — no metric-id in a raw
dim-filter slot (b544819 stuck).

**Scope:** the 0087–0091 + Wave-B + W-P6b queue was NOT re-reported (marked `[known-queue]`).
See [[query-pipeline-data-home]] (B1), [[conditional-formatting]] (the ThresholdField template A1
reuses), [[project-authoring-experience-architecture]].
