// ── resolveVariants ───────────────────────────────────────────────────
//
//  Translates a slice's DECLARED variants + the node's AUTHORED values into a
//  bag of `data-*` attributes the shell spreads — zero class coupling, exactly
//  like resolveViewState turns a boolean into `data-view`. CSS reads the
//  attribute (`.section[data-emphasis="hero"]`), never a `--modifier` class.
//
//  A 'flag' variant projects its attr as a PRESENCE flag (empty string) when the
//  authored value is truthy; an 'enum' variant projects its attr VALUE (the
//  chosen option). Falsy / absent / empty → the attr is omitted entirely.
//
//  Pure, typed, zero-runtime. Sits BESIDE resolveViewState (same idiom: a
//  declarative input in, `data-*` attrs out). The schema TYPE is owned by the
//  engine (NodeSliceMeta.variants); this resolver takes the structural shape it
//  needs (attr + kind + default) so @statdash/styles stays arrow-clean — it
//  imports nothing from react/engine. The engine's VariantSchema satisfies it.
//

/** Structural shape of one declared variant this resolver consumes.
 *  The engine's VariantDef is a superset — it satisfies this by structure. */
export interface VariantDefShape {
  /** data-attribute key emitted on the node element, e.g. 'data-emphasis'. */
  attr:     string
  /** 'flag' → attr present|absent; 'enum' → attr value is the authored value. */
  kind:     'flag' | 'enum'
  /** Default authored value when the node omits this variant. */
  default?: string | boolean
}

/** A slice's declared variants, keyed by variant name. */
export type VariantSchemaShape = Record<string, VariantDefShape>

/** Authored variant values off the node, keyed by variant name. */
export type AuthoredVariants = Record<string, string | boolean | undefined>

/**
 * Resolve declared variants + authored values → `data-*` attribute bag.
 *
 * @param schema   the slice's declared VariantSchema (NodeSliceMeta.variants).
 * @param authored the node's authored `variants` bag (NodeBase.variants).
 * @returns a `Record<dataAttr, value>` to spread onto the variant-carrying element.
 */
export function resolveVariants(
  schema:   VariantSchemaShape | undefined,
  authored: AuthoredVariants | undefined,
): Record<string, string> {
  if (!schema) return {}
  const out: Record<string, string> = {}
  for (const [name, def] of Object.entries(schema)) {
    const v = authored?.[name] ?? def.default
    if (v === undefined || v === false || v === '') continue
    out[def.attr] = def.kind === 'flag' ? '' : String(v)
  }
  return out
}
