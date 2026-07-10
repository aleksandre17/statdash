---
name: object-meta-one-type-system
description: ADR-023 R1 — ObjectMeta is the ONE base type (kind-as-facet); objectRegistry is the one discovery registry; the 5 SliceMeta names are derived refinements
metadata:
  type: reference
---

# ObjectMeta — one type system, kind-as-facet (ADR-023 · AR-49 R1)

The 5-tier plugin taxonomy is now ONE base type + refinements, in
`platform/packages/react/src/engine/slice-meta.ts`:
`Page/Panel/Node/Chrome/FilterControl SliceMeta = ObjectMeta & { sliceType; …pinned facets }`.
"Kind" is a pinned facet (page `rootOnly:true`, panel `canHaveChildren?:false`), not a
5th mechanism. The names re-export byte-identically through the barrel chain
(slice-meta → types/slice.ts → types/index.ts → engine index.ts).

**Byte-identical rule that bit once:** `type` is NODE-TIER identity (node/page/panel
`type:string`), NOT on the `ObjectMeta` base — because putting it there widened
chrome/control to `type?:string` and broke `'type' in m` narrowing in
`schema-completeness.fitness.test.ts`. Universal `(type,variant)` identity is
synthesized at ingestion by `normalizeObjectIdentity` (chrome→slot/key, control→
controlType, else type/variant). Same caution applies before moving any other field
onto the shared base — check `'field' in m` consumers first.

**objectRegistry** (`objectRegistry.ts`) = the ONE kind-agnostic type-descriptor /
discovery registry. `registerSlice` feeds it via ONE unconditional
`objectRegistry.register(mod.META)` BEFORE the behaviour branches. The three legacy
registries (nodeRegistry/chromeRegistry/filterControlRegistry) stay as typed
BEHAVIOUR stores (ISP: descriptor discovery vs renderer/codec behaviour) — kept as
reversible aliases. R1 is Strangler EXPAND only: no behaviour-store merge, no
contract, no promotion (kpi-card/hero-card are NOT node types yet — that is R2/R3,
owner one-way doors D-ROM-2/3).

**Why no physical registry merge in R1:** the 3 behaviour contracts are
heterogeneous (`(def,ctx,children)=>ReactNode` vs `()=>ReactNode` vs a rich codec
slice); one heterogeneous Map regresses type-safety (Law 6/ISP). Canonical answer =
behaviour side-tables keyed by identity, lands with R2/R4.

**Fitness gates:** `object-model.fitness.test.ts` (react/engine — FF-ONE-TYPE-SYSTEM,
FF-KIND-IS-FACET real; FF-ONE-COMPOSITION-GRAMMAR scaffold→R4) +
`object-model-residence.fitness.test.ts` (plugins/__tests__ — FF-NO-FACET-REINVENTION
[allowlist `['kpi-strip']`, the `when` facet; flips to `[]` at R2], FF-TWO-RESIDENCES-ONLY,
FF-PROMOTION-LOSSLESS scaffolds). The react gate uses SYNTHETIC metas (arrow-clean, no
plugin import); the residence gate scans `AUTHORING_METAS` (plugins-tier, arrow-legal).

See [[project_ar49_m0_dimension_catalog]] (sibling AR-49 track) and ADR-023.
