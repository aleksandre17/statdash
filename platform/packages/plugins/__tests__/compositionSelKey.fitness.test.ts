// @vitest-environment node
//
// ── FF-COMPOSITION-SELKEY — the composition table's cross-filter key rotates ────
//
//  The composition (id `sectors`) table pivots when a region is selected (State B):
//  rows become SECTORS and regions move to the series/column axis. Its row:click
//  handler therefore writes `key:{$ctx:_selKey}` — a state-bound ref — instead of a
//  literal `region`. `_selKey` is a page var resolving to `region`, so the gesture
//  targets the `region` param in BOTH the SimpleTable (State A) and the PivotTable
//  (State B) orientations. This gate locks that wiring against the real provisioning,
//  and resolves the ref through the SAME dims→vars path the runtime write point uses.
//

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve as resolvePath } from 'node:path'
import { describe, it, expect } from 'vitest'
import { resolveRef } from '@statdash/engine'

/* eslint-disable @typescript-eslint/no-explicit-any */
const here     = dirname(fileURLToPath(import.meta.url))
const provPath = resolvePath(here, '../../../apps/api/provisioning/geostat.provisioning.json')
const prov: any = JSON.parse(readFileSync(provPath, 'utf8'))

const regional: any = prov.pages.find((p: any) => p.config?.vars?._xDim && p.config?.vars?._seriesDim)

// Recursively collect every node carrying a `{$ctx:_selKey}` cross-filter key.
function collectSelKeyHandlers(node: any, out: any[] = []): any[] {
  if (node && typeof node === 'object') {
    for (const h of node.on ?? []) {
      for (const a of h.actions ?? []) {
        if (a?.key && typeof a.key === 'object' && a.key.$ctx === '_selKey') out.push({ node, action: a })
      }
    }
    for (const child of node.children ?? []) collectSelKeyHandlers(child, out)
  }
  return out
}

describe('FF-COMPOSITION-SELKEY — provisioning wiring', () => {
  it('the page carries a `_selKey` var resolving to the region param', () => {
    expect(regional.config.vars._selKey).toBe('region')
  })

  it('exactly the composition table declares the state-bound `{$ctx:_selKey}` key', () => {
    const found = collectSelKeyHandlers(regional.config)
    expect(found).toHaveLength(1)
    const { node, action } = found[0]
    expect(node.type).toBe('table')
    // fromField stays `id` — enc.id='geo', so the emitted row's id is the region code
    // in both states (SimpleTable row + PivotTable series-representative row).
    expect(action.fromField).toBe('id')
    expect(action.mode).toBe('toggle')
  })

  it('the `{$ctx:_selKey}` key resolves to `region` through the one ref dispatcher', () => {
    const services = { dims: {}, vars: regional.config.vars }
    const key = resolveRef({ $ctx: '_selKey' }, services)
      ?? resolveRef({ $ref: '_selKey' }, services)
    expect(key).toBe('region')
  })
})
