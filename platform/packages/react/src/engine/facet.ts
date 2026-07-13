// ── facet — the FACET axis: universal capabilities as projectable contracts ─────
//
//  ADR-041 gave the CONSTITUENT axis (Parts — "what does an element CONTAIN?") a
//  generic port: `enumerateParts`/`writePart`, projected into the dock by
//  `element.schema`. This file is its ORTHOGONAL SIBLING — the FACET axis: "what
//  universal CAPABILITIES does an element EXPOSE?" (STYLE · DATA · EVENTS ·
//  VISIBILITY · CHROME-composition). Those capabilities live on the runtime config
//  as TypeScript structure (`view.styles: NodeStyles`, `data: DataSpec`, `on: […]`)
//  but — until now — had NO projectable AUTHORING contract. The dock could recurse
//  over `meta.schema` for per-type props, yet had nothing to recurse over for the
//  facets, so they fell out of the inspector.
//
//  A `FacetDescriptor` elevates ROOT-4 (Facet) from a render-side opt-in to a
//  DECLARED authoring contract:  inspect(element) = projectParts(element)  (ADR-041)
//                                               ⊕ projectFacets(element)   (this file)
//
//  The genericity is TOTAL and OCP-clean, exactly like the Part port:
//    • `appliesWhen(meta)` reads a declared CAP or FIELD — NEVER a concrete type
//      literal (Law 1 · FF-NO-EXTERNAL-SPECIAL-CASE stays green).
//    • `contract(meta)` yields a `PropSchema` fragment; the dock projects it through
//      the SAME generic Inspector + `FieldControlRegistry` the part axis uses — a
//      RICH facet (STYLE → `type:'style'` → StyleField; later DATA → a query editor)
//      dispatches to a rich control. Genericity is in the DISPATCH, not in pretending
//      a pipeline builder writes itself (Strategy — the reference-platform pattern:
//      Webflow/Framer/Builder.io each project a FIXED set of facets, each opted into
//      by declaration, never a per-type inspector).
//    • A NEW facet = ONE `register()` call; the dock mechanism is unchanged (Law 8).
//
//  THIN-BASE discipline (feedback: strict-SOLID-per-element): the facet CONTRACT is
//  declared ONCE, at the platform. An element does NOT carry each facet's authoring
//  form on its schema — it merely declares an opt-in SIGNAL (a `cap`, or the presence
//  of a declared field). No `NodeBase` bloat; no per-element facet form.
//
//  Pure declarative registry — no React, no strings (packages/react is
//  locale-agnostic, Law 4). The app (apps/panel) registers the concrete built-in
//  facets WITH their localized labels and derives one dock section per facet from
//  `facetRegistry.list()`, mounting each `contract` through the generic Inspector.
//
import type { LocaleString, PropSchema } from '@statdash/engine'
import type { ObjectMeta } from './slice-meta'

/**
 * A DECLARED, authorable universal facet — the sibling of the Part port. Data only:
 * an id, an opt-in predicate over the DECLARATION, the authorable contract to
 * project, and where the facet lives on the config (for reads/writes).
 */
export interface FacetDescriptor {
  /** Stable id — the dock section derives its id from this (`element.facet.<id>`). */
  id:          string
  /**
   * TRUE when this facet belongs on the given element — read a declared CAP or FIELD,
   * NEVER a concrete `meta.type` literal (Law 1). E.g. UNIVERSAL facets (STYLE,
   * VISIBILITY) ⇐ the `slot`-discriminant (any non-chrome node); DATA ⇐ `caps:['data-
   * bindable']`; EVENTS ⇐ `caps:['interactive']`; CHROME ⇐ the declared `slot` field.
   */
  appliesWhen: (meta: ObjectMeta) => boolean
  /**
   * The authorable shape to project as a dock section — a `PropSchema` fragment the
   * generic Inspector renders (each field dispatched through `FieldControlRegistry`,
   * so a rich facet resolves to a rich control). `meta` is passed so a facet MAY tailor
   * its contract to the element (e.g. a per-element style-property subset) — the MVP
   * STYLE facet returns a whole-element `view.styles` field, ignoring `meta`.
   */
  contract:    (meta: ObjectMeta) => PropSchema
  /** Where the facet lives on the config (`'view.styles'`, `'data'`, `'on'`). The
   *  contract's field path(s) descend from here; also the read anchor for summaries. */
  readPath:    string
  /** Section heading + accessible name for the projected dock section (app-supplied,
   *  so localized strings stay OUT of locale-agnostic packages/react). */
  label:       LocaleString
  /** Ascending order among facet sections in the dock (lower renders first). */
  order:       number
}

class FacetRegistryImpl {
  private facets = new Map<string, FacetDescriptor>()

  /** Register (or override by id) a facet. Chainable. */
  register(facet: FacetDescriptor): this {
    this.facets.set(facet.id, facet)
    return this
  }

  /** True if a facet with this id is registered. */
  has(id: string): boolean {
    return this.facets.has(id)
  }

  /** All registered facets, sorted by `order` — the dock derives one section each. */
  list(): FacetDescriptor[] {
    return [...this.facets.values()].sort((a, b) => a.order - b.order)
  }

  /** The facets applicable to a given element declaration, in order. */
  applicable(meta: ObjectMeta): FacetDescriptor[] {
    return this.list().filter((f) => f.appliesWhen(meta))
  }
}

export type FacetRegistry = FacetRegistryImpl

/** The one facet registry. The app registers the built-in facets (STYLE, …). */
export const facetRegistry: FacetRegistry = new FacetRegistryImpl()
