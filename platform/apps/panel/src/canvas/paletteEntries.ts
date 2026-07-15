// ── paletteEntries — derive the draggable node palette from the registry ───
//
//  Open-registry discovery (Builder.io / Grafana palette): the palette is built
//  entirely from nodeRegistry.list(). A newly registered node type appears with
//  zero palette code change. rootOnly page templates are excluded — they are
//  tree roots, never droppable children. Pure → shared by the component + tests.
//
//  SEMANTIC category grouping (FF-PALETTE-CATEGORY-DRIVEN): getGroupedPaletteEntries()
//  partitions the palette by each slice's DECLARED `meta.category` (layout | data |
//  content) — the taxonomy the slice author owns, not a capability-derived guess.
//  This replaced the old capability partition (COLLAPSIBLE⇒layout / FILTERABLE⇒data),
//  which mis-grouped real layout primitives (grid/columns/divider/spacer declare no
//  such caps) under "content". A new slice lands in its group by declaring ONE field.
//
import { nodeRegistry } from '@statdash/react/engine'
import type { LocaleString, NodeCap, CapabilityRequirement } from '@statdash/react/engine'
import { PALETTE_GROUP_LABELS } from './paletteGroupLabels'

export interface PaletteEntry {
  type:      string
  variant:   string
  /**
   * i18n label — the RAW registry LocaleString, resolved at the render seam by the
   * active locale (NOT pre-flattened to en/ka here, which baked English labels into
   * a KA UI — audit finding #7). Consumers without a locale (⌘K) resolve bilingually.
   */
  label:     LocaleString
  /** Registry icon TOKEN (NodeSliceMeta.icon) → glyph via resolvePaletteIcon. */
  icon?:     string
  /**
   * i18n tile description (NodeSliceMeta — when declared). Optional + registry-
   * derived: absent today because no slice meta carries a `description` field yet
   * (adding it is a coordinated packages change, flagged — like §2.10/D7). The seam
   * is ready so a tile gains its description with zero palette code (OCP).
   */
  description?: LocaleString
  category?: string
  /** Capability tokens declared by this slice (defensive copy from registry). */
  caps:      NodeCap[]
  /**
   * DECLARED data-capability requirement (Law 1) — the prerequisite the capability
   * gate reads (e.g. `{ conceptRole: 'geo' }` for a map). Absent ⇒ no requirement
   * beyond the baseline. Read generically by `capabilityGate`; NEVER a node-type sniff.
   */
  requires?: CapabilityRequirement
}

/** Ordered palette group — rendered as a labelled section in the palette. */
export interface PaletteGroup {
  /** Machine key, e.g. "data", "layout", "content" — the localization key. */
  key:     string
  /** English default heading; NodePalette re-localizes it via paletteGroupHeading(key). */
  heading: string
  entries: PaletteEntry[]
}

/** The raw registry LocaleString label, or the type as a last-resort fallback. */
function rawLabel(label: unknown, fallback: string): LocaleString {
  if (typeof label === 'string') return label
  if (label && typeof label === 'object') return label as Record<string, string>
  return fallback
}

/**
 * Every draggable (non-root) registered type, deduped by type.
 * Entries carry the RAW registry metadata (i18n label, icon token, description) +
 * the `caps` array — a pure projection of NodeSliceMeta, resolved at the render
 * seam (FF-PALETTE-META-DRIVEN). Existing callers (NodePalette tests) depend on
 * the type/caps shape; label is now a LocaleString (resolve before display).
 */
export function getPaletteEntries(): PaletteEntry[] {
  const seen = new Set<string>()
  const out: PaletteEntry[] = []
  for (const entry of nodeRegistry.list()) {
    if (entry.rootOnly) continue           // page roots are not droppable
    if (seen.has(entry.type)) continue     // one palette row per type
    seen.add(entry.type)
    const description = (entry as { description?: LocaleString }).description
    const requires = (entry as { requires?: CapabilityRequirement }).requires
    out.push({
      type:        entry.type,
      variant:     entry.variant,
      label:       rawLabel(entry.label, entry.type),
      icon:        entry.icon,
      ...(description !== undefined ? { description } : {}),
      category:    entry.category as string | undefined,
      caps:        nodeRegistry.getCaps(entry.type, entry.variant),
      ...(requires !== undefined ? { requires } : {}),
    })
  }
  return out
}

/**
 * Authoring-canonical order for the semantic category groups: data panels (the
 * primary value) → layout primitives → static content. A category present in the
 * registry but not listed here still surfaces (appended in first-seen order) — a
 * new taxonomy category shows with zero grouping code, needing only its localized
 * heading row (FF-PALETTE-META-DRIVEN).
 */
const PALETTE_CATEGORY_ORDER = ['data', 'layout', 'content'] as const

/**
 * Palette group key for a placeable's declared `meta.category`. `page` slices are
 * rootOnly (already excluded upstream) and `filter` controls are not node-registry
 * entries, so neither reaches here; an absent/unknown category degrades gracefully
 * into `content` so the palette never silently drops a registered tile.
 */
function paletteCategoryKey(category: string | undefined): string {
  return category ?? 'content'
}

/**
 * Semantic category-driven grouped palette (FF-PALETTE-CATEGORY-DRIVEN).
 *
 * Every tile's group is a pure projection of its slice's DECLARED `meta.category`
 * — the semantic taxonomy the slice author owns (layout | data | content), NOT a
 * capability-derived partition. This is the fix for the taxonomy defect where the
 * "Layout" group held only `section` (the sole COLLAPSIBLE type) while the real
 * layout primitives (grid, columns, divider, spacer, stack, wrap, card) fell into
 * "Content" because they declare no capability. Now a slice lands in its group by
 * declaring one field; the palette needs zero code to re-classify it (OCP).
 *
 * Heading = the group-labels table's English default (locale-free derivation);
 * NodePalette re-resolves it to the active locale at render (paletteGroupHeading).
 * rootOnly entries are excluded upstream (getPaletteEntries).
 */
export function getGroupedPaletteEntries(): PaletteGroup[] {
  const allEntries = getPaletteEntries()    // already deduped + rootOnly-filtered

  // Partition by declared semantic category (first-seen order preserved per group).
  const byCategory = new Map<string, PaletteEntry[]>()
  for (const entry of allEntries) {
    const key = paletteCategoryKey(entry.category)
    const bucket = byCategory.get(key)
    if (bucket) bucket.push(entry)
    else byCategory.set(key, [entry])
  }

  // Known categories in authoring-canonical order, then any novel category in
  // first-seen order (OCP — a new category needs no edit here, only a heading row).
  const known: readonly string[] = PALETTE_CATEGORY_ORDER
  const orderedKeys = [
    ...PALETTE_CATEGORY_ORDER.filter((k) => byCategory.has(k)),
    ...[...byCategory.keys()].filter((k) => !known.includes(k)),
  ]

  return orderedKeys.map((key) => ({
    key,
    heading: PALETTE_GROUP_LABELS[key]?.en ?? key,
    entries: byCategory.get(key)!,
  }))
}
