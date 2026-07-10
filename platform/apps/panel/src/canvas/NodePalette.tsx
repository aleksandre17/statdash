// ── NodePalette — capability-aware icon-tile palette (N35 + C3 + M4 Wave 1) ────
//
//  Open-registry discovery (Builder.io / Webflow / Framer palette): the palette is
//  built from nodeRegistry.list() — every registered slice appears with zero
//  palette code change. Capability-driven grouping [N29] partitions it via
//  getByCapability(CAPS.*).
//
//  M4 Wave 1 — palette elevation (§2.3): each entry renders as an ICON TILE
//  ([icon] Name — description), grouped, uniform width — killing the ragged `•`
//  text list. Icon (registry icon token → resolvePaletteIcon), label (i18n
//  LocaleString resolved HERE by the active locale, not pre-flattened), and group
//  headings (paletteGroupHeading table) are all registry-/table-derived — no
//  hardcoded palette label or heading string (FF-PALETTE-META-DRIVEN).
//
//  C3 capability-gating + suggest-the-chart:
//    - Entries are GATED against the active dataset's cube profile
//      (gatePaletteEntries): data-bound panels the dataset cannot support are
//      hidden. The gate is OPEN when no profile is available (graceful degrade).
//    - A "Recommended" section (suggestPanels) leads the palette: panel types
//      that FIT the dataset's shape, so the author starts from a fit-for-data chart.
//
//  rootOnly filter: page-template roots are tree roots, never droppable children
//  (excluded by getPaletteEntries()).
//
//  Native HTML5 drag: onDragStart writes the type to dataTransfer('nodeType').
//
import { useMemo }                                      from 'react'
import { resolveLocaleString }                          from '@statdash/engine'
import { getPaletteEntries, getGroupedPaletteEntries }  from './paletteEntries'
import type { PaletteEntry, PaletteGroup }              from './paletteEntries'
import { paletteGroupHeading, PALETTE_LEAF_HINT }       from './paletteGroupLabels'
import { renderPaletteIcon }                            from './paletteIcons'
import { nestAccepts, isDropTarget }                    from './insertNode'
import { useActiveProfile }                             from '../discovery/useActiveProfile'
import { gatePaletteEntries }                           from '../discovery/capabilityGate'
import { suggestPanels }                                from '../discovery/suggestPanels'
import type { Locale }                                  from '../types/constructor'
import './node-palette.css'

export interface NodePaletteProps {
  /** Active UI locale — resolves each tile's i18n label/description at render. */
  locale?: Locale
  /**
   * Type of the currently-selected node (M4.1 Thread A — context-aware palette).
   *   - a CONTAINER selected → offer ONLY schema-compatible children (nestAccepts);
   *   - a LEAF selected → offer NO node tile + a guided hint to the Inspector;
   *   - null / nothing selected → the full page/frame-level set (today's behaviour).
   * The palette NARROWS, it never BLOCKS (FF-NO-WORKFLOW-GATE): a legal insert is
   * always reachable by selecting a compatible container or clearing the selection.
   */
  selectedType?: string | null
  onDragStateChange?: (dragging: boolean) => void
}

function PaletteItem({
  entry,
  locale,
  onDragStateChange,
}: {
  entry: PaletteEntry
  locale: Locale
  onDragStateChange?: (dragging: boolean) => void
}) {
  const name = resolveLocaleString(entry.label, locale, 'en') || entry.type
  const desc = entry.description ? resolveLocaleString(entry.description, locale, 'en') : ''

  return (
    <button
      type="button"
      className="node-palette__tile"
      data-node-type={entry.type}
      draggable
      aria-label={locale === 'en' ? `Add ${name}` : `დამატება: ${name}`}
      onDragStart={(e) => {
        e.dataTransfer.setData('nodeType', entry.type)
        e.dataTransfer.effectAllowed = 'copy'
        onDragStateChange?.(true)
      }}
      onDragEnd={() => onDragStateChange?.(false)}
    >
      <span className="node-palette__tile-icon" aria-hidden="true">
        {renderPaletteIcon(entry.icon, { fontSize: 'small' })}
      </span>
      <span className="node-palette__tile-text">
        <span className="node-palette__tile-name">{name}</span>
        {desc && <span className="node-palette__tile-desc">{desc}</span>}
      </span>
    </button>
  )
}

