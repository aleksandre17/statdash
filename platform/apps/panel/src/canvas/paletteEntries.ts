// ── paletteEntries — derive the draggable node palette from the registry ───
//
//  Open-registry discovery (Builder.io / Grafana palette): the palette is built
//  entirely from nodeRegistry.list(). A newly registered node type appears with
//  zero palette code change. rootOnly page templates are excluded — they are
//  tree roots, never droppable children. Pure → shared by the component + tests.
//
//  Capability-driven grouping [N29]: getGroupedPaletteEntries() uses
//  nodeRegistry.getByCapability(CAPS.*) to partition the palette into named
//  groups — the real consumer that eliminates the CAPS/getByCapability dead-seam.
//  Adding a new cap to a meta.ts is all that's needed to re-classify a type.
//
import { nodeRegistry, CAPS } from '@statdash/react/engine'
import type { LocaleString, NodeCap } from '@statdash/react/engine'
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
    out.push({
      type:        entry.type,
      variant:     entry.variant,
      label:       rawLabel(entry.label, entry.type),
      icon:        entry.icon,
      ...(description !== undefined ? { description } : {}),
      category:    entry.category as string | undefined,
      caps:        nodeRegistry.getCaps(entry.type, entry.variant),
    })
  }
  return out
}

/**
 * Capability-driven grouped palette [N29] — the real consumer of CAPS +
 * getByCapability.
 *
 * Groups are derived from the registry via capability queries:
 *   "Data panels"    — types declaring CAPS.FILTERABLE (respond to filter ctx)
 *   "Layout"         — types declaring CAPS.COLLAPSIBLE but not FILTERABLE
 *                      (sections, structural containers with UI behaviour)
 *   "Content"        — remaining non-root types (static content: hero, links…)
 *
 * The grouping is additive: adding a new cap to a meta.ts re-classifies that
 * type with zero palette code change. New caps = new groups added here only.
 *
 * Each group is de-duped by type and ordered: FILTERABLE types first, then
 * collapsible-only, then content. rootOnly entries are excluded everywhere.
 */
export function getGroupedPaletteEntries(): PaletteGroup[] {
  // ── Capability sets (type-level, first variant wins) ──────────────────
  const filterableTypes = new Set(
    nodeRegistry.getByCapability(CAPS.FILTERABLE)
      .filter((e) => !e.rootOnly)
      .map((e) => e.type),
  )

  const collapsibleTypes = new Set(
    nodeRegistry.getByCapability(CAPS.COLLAPSIBLE)
      .filter((e) => !e.rootOnly)
      .map((e) => e.type),
  )

  // ── Full non-root entry map — one entry per type ───────────────────────
  const allEntries = getPaletteEntries()    // already deduped + rootOnly-filtered
  const byType = new Map(allEntries.map((e) => [e.type, e]))

  // ── Partition into groups (types can appear in at most one group) ──────
  const dataEntries:    PaletteEntry[] = []
  const layoutEntries:  PaletteEntry[] = []
  const contentEntries: PaletteEntry[] = []

  for (const entry of allEntries) {
    if (filterableTypes.has(entry.type)) {
      dataEntries.push(entry)
    } else if (collapsibleTypes.has(entry.type)) {
      layoutEntries.push(entry)
    } else {
      contentEntries.push(byType.get(entry.type)!)
    }
  }

  // Heading = the group-labels table's English default (locale-free derivation);
  // NodePalette re-resolves it to the active locale at render (paletteGroupHeading).
  const groups: PaletteGroup[] = []
  if (dataEntries.length)    groups.push({ key: 'data',    heading: PALETTE_GROUP_LABELS.data.en,    entries: dataEntries })
  if (layoutEntries.length)  groups.push({ key: 'layout',  heading: PALETTE_GROUP_LABELS.layout.en,  entries: layoutEntries })
  if (contentEntries.length) groups.push({ key: 'content', heading: PALETTE_GROUP_LABELS.content.en, entries: contentEntries })

  return groups
}
