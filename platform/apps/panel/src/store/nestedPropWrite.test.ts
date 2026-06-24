// ── nestedPropWrite.test — nested/dotted prop writes through the store ────────
//
//  SLICE A invariants, proven against the REAL store (not the pure helper):
//    1. A dotted-path edit (the Inspector's onChange path → setAtPath →
//       updateNode) writes the correct nested location and ONLY that location.
//    2. Immutability holds: untouched sibling branches stay referentially equal,
//       so Zustand change-detection + the command-pattern undo/redo are correct.
//    3. Undo of a nested edit restores the prior props EXACTLY; redo re-applies.
//    4. The chrome write path (updateChromeConfig) writes nested paths too.
//
//  This is the wiring proof for PageStep.patchProp (same setAtPath(props,…)
//  shape) and for constructor.chrome.updateChromeConfigPatch.
//
import { describe, it, expect, beforeEach } from 'vitest'
import { useConstructorStore } from './constructor.store'
import { setAtPath } from '../inspector/showWhen'
import { INITIAL_SESSION } from './constructor.history'
import type { CanvasPage } from '../types/constructor'

const seedPage = (): CanvasPage => ({
  id: 'p1', title: { ka: 'p', en: 'p' }, slug: 'p',
  nodeIds: ['n1'],
  nodes: {
    n1: {
      id: 'n1', type: 'chart', props: {
        title: 't',
        view:  { width: 'full', height: 240 },
      }, childIds: [],
    },
  },
})

beforeEach(() => {
  useConstructorStore.setState({
    ...INITIAL_SESSION,
    pages: [seedPage()],
    activePageId: 'p1',
    undoStack: [], redoStack: [], canUndo: false, canRedo: false,
  })
})

const propsOf = () => useConstructorStore.getState().pages[0].nodes.n1.props as Record<string, unknown>

describe('nested prop write — patchProp wiring (setAtPath → updateNode)', () => {
  it('writes a dotted path to the correct nested location and ONLY that path', () => {
    const { updateNode } = useConstructorStore.getState()
    const before = propsOf()
    updateNode('p1', 'n1', { props: setAtPath(before, 'view.width', 'half') })

    const after = propsOf()
    expect((after.view as Record<string, unknown>).width).toBe('half')
    expect((after.view as Record<string, unknown>).height).toBe(240)  // sibling key kept
    expect(after.title).toBe('t')                                     // sibling branch kept
  })

  it('keeps untouched branches referentially equal (immutability)', () => {
    const { updateNode } = useConstructorStore.getState()
    const before = propsOf()
    const beforeTitleRef = before.title
    updateNode('p1', 'n1', { props: setAtPath(before, 'view.width', 'half') })

    const after = propsOf()
    expect(after).not.toBe(before)
    expect(after.view).not.toBe(before.view)          // touched branch cloned
    expect(after.title).toBe(beforeTitleRef)          // untouched branch shared
  })

  it('undo restores the prior nested props EXACTLY; redo re-applies', () => {
    const store = useConstructorStore.getState
    const before = { ...propsOf(), view: { ...(propsOf().view as object) } }

    store().updateNode('p1', 'n1', { props: setAtPath(propsOf(), 'view.width', 'half') })
    expect((propsOf().view as Record<string, unknown>).width).toBe('half')

    store().undo()
    expect(propsOf()).toEqual(before)                 // restored exactly

    store().redo()
    expect((propsOf().view as Record<string, unknown>).width).toBe('half')
  })

  it('a top-level edit still works exactly as before (no regression)', () => {
    const { updateNode } = useConstructorStore.getState()
    updateNode('p1', 'n1', { props: setAtPath(propsOf(), 'title', 'new') })
    expect(propsOf().title).toBe('new')
    expect(propsOf().view).toEqual({ width: 'full', height: 240 })
  })
})

describe('nested chrome config write — updateChromeConfig wiring', () => {
  it('writes a dotted chrome field to the nested config location', () => {
    const { updateChromeConfig } = useConstructorStore.getState()
    updateChromeConfig('header', 'brand.title', 'Stat')
    const config = useConstructorStore.getState().site.chrome.header?.config as Record<string, unknown>
    expect((config.brand as Record<string, unknown>).title).toBe('Stat')
  })

  it('preserves a sibling nested chrome field across two dotted edits', () => {
    const { updateChromeConfig } = useConstructorStore.getState()
    updateChromeConfig('header', 'brand.title', 'Stat')
    updateChromeConfig('header', 'brand.logo', 'logo.svg')
    const config = useConstructorStore.getState().site.chrome.header?.config as Record<string, unknown>
    expect(config.brand).toEqual({ title: 'Stat', logo: 'logo.svg' })
  })
})
