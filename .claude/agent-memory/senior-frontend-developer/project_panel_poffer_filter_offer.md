---
name: project-panel-poffer-filter-offer
description: P-OFFER offer-driven step editors — pick governed columns/members, never type; stepInput seam + FieldPicker/MemberPicker; engine filter grammar is equality/IN only
metadata:
  type: project
---

# P-OFFER — the offer-driven pipeline step editors (card 0082, commit 43fbbe8)

**P-OFFER principle (owner-directed, binding on the authoring surface):** the author never TYPES an identifier — every field/member/metric is PICKED from an offered, governed list; free text ONLY where a name is genuinely new (a Derive's produced-field name). Excel/Power-Query AutoFilter school (Law 4). The DATA-plane peer of [[feedback_contextual_relevance_canon]] "offer, don't ask the author to guess."

**Why:** owner complaint (2026-07-18) — the Filter step's free-text "სვეტი/მნიშვნელობა" boxes left him unable to tell what to write where.

**How to apply:** any pipeline step editor (Filter, Sort, Lookup, and future Aggregate/Reshape/Combine field pickers) offers columns + members. Reuse the two primitives, don't re-roll:
- `editors/query/steps/offer/FieldPicker.tsx` — a Select over offered columns (governed labels; off-list stored value kept as an honest extra option); free-text fallback when no offer. Used by Filter's column, Sort's field, Lookup's key.
- `editors/query/steps/offer/MemberPicker.tsx` — the Excel AutoFilter checkbox list (searchable, WCAG group+checkboxes). Checked set → engine `where` semantics UNCHANGED: one → scalar, many → IN-array; uncheck-all drops the condition.

**The offer seam (pure, ONE derivation path):** `pipeline-preview/stepInput.ts` — `stepInputRows(sourceRows, tail, index, ctx)` = the step's INPUT = the PREVIOUS step's OUTPUT via the existing `deriveStepRows` prefix (never a 2nd fetch). `buildStepInputOffer(...)` derives governed columns (`buildColumnLabels`) + a column's distinct governed members (`buildMemberLabels`, label-sorted, `DISTINCT_CAP=1000`), excluding `AUTHOR_HIDDEN_FIELDS`.

**The wiring:** `DataWorkbench` lifts `usePipelineSourceRows` ONCE and passes `source` to BOTH the grid (`PipelineStepGridView` — the new pure form split out of the self-resolving `PipelineStepGrid`) AND the `stepInput(index)` provider → `PipelineBuilder` (`stepInput?` prop) → `StepCard` → `StepForm` (`input?` prop) → the step editors. Governed-label resolvers extracted to `pipeline-preview/useGridLabels.ts` so grid + offers speak the identical catalog. The LEGACY editor path (`QuerySpecEditor`) omits `stepInput` → free-text fallback (Strangler).

**Engine filter grammar CHECK (durable fact):** `FilterValue = DimVal | DimVal[] | CtxRef | NeRef | NeCtxRef` (`packages/core/src/sdmx.ts`); `matchesFilter`/`resolveFilter` (`store-filter.ts`) — **equality / IN-set only** (+ `$ctx` scope, `$ne` exclusion). **No comparators** (`>`,`≥`,`<`,`≤`,`between`). A numeric comparator filter row needs a NEW engine `FilterValue` comparator variant (Class-M engine contract) — do NOT invent comparator config grammar in the panel (Law 2). `ColumnOffer.numeric` is the ledgered seam it will land on. `$ne` is a SINGLE `DimVal` (multi-exclude = a ledgered array-$ne engine door).

**TWO filter resolution paths — they must AGREE (durable fact, 0087b):** a query-level filter (`ObsQuery.filter` / the source head) resolves through the STORE predicate `matchesFilter` (store-filter.ts); a pipeline TAIL `filter` step resolves through `applyFilter` (`data/transform/steps.ts`). Card 0087b fixed a real divergence: `applyFilter` matched `isCtxRef` (keyed on `$ctx`) BEFORE `$ne`, so a **NeCtxRef `{$ne,$ctx}`** in a pipeline filter step silently DROPPED its exclusion (the store path never had the bug). Fix = match `$ne` FIRST, mirroring matchesFilter (incl. the multi-value `$ctx` scope `splitMultiValue` split). Guard: `filter-parity.fitness.ts` asserts `applyFilter ≡ matchesFilter` over specific/follow/except/combined. When adding a new FilterValue shape, wire it in BOTH paths + extend that fitness.

Extends [[project_panel_pipeline_emission_flip_wp5b]] · [[project_panel_data_workbench_wp2]].
