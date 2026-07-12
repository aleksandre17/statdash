import type { PartAddress } from '@statdash/react/engine'
import type {
  DataSourceDef, NamedDataSpec,
  SiteDef,
  CanvasPage,
  ChromeSelection,
} from '../types/constructor'

// ── History (undo/redo) ───────────────────────────────────────────────────────
// Command-pattern: each mutating action pushes a snapshot to undoStack.
// Undo pops and restores; Redo pops from redoStack.
//
// Split out of constructor.store.ts (one concern per file): this module owns the
// session shape, the Studio-UI slice, the history slice, and the snapshot/push
// helpers. The store module owns only the action wiring.

export interface HistoryEntry {
  label:    string
  snapshot: ConstructorSession
}

export interface HistorySlice {
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  canUndo:   boolean
  canRedo:   boolean
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface ConstructorSession {
  // Layer 1
  dataSources: DataSourceDef[]
  dataSpecs:   NamedDataSpec[]
  // Layer 2
  site:        SiteDef
  // Layer 3
  pages:       CanvasPage[]
  activePageId: string | null
}

// ── Selection address — ONE completed Composite address (ADR-039 · ADR-041 Ph.3) ─
//
//  The old selection TRIPLE (`selectedNodeId` · `selectedItemPath` · `chromeSelection`)
//  collapses to this ONE address (ADR-041 ROOT-3 · Delta 1). A node/item part uses the
//  engine `PartAddress` `(nodeId, partPath?)`:
//    • whole node        → `{ nodeId }`                       (partPath undefined)
//    • value-band item   → `{ nodeId, partPath: 'items.0' }`  (positional — value)
//    • sourced item      → `{ nodeId, partPath: 'main.year' }`(stable key — sourced/Delta 1)
//  Chrome is the SITE-FRAME arm (ROM R4 — chrome regions fold into a `slot` part of a
//  `site-frame` element later; until then chrome keeps its own `{kind,slot,key}` shape,
//  discriminated by `kind:'chrome'` — a `PartAddress` never carries `kind`). The three
//  legacy fields are DERIVED reads of THIS one address (constructor.selectors), never
//  independently settable — that is what FF-ONE-SELECTION-ADDRESS locks.
export type SelectionAddress = PartAddress | ChromeSelection

// ── Studio UI ───────────────────────────────────────────────────────────────

export interface StudioUiSlice {
  // The Studio activity-rail surface is NO LONGER store state — it is URL state
  // (`/studio/:surface`, the single source of truth; see studio/useStudioRoute.ts).
  // This slice now carries only the EPHEMERAL selection address (node/item/chrome),
  // collapsed to ONE `SelectionAddress` (the selection triple is derived from it).
  selection: SelectionAddress | null
}

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_SITE: SiteDef = {
  name:               '',
  defaultLocale:      'ka',
  // Empty until the site read projects config.locale — useActiveLocales falls
  // back to [defaultLocale]/['ka','en'] so LocaleField never authors empty.
  activeLocales:      [],
  nav:                [],
  themeOverrides:     {},
  dataSourceBindings: {},
  chrome:             {},
}

export const INITIAL_SESSION: ConstructorSession = {
  dataSources:  [],
  dataSpecs:    [],
  site:         INITIAL_SITE,
  pages:        [],
  activePageId: null,
}

// ── Snapshot helpers ──────────────────────────────────────────────────────────

export function snapshot(state: ConstructorSession): ConstructorSession {
  return {
    dataSources:  state.dataSources,
    dataSpecs:    state.dataSpecs,
    site:         state.site,
    pages:        state.pages,
    activePageId: state.activePageId,
  }
}

export function pushHistory(
  state: ConstructorSession & HistorySlice,
  label: string,
): Pick<HistorySlice, 'undoStack' | 'redoStack' | 'canUndo' | 'canRedo'> {
  const entry: HistoryEntry = { label, snapshot: snapshot(state) }
  const undoStack = [...state.undoStack.slice(-49), entry]   // cap at 50
  return { undoStack, redoStack: [], canUndo: true, canRedo: false }
}
