---
name: panel-raw-cube-promotion
description: 0084 — the STEWARD raw-cube Get entry (GetHead tabs, plane-gated) + the E2 promotion loop (raw head → governed metric, reusing the semanticCatalog seam) + cubeDebt member-label visibility. Seams, the SAFE-SAVE + zustand-selector gotchas, and the store-routing finding.
metadata:
  type: project
---

# 0084 — raw work in the workbench: the steward raw-cube entry + the promotion loop (commit `7058c12`, on main)

Two-audience canon (ADR-046 variant 2 — the steward `source(query)` head EXISTS, no new grammar). All in `platform/apps/panel/src/features/data-layer/workbench/`.

## The seams (reuse these)
- **`GetHead.tsx`** — the plane-gated source picker. AUTHOR lens → `MetricPalette` only (no raw tab, FF-AUTHOR-NO-QUERY). STEWARD lens → MUI tabs «მეტრიკები» | «ნედლი კუბები». Reads `useRole()` (the ONE lens seam, [[project_mui_radix_migration]]-adjacent; author⇒metrics-only).
- **`RawCubePalette.tsx`** — cube list = `cubeApi.datasets()` (`CubeDatasetRow` = code + bilingual label); each cube an expandable disclosure loading its profile lazily via `cubeProfile.store.ensure` → dim summary + label-debt chips + a «browse» button emitting `profile.measures.map(m=>m.code)`.
- **`workbenchModel.ts`** helpers — `withStewardCube(m, measures)` (steward `{op:'source',query:{measure}}` head, CLEARS the tail = a new raw cube is a new table); `promoteHeadToMetric(m, id)` (head SWAP → `{op:'source',metrics:[id]}`, tail preserved); `isStewardHead`/`stewardHeadMeasure`.
- **`PromoteMetric.tsx`** (E2) — steward-lens-gated (a legacy `query` desugars to a steward head even in the author lens, so gate on ROLE not head). REUSES the definition seam verbatim: `metricDraft.draftFromMeasure`/`unitToLocaleString` (unit pre-fill) → `semanticCatalog.store.upsertMetric` → `saveSemanticCatalog()` (PUT `/api/config/site` + `registerManifestMetrics` + `metricCatalog invalidate`) → on ok `onPromoted(id)` replaces the head.
- **`cubeDebt.ts`** — pure member-label debt lens: `memberLacksLabel` (empty OR code-echoed-as-label ⇒ missing), `cubeLabelDebt` (time axis exempt), `debtNote` («N წევრს ეტიკეტი აკლია»). Visibility ONLY — never invents a label.

## Gotchas that bit
- **SAFE-SAVE (catalog-wipe trap):** `saveSemanticCatalog()` PUTs the WHOLE working copy (`useSemanticCatalogStore.metrics`). If the store is un-hydrated (idle, `metrics:[]`), an `upsertMetric` + save PUTs ONLY the new metric → **wipes the catalog**. Always `ensure()` + gate Save on `status==='ready'` before upsert.
- **zustand mapping-selector infinite loop:** `useStore(s => s.metrics.map(m=>m.id))` returns a FRESH array each render → "getSnapshot should be cached" → Maximum update depth exceeded. Select the STABLE ref (`s.metrics`) + derive with `useMemo`.
- **setState-in-effect is an ESLint ERROR** (`react-hooks/set-state-in-effect`). Seeding form state from an async-resolved prop (unit/label pre-fill) must be a PURE derivation (`eff = hasTyped ? typed : seed`), never a `useEffect(()=>setState())`.

## FF-PROMOTE-ROUNDTRIP (flipped, core TEST-ONLY)
`packages/core/src/data/promote-roundtrip.fitness.test.ts` (it.todo → 3/3). The byte-identity is an ENGINE property so it lives in core: a governed BASE metric whose `code` = the raw head's `query.measure` browses through `browseBaseMetric` = the SAME storeObs read the steward `source(query)` head uses (ADR-046 Addendum 2) → `interpretSpec(governedHead) ≡ interpretSpec(rawHead)`, tail preserved. NO engine src change.

## Finding — raw-cube live browse is PAGE-store-scoped (apps-only boundary)
A steward `source(query)` head carries no `dataSource` → `specDataSource`→undefined → `resolveStore` first-store fallback → the live browse reads the PAGE's active cube regardless of WHICH cube was picked. Correct when the pick IS a session source; a cross-cube pick reads the wrong store. Cube LIST + debt inventory are correct for ALL cubes; only the live BROWSE is page-scoped. Cure = add the picked cube to live descriptors (session) or an engine seam — NOT apps-only.

## Debt inventory (live, 2026-07-18 — provisioning governance gap, not a panel defect)
REGIONAL_GVA · ACCOUNTS_SEQUENCE · GDP_ANNUAL each carry a dim with **8 members lacking a governed label** (codelists ship without member labels — the R/U-class gap). Fix belongs in provisioning.

Extends [[project_panel_pipeline_emission_flip_wp5b]] · [[project_panel_poffer_filter_offer]] · [[project_panel_plane_inspector]]. Live: `probe-0084-raw-cube.mjs` (steward lens via localStorage `statdash.role`) → `work/authoring-truth/0084/`.
