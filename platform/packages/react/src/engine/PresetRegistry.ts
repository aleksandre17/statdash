// ── PresetRegistry — the composed-preset store (ADR-049 P2b · ADR-050 R2) ──
//
//  "Pick a whole, then tweak." A PRESET is a partial element declaration — a pure-
//  config sub-tree (`NodeSeed`) that composes an EXISTING registered node type with
//  sensible props, a bound DataSpec (made declarable by P1's `make()`), and pre-wired
//  trend/threshold/visibility — projected into the palette as ONE insertable whole.
//  Dropping it lands a valid, data-bound, sensibly-styled object; non-expert assembly
//  becomes pick-a-whole. One declaration → a palette entry + a dropped instance, with
//  zero per-type projector code (OCP · a new preset is a new declaration, machinery
//  unchanged). This is the homoiconic move ADR-041/038 asked of the assembly axis.
//
//  MECHANISM / CONTENT SPLIT (the SAME split slices use — Q1 of the ADR's resolved
//  design). This file is the MECHANISM: the registry class + the `presetRegistry`
//  singleton + the `PresetDecl`/`NodeSeed` types. It is generic, engine-resident, and
//  app-AGNOSTIC — it carries NO curated preset and NO domain code (dependency arrow).
//  The CONTENT — the actual curated statistics-native presets, which carry domain
//  indicator codes — is registered by the SHELL at boot (apps/panel · packages/plugins),
//  EXACTLY as `registerSlice` feeds `objectRegistry`. Engine owns the port; the shell
//  owns the declarations.
//
//  RESIDENCE (why a NEW sibling registry, not a field on an existing store — Q1):
//    • NOT `ObjectMeta.preset[]` on `objectRegistry` — that store is "which object
//      TYPES exist", JSON descriptors keyed 1:1 by identity; a preset is N-per-type,
//      an instance-SEED (not a type descriptor), and may carry domain codes below the
//      arrow. Three contract breaks → its own store.
//    • NOT `NodeRegistry.getDefaults` — that returns SCALAR props for the V6 `makeNode`
//      seed, keyed 1:1; widening it to emit children + a DataSpec would mutate the V6
//      build contract and mix "how to render" with "what curated content."
//  So the preset OWNS its store; `objectRegistry`'s descriptors-only contract and
//  `getDefaults`' scalar-V6 contract are BOTH left untouched — a pure additive add.
//
//  Law 2 (config declarative): a `NodeSeed` is INERT config — no functions anywhere in
//  the stored value. The pre-wired trend/threshold live inside `seed.props`/`seed.data`
//  as ordinary authored values, so a preset round-trips through JSON losslessly.
//
import type { DataSpec, VisibilityExpr } from '@statdash/engine'
import type { LocaleString }             from './types'
import type { NodeCap }                  from './NodeRegistry'

/**
 * A recursive, PURE-CONFIG partial node declaration — the body of a preset. It
 * references an EXISTING registered node `type` and composes it; it never introduces
 * a new type or a new grammar (ADR-038/041 · Law 10). Every field is inert data:
 *   • `props`    — overlays the registry's `getDefaults(type,variant)` (see the merge
 *                  rule in `planPresetInserts`). A seed of just `{ type }` (no overlays)
 *                  builds a node BYTE-IDENTICAL to a bare palette drop.
 *   • `data`     — a bound DataSpec (made declarable by P1's `make()`); stored at
 *                  `props.data` — the node-body key the canvas/engine bind read.
 *   • `view`     — pre-wired conditional visibility; stored at `props.view`.
 *   • `children` — a preset MAY be a small subtree (e.g. a section wrapping a bound
 *                  chart); built recursively, in fixed pre-order (Q2).
 */
export interface NodeSeed {
  type:      string
  variant?:  string
  props?:    Record<string, unknown>
  data?:     DataSpec
  view?:     { visibleWhen?: VisibilityExpr }
  children?: NodeSeed[]
}

/**
 * A composed-preset declaration — the palette-facing identity plus the `seed` it
 * inserts. `caps` mirrors `ObjectMeta.caps` so a preset can be capability-filtered by
 * the same machinery a node tile is. `label`/`icon`/`category` drive its palette tile.
 */
export interface PresetDecl {
  /** Stable palette identity (the drag payload's `presetId`). */
  id:        string
  /** i18n tile label — resolved at the palette render seam by the active locale (Law 4). */
  label:     LocaleString
  /** i18n tile description (optional) — resolved at the render seam. */
  description?: LocaleString
  /** Registry icon token → glyph via the palette's icon resolver. */
  icon?:     string
  /** Palette band grouping key (optional; defaults to the shared Starters band). */
  category?: string
  /** Capability tokens — the preset filter mirror of `ObjectMeta.caps`. */
  caps?:     NodeCap[]
  /** THE partial element declaration (pure data). */
  seed:      NodeSeed
}

/**
 * The composed-preset registry — a sibling of `objectRegistry`, same additive Strangler
 * shape. JSON-serializable descriptors only (behaviour stays in the stores); the palette
 * projects `list()` and the insert path expands the chosen `seed` through the SHARED
 * placement resolver (`planPresetInserts`). Keyed by the preset's stable `id`.
 */
export class PresetRegistry {
  private map = new Map<string, PresetDecl>()

  /** The ONE ingestion path — the shell registers a curated preset at boot. */
  register(decl: PresetDecl): void {
    this.map.set(decl.id, decl)
  }

  get(id: string): PresetDecl | undefined {
    return this.map.get(id)
  }

  has(id: string): boolean {
    return this.map.has(id)
  }

  /** Every registered preset — the ONE palette source (Starters band). */
  list(): PresetDecl[] {
    return [...this.map.values()]
  }
}

/** The composed-preset registry singleton (fed by the shell at boot). */
export const presetRegistry = new PresetRegistry()

/** Register a curated preset (the shell-side boot idiom — mirrors `registerSlice`). */
export function registerPreset(decl: PresetDecl): void {
  presetRegistry.register(decl)
}

/** Every registered preset descriptor — the palette's Starters-band source. */
export function getPresets(): PresetDecl[] {
  return presetRegistry.list()
}