export function NodePalette({ locale = 'ka', selectedType, onDragStateChange }: NodePaletteProps) {
  const active = useActiveProfile()

  // Context-aware narrowing (M4.1 Thread A). A container selected → keep only the
  // types it can hold (nestAccepts, the SAME predicate the insert router uses, so a
  // palette-offered tile is guaranteed to nest where shown — no silent redirect).
  // Nothing selected → nestAccepts(undefined, …) is true for all (the full set).
  const leaf = selectedType != null && !isDropTarget(selectedType)
  const acceptsInSelection = useMemo(
    () => (t: string) => nestAccepts(selectedType ?? undefined, t),
    [selectedType],
  )

  // Gate the capability groups against the active profile (C3), then narrow to the
  // selection's accept-set. Empty groups drop out. Memoised on profile + selection.
  const groups = useMemo<PaletteGroup[]>(() => {
    const raw = getGroupedPaletteEntries()
    return raw
      .map((g) => ({ ...g, entries: gatePaletteEntries(g.entries, active).filter((e) => acceptsInSelection(e.type)) }))
      .filter((g) => g.entries.length > 0)
  }, [active, acceptsInSelection])

  const flat = useMemo<PaletteEntry[]>(
    () => gatePaletteEntries(getPaletteEntries(), active).filter((e) => acceptsInSelection(e.type)),
    [active, acceptsInSelection],
  )

  // Recommended section — suggestPanels(profile) intersected with the gated,
  // registered entries (only suggest a type the palette actually offers).
  const recommended = useMemo<PaletteEntry[]>(() => {
    if (active.status !== 'ready') return []
    const byType = new Map(flat.map((e) => [e.type, e]))
    const seen = new Set<string>()
    const out: PaletteEntry[] = []
    for (const s of suggestPanels(active.profile)) {
      const entry = byType.get(s.panelType)
      if (entry && !seen.has(entry.type)) { seen.add(entry.type); out.push(entry) }
    }
    return out
  }, [active, flat])

  const RecommendedSection =
    recommended.length > 0 ? (
      <section
        className="node-palette__group node-palette__group--recommended"
        aria-label={paletteGroupHeading('recommended', locale)}
      >
        <h3 className="node-palette__group-heading">{paletteGroupHeading('recommended', locale)}</h3>
        <ul className="node-palette__group-list">
          {recommended.map((entry) => (
            <li key={entry.type}>
              <PaletteItem entry={entry} locale={locale} onDragStateChange={onDragStateChange} />
            </li>
          ))}
        </ul>
      </section>
    ) : null

  // Leaf selection (M4.1 Thread A) — a block that accepts no child blocks. The
  // honest, canonical answer is NO node tile + a guided hint pivoting the author to
  // the Inspector (its own props / the filterSchema), never an invented cross-tier
  // slot. This is guidance-by-affordance, not a block: clearing the selection or
  // selecting a container restores the full/compatible palette.
  if (leaf) {
    return (
      <div
        className="node-palette__leaf-hint"
        role="note"
        data-testid="node-palette-leaf-hint"
        aria-label={PALETTE_LEAF_HINT.title[locale]}
      >
        <span className="node-palette__leaf-hint-title">{PALETTE_LEAF_HINT.title[locale]}</span>
        <span className="node-palette__leaf-hint-body">{PALETTE_LEAF_HINT.body[locale]}</span>
      </div>
    )
  }

  // Grouped render — one <section> per capability group, recommendations first.
  if (groups.length > 0) {
    return (
      <div className="node-palette" data-testid="node-palette" aria-label="Node palette">
        {RecommendedSection}
        {groups.map((group) => {
          const heading = paletteGroupHeading(group.key, locale)
          return (
            <section key={group.key} className="node-palette__group" aria-label={heading}>
              <h3 className="node-palette__group-heading">{heading}</h3>
              <ul className="node-palette__group-list">
                {group.entries.map((entry) => (
                  <li key={entry.type}>
                    <PaletteItem entry={entry} locale={locale} onDragStateChange={onDragStateChange} />
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    )
  }

  // Flat fallback — preserves the existing test expectation shape when the
  // registry is empty (no groups → no grouped render).
  return (
    <ul className="node-palette" data-testid="node-palette" aria-label="Node palette">
      {flat.map((entry) => (
        <li key={entry.type}>
          <PaletteItem entry={entry} locale={locale} onDragStateChange={onDragStateChange} />
        </li>
      ))}
    </ul>
  )
}
