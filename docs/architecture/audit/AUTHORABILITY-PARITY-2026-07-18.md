# Authorability-Parity Audit — hand-written corpus ⇄ the authoring panel

> **Date:** 2026-07-18 · **Owner ask (verbatim):** «provisioning JSON-ში იქნებ დაინახო რაღაც,
> რაც პანელიდან შეუძლებელია ააწყო — ან პირიქით, პანელიდან უკეთ იწყობა და ეს ფაილი გადასაწერია. თვითონ ნახე.»
> **Deliverable:** two-direction inventory · read-only. **Ground:** `platform/apps/api/provisioning/geostat.provisioning.json`
> (5666 lines) vs the panel's authoring reach (node palette + `catalog.ts`, Inspector prop-schemas incl. the role/plane
> seam, the data-layer workbench as of card 0087, filters/perspectives/page-config editors, the semantic Model surface).
> **Reference anchors:** Grafana panel-editor completeness · Builder.io schema-driven editors · dbt/Looker measure templates.
>
> **Scope discipline:** the in-flight 0087–0091 + Wave-B + W-P6b queue is NOT re-reported here (owner instruction). Where a
> gap is already owned by that queue it is marked `[known-queue]` and referenced, not re-argued.

---

## Executive summary (simple language)

1. **Element parity is strong.** Every node type in the corpus (page-header, filter-bar, chart, table, kpi-strip,
   geograph, hero, featured-slider, columns/grid/wrap, links) is a registered, palette-placeable element. Nothing in the
   corpus uses an element the panel doesn't know.
2. **The gaps are all one shape: rich SUB-OBJECTS that fall back to raw JSON.** A handful of nested config bags — above
   all the **trend** block (yoy / cagr / share num-denom) — are declared as opaque `object` fields, so the author edits
   them as hand-JSON instead of through a real form. Trend alone appears ~33 times.
