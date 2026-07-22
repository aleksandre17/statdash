// ── workbenchCapabilities — DERIVED three-pane admissibility (DESIGN-0104 §2·C2 · E1) ──
//
//  The Capability Matrix's admissibility half. A kind opens the three-pane workbench IFF
//  every capability it REQUIRES is PROVIDED by the workbench's own surfaces — a pure,
//  data-driven subset check, NEVER a hand-maintained kind allow-list. This REPLACES the old
//  `isWorkbenchShaped` allow-list (`workbenchModel.ts`, hand-narrowed to query+pipeline): the
//  gate is re-derived here and can never be hand-widened again. The 0104 regression class — a
//  kind diverted into a read-only three-pane that cannot edit what it needs — is now
//  UNREPRESENTABLE: a kind requiring `head.years.edit` (timeseries) is refused the panes by
//  DERIVATION until a surface here provides that act; then it auto-admits, no edit to this
//  file (OCP — declaration over dispatch, no per-kind switch).
//
//  Arrow: the required set is ENGINE-declared (`capabilitiesFor`, Constructor-visible); what
//  the three-pane PROVIDES is a PANEL fact (this surface is panel-owned), declared here.
//
import { capabilitiesFor, type CapabilityId } from '@statdash/engine'

/**
 * What the three-pane workbench provides INTRINSICALLY — the pipeline-spine authoring acts
 * its own panes deliver (GetHead source-pick · GetGrainEditor/FilterBuilder · PipelineBuilder
 * tail · Field-Wells encoding · Advanced raw-JSON). This is exactly the set that makes a
 * `query` and a native `pipeline` authorable WITHOUT loss — and NOT the value-cell / pivot /
 * inline-source / single↔multi acts, so those kinds fall to their dedicated editors.
 *
 * E2a EXTENSION SEAM: when head/step editors register (`registerStepEditor`), their `provides`
 * union in below — that is how timeseries/growth/pivot/transform auto-admit, by declaration.
 */
export const WORKBENCH_CORE_CAPABILITIES: readonly CapabilityId[] = [
  'head.source.pick',
  'head.filter-builder',
  'pipeline.steps.edit',
  'encoding.edit',
  'raw-json.write',
]

/**
 * `pipeline` is the workbench's NATIVE shape, not an authoring-catalog kind (it is authored
 * by the panes, not picked — C7 adds it to the picker in a later wave). Its requirement is
 * declared here, beside the workbench that owns it, rather than in `SPEC_CATALOG`.
 */
const PIPELINE_REQUIRED: readonly CapabilityId[] = [
  'head.source.pick',
  'pipeline.steps.edit',
  'encoding.edit',
  'raw-json.write',
]

/** The authoring capabilities a kind REQUIRES — engine catalog for catalog kinds, plus the
 *  panel-owned `pipeline` shape. Empty ⇒ an undeclared kind (fail-closed below). */
export function requiredCapabilities(kind: string): readonly CapabilityId[] {
  return kind === 'pipeline' ? PIPELINE_REQUIRED : capabilitiesFor(kind)
}

/** The capabilities the three-pane workbench currently PROVIDES (core surfaces; E2a unions in
 *  registered step/head editors). A Set for the subset test. */
export function workbenchProvidedCapabilities(): ReadonlySet<CapabilityId> {
  // E2a: `...stepEditorProvides()` unions here — the ONE line that widens the panes.
  return new Set<CapabilityId>(WORKBENCH_CORE_CAPABILITIES)
}

/**
 * DERIVED: may the three-pane workbench author `kind` without loss? True IFF every required
 * capability is provided. FAIL-CLOSED on an undeclared kind (empty requirement ⇒ NOT
 * admissible) — an undeclared kind must route to the honest fallback lane, never be silently
 * admitted to the panes (the regression lock). Replaces the hand gate; no per-kind branch.
 */
export function isWorkbenchAdmissible(kind: string): boolean {
  const required = requiredCapabilities(kind)
  if (required.length === 0) return false
  const provided = workbenchProvidedCapabilities()
  return required.every((c) => provided.has(c))
}
