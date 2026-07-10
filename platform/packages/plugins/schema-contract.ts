// ── schema-contract.ts — the compile-time schema-completeness gate (Wave 8, tier b) ──
//
//  FF-SCHEMA-COMPLETE, compile-time half. The Inspector renders a node's whole
//  property panel GENERICALLY from its co-located PropSchema (Seam-2). "Everything
//  the runner renders is authorable" is only true if that PropSchema stays 1:1 with
//  the element's editable interface — but TS types are ERASED at runtime, so the
//  runtime fitness (schema-completeness.fitness.test.ts) cannot see the interface.
//  This module closes that gap with a TYPE-LEVEL assertion co-located beside each
//  schema: a new editable field with no schema entry fails `tsc`.
//
//  Two tools:
//    • defineSchema()  — an identity wrapper that PRESERVES each field's literal
//      `field` name at the type level (a plain `: PropSchema` annotation widens
//      `field` to `string`, erasing the very names the assert needs). Runtime value
//      is unchanged; the return type is a literal tuple still assignable to PropSchema.
//    • AssertSchemaCovers<Interface, typeof Schema, Todo> — resolves to `true` iff
//      every editable interface key is covered by a top-level schema field (or an
//      explicitly-documented Todo). Wrap it in Expect<…> beside the schema:
//          type _HeroCovers = Expect<AssertSchemaCovers<HeroNode, typeof HeroSchema>>
//      An uncovered field makes Expect<…> fail its `extends true` constraint, and
//      tsc names the offending field(s) verbatim.
//
//  What "editable" excludes (never authored as a top-level scalar prop):
//    • NodeBase system fields (type/id/variant/data/view/storeKey/variants/
//      visibleToRoles/transforms/fieldConfig/vars/dataLinks/on) — keyof NodeBase.
//    • child-slot fields — any interface key typed `NodeDef[]` (edited in the tree,
//      not the property panel). Detected structurally, so a renamed slot is handled
//      with zero per-slice config.
//
//  Direction: FORWARD-ONLY (coverage). We assert every editable key HAS a schema
//  field; we do NOT assert the reverse (no stray schema field), because dot-path
//  fields legitimately target system keys — `data.query.measure`, `view.legend`,
//  `methodology.note` — whose top-level segment (`data`/`view`) is a system key, not
//  an editable one. A forward-only gate is exactly "a new editable field with no
//  schema entry fails tsc" without false positives on system-targeting dot-paths.
//
//  Lives in plugins (the shell/composition layer that OWNS these schemas) — it
//  imports only pure engine TYPES (PropField/NodeBase/NodeDef), never React.
//
import type { PropField, NodeBase, NodeDef } from '@statdash/react/engine'

// ── defineSchema — literal-preserving identity wrapper ────────────────────────
//
//  `const T` (TS 5.0 const type parameter) infers the argument as-if `as const`,
//  capturing each `field: 'title'` as a literal. `Mutable<T>` strips the outer
//  readonly so the result is still assignable to PropSchema (`PropField[]`), i.e.
//  metas keep `schema: XSchema` with no cast. The runtime value is the same array.
type Mutable<T> = { -readonly [K in keyof T]: T[K] }

export function defineSchema<const T extends readonly PropField[]>(schema: T): Mutable<T> {
  return schema as Mutable<T>
}

// ── AssertSchemaCovers — the type-level completeness oracle ───────────────────

/** System fields never authored as top-level scalar props (the NodeBase base). */
type SystemKeys = keyof NodeBase

/** Interface keys typed as a child-slot (`NodeDef[]`) — structural, not a prop. */
type ChildSlotKeys<N> = {
  [K in keyof N]-?: NonNullable<N[K]> extends readonly NodeDef[] ? K : never
}[keyof N]

/** The keys an element's PropSchema is expected to cover. */
export type EditableKeys<N> = Exclude<keyof N, SystemKeys | ChildSlotKeys<N>> & string

/** Top-level segment of a (possibly dot-path) schema field name. */
type TopLevel<F> = F extends `${infer Head}.${string}` ? Head : F

/** The set of top-level field names a schema value declares. */
type SchemaFields<S extends readonly PropField[]> = TopLevel<S[number]['field']> & string

/**
 * Editable interface keys NOT covered by a schema field and NOT in the documented
 * `Todo` allowlist. `never` ⇒ complete.
 */
export type UncoveredFields<
  N,
  S extends readonly PropField[],
  Todo extends string = never,
> = Exclude<EditableKeys<N>, SchemaFields<S> | Todo>

/**
 * `true` when the schema covers every editable interface key (allowing an explicit,
 * documented `Todo` union of deferred keys); otherwise resolves to the union of
 * offending field names — surfaced verbatim by `Expect<…>` at `tsc` time.
 *
 * `Todo` is the compile-time face of the shrinking `SCHEMA_TODO` backlog: a key
 * placed here is a DOCUMENTED, deliberate deferral (a nested/array-of-object field
 * awaiting the tier-c `itemSchema` engine seam, or a field authored through another
 * path), never a silent drop.
 */
export type AssertSchemaCovers<
  N,
  S extends readonly PropField[],
  Todo extends string = never,
> = [UncoveredFields<N, S, Todo>] extends [never] ? true : UncoveredFields<N, S, Todo>

/**
 * Forces the completeness result to `true` at declaration time. `type _X =
 * Expect<AssertSchemaCovers<…>>` is a type-only check (no runtime emit): if the
 * assert resolves to an uncovered-field union, `Expect` violates its `extends true`
 * constraint and tsc fails on that line, naming the missing field(s).
 */
export type Expect<T extends true> = T
