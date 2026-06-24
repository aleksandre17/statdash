// ── variant-meta.ts — declarative shell-variant contract ──────────────
//
//  The shell layer's variants are DECLARED here as DATA, never hand-coded as
//  `className` modifier strings in a shell. This finishes the data-attribute
//  spine the codebase already uses (`resolveViewState` → `data-view`; the
//  PresentationProjector registry → `key + schema()`): a variant is a typed
//  declaration whose authored value a generic resolver projects to a `data-*`
//  attribute the shell spreads; the CSS reads `[data-attr]`, NOT a `--modifier`
//  class.
//
//  Three companion pieces complete the seam:
//    • VariantDef / VariantSchema — the declaration (this file).
//    • resolveVariants() (@statdash/styles) — declared schema + authored values
//      → `data-*` attrs. Pure; sits BESIDE resolveViewState (same idiom).
//    • variantPropSchema() (this file) — VariantSchema → PropField[], so variants
//      are Constructor-authorable + flow into generatePageConfigSchema (declare →
//      author → validate → render). Mirrors presentationPropSchema().
//
//  A NEW variant = one VariantDef in a slice's META + a CSS rule → ZERO shell
//  code (OCP / Law 8 M-5). The engine never reads a specific variant name; it
//  only iterates a slice's declared VariantSchema.
//

import type { LocaleString } from '@statdash/engine'
import type { PropField, PropFieldOption } from './slice-meta'

// ── VariantDef — one declared variant ─────────────────────────────────

export interface VariantDef {
  /** data-attribute key emitted on the node element, e.g. 'data-emphasis'. */
  attr:     string
  /**
   * Authored type: a boolean toggle ('flag' → attr present|absent) or a named
   * enum ('enum' → attr value is the chosen option's `value`).
   */
  kind:     'flag' | 'enum'
  /** Enum members (kind:'enum'); ignored for 'flag'. */
  options?: PropFieldOption[]
  label:    LocaleString
  /** Default authored value when the node omits it. */
  default?: string | boolean
}

/** A slice's declared variants, keyed by variant name (e.g. `emphasis`). */
export type VariantSchema = Record<string, VariantDef>

// ── variantPropSchema — VariantSchema → Constructor PropFields ─────────
//
//  Maps each VariantDef to a PropField under the `variants.<name>` dot-path,
//  so the Constructor Inspector renders a typed control (an enum → a select
//  with `options`; a flag → a boolean toggle) and generatePageConfigSchema
//  validates the stored value. Mirrors presentationPropSchema(): the union of
//  declared variant fields is the Constructor's authoring face for variants.
//
//  Returns [] for a slice that declares no variants — the empty-object base.
//
export function variantPropSchema(schema: VariantSchema | undefined): PropField[] {
  if (!schema) return []
  return Object.entries(schema).map(([name, def]) => {
    const base = {
      field: `variants.${name}`,
      label: def.label,
      ...(def.default !== undefined && { default: def.default }),
    }
    return def.kind === 'enum'
      ? { ...base, type: 'string' as const, ...(def.options && { options: def.options }) }
      : { ...base, type: 'boolean' as const }
  })
}

// ── nodeSchemaWithVariants — the ONE schema-folding SSOT ───────────────
//
//  Folds a slice's declared variants into its authored PropSchema as
//  `variants.<name>` PropFields. EVERY registration path that feeds the
//  Constructor/wire-schema (registerSlice at runtime, the emit-schema build
//  tool, the schema fitness tests) MUST route the registered `schema` through
//  here — otherwise the variant fields appear on one face but not another
//  (the exact half-registration F3 forbids). Returns the base untouched when no
//  variants are declared (schema-less slices stay schema-less); never mutates.
//
export function nodeSchemaWithVariants(
  base:     PropField[] | undefined,
  variants: VariantSchema | undefined,
): PropField[] | undefined {
  const variantFields = variantPropSchema(variants)
  if (variantFields.length === 0) return base
  return [...(base ?? []), ...variantFields]
}
