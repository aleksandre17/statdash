// ── OutlineItem — one sortable treeitem in the Outline (V6) ───────────────────
//
//  A single row of the Webflow-Navigator tree. Sortable via dnd-kit (pointer +
//  keyboard sensors → WCAG-accessible drag); selectable via click/Enter/Space
//  (bidirectional with the canvas); collapsible; deletable. Pure presentation
//  over an OutlineRow — all mutation flows up to OutlineTree → the store.
//
//  The whole row is the drag handle (listeners on the row) so a keyboard user
//  can Space-to-lift then arrow-to-move (dnd-kit keyboard sensor). Selection is
//  a nested click that stops propagation from the drag listeners' activation.
//
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { OutlineRow } from './outlineModel'

export interface OutlineItemProps {
  row:       OutlineRow
  selected:  boolean
  collapsed: boolean
  dragging:  boolean
  onSelect:  (id: string) => void
  onToggle:  (id: string) => void
  onDelete:  (id: string) => void
  onKeyNav:  (e: React.KeyboardEvent, row: OutlineRow) => void
}

export function OutlineItem({
  row, selected, collapsed, dragging, onSelect, onToggle, onDelete, onKeyNav,
}: OutlineItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingInlineStart: `${(row.depth - 1) * 14 + 8}px`,
    opacity: isDragging || dragging ? 0.5 : 1,
  }

  const cls =
    'outline__item' +
    (selected ? ' outline__item--selected' : '') +
    (isDragging ? ' outline__item--dragging' : '')

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cls}
      // dnd-kit's `attributes` carry a generic role/tabIndex/aria-roledescription
      // for a sortable button. Spread them FIRST, then override with the tree-view
      // semantics (role=treeitem + aria-level/posinset/setsize) so the WAI-ARIA
      // Tree pattern wins — the keyboard drag still works (listeners drive it).
      {...attributes}
      {...listeners}
      role="treeitem"
      aria-level={row.depth}
      aria-posinset={row.posInSet}
      aria-setsize={row.setSize}
      aria-selected={selected}
      {...(row.hasChildren ? { 'aria-expanded': !collapsed } : {})}
      data-outline-id={row.id}
      tabIndex={selected ? 0 : -1}
      onClick={(e) => { e.stopPropagation(); onSelect(row.id) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(row.id) }
        else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onDelete(row.id) }
        else onKeyNav(e, row)
      }}
    >
      {row.hasChildren ? (
        <button
          type="button"
          className="outline__toggle"
          aria-label={collapsed ? `Expand ${row.label}` : `Collapse ${row.label}`}
          // Stop the toggle click from bubbling to the row's select handler.
          onClick={(e) => { e.stopPropagation(); onToggle(row.id) }}
          // Don't let dnd-kit's pointer listeners arm a drag on the toggle.
          onPointerDown={(e) => e.stopPropagation()}
        >
          {collapsed ? '▶' : '▼'}
        </button>
      ) : (
        <span className="outline__toggle outline__toggle--leaf" aria-hidden="true" />
      )}

      {/* Label + a disambiguating subtitle in a min-width:0 text column, so a long
          label ellipsizes (recoverable via the native tooltip) and structurally
          identical siblings (two Tables) are told apart by what each one binds. */}
      <span className="outline__text">
        <span className="outline__label" title={row.label}>{row.label}</span>
        {row.subtitle && (
          <span className="outline__subtitle" title={row.subtitle}>{row.subtitle}</span>
        )}
      </span>
      {/* The type chip is informative only when the label differs from it
          (a titled node) — otherwise it would just echo the label. */}
      {row.label !== row.type && <span className="outline__type">{row.type}</span>}

      <button
        type="button"
        className="outline__delete"
        aria-label={`Delete ${row.label}`}
        onClick={(e) => { e.stopPropagation(); onDelete(row.id) }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        ✕
      </button>
    </li>
  )
}
