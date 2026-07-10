// ── Methodology fieldset — authorable node-level data integrity [V3] ──────────
//
//  Closes the Law-9 coverage gap: the methodology disclosure (note · source ·
//  last-updated) the section shell already RENDERS, and the `preliminary` flag the
//  PreliminaryBadge already reads, were UN-AUTHORABLE in the Constructor. This
//  proves they are now part of the relevant nodes' PropSchema (so the generic
//  Inspector authors them), they round-trip losslessly, and an authored
//  `preliminary` reaches a node def in the exact shape resolvePreliminary reads
//  (signal #1) — i.e. authoring drives the badge.
//
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { nodeRegistry } from '@statdash/react/engine'
import { setupCanvasRegistry } from '../canvas/setupCanvasRegistry'
import { toNodePageConfig, fromNodePageConfig } from '../canvas/canvasPageAdapter'
import { Inspector } from './Inspector'
import { setAtPath } from './showWhen'
import type { CanvasNode, CanvasPage } from '../types/constructor'

beforeAll(() => { setupCanvasRegistry() })

// Render the Inspector over a node and capture each onChange field/value write.
function authorNode(node: CanvasNode) {
  const onChange = vi.fn<(field: string, value: unknown) => void>()
  const utils = render(<Inspector node={node} onChange={onChange} />)
  return { onChange, ...utils }
}

describe('methodology fieldset — section node carries authorable methodology fields', () => {
  it('section PropSchema declares note / source / last-updated', () => {
    const fields = (nodeRegistry.getSchema('section') ?? []).map((f) => f.field)
    expect(fields).toContain('methodology.note')
    expect(fields).toContain('methodology.source')
    expect(fields).toContain('methodology.lastUpdated')
  })

  it('the Inspector renders the methodology controls (no dead panel)', () => {
    const node: CanvasNode = { id: 's1', type: 'section', props: { title: 'S' }, childIds: [] }
    authorNode(node)
    expect(document.getElementById('insp-methodology-note')).not.toBeNull()
    expect(document.getElementById('insp-methodology-source')).not.toBeNull()
    expect(document.getElementById('insp-methodology-lastUpdated')).not.toBeNull()
  })

  it('authoring writes the NESTED methodology.* path (the shape SectionShell reads)', () => {
    const node: CanvasNode = { id: 's1', type: 'section', props: { title: 'S' }, childIds: [] }
    const { onChange } = authorNode(node)
    fireEvent.change(document.getElementById('insp-methodology-source')!, {
      target: { value: 'GeoStat / National Accounts' },
    })
    const [field, value] = onChange.mock.calls.at(-1)!
    expect(field).toBe('methodology.source')
    // The panel's setAtPath turns that into a nested object on the node props.
    const next = setAtPath(node.props, field, value)
    expect(next).toMatchObject({ methodology: { source: 'GeoStat / National Accounts' } })
  })

  it('authored methodology round-trips losslessly through canvasPageAdapter', () => {
    const page: CanvasPage = {
      id: 'p', type: 'inner-page', title: { ka: 'გ', en: 'P' }, slug: 'p', nodeIds: ['s1'],
      nodes: {
        s1: {
          id: 's1', type: 'section',
          props: { title: 'S', methodology: { note: '{label} note', source: 'GeoStat', lastUpdated: '2024-03' } },
          childIds: [],
        },
      },
    }
    const restored = fromNodePageConfig(toNodePageConfig(page), page.title)
    expect(restored).toEqual(page)
    // And the methodology survives in the engine tree the shell consumes.
    const cfg = toNodePageConfig(page) as unknown as { children: Array<{ methodology?: unknown }> }
    expect(cfg.children[0].methodology).toEqual({ note: '{label} note', source: 'GeoStat', lastUpdated: '2024-03' })
  })
})

describe('preliminary flag — data panels author the badge driver (signal #1)', () => {
  it.each(['chart', 'table', 'gauge'])('%s PropSchema declares a boolean `preliminary` field', (type) => {
    const field = (nodeRegistry.getSchema(type) ?? []).find((f) => f.field === 'preliminary')
    expect(field, `${type} should author preliminary`).toBeTruthy()
    expect(field!.type).toBe('boolean')
  })

  it('authoring preliminary on a chart produces a def in the shape resolvePreliminary reads', () => {
    const node: CanvasNode = { id: 'c1', type: 'chart', props: { chartType: 'bar' }, childIds: [] }
    const { onChange } = authorNode(node)
    // boolean control → a checkbox with the deterministic id.
    const checkbox = document.getElementById('insp-preliminary') as HTMLInputElement
    expect(checkbox).not.toBeNull()
    fireEvent.click(checkbox)
    const [field, value] = onChange.mock.calls.at(-1)!
    expect(field).toBe('preliminary')
    expect(value).toBe(true)
    // The authored value lands on the node body that becomes the engine def —
    // exactly `def.preliminary === true`, resolvePreliminary's signal #1.
    const page: CanvasPage = {
      id: 'p', type: 'inner-page', title: { ka: 'გ', en: 'P' }, slug: 'p', nodeIds: ['c1'],
      nodes: { c1: { ...node, props: setAtPath(node.props, field, value) } },
    }
    const cfg = toNodePageConfig(page) as unknown as { children: Array<{ preliminary?: boolean }> }
    expect(cfg.children[0].preliminary).toBe(true)
  })
})
