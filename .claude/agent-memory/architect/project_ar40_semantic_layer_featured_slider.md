---
name: ar40-semantic-layer-featured-slider
description: AR-40 DESIGNED — formalize the EXISTING MetricDef registry into the full semantic layer; the key unification is U1 (make interpretKpi's point-read metric-aware = the last non-unified measure path); first consumer = landing featured-slider replacing the hard-coded stats-carousel. SSOT = SPEC doc.
metadata:
  type: project
---

**AR-40 Semantic/Metrics Layer + landing Featured-Slider — DESIGNED 2026-07-04.**
SSOT = `docs/architecture/proposals/SPEC-AR40-semantic-layer-and-featured-slider.md`; registry card = ARCHITECTURE-REGISTRY.md AR-40 (section F). Builds on [[semantic-layer-n26]] + [[metric-delivery-pipeline]] + [[project-featured-manifest]].

**The non-obvious load-bearing decisions (so future work doesn't re-litigate):**
- The semantic layer ALREADY EXISTS (`core/data/metric.ts` MetricDef registry, manifest→boot delivery). AR-40 is COMPLETION, not greenfield. Do not propose re-architecting it.
- **U1 is the whole unification**: `interpretKpi`'s point-read path (`resolveValue`/`resolveTrend` → `storeVal(store, spec.measure)`) is the ONLY measure path NOT metric-aware (query DataSpec + calc-metric already are). WARM (`extractKpiRequirements`) ALREADY resolves via `resolveMeasureRef` → a render/warm asymmetry. U1 = route render through `resolveMeasureRef` too → symmetric, byte-identical for raw codes, kills the cache-miss/dead-badge risk the metric-delivery memory warns about.
- **Only ONE schema addition**: `format?: FormatKey` on MetricDef (+ ManifestMetric wire). Governs numeric formatting once (closes format-drift half of chart≠table). MetricDef STAYS THIN — still NO filters/joins/sql (the refused LookML line).
- **"Featured" is a CURATION, not a metric flag** (LookML define-vs-curate): metric def stays a pure definition; the featured collection = a curated list of `FeaturedItemSpec` (metric-id + coordinate `at` + time + trend? + href + group). Kept separate (SSOT/SoC).
- **The slider REUSES interpretKpi** — `FeaturedItemSpec` lowers to a `{type:'point'}` KpiSpec; `interpretFeatured` (core `data/featured.ts`) calls `interpretKpi`; react `useFeaturedRows` mirrors `useKpiRows` (warm+read). NO parallel resolver. label/unit/format/methodology come from the metric (getMetric); preliminary derives free from OBS_STATUS at the coordinate.
- **NEW node `featured-slider`** (plugins/nodes/featured-slider), NOT evolving `stats-carousel` (which is caps:[] editorial, no store access). Strangler-replace the landing hard-coded stats-carousel (renders hand-typed `"204 000"`/`"54 100"` — already stale vs live 49374). Yellow = authoring signal only, NEVER UI color.
- **FEATURED.json.value is a SNAPSHOT** (verification/authoring), NOT the render source — the slider renders the LIVE value via the store at the featured coordinate. P4 drift fitness guards snapshot≈live.

**Phases:** P0 spine (format + U1, byte-identical) → P1 populate metrics[] for the 11 featured indicators (provisioning) → P2 the node (core featured.ts → react hook → plugin) → P3 Strangler-migrate landing page. P4 (gated) = install withMetricProvenance (installed NOWHERE today) + drift fitness.

**Owner-decision points (P0 blocked on 3 schema/data ones):** `format` on ManifestMetric wire (additive contract change); the 11 metrics' units/labels + omit-methodology-never-fabricate; FEATURED.json→provisioning generator vs hand-author. Elevations noted (do NOT build): deep-link drill→AR-31/42, lineage on slide→AR-43, declared dimensionality→AR-10 picker.
