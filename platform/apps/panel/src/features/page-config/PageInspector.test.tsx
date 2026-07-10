// ── Page Inspector — schema-driven PAGE-ROOT authoring + round-trip [V3] ───────
//
//  Proves the ADR mechanism for page-level config: the page root's PageConfigBase
//  (presentation · frame · perspectives · vars) is authored through the SAME generic
//  Inspector (pageSchemaSource — presentation via presentationPropSchema), the
//  edits land in page.meta, and the page round-trips losslessly through
//  canvasPageAdapter. No bespoke page form, no second engine.
//
import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { registerPresentationProjector } from '@statdash/react/engine'
import { colorProjector, crumbsProjector } from '@statdash/plugins/presentation'
import { pageSchema, pageGroups, pageSchemaSource } from './pageSchemaSource'
import { PageInspectorPanel } from './PageInspectorPanel'
import { useConstructorStore } from '../../store/constructor.store'
import { toNodePageConfig, fromNodePageConfig } from '../../canvas/canvasPageAdapter'
import type { CanvasPage } from '../../types/constructor'

// presentationPropSchema() reads the live registry — boot the shipped projectors
// (color, crumbs) so the page schema includes their fields, exactly as the panel
// does at app boot (setupCanvasRegistry → registerPresentationProjectors).
beforeAll(() => {
  registerPresentationProjector(colorProjector)
  registerPresentationProjector(crumbsProjector)
})

function seedPage(meta?: CanvasPage['meta']): CanvasPage {
  const page: CanvasPage = {
    id: 'p1', type: 'inner-page', title: { ka: 'გვ', en: 'Pg' }, slug: 'pg', nodeIds: [], nodes: {},
    ...(meta ? { meta } : {}),
  }
  useConstructorStore.setState({ pages: [page], activePageId: 'p1' })
  return page
}

describe('pageSchemaSource — schema reflects the registered projectors', () => {
  it('projects presentationPropSchema() into prefixed presentation.* fields', () => {
    const schema = pageSchema()
    const fields = schema.map((f) => f.field)
    // frame (static select) + the projected presentation fields + vars.
    expect(fields).toContain('frame')
    expect(fields).toContain('presentation.color')   // colorProjector → presentation.color
    expect(fields).toContain('presentation.crumbs')  // crumbsProjector → presentation.crumbs
    expect(fields).toContain('vars')
    // `perspectives` is NO LONGER a raw page-root field — the dedicated PerspectivesPane
    // (P-final) authors the PerspectiveAxis; it still round-trips through page.meta.
    expect(fields).not.toContain('perspectives')
    // No page-root `type` field — the kind is fixed by the adapter (see source note).
    expect(fields).not.toContain('type')
  })

  it('groups the presentation fields under a Presentation accordion', () => {
    const groups = pageGroups()
    const presentation = groups.find((g) => (g.label as { en: string }).en === 'Presentation')
    expect(presentation?.fields).toContain('presentation.color')
  })

  it('the source ignores element identity (the page is always the same kind)', () => {
    const a = pageSchemaSource.getSchema({ id: 'x', type: 'inner-page', props: {}, childIds: [] })
    const b = pageSchemaSource.getSchema({ id: 'y', type: 'tab-page', props: {}, childIds: [] })
    expect(a.map((f) => f.field)).toEqual(b.map((f) => f.field))
  })
})

describe('PageInspectorPanel — authors page config through the generic Inspector', () => {
  it('renders the page schema through the Inspector (no dead panel)', () => {
    seedPage()
    render(<PageInspectorPanel />)
    expect(screen.getByTestId('page-inspector')).toBeInTheDocument()
    expect(screen.getByTestId('inspector')).toBeInTheDocument()
    // frame is a static-option select; presentation.color is a color control.
    expect(document.getElementById('insp-frame')).not.toBeNull()
    expect(document.getElementById('insp-presentation-color')).not.toBeNull()
    expect(screen.queryByText(/No property schema/i)).toBeNull()
  })

  it('authoring frame writes into page.meta.frame', () => {
    seedPage()
    render(<PageInspectorPanel />)
    const select = document.getElementById('insp-frame') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'landing' } })
    const page = useConstructorStore.getState().pages[0]
    expect(page.meta?.frame).toBe('landing')
  })

  it('authoring presentation.color writes the NESTED meta path (not a flat key)', () => {
    seedPage()
    render(<PageInspectorPanel />)
    const color = document.getElementById('insp-presentation-color') as HTMLInputElement
    fireEvent.change(color, { target: { value: '#123456' } })
    const page = useConstructorStore.getState().pages[0]
    expect(page.meta?.presentation).toEqual({ color: '#123456' })
    // It did NOT leak to a flat `color` on meta.
    expect((page.meta as Record<string, unknown>).color).toBeUndefined()
  })

  it('round-trips authored page config losslessly through canvasPageAdapter', () => {
    seedPage({
      frame: 'minimal',
      presentation: { color: '#abcdef' },
      perspectives: { mode: { perspectives: [
        { id: 'year',  label: { ka: 'წ', en: 'Y' } },
        { id: 'range', label: { ka: 'დ', en: 'R' } },
      ] } },
      vars: { y: { op: 'lookup', key: 'time', map: { '2023': 'Y' } } },
    })
    const page = useConstructorStore.getState().pages[0]
    const restored = fromNodePageConfig(toNodePageConfig(page), page.title)
    expect(restored).toEqual(page)
    expect(restored.meta?.frame).toBe('minimal')
    expect(restored.meta?.presentation).toEqual({ color: '#abcdef' })
    expect(restored.meta?.perspectives).toBeDefined()
  })
})
