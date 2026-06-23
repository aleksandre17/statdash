// ── NodePalette — capability-aware draggable source list (N35 + C3) ──────────
//
//  Open-registry discovery (Builder.io / Grafana panel palette): the palette is
//  built from nodeRegistry.list() — every registered slice appears with zero
//  palette code change. Capability-driven grouping [N29] partitions it via
//  getByCapability(CAPS.*).
//
//  C3 capability-gating + suggest-the-chart:
//    - Entries are GATED against the active dataset's cube profile
//      (gatePaletteEntries): data-bound panels the dataset cannot support are
//      hidden (no chart on a measure-less dataset). The gate is OPEN when no
//      profile is available — gating never empties the palette (graceful
//      degradation).
//    - A "Recommended" section (suggestPanels) leads the palette: panel types
//      that FIT the dataset's shape (time→timeseries, geo→map…), so the author
//      starts from a fit-for-data chart, not a blank palette.
//
//  rootOnly filter: page-template roots are tree roots, never droppable children
//  (excluded by getPaletteEntries()).
//
//  Native HTML5 drag: onDragStart writes the type to dataTransfer('nodeType').
//
import { useMemo }                                      from 'react'
import { getPaletteEntries, getGroupedPaletteEntries }  from './paletteEntries'
import type { PaletteEntry, PaletteGroup }              from './paletteEntries'
import { useActiveProfile }                             from '../discovery/useActiveProfile'
import { gatePaletteEntries }                           from '../discovery/capabilityGate'
import { suggestPanels }                                from '../discovery/suggestPanels'

export interface NodePaletteProps {
  onDragStateChange?: (dragging: boolean) => void
}

function PaletteItem({
  entry,
  onDragStateChange,
}: {
  entry: PaletteEntry
  onDragStateChange?: (dragging: boolean) => void
}) {
  return (
    <button
      type="button"
      className="node-palette__item"
      data-node-type={entry.type}
      draggable
      aria-label={`Add ${entry.label}`}
      onDragStart={(e) => {
        e.dataTransfer.setData('nodeType', entry.type)
        e.dataTransfer.effectAllowed = 'copy'
        onDragStateChange?.(true)
      }}
      onDragEnd={() => onDragStateChange?.(false)}
    >
      {entry.label}
    </button>
  )
}

export function NodePalette({ onDragStateChange }: NodePaletteProps) {
  const active = useActiveProfile()

  // Gate the capability groups against the active profile (C3). Each group's
  // entries are filtered; empty groups drop out. Memoised on the profile status.
  const groups = useMemo<PaletteGroup[]>(() => {
    const raw = getGroupedPaletteEntries()
    return raw
      .map((g) => ({ ...g, entries: gatePaletteEntries(g.entries, active) }))
      .filter((g) => g.entries.length > 0)
  }, [active])

  const flat = useMemo<PaletteEntry[]>(
    () => gatePaletteEntries(getPaletteEntries(), active),
    [active],
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
      <section className="node-palette__group node-palette__group--recommended" aria-label="Recommended panels">
        <h3 className="node-palette__group-heading">Recommended</h3>
        <ul className="node-palette__group-list">
          {recommended.map((entry) => (
            <li key={entry.type}>
              <PaletteItem entry={entry} onDragStateChange={onDragStateChange} />
            </li>
          ))}
        </ul>
      </section>
    ) : null

  // Grouped render — one <section> per capability group, recommendations first.
  if (groups.length > 0) {
    return (
      <div className="node-palette" data-testid="node-palette" aria-label="Node palette">
        {RecommendedSection}
        {groups.map((group) => (
          <section key={group.key} className="node-palette__group" aria-label={group.heading}>
            <h3 className="node-palette__group-heading">{group.heading}</h3>
            <ul className="node-palette__group-list">
              {group.entries.map((entry) => (
                <li key={entry.type}>
                  <PaletteItem entry={entry} onDragStateChange={onDragStateChange} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    )
  }

  // Flat fallback — preserves the existing test expectation shape when the
  // registry is empty (no groups → no grouped render).
  return (
    <ul className="node-palette" data-testid="node-palette" aria-label="Node palette">
      {flat.map((entry) => (
        <li key={entry.type}>
          <PaletteItem entry={entry} onDragStateChange={onDragStateChange} />
        </li>
      ))}
    </ul>
  )
}
