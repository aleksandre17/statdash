// ── commandModel — the Cmd-K / slash command list, derived from the registry ──
//
//  Notion/Gutenberg + cmdk: the command palette is NOT a hardcoded menu. Its
//  INSERT commands are derived from the open node registry (getPaletteEntries —
//  the SAME source the drag palette uses), so a newly-registered node type is
//  insertable from Cmd-K and slash with zero palette-code change (OCP). Around
//  the insert commands sit a small fixed set of structural commands (navigate to
//  a node, delete, duplicate) that operate on the current selection.
//
//  Pure data only — building the list here (not in the component) keeps it
//  unit-testable and lets the byte-identical-insert fitness test enumerate the
//  exact insert commands Cmd-K offers without rendering React.
//
import { getPaletteEntries } from '../canvas/paletteEntries'
import type { LocaleString } from '@statdash/react/engine'
import type { CanvasPage } from '../types/constructor'

/**
 * Resolve a palette entry's i18n label to a bilingual command label ("ka · en"),
 * matching the ⌘K convention (workspaceCommands). The palette is now the SSOT of
 * the raw LocaleString; ⌘K has no active-locale here, so it shows both — a
 * non-programmer finds the command in either language.
 */
function bilingualLabel(label: LocaleString): string {
  if (typeof label === 'string') return label
  const ka = label.ka
  const en = label.en
  if (ka && en) return ka === en ? ka : `${ka} · ${en}`
  return ka ?? en ?? Object.values(label)[0] ?? ''
}

export type CommandKind = 'insert' | 'navigate' | 'action'

export interface Command {
  /** Stable id — `insert:<type>`, `navigate:<nodeId>`, `action:<name>`. */
  id:       string
  kind:     CommandKind
  /** Display label shown in the palette row. */
  label:    string
  /** Extra searchable keywords (cmdk matches against these too). */
  keywords: string[]
  /** Section heading the command groups under. */
  group:    string
  /** For insert commands — the node type to insert (OCP payload). */
  nodeType?: string
  /** For navigate commands — the target node id. */
  nodeId?:   string
  /** For action commands — the action name (delete / duplicate / open-data-model). */
  action?:   'delete' | 'duplicate' | 'open-data-model'
}

/**
 * Workspace commands — jump straight to a Studio workspace from anywhere. Today the
 * one entry is "Data model": the documented-but-unbuilt ⌘K seam (useRole.ts) that
 * lands the user directly in metric authoring (sets the Steward lens + opens the
 * Model surface in one step — the SAME composed action the top-bar switch fires).
 * Always available (no selection needed), bilingual + rich keywords so a
 * non-programmer finds it by intent ("metric", "define") not the internal concept.
 */
export function workspaceCommands(): Command[] {
  return [{
    id:       'action:open-data-model',
    kind:     'action' as const,
    label:    'მონაცემთა მოდელი · Data model',
    keywords: ['data model', 'metric', 'metrics', 'define', 'catalog', 'author', 'steward', 'model', 'მეტრიკა', 'მოდელი', 'კატალოგი'],
    group:    'გადასვლა · Go to',
    action:   'open-data-model',
  }]
}

/** Insert commands — one per registered, droppable node type (registry-driven). */
export function insertCommands(): Command[] {
  return getPaletteEntries().map((entry) => ({
    id:       `insert:${entry.type}`,
    kind:     'insert' as const,
    label:    bilingualLabel(entry.label),
    keywords: [entry.type, entry.category ?? '', ...entry.caps],
    group:    'ჩასმა · Insert',
    nodeType: entry.type,
  }))
}

/** Navigate commands — one per node in the active page (jump selection to it). */
export function navigateCommands(page: CanvasPage | null): Command[] {
  if (!page) return []
  return Object.values(page.nodes).map((node) => {
    const title = node.props.title ?? node.props.label ?? node.props.heading
    const label = typeof title === 'string' ? title : node.type
    return {
      id:       `navigate:${node.id}`,
      kind:     'navigate' as const,
      label,
      keywords: [node.type, node.id],
      group:    'გადასვლა · Go to',
      nodeId:   node.id,
    }
  })
}

/** Action commands — operate on the current selection (delete / duplicate). */
export function actionCommands(selectedId: string | null): Command[] {
  if (!selectedId) return []
  return [
    { id: 'action:duplicate', kind: 'action', label: 'დუბლირება · Duplicate', keywords: ['copy', 'duplicate'], group: 'მოქმედება · Action', action: 'duplicate' },
    { id: 'action:delete',    kind: 'action', label: 'წაშლა · Delete',        keywords: ['remove', 'delete'],   group: 'მოქმედება · Action', action: 'delete' },
  ]
}

/**
 * The full command list for the current context. INSERT commands lead (the
 * primary Cmd-K job), then navigate, then selection actions. `slashMode` (the "/"
 * quick-insert) restricts the list to INSERT only — the Notion/Gutenberg slash
 * filters the type registry, nothing else.
 */
export function buildCommands(
  page: CanvasPage | null,
  selectedId: string | null,
  slashMode = false,
): Command[] {
  if (slashMode) return insertCommands()
  return [...insertCommands(), ...workspaceCommands(), ...navigateCommands(page), ...actionCommands(selectedId)]
}