3. **The single most valuable thing to build next is a structured Trend builder** (KPI + featured-slider). After that:
   the **prior-period ($prev) input** in the metric CalcBuilder, and **wiring the visibility builder we already own** onto
   item-level `when` (42 occurrences, capability exists but isn't projected there).
4. **A few filter/perspective details are still hand-JSON:** the options SOURCE (pick members + sort), the "pick default
   from options", the from→to span pairing, and perspective enter/exit state-resets.
5. **In the other direction, nothing is broken — a few things are just old-style.** Charts still emit the legacy
   `query`+`pipe` pair instead of the new single `pipeline` spine (0082); some KPI/featured trends hand-compute a YoY
   where a governed growth metric now exists; and a governed metric still carries a redundant raw coordinate that its
   passport should own. All are safe expand-contract migrations, none urgent.
6. **The integrity guard held:** CHECK-4 verified — no governed metric-id leaks into a raw dimension-filter slot
   (the b544819 fix stuck). Clean bill.

---

## DIRECTION A — corpus constructs the panel CANNOT (fully) author

| # | Construct class | occ ≈ | Verdict | Where / what's missing | Recommended concept |
|---|---|---|---|---|---|
| A1 | **KPI trend block** (`trend`: yoy/cagr/share num-denom) | 33 | **PARTIAL** | `KpiItemSchema.trend` = opaque `type:'object'` (raw JSON); `KpiValueItemSchema` has no num/denom fields for `type:'share'` | **Structured TrendField** — pick yoy/cagr/share → for share pick num+denom governed metric & coords (Grafana stat "Value options" completeness) |
| A2 | **KPI value spec** (measure/type/time/format) | point 13 · yoy 17 · cagr 11 · share 5 | **AUTHORABLE** | governed `value.measure` (enum-ref 'metrics') + type/time/format/color/thresholds/unit/preliminary/note all declared | — (strong; keep) |
| A3 | **Per-item / node `when` visibility** (`op:perspective-is`) | 42 | **PARTIAL** | `VisibilityBuilder` EXISTS + wired to filters/perspectives/page — but KPI/featured item `when` is opaque `object` (plane:'steward'), and node `view.visibleWhen` is unwired | **Project the existing VisibilityBuilder** onto item `when` + `view.visibleWhen` (wiring, not new build) |
| A4 | **calc / derived metric** (`calc.inputs` + `expr` + `$prev` + `$derived`) | calc 3 · $prev 2 | **PARTIAL** | CalcBuilder authors templates (Ratio/Pct/Diff/Sum/Weighted) + ExprTree; but a MetricInput's `at.time.$prev` prior-period shift is NOT surfaced → growth-by-lag (gdp.growthYoy class) can't be composed | **Per-input coordinate/lag affordance** in CalcBuilder (dbt/Looker period-over-period template) |
| A5 | **filter `options` source** (`{items:{$d/$cl},labelField,valueField,pipe:[sort]}`) | ~8 selects | **PARTIAL** | `selectSchema.options` = raw `type:'object'` escape hatch; the pick-members + sort source is hand-JSON | **OptionsSourceField builder** (pick dim members → sort/limit), promoting the documented escape hatch |
| A6 | **filter default `{from:'options',pick:'first'\|'last'}` + `spanRole` from/to** | ~6 | **PARTIAL** | `param-schemas.ts` `default` is a scalar member picker; "pick from options" default mode + `spanRole`/`order`/`position` not in schema | Add default-mode + span-role fields to the param PropSchema (OCP, no new form) |
| A7 | **perspective def** (label/icon/scope) | 3 sets | **PARTIAL** | label/icon/scope authorable via registry; **`onEnter`/`onExit` set-bags NOT authorable** (6 occ); modern `scope.binding.selection` window/`targetKeys` under-covered vs legacy timeBinding | Register an `onEnter/onExit` scope-key (state-reset) + selection-kind fields (registry OCP) |
| A8 | **page-header badge** (`{range:{ka,en},year:{ka,en}}` + `{fromYear}`/`{time}` tokens) | 3 | **PARTIAL** | `PageHeaderSchema.badge` = plain `type:'string'`; the **perspective-keyed map + template tokens** aren't authorable | Promote `badge` to a perspective-keyed LocaleString map field with a token hint |
| A9 | **chart configs** (encoding + pipe + fieldConfig + axes/legend/tooltip) | chart 14 · encoding 18 · pipe 28 | **AUTHORABLE** | mark/viz via ChartSchema; DATA (encoding/pipe/filter) via data-layer workbench (EncodingEditor + PipelineBuilder + TransformStepEditor + FilterBuilder). Heaviest 10-op pipes live in the steward workbench (correct) | — (minor: inline series-color maps inside `lookup` ops author via generic object step, not a color-map UI) |
| A10 | **table configs** (columns + footer/series) | table 16 | **PARTIAL** | columns (label/key/format/width/align) + colLabel + data authorable; `footer`/`seriesFormat`/`seriesOrder`/`valueLabel`/`color`/`indent`/`statusFlags`/`caption` are the declared SCHEMA_TODO (hand-JSON); column `bar`/`valueMappings` deferred | Drain the TableConfig SCHEMA_TODO into nested itemSchemas (the KPI/axes template) |
| A11 | **featured-slider / hero landing** (items: metric/at/time/trend/group/href) | featured 1 (~14 items) · hero 1 | **PARTIAL** | items metric/label/unit/format/href/group/icon/order/color/trendSub/time authorable; `trend` opaque (= A1), `at` plane:'system' opaque | Reuse the A1 TrendField; metric-passport coordinate (see B3) removes the raw `at` |
| A12 | **query fan-out `$ctx`/`$ne`** | $ctx 92 · $ne 26 | `[known-queue]` | 0087-parity ($ctx/$ne modes) in flight — not re-reported | (0087) |
| A13 | **LocaleString bilingual fields** | pervasive | **AUTHORABLE** | LocaleString controls + `coverage:'localized'` + locale gates. (Minor: page-header `title` schema is `type:'string'` though config is LocaleString) | — |
| A14 | **layout / breakpoint overrides** (`count:{default,md,sm}`, grid) | columns 8 · grid 8 | **AUTHORABLE** | per-breakpoint authoring landed (ValueAuthoringControl · resolveGrid) | — |

**Severity ranking (frequency × author-plane centrality):** A1 (high) > A3 (high, wiring) > A4 (med) > A5/A6 (med) > A7 (med) > A11 (med) > A8 (low-med) > A10 (low-med) > A9 minor.

---

## DIRECTION B — corpus shapes the panel now SUPERSEDES (modernization ledger, all safe/expand-contract)

| # | Legacy shape in corpus | occ ≈ | Status | Modern emission | Move |
|---|---|---|---|---|---|
| B1 | **`type:'query'` + `pipe[]` + `encoding`** as the chart/section data head | query 18 (36 discriminant tokens) · transform 0 | stored-fine (expand-contract) | ONE `pipeline` DataSpec with a `source` head (0082 spine) | Flip default emission query→pipeline after `FF-PIPELINE-EQUIV` green (the ⛔ one-way door already specced in 0082). Absorbs B4 |
| B2 | **hand `type:'yoy'` trends** where a governed growth metric now EXISTS | yoy 17; `gdp.growthYoy`/`gdp.perCapitaGrowthYoy` defined (lines 5438/5480) | redundant declaration | BIND the governed growth metric instead of re-declaring a yoy trend | Promote hand yoy/cagr trends → governed growth-metric refs where an equivalent exists (needs passport trend-semantics, 0090-adjacent) |
| B3 | **redundant `value.filter:{account,side}` alongside a governed `value.measure`** | ~KPI values (accounts.*) | redundant plumbing | metric passport (0090) carries the metric's natural coordinate → `value.filter` becomes override-only | The promotion loop (0084) + passport (0090) absorb the default coordinate `[known-queue-adjacent]` |
| B4 | **`measure:'*'` wildcard + `filter.measure:{$ctx}`** on the same chart query | measure:'*' 7 | redundant read spec | a `pipeline` `source` head expresses the read once | Folds into B1 |
| B5 | **filter `options` as raw `{items,pipe}` JSON** | ~8 | rewrite-only today | a declared OptionsSource builder (A5) makes them re-authorable, not rewrite | Ships with A5; then existing sources re-open in the builder |
| B6 | **CHECK-4: metric-id in a raw dim-filter slot** | 0 | **VERIFIED PASS** | governed ids appear ONLY in governed measure-ref positions; the b544819 fix stuck | No action — clean bill |

---

## RANKED TOP-LISTS (the LEAD cards these)

### (A) The 5 authorability gaps that matter most — what the owner will want to author next and cannot

1. **Structured Trend builder** (A1/A11) — the `trend` union (yoy/cagr/share-with-num/denom) is authored as raw JSON in
   ~33 places across KPI strips and the featured slider. Highest-frequency opaque sub-object. *Reference: Grafana
   panel-editor "Value options"/thresholds completeness.* Ships as a `TrendField` PropFieldType → step form, the exact
   template the just-landed `ThresholdField` used.
2. **Prior-period ($prev) input in CalcBuilder** (A4) — the coordinate/time-lag on a `calc` input is not surfaced, so the
   whole growth-by-lag class (gdp.growthYoy, perCapitaGrowthYoy) and per-input `at` coords (laborShare) cannot be composed
   visually. *Reference: dbt/Looker period-over-period measure templates.*
3. **Wire the EXISTING VisibilityBuilder onto item-level `when`** (A3) — capability already built and wired to
   filters/perspectives/page; just not projected onto KPI/featured item `when` (plane:'steward' opaque) nor node
   `view.visibleWhen`. 42 occurrences. Lowest-cost, high-visibility — a projection, not a new build.
4. **Filter options-source + default-from-options + span-role** (A5/A6) — the options SOURCE (pick members + sort), the
   `{from:'options',pick:'first'|'last'}` default, and the from→to `spanRole` pairing are hand-JSON. Every dynamics filter
   in the corpus needs them. *Reference: Builder.io schema-driven data-binding editors.*
5. **Perspective onEnter/onExit + page-header perspective-keyed badge** (A7/A8) — perspective state-reset bags (6) and the
   `{range,year}` badge map with `{fromYear}`/`{time}` tokens are both perspective-shaped config the panel flattens to a
   scalar. Register an enter/exit scope-key + promote `badge` to a keyed-map field (registry OCP, no new form machinery).

### (B) Top corpus-modernization moves — each safe / expand-contract

1. **Flip default data-head emission `query`+`pipe` → `pipeline`+`source`** (B1/B4) — after `FF-PIPELINE-EQUIV` proves
   equivalence on the stored corpus (the 0082 ⛔ one-way door). Retires 18 legacy query heads + the `measure:'*'`+`$ctx`
   redundancy into one spine. Stored configs keep working via desugar; only new emissions change.
2. **Bind governed growth metrics in place of hand `type:'yoy'` trends** (B2) — where `gdp.growthYoy` et al. already exist,
   a modern KPI/featured item binds the governed metric rather than re-declaring a yoy trend. Depends on the metric
   passport (0090) carrying trend semantics; cleanest AFTER gap A1 lands (the builder can emit either shape).
3. **Move the redundant `value.filter` coordinate into the metric passport** (B3) — a governed measure should carry its
   natural coordinate (account/side) so authors never hand-specify it; `value.filter` degrades to override-only. Absorbed
   by the 0084 promotion loop + 0090 passport.
4. **CHECK-4 = clean** (B6) — no action; recorded so the guard's green state is auditable.

---

## Method note

Element parity was established from `platform/packages/plugins/catalog.ts` (registered metas) cross-checked against the
corpus `type` histogram — every corpus node type maps to a registered element. Prop-schema reach was read directly from
each element's declared `Schema`/`itemSchema` (`KpiStripNode.ts`, `ChartNode.ts`, `TableNode.ts`, `page-header`,
`featured-slider`, `param-schemas.ts`) and the panel schema-source ports
(`filterParamSchemaSource`, `perspectiveScopeSchemaSource`, `perspectiveDefSchemaSource`). Data-plane reach was read from
the data-layer workbench (`DataSpecEditor` + `EncodingEditor` + `PipelineBuilder` + `TransformStepEditor` + `FilterBuilder`)
and the semantic Model surface (`CalcBuilder`, `MetricEditor`, `PromoteMetric`). The gaps are consistently the opaque
`type:'object'`/plane:'system' leaves flagged in each element's own `OPAQUE_BY_DESIGN` / `SCHEMA_TODO` comment — this audit
prioritizes them by corpus frequency and author-plane centrality, and confirms none is an element-parity hole (all are
sub-object-depth or wiring gaps, consistent with ADR-038/041 holding).
