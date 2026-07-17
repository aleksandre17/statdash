---
name: facet-axis-style-facet
description: The FACET axis (SPEC-deep-authorability-completion) — the FacetDescriptor/facetRegistry seam (ADR-041 sibling) projecting universal element capabilities as generic dock sections. Seam mechanism, how a facet opts in, the complete 5-facet set, and the reusable gotchas.
metadata:
  type: project
---

Built for SPEC-deep-authorability-completion. An element has TWO orthogonal declared-contract axes: CONSTITUENT (Parts, ADR-041 — `enumerateParts`/`element.schema`) and FACET (universal capabilities). The dock projected only the part axis; this work added the facet axis, generically. **COMPLETE — all 6 authoring dimensions project: content (=element.schema, the part axis) + the 5 FACET descriptors below.**

## The seam (mechanism)
- `packages/react/src/engine/facet.ts` — `FacetDescriptor { id, appliesWhen(meta), contract(meta)→PropSchema, readPath, label, order }` + `facetRegistry` (register/has/list/applicable). Engine-index exported, DATA-ONLY, **locale-agnostic** (post-edit-laws hook FORBIDS `ka`/Georgian in packages/react|core → concrete facets + labels live in the APP).
- **appliesWhen reads a declared CAP or FIELD, never a `meta.type` literal** — keeps `FF-NO-EXTERNAL-SPECIAL-CASE` green (scans builtins.tsx/useCanvasController for type literals).
- **contract returns a PropSchema fragment** dispatched through the SAME generic `Inspector` + `FieldControlRegistry` the part axis uses. Genericity is in the DISPATCH (rich facet → rich control), not auto-generation. Reference shape = Webflow/Framer/Builder.io (fixed facet set, each opted-in by declaration).

## App wiring (labels + registration)
- `apps/panel/src/inspector/facets/builtinFacets.ts` — `registerBuiltinFacets()` registers each concrete facet WITH `{ka,en}` labels (app tier = locale-legal).
- `apps/panel/src/inspector/sections/builtins.tsx` — `registerFacetSections()` (exported) loops `facetRegistry.list()` → ONE `dockSectionRegistry` section per facet (`id: element.facet.<id>`). appliesTo = `selectedElementMeta(ctx)` (whole node → `nodeRegistry.getMeta`; chrome region PART → `selectedBand.partMeta`; positional value/filter item → undefined) then `facet.appliesWhen(meta)`. render = `<Inspector schemaSource={fixedSchemaSource(facet.contract(meta),[])} onChange={patchProp | patchChromeStructural} />`. NO overline (the contract field's label is the single heading — DRY). `registerBuiltinDockSections()` runs facets first.

## The 5 facets (id · order · readPath · opt-in predicate · type→control)
- **style** 40 · `view.styles` · **UNIVERSAL** (`typeof meta.slot!=='string'` — SAME slot-inverse predicate as visibility; retired the `styleable` cap 2026-07-13, AR49 universal-authorability) · `'style'`→StyleField (grouped token-picker over view.styles; render via applyNodeStyles/resolveStyle). Activated dormant `enum-ref source:'tokens'` (tokenCatalogOptions, cssVar IDENTITY round-trip). **WHY universal:** `defineShell` calls `applyViewStyles(def.view)` for EVERY shell regardless of caps — the RUNTIME already honours view.styles universally, so gating AUTHORING behind an opt-in cap was a gap. `styleable` NodeCap token + `CAPS.STYLEABLE` const are RETIRED (were read by nothing but this facet). Style+Visibility are the two UNIVERSAL facets ("always"); data/events are OPT-IN caps ("where applicable"). geograph gained `data-bindable` (declares a DataSpec).
- **data** 20 · `data` · cap `data-bindable` (dedicated AUTHORING cap, NOT behavioural `data`) · `'data-pipeline'`→DataFacetField (MetricPalette bind via `bindMeasureToSpec`→query.measure ⊕ lazy DataSpecEditor pipe, metric-optional; raw-source stays Steward — D-DA1 lens, FF-AUTHOR-NO-QUERY).
- **events** 50 · `on` · cap `interactive` (dedicated, NOT behavioural `filterable`) · `'events'`→EventsField (trigger→action list over NodeAction grammar; nested Inspector per arm). **The union IS the SSOT:** eventsFacetModel tables typed `Record<NodeEventTrigger,…>`/`Record<NodeAction['type'],…>` → tsc forces label+schema+default per arm (a new node-events.ts arm is a compile error until offered; OCP).
- **visibility** 30 · `view.visibleWhen` · **UNIVERSAL** (`typeof meta.slot!=='string'` — the INVERSE of chrome's `slot` read; any renderable page node, excludes chrome regions) · `'visibility'`→VisibilityField. FOLDs the retired hand-wired `element.visibility` section, REUSING VisibilitySection verbatim (`heading={false}`).
- **chrome** 15 · `''` · field `slot` (`typeof meta.slot==='string'`) · contract = `chromeStructuralContract(slot)` projecting variant/region/order; write lane = `patchChromeStructural` (band.partMeta branch), NOT patchProp.

## Reusable gotchas
- **New PropFieldType per rich facet** (`packages/core/src/config/prop-schema.ts`). TWO consumers: PropSchemaForm FIELD_RENDERERS `Record<PropFieldType,…>` (tsc-FORCED — the exhaustive one; add `jsonInput` degrade) + propSchemaToJsonSchema typeDescriptor (has a `default` so optional, but add `{type,$comment}` so saveGuard accepts the authored value). Register `type→Control` in FieldControlRegistry.
- **appliesWhen must NOT read `meta.type`** — `nodeRegistry.getMeta` returns StoredMeta WITHOUT `type` (type is the map key), so a `.type` predicate matches in unit tests (which pass `{type}`) but NEVER in the real dock flow. Use caps or the `slot` discriminant.
- **Fold, don't parallel:** a pre-existing hand-wired section re-homes as ONE mode of a facet, deleting the section (element.data→facet, element.visibility→facet). Orphaned controller write lanes (`selectedBindable`, `setVisibleWhen`) left as follow-up. `patchProp(path, undefined)` leaves `{path:undefined}` (JSON-drops on save) vs a clean delete — accepted (consistent across facets).
- **Shared component with 2 consumers** (VisibilitySection: facet + ParamDefEditor filter-scoping) → gate the heading with a prop, don't delete/fork.
- **dockSection.test.ts folds** need `setupCanvasRegistry()` — a facet section is meta-driven (needs getMeta) where the old hand-wired section used registry-free `wholeNodeSelected`.

## Guard
`FF-FACET-PROJECTED` (`apps/panel/src/inspector/facetProjection.fitness.test.ts`): each facet registered + predicate reads declaration not type + section falls out for a real opted-in meta and NOT for a non-opted one + a synthetic 2nd facet re-derives (OCP) + "all SIX dimensions" leg. Round-trips: styleField.roundtrip / eventsFacet.roundtrip; visibility render proven by CanvasView.test.tsx.
