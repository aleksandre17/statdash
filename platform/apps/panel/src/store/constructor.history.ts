import type {
  DataSourceDef, NamedDataSpec,
  SiteDef,
  CanvasPage,
  WizardStep,
} from '../types/constructor'

// ── History (undo/redo) ───────────────────────────────────────────────────────
// Command-pattern: each mutating action pushes a snapshot to undoStack.
// Undo pops and restores; Redo pops from redoStack.
//
// Split out of constructor.store.ts (one concern per file): this module owns the
// session shape, the wizard-UI slice, the history slice, and the snapshot/push
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

// ── Wizard UI ─────────────────────────────────────────────────────────────────

export interface WizardSlice {
  activeStep:     WizardStep
  completedSteps: Set<WizardStep>
  selectedNodeId: string | null
}

// ── Initial state ─────────────────────────────────────────────────────────────

const INITIAL_SITE: SiteDef = {
  name:               '',
  defaultLocale:      'ka',
  nav:                [],
  themeOverrides:     {},
  dataSourceBindings: {},
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
