// ── ChromeInspectorPanel — Phase C: chrome authored via the GENERIC Inspector ─
//
//  Proves the "one Inspector, all slice kinds" requirement: a CHROME element is
//  authored through the SAME schema-driven Inspector that renders node schemas,
//  with the schema resolved from chromeRegistry.getMeta(slot,key).schema and
//  edits written to the slot's per-element config (site.chrome[slot].config).
//
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { useConstructorStore, selectedNodeIdOf, chromeSelectionOf } from '../store/constructor.store'
import { ChromeInspectorPanel } from './ChromeInspectorPanel'
import { chromeSchemaSource } from './schemaSource'
import type { CanvasNode } from '../types/constructor'

beforeAll(() => { setupCanvasRegistry() })
afterEach(cleanup)

const store = () => useConstructorStore.getState()

beforeEach(() => {
  useConstructorStore.setState({
    selection: null,
    site: { ...store().site, chrome: {} },
    undoStack: [], redoStack: [], canUndo: false, canRedo: false,
  })
})

describe('chromeSchemaSource — resolves the per-element chrome schema', () => {
  it('returns the InnerSidebar schema (the per-element seam, not a shared base)', () => {
    const node: CanvasNode = { id: 'c', type: 'InnerSidebar', variant: 'default', props: {}, childIds: [] }
    const schema = chromeSchemaSource.getSchema(node)
    expect(schema.map((f) => f.field)).toContain('brandTitle')
    expect(schema.map((f) => f.field)).toContain('sectionsLabel')
  })

  it('returns [] for an unknown chrome element (inspectable, never crashes)', () => {
    const node: CanvasNode = { id: 'c', type: 'NopeSlot', variant: 'default', props: {}, childIds: [] }
    expect(chromeSchemaSource.getSchema(node)).toEqual([])
  })
})

describe('ChromeInspectorPanel — generic Inspector reuse for chrome', () => {
  it('renders the chrome schema through the generic Inspector on chrome selection', () => {
    store().selectChrome({ kind: 'chrome', slot: 'InnerSidebar', key: 'default' })
    render(<ChromeInspectorPanel />)
    // Same Inspector body (data-testid="inspector") — no chrome-specific UI.
    expect(screen.getByTestId('inspector')).toBeInTheDocument()
    // The InnerSidebar's own LocaleString field renders (label in ka).
    expect(screen.getByText('ბრენდის სათაური')).toBeInTheDocument()
  })

  it('writes edits to the slot per-element config (site.chrome[slot].config)', () => {
    store().selectChrome({ kind: 'chrome', slot: 'InnerSidebar', key: 'default' })
    render(<ChromeInspectorPanel />)
    // brandTitle is coverage:'localized' → LocaleField renders one input per locale.
    const group  = screen.getAllByRole('group', { name: /brandTitle \(localized\)/i })[0]
    const inputs = group.querySelectorAll('input[type="text"]')
    expect(inputs.length).toBe(2)
    fireEvent.change(inputs[0], { target: { value: 'GeoStat' } })

    const cfg = store().site.chrome['InnerSidebar']?.config as Record<string, unknown> | undefined
    expect(cfg?.brandTitle).toMatchObject({ ka: expect.any(String), en: expect.any(String) })
  })

  it('renders nothing when no chrome element is selected', () => {
    store().selectChrome(null)
    const { container } = render(<ChromeInspectorPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('selecting chrome clears node selection (mutual exclusivity)', () => {
    store().selectNode('some-node')
    store().selectChrome({ kind: 'chrome', slot: 'InnerSidebar', key: 'default' })
    expect(selectedNodeIdOf(store().selection)).toBeNull()
    expect(chromeSelectionOf(store().selection)).toMatchObject({ slot: 'InnerSidebar', key: 'default' })
  })
})
