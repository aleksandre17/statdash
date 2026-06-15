// ── NodeRegistry — type+variant → renderer dispatch ────────────────────
//
//  Builder.io component registry + Grafana panel plugin pattern:
//    register(type, variant, renderer, opts?)  — register at startup
//    get(type, variant?)                        — dispatch by type+variant
//
//  Variant system (Grafana panel variant pattern):
//    'section' + 'default' → SectionShell
//    'section' + 'compact' → CompactSectionShell
//    get(type, variant) falls back to 'default' if variant not registered.
//
//  Extended descriptor storage (Retool/Appsmith property-panel pattern):
//    defaults     — initial values for Constructor "new node" creation
//    slots        — typed children contracts for Constructor insertion
//    validate     — runtime validation on config load (fail-fast)
//    migrate      — forward migration when version mismatch
//    errorFallback — per-node crash UI (ISP: shell owns its error state)
//

import type { ReactNode }                               from 'react'
import type {
  NodeRenderer,
  NodeDef,
  NodeBase,
  NodeTypeMap,
  RenderContext,
  SlotDef,
  ValidationError,
  ChildrenArg,
  PropSchema,
}                                                        from './types'

type AnyRenderer      = (def: NodeBase, ctx: RenderContext, children: ChildrenArg) => ReactNode
type ValidateFn       = (def: NodeDef) => ValidationError[] | null
type MigrateFn        = (old: Record<string, unknown>, from: number) => NodeBase
type ErrorFallbackFn  = (props: { node: NodeBase; error: Error }) => ReactNode

interface StoredMeta extends Record<string, unknown> {
  label?:           unknown
  icon?:            string
  category?:        string
  schema?:          PropSchema
  preview?:         string
  transparent?:     boolean
  canHaveChildren?: boolean
  singleton?:       boolean
  rootOnly?:        boolean
  version?:         number
  defaults?:        Record<string, unknown>
  slots?:           Record<string, SlotDef>
  groups?:          unknown[]
}

export class NodeRegistry {
  private renderers     = new Map<string, AnyRenderer>()
  private metas         = new Map<string, StoredMeta>()
  private validators    = new Map<string, ValidateFn>()
  private migrators     = new Map<string, MigrateFn>()
  private errorFallbacks = new Map<string, ErrorFallbackFn>()

  register<T extends { type: string }>(
    type:     string,
    variant:  string,
    renderer: (def: T, ctx: RenderContext, children: ChildrenArg) => ReactNode,
    opts?: {
      label?:           unknown
      icon?:            string
      category?:        string
      schema?:          PropSchema
      preview?:         string
      transparent?:     boolean
      canHaveChildren?: boolean
      singleton?:       boolean
      rootOnly?:        boolean
      version?:         number
      defaults?:        Record<string, unknown>
      slots?:           Record<string, SlotDef>
      groups?:          unknown[]
      validate?:        ValidateFn
      migrate?:         MigrateFn
      errorFallback?:   ErrorFallbackFn
    },
  ): this {
    const key = `${type}::${variant}`
    this.renderers.set(key, renderer as AnyRenderer)
    if (opts) {
      const { validate, migrate, errorFallback, ...meta } = opts
      this.metas.set(key, meta)
      if (validate)      this.validators.set(key, validate)
      if (migrate)       this.migrators.set(key, migrate)
      if (errorFallback) this.errorFallbacks.set(key, errorFallback)
    }
    return this
  }

  // ── Typed get overload — returns typed renderer when K ∈ NodeTypeMap ──

  get<K extends keyof NodeTypeMap>(type: K, variant?: string): NodeRenderer<NodeTypeMap[K]> | undefined
  get(type: string, variant?: string): NodeRenderer | undefined
  get(type: string, variant = 'default'): NodeRenderer | undefined {
    return (
      this.renderers.get(`${type}::${variant}`) ??
      this.renderers.get(`${type}::default`)
    ) as NodeRenderer | undefined
  }

