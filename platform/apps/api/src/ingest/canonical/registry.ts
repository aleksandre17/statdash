// ── Codelist / DSD resolution registry — the declare-OR-reference seam ────────
//
// ADR-0031 §3 (codelist/DSD registry) + §4 improvement 2 / Wave 1c. A data-keyed
// dispatch on `CodelistRef.kind` (Registry pattern) deciding HOW a dimension's
// codelist members are sourced:
//
//   - `declared` (BAKE-NOW): members come from this workbook's `CL_<dim>` sheet.
//      Resolution = the existing upsert-and-register path — the parser emits the
//      `RawClassifierRow[]` and the codelists submission upserts them (SCD-2), so
//      they become referenceable by `(dim, vintage)` for the next workbook.
//
//   - `reference` / `dsdRef` (SEAM-DEFER): resolve members from the shared gold
//      registry by id + version (the SDMX agency-registry model — geo/time/measure
//      shared across datasets without re-listing them). The type union carries it
//      now; the resolver is a NOT_IMPLEMENTED stub until the first workbook
//      actually references rather than declares (trigger: a 4th dataset reusing
//      CL_GEO). This keeps the seam OPEN without building an unused resolver.

import type { CodelistRef } from './types.js'

/**
 * What a `declared` codelist resolves to: the dimension whose `CL_<dim>` sheet
 * carries the members. The parser has already emitted those members as
 * `RawClassifierRow[]`; this resolution result just names the upsert path.
 */
export interface DeclaredResolution {
  kind: 'declared'
  dim: string
}

/**
 * Resolve a `CodelistRef` to its sourcing strategy (data-keyed dispatch on `kind`).
 *
 * `declared` returns the upsert-path descriptor (BAKE-NOW). `reference` is a
 * reserved seam: it throws `NOT_IMPLEMENTED` — the union carries the case so the
 * type system already accounts for it, but the gold-registry resolver is built on
 * trigger, not speculatively (SEAM-DEFER, §4 improvement 2).
 */
export function resolveCodelist(ref: CodelistRef): DeclaredResolution {
  switch (ref.kind) {
    case 'declared':
      return { kind: 'declared', dim: ref.dim }
    case 'reference':
      throw new Error(
        `NOT_IMPLEMENTED: reference codelist resolution (id=${ref.id}, version=${ref.version}). ` +
        `SEAM-DEFER (ADR-0031 §4 improvement 2) — build the gold-registry resolver when the ` +
        `first workbook references rather than declares a codelist.`,
      )
    default: {
      // Exhaustiveness guard: a new CodelistRef.kind must extend this switch.
      const _never: never = ref
      throw new Error(`Unknown CodelistRef kind: ${JSON.stringify(_never)}`)
    }
  }
}

/**
 * Resolve a whole-DSD reference (`dsd_ref` STRUCTURE row). Reserved seam — always
 * throws `NOT_IMPLEMENTED` until a workbook references a registered DSD by id +
 * version instead of declaring its dimensions inline (SEAM-DEFER, improvement 2).
 */
export function resolveDsdRef(ref: { id: string; version: string }): never {
  throw new Error(
    `NOT_IMPLEMENTED: whole-DSD reference resolution (id=${ref.id}, version=${ref.version}). ` +
    `SEAM-DEFER (ADR-0031 §4 improvement 2) — build the DSD-registry resolver on first use.`,
  )
}
