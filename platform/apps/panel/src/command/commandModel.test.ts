// ── commandModel.test — registry-driven commands, OCP (V6) ────────────────────
import { describe, it, expect, beforeAll } from 'vitest'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { getPaletteEntries } from '../canvas/paletteEntries'
import {
  insertCommands, navigateCommands, actionCommands, workspaceCommands, buildCommands,
} from './commandModel'
import type { CanvasPage } from '../types/constructor'

beforeAll(() => { setupCanvasRegistry() })

const page: CanvasPage = {
  id: 'p1', title: { ka: 'გ', en: 'P' }, slug: 'p',
  nodeIds: ['a'],
  nodes: { a: { id: 'a', type: 'section', props: { title: 'Sec' }, childIds: [] } },
}

describe('insertCommands (OCP — derived from the registry, not a hardcoded list)', () => {
  it('emits exactly one insert command per droppable registered type', () => {
    const cmds = insertCommands()
    const types = getPaletteEntries().map((e) => e.type)
    expect(cmds.map((c) => c.nodeType).sort()).toEqual([...types].sort())
    expect(cmds.every((c) => c.kind === 'insert')).toBe(true)
  })

  it('excludes rootOnly page templates (same source as the palette)', () => {
    const types = insertCommands().map((c) => c.nodeType)
    expect(types).not.toContain('inner-page')
    expect(types).not.toContain('tab-page')
  })
})

describe('navigateCommands / actionCommands', () => {
  it('emits one navigate command per page node', () => {
    const cmds = navigateCommands(page)
    expect(cmds).toHaveLength(1)
    expect(cmds[0].nodeId).toBe('a')
    expect(cmds[0].label).toBe('Sec')   // title-ish label
  })

  it('emits delete + duplicate only when a node is selected', () => {
    expect(actionCommands(null)).toHaveLength(0)
    const cmds = actionCommands('a')
    expect(cmds.map((c) => c.action)).toEqual(['duplicate', 'delete'])
  })
})

describe('workspaceCommands — the ⌘K jump to metric authoring (documented useRole seam)', () => {
  it('exposes an always-available "Data model" command that opens the workspace', () => {
    const cmds = workspaceCommands()
    const dm = cmds.find((c) => c.action === 'open-data-model')
    expect(dm).toBeDefined()
    expect(dm!.kind).toBe('action')
    // Found by INTENT, not the internal concept — search hits "metric"/"define".
    expect(dm!.keywords).toEqual(expect.arrayContaining(['metric', 'define']))
  })
})

describe('buildCommands slash mode', () => {
  it('full mode includes insert + navigate + actions + the workspace jump', () => {
    const cmds = buildCommands(page, 'a', false)
    expect(cmds.some((c) => c.kind === 'insert')).toBe(true)
    expect(cmds.some((c) => c.kind === 'navigate')).toBe(true)
    expect(cmds.some((c) => c.kind === 'action')).toBe(true)
    // The ⌘K "Data model" jump is offered in the full palette (not slash-insert).
    expect(cmds.some((c) => c.action === 'open-data-model')).toBe(true)
  })

  it('slash mode narrows to INSERT only (Notion/Gutenberg quick-insert)', () => {
    const cmds = buildCommands(page, 'a', true)
    expect(cmds.length).toBeGreaterThan(0)
    expect(cmds.every((c) => c.kind === 'insert')).toBe(true)
    // The workspace jump is NOT a slash-insert command.
    expect(cmds.some((c) => c.action === 'open-data-model')).toBe(false)
  })
})
