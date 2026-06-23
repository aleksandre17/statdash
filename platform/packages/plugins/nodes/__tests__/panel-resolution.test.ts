// @vitest-environment node
//
// ── panel-resolution.test.ts — text/gauge resolve through the registry ────────
//
//  Companion to panel-registration.fitness.test.ts. The fitness proves the
//  barrels EXPORT every on-disk panel; this proves the META the barrels carry is
//  registration-shaped and that nodeRegistry.get(type) actually RESOLVES it.
//
//  Together they close the 2nd-tenant capstone gap end to end:
//    barrel export (fitness)  →  registerSlice() shape (here)  →  get() resolves.
//
//  Registers via NodeRegistry.register directly (the same call registerSlice
//  makes for sliceType 'panel') against META imported from the pure meta.ts
//  files — avoids the @statdash/react/engine barrel + i18next + Shell deps that
//  are unresolvable in the node test environment (see NodeRegistry.caps.test.ts).
//

import { describe, it, expect, beforeAll } from 'vitest'
import { NodeRegistry } from '@statdash/react/engine/NodeRegistry'
import type { NodeBase, RenderContext, ChildrenArg } from '@statdash/react/engine/types'

import { META as textMeta }  from '../../panels/text/default/meta'
import { META as gaugeMeta } from '../../panels/gauge/default/meta'

const stubShell = (_def: NodeBase, _ctx: RenderContext, _children: ChildrenArg) => null

function makeRegistry(): NodeRegistry {
  const reg = new NodeRegistry()
  for (const m of [textMeta, gaugeMeta]) {
    reg.register(m.type, m.variant ?? 'default', stubShell, {
      label:    m.label,
      icon:     m.icon,
      category: m.category,
      schema:   m.schema,
      caps:     'caps' in m ? m.caps : undefined,
      version:  m.version,
    })
  }
  return reg
}

let reg: NodeRegistry
beforeAll(() => { reg = makeRegistry() })

describe('panel resolution — text', () => {
  it('META is panel-shaped (sliceType "panel", type "text")', () => {
    expect(textMeta.sliceType).toBe('panel')
    expect(textMeta.type).toBe('text')
  })

  it('nodeRegistry.get("text") resolves to a renderer', () => {
    expect(reg.get('text')).toBeDefined()
    expect(reg.has('text')).toBe(true)
  })
})

describe('panel resolution — gauge', () => {
  it('META is panel-shaped (sliceType "panel", type "gauge")', () => {
    expect(gaugeMeta.sliceType).toBe('panel')
    expect(gaugeMeta.type).toBe('gauge')
  })

  it('nodeRegistry.get("gauge") resolves to a renderer', () => {
    expect(reg.get('gauge')).toBeDefined()
    expect(reg.has('gauge')).toBe(true)
  })
})
