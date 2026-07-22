// ── @statdash/engine — Authoring Capability vocabulary (DESIGN-0104 §2·C2 · E1) ────────
//
//  The ONE place the AUTHORING-CAPABILITY vocabulary is enumerated (door #3, lead-reviewed).
//  A `CapabilityId` names an AUTHORING ACT — *what the author does to a spec* — never a
//  component or a kind. Kinds DECLARE the capabilities they REQUIRE (`SpecManifestEntry.
//  capabilities`, spec-catalog.ts); editing surfaces DECLARE what they PROVIDE (panel-side
//  `provides`); workbench admissibility + editor parity are DERIVED from the two (never a
//  hand gate). This makes the 0104 regression class — a kind silently diverted into a
//  read-only surface that cannot edit what it needs — UNREPRESENTABLE: a kind is admitted
//  to a surface only when that surface provably provides every capability the kind requires.
//
//  Engine-side + serializable BY DESIGN (Arrow discipline): the ids ride `SpecManifestEntry`
//  into `specManifest()` → the Constructor introspects them. The React editors that PROVIDE
//  them live panel-side and are resolved at boot — same split `editorKey` already proves.
//
//  Vocabulary discipline (keep it honest, not ceremonial):
//    • SEMANTIC — `head.years.edit` (the act), never `YearsField` (the component).
//    • SHARED where the act is shared — timeseries + growth both `head.measure-code.edit`.
//    • `.edit` / `.toggle` / `.pick` / `.write` verb suffix — the act's shape.
//    • Add an id only when a real surface provides it AND a real kind requires it — every
//      entry must BITE (derive an admissibility decision or red a parity probe).
//
export const CAPABILITY_IDS = [
  // ── Pipeline-spine acts — the three-pane workbench provides these intrinsically ──────
  //  (query + native pipeline are authored ENTIRELY from this set → they are admissible).
  'head.source.pick',      // choose / replace the source head (governed metric | raw cube)
  'head.filter-builder',   // pin / filter the source read (the where-grain / query filter)
  'pipeline.steps.edit',   // author the tail — add / reorder / edit transform steps
  'encoding.edit',         // map fields to encoding channels (x / y / color / label wells)
  'raw-json.write',        // write the raw spec JSON (the power-user escape hatch)

  // ── Kind-specific acts — NOT in the pipeline spine (a dedicated editor provides them) ─
  //  A kind requiring ANY of these is NOT three-pane-admissible → it routes to its
  //  dedicated fallback editor (never a read-only three-pane). E2a+ re-homes these as
  //  head / step editors, at which point their kinds auto-admit — the matrix, not a hand
  //  edit, opens the gate.
  'head.measure-code.edit', // edit a single scalar measure code (value-cell head)
  'head.years.edit',        // edit the YearsSpec (number[] | 'all')
  'growth.single-multi.toggle', // toggle single↔multi code (the one-way trap's escape)
  'pivot.rows.edit',        // edit the static pivot rows
  'pivot.key-field.edit',   // choose the key field
  'pivot.value-fields.edit', // choose the value columns
  'pivot.colors.edit',      // map per-series colors
  'transform.source.edit',  // edit the inline literal source rows
  'row-list.rows.edit',     // edit the explicit RowSpec[]
  'ratio-list.pairs.edit',  // edit the measure / denominator pairs
  'metric.refs.edit',       // choose governed metric refs
  'metric.grain.edit',      // set the by / time / where grain
] as const

/** An authoring-capability id — a member of the `CAPABILITY_IDS` const union (typo-proof). */
export type CapabilityId = typeof CAPABILITY_IDS[number]
