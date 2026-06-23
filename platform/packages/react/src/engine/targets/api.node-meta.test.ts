// @vitest-environment node
//
// ── NodeDataEntry metadata tests — G3 (variant/title/specType) + G7 (exportFormats) ──
//
//  Concern: per-node metadata fields added to NodeDataEntry in N27 gap-fill.
//  Kept in a separate file from api.test.ts (core walk behaviour) to stay
//  within the 400-line ceiling per file.
//
//  G3 — variant, title (from view.title / view.subtitle / node.title), specType
//  G7 — exportFormats: present on ok frames, absent on empty/error frames
//

import { describe, it, expect }     from 'vitest'
import { renderPageToJSON }         from './api'
import type { StaticRenderContext } from './html'
import { staticStore }              from '@statdash/engine'
import type { NodePageConfig }      from '../types'

// ── Shared minimal context ─────────────────────────────────────────────────────

const staticCtx: StaticRenderContext = {
  sectionCtx: {
    dims:     { time: 2024 },
    timeMode: 'year' as const,
  },
  stores:         { main: staticStore },
  filterParams:   {},
  vars:           {},
  locale:         'en',
  fallbackLocale: 'en',
  timeModeKey:    'mode',
  mode: {
    current:   'year',
    available: [],
    set:       () => {},
  },
  effects: [],
}

function asPage(obj: object): NodePageConfig {
  return obj as unknown as NodePageConfig
}

// ── G3: variant, title, specType ──────────────────────────────────────────────

describe('G3 — NodeDataEntry node metadata', () => {

  it('data node has specType matching its DataSpec type', () => {
    const page = asPage({
      type:     'inner-page',
      children: [
        {
          type: 'section',
          data: { type: 'row-list', rows: [{ code: 'GDP' }] },
        },
      ],
    })
    const entry = renderPageToJSON(page, staticCtx).nodes[0].children[0]

    expect(entry.specType).toBe('row-list')
  })

  it('structural node (no data field) has specType undefined', () => {
    const page = asPage({
      type:     'inner-page',
      children: [{ type: 'section' }],
    })
    const entry = renderPageToJSON(page, staticCtx).nodes[0].children[0]

    expect(entry.specType).toBeUndefined()
  })

  it('node with view.title has title from view.title', () => {
    const page = asPage({
      type:     'inner-page',
      children: [
        { type: 'section', view: { title: 'My Section' } },
      ],
    })
    const entry = renderPageToJSON(page, staticCtx).nodes[0].children[0]

    expect(entry.title).toBe('My Section')
  })

  it('node with view.subtitle (no view.title) has title from view.subtitle', () => {
    const page = asPage({
      type:     'inner-page',
      children: [
        { type: 'section', view: { subtitle: 'Sub Heading' } },
      ],
    })
    const entry = renderPageToJSON(page, staticCtx).nodes[0].children[0]

    expect(entry.title).toBe('Sub Heading')
  })

  it('node with node.title (no view) has title from node.title', () => {
    const page = asPage({
      type:     'inner-page',
      children: [
        { type: 'section', title: 'Fallback Title' },
      ],
    })
    const entry = renderPageToJSON(page, staticCtx).nodes[0].children[0]

    expect(entry.title).toBe('Fallback Title')
  })

  it('view.title takes priority over node.title', () => {
    const page = asPage({
      type:     'inner-page',
      children: [
        { type: 'section', view: { title: 'View Title' }, title: 'Node Title' },
      ],
    })
    const entry = renderPageToJSON(page, staticCtx).nodes[0].children[0]

    expect(entry.title).toBe('View Title')
  })

  it('node with no title sources has title undefined', () => {
    const page = asPage({
      type:     'inner-page',
      children: [{ type: 'section' }],
    })
    const entry = renderPageToJSON(page, staticCtx).nodes[0].children[0]

    expect(entry.title).toBeUndefined()
  })

  it('node with variant string has variant populated', () => {
    const page = asPage({
      type:     'inner-page',
      children: [
        { type: 'section', variant: 'highlighted' },
      ],
    })
    const entry = renderPageToJSON(page, staticCtx).nodes[0].children[0]

    expect(entry.variant).toBe('highlighted')
  })

  it('node without variant has variant undefined', () => {
    const page = asPage({
      type:     'inner-page',
      children: [{ type: 'section' }],
    })
    const entry = renderPageToJSON(page, staticCtx).nodes[0].children[0]

    expect(entry.variant).toBeUndefined()
  })

})

