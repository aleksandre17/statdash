// ── dockSection — the ONE registry the dock body composes from (SPEC §3.1) ──────
//
//  The dock body is no longer a hardcoded `Chip + Inspector + ContextEditor +
//  Divider + VisibilitySection` (element) / `PageConfig + Perspectives + Filters`
//  (page) stack in RightDock.tsx. It is a set of SECTIONS from this open registry —
//  each declared as DATA (`{ id, appliesTo, render, order }`, Law 2). RightDock
//  filters the registry by the current dock context and renders the applicable
//  sections in order, joined by one uniform divider grammar. A new section (lineage,
//  a stage bridge) = one `register()` call; RightDock never changes (OCP, Law 8).
//
//  This is the coherence fix for the owner's "scattered functionality" (§4.3): the
//  visibility section, the node-context bridges, and the page panes all compose
//  through ONE grammar instead of three heterogeneous, divider-stitched panes.
//
//  Pure registry — no React import; sections carry their own `render`. Framework-
//  free + trivially testable (list() is a pure filter+sort over declared data).
//
import type { ReactNode } from 'react'
import type { Locale } from '../../types/constructor'
import type { CanvasController } from '../../studio/useCanvasController'
import type { Role } from '../../studio/useRole'

/** The scope a dock body is composed for — mirrors the RightDock DockScope. */
export type DockSectionScope = 'element' | 'page'

/** Everything a section needs to decide applicability + render. Read-only view of
 *  the controller (sections read selection + write through its patch seams). */
export interface DockRenderCtx {
  scope:      DockSectionScope
  locale:     Locale
  controller: CanvasController
  /**
   * The active AUDIENCE lens (root Law 11 · ADR-043) — sections filter their
   * projection by it (a `plane:'steward'` facet hides from the author dock). Optional:
   * absent ⇒ the author lens (the safe default, so a test ctx that omits it sees only
   * the author plane). RightDock populates it from `useRole`.
   */
  role?:      Role
}

/** A dock body section — declared data, resolved generically by RightDock. */
export interface DockSection {
  /** Stable id (test hook + de-dup key). */
  id: string
  /** True when this section belongs in the given dock context. */
  appliesTo: (ctx: DockRenderCtx) => boolean
  /** Render the section body — or null to contribute nothing this render. */
  render: (ctx: DockRenderCtx) => ReactNode
  /** Ascending order within the body (lower renders first). */
  order: number
}

class DockSectionRegistryImpl {
  private sections = new Map<string, DockSection>()

  /** Register (or override by id) a dock section. Chainable. */
  register(section: DockSection): this {
    this.sections.set(section.id, section)
    return this
  }

  /** True if a section with this id is registered. */
  has(id: string): boolean {
    return this.sections.has(id)
  }

  /** All registered sections (unfiltered) in registration order — introspection. */
  all(): DockSection[] {
    return [...this.sections.values()]
  }

  /** The applicable sections for a context, sorted by `order` (the render list). */
  list(ctx: DockRenderCtx): DockSection[] {
    return [...this.sections.values()]
      .filter((s) => s.appliesTo(ctx))
      .sort((a, b) => a.order - b.order)
  }
}

export type DockSectionRegistry = DockSectionRegistryImpl

/** The one dock-section registry. Built-ins register in `./builtins`. */
export const dockSectionRegistry: DockSectionRegistry = new DockSectionRegistryImpl()