  has(type: string, variant = 'default'): boolean {
    return (
      this.renderers.has(`${type}::${variant}`) ||
      this.renderers.has(`${type}::default`)
    )
  }

  // ── Meta accessors ────────────────────────────────────────────────────

  getMeta(type: string, variant = 'default'): StoredMeta | undefined {
    return (
      this.metas.get(`${type}::${variant}`) ??
      this.metas.get(`${type}::default`)
    )
  }

  isTransparent(type: string, variant = 'default'): boolean {
    return !!(this.getMeta(type, variant)?.transparent)
  }

  getDefaults(type: string, variant = 'default'): Record<string, unknown> | undefined {
    return (
      this.metas.get(`${type}::${variant}`)?.defaults ??
      this.metas.get(`${type}::default`)?.defaults
    )
  }

  getSlots(type: string, variant = 'default'): Record<string, SlotDef> | undefined {
    return (
      this.metas.get(`${type}::${variant}`)?.slots ??
      this.metas.get(`${type}::default`)?.slots
    )
  }

  getValidate(type: string, variant = 'default'): ValidateFn | undefined {
    return (
      this.validators.get(`${type}::${variant}`) ??
      this.validators.get(`${type}::default`)
    )
  }

  getMigrate(type: string, variant = 'default'): MigrateFn | undefined {
    return (
      this.migrators.get(`${type}::${variant}`) ??
      this.migrators.get(`${type}::default`)
    )
  }

  getErrorFallback(type: string, variant = 'default'): ErrorFallbackFn | undefined {
    return (
      this.errorFallbacks.get(`${type}::${variant}`) ??
      this.errorFallbacks.get(`${type}::default`)
    )
  }

  // ── Introspection ─────────────────────────────────────────────────────

  types(): string[] {
    return [...new Set([...this.renderers.keys()].map(k => k.split('::')[0]))]
  }

  /**
   * Constructor type-picker source — every registered type+variant with its META.
   * Open-registry discovery: a newly registered slice appears here with zero
   * Constructor code change (15-constructor.md §1).  Renderer fn is intentionally
   * omitted — META is JSON-serializable, the renderer is not.
   */
  list(): Array<{ type: string; variant: string } & StoredMeta> {
    return [...this.metas.entries()].map(([key, meta]) => {
      const [type, variant] = key.split('::')
      return { type, variant, ...meta }
    })
  }

  /**
   * JSON Schema for a type's config form (null → Constructor uses raw JSON editor).
   * Progressive enhancement per 15-constructor.md §3.
   */
  getSchema(type: string, variant = 'default'): PropSchema | null {
    return this.getMeta(type, variant)?.schema ?? null
  }

  // ── Registry manifest — Constructor build-time discovery ──────────

  /**
   * Emits the full builder manifest as JSON-serializable data.
   * Constructor reads this to build the palette + property panel system.
   * Called after setupRegistrations() so all slices are registered.
   *
   * Reference: roadmap Layer 9.1 [N10, N11], 15-constructor.md §3.
   */
  describeRegistry(): RegistryManifest {
    const entries = this.list()
    return {
      palette: entries.map(({ type, variant, label, icon, category }) =>
        ({ type, variant, label, icon, category }),
      ),
      propertySchemas: Object.fromEntries(
        entries
          .filter(e => e.schema != null)
          .map(e => [`${e.type}:${e.variant}`, e.schema as PropSchema]),
      ),
    }
  }
}

/** JSON-serializable manifest emitted by `nodeRegistry.describeRegistry()`. */
export interface RegistryManifest {
  /** All registered node/panel/page entries with display metadata. */
  palette: Array<{
    type:      string
    variant:   string
    label?:    unknown
    icon?:     string
    category?: string
  }>
  /** Typed property schemas keyed by `${type}:${variant}`. */
  propertySchemas: Record<string, PropSchema>
}