// ── G7: exportFormats ─────────────────────────────────────────────────────────

describe('G7 — NodeDataEntry exportFormats', () => {

  it('data node with rows has exportFormats — non-empty array of objects with at least id', () => {
    // @statdash/engine re-exports ./data/export/index.ts which registers csv + sdmx-json
    // as a module-level side-effect, so formats are present on first import.
    const page = asPage({
      type:     'inner-page',
      children: [
        {
          type: 'section',
          data: { type: 'row-list', rows: [{ code: 'GDP' }] },
        },
      ],
    })
    const entry = renderPageToJSON(page, staticCtx).nodes[0].children[0]

    expect(entry.status).toBe('ok')
    expect(Array.isArray(entry.exportFormats)).toBe(true)
    expect(entry.exportFormats!.length).toBeGreaterThan(0)
    for (const fmt of entry.exportFormats!) {
      expect(typeof fmt.id).toBe('string')
    }
  })

  it('exportFormats includes built-in csv entry with label, mime and ext', () => {
    const page = asPage({
      type:     'inner-page',
      children: [
        {
          type: 'section',
          data: { type: 'row-list', rows: [{ code: 'GDP' }] },
        },
      ],
    })
    const entry  = renderPageToJSON(page, staticCtx).nodes[0].children[0]
    const csvFmt = entry.exportFormats?.find(f => f.id === 'csv')

    expect(csvFmt).toBeDefined()
    expect(csvFmt!.label).toBe('CSV')
    expect(csvFmt!.mime).toBe('text/csv')
    expect(csvFmt!.ext).toBe('csv')
  })

  it('exportFormats includes built-in sdmx-json entry', () => {
    const page = asPage({
      type:     'inner-page',
      children: [
        {
          type: 'section',
          data: { type: 'row-list', rows: [{ code: 'GDP' }] },
        },
      ],
    })
    const entry      = renderPageToJSON(page, staticCtx).nodes[0].children[0]
    const sdmxFmt    = entry.exportFormats?.find(f => f.id === 'sdmx-json')

    expect(sdmxFmt).toBeDefined()
    expect(sdmxFmt!.label).toBe('SDMX-JSON')
    expect(sdmxFmt!.mime).toBe('application/json')
    expect(sdmxFmt!.ext).toBe('json')
  })

  it('data node with no rows (status: empty) has no exportFormats', () => {
    // Unknown spec type → interpretSpec returns [] → status=empty → no exportFormats
    const page = asPage({
      type:     'inner-page',
      children: [
        {
          type: 'section',
          data: { type: 'UNKNOWN_SPEC_TYPE_XYZ' },
        },
      ],
    })
    const entry = renderPageToJSON(page, staticCtx).nodes[0].children[0]

    expect(entry.status).toBe('empty')
    expect(entry.exportFormats).toBeUndefined()
  })

  it('data node that errors has no exportFormats', () => {
    // rows: null → TypeError in RowListResolver → status=error → no exportFormats
    const page = asPage({
      type:     'inner-page',
      children: [
        {
          type: 'section',
          data: { type: 'row-list', rows: null } as unknown,
        },
      ],
    })
    const entry = renderPageToJSON(page, staticCtx).nodes[0].children[0]

    expect(entry.status).toBe('error')
    expect(entry.exportFormats).toBeUndefined()
  })

  it('structural node (no data) has no exportFormats', () => {
    const page = asPage({
      type:     'inner-page',
      children: [{ type: 'section' }],
    })
    const entry = renderPageToJSON(page, staticCtx).nodes[0].children[0]

    expect(entry.exportFormats).toBeUndefined()
  })

})
