// ── R4 fitness nets — one ref taxonomy, one resolution path ──────────────────
//
//  Locks the ADR R4 invariants (adr_data_reference_render_vision, fault line F-B):
//
//    FF-REF-RESOLVES         — each taxonomy scope prefix resolves to its
//                              documented home (ctx→dims, param→params, row→row,
//                              var→vars, dim→classifier/display view).
//    FF-ONE-RESOLUTION-PATH  — every core consumer that interprets a `$`-ref
//                              routes through the ONE resolveRef dispatcher; no
//                              parallel evaluator re-implements ref routing.
//    Migration round-trip     — the DataLink `$ctx`→`$param` collision fix is
//                              byte-identical for configs without the collision,
//                              precise for those with it, and idempotent.
//
//  @vitest-environment node

import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join, sep }                  from 'path'
import { describe, it, expect }                from 'vitest'

import { resolveRef, refScope, isRef, REF_SCOPES } from './ref'
import type { Classifier, DisplayMap }             from '../sdmx'
import { migratePageConfig, CURRENT_SCHEMA_VERSION } from '../config/migration'

// ── FF-REF-RESOLVES — each scope resolves to its documented home ─────────────

describe('FF-REF-RESOLVES — every scope prefix resolves to its documented home', () => {
  const classifiers: Record<string, Classifier> = {
    geo: [
      { code: 'GE',    parent: undefined },
      { code: 'GE-TB', parent: 'GE' },
    ],
  }
  const display: Record<string, DisplayMap> = {
    geo: { 'GE': { label: 'Georgia' }, 'GE-TB': { label: 'Tbilisi' } },
  }

  it('ctx scope → SectionContext.dims[key]', () => {
    expect(resolveRef({ $ctx: 'time' }, { dims: { time: 2023 } })).toBe(2023)
    expect(resolveRef({ $ctx: 'missing' }, { dims: { time: 2023 } })).toBeUndefined()
  })

  it('param scope → filter params[key] (the de-collided DataLink token)', () => {
    expect(resolveRef({ $param: 'region' }, { params: { region: 'GE-TB' } })).toBe('GE-TB')
  })

  it('row scope → clicked row[field]', () => {
    expect(resolveRef({ $row: 'id' }, { row: { id: 'GE-TB', value: 1 } })).toBe('GE-TB')
  })

  it('var scope → page var[key]', () => {
    expect(resolveRef({ $ref: 'mode' }, { vars: { mode: 'multi' } })).toBe('multi')
  })

  it('dim scope ($cl) → classifier view (structural)', () => {
    const out = resolveRef({ $cl: 'geo', view: 'items' }, { classifiers, display })
    expect(Array.isArray(out)).toBe(true)
    expect((out as Array<{ code: string }>).map((e) => e.code).sort()).toEqual(['GE', 'GE-TB'])
  })

  it('dim scope ($d) → display view (UI, code injected)', () => {
    const out = resolveRef({ $d: 'geo', view: 'byCode' }, { classifiers, display })
    expect((out as Record<string, { label: string }>)['GE'].label).toBe('Georgia')
  })

  it('scopes are exactly the documented taxonomy and never collide', () => {
    expect([...REF_SCOPES].sort()).toEqual(['ctx', 'dim', 'param', 'row', 'var'])
    // $ctx is ctx scope EVERYWHERE — never param (the collision is gone).
    expect(refScope({ $ctx: 'x' })).toBe('ctx')
    expect(refScope({ $param: 'x' })).toBe('param')
    expect(refScope({ $row: 'x' })).toBe('row')
    expect(refScope({ $ref: 'x' })).toBe('var')
    expect(refScope({ $cl: 'x' })).toBe('dim')
    expect(refScope({ $d: 'x' })).toBe('dim')
    expect(refScope('literal')).toBeNull()
    expect(isRef({ $ctx: 'x' })).toBe(true)
    expect(isRef(42)).toBe(false)
  })
})

// ── FF-ONE-RESOLUTION-PATH — no parallel `$`-ref evaluator survives ──────────
//
//  Source-level invariant: the modules that consume `$`-refs must route through
//  resolveRef (../ref). They may still import the dim-scope leaves (resolveDimRef
//  etc.) only via resolveRef itself. We assert: (1) the consuming modules import
//  resolveRef, and (2) no consumer outside ref.ts reads a `$`-ref directly off a
//  scope object (e.g. `ctx.dims[<expr>.$ctx]` / `resolveDimRef(` ).

describe('FF-ONE-RESOLUTION-PATH — refs route through the one dispatcher', () => {
  const SRC = resolve(__dirname, '..')

  const CONSUMERS = [
    'links/resolver.ts',
    'data/store-filter.ts',
    'registry/resolvers.ts',
    'config/filter-derive.ts',
    'data/resolve.ts',
    'data/transform/steps.ts',
  ]

  it('every `$`-ref consumer imports resolveRef from the ref module', () => {
    for (const rel of CONSUMERS) {
      const src = readFileSync(join(SRC, rel), 'utf8')
      expect(src, `${rel} must route through resolveRef`).toMatch(/resolveRef/)
    }
  })

  it('no core module outside ref.ts calls resolveDimRef directly (it is the dim-scope leaf of resolveRef)', () => {
    // Walk the whole core src tree; the only non-test files allowed to name
    // resolveDimRef as a CALL are ref.ts (the dispatcher) and codelist.ts (its home).
    const ALLOWED = new Set(['ref/ref.ts', 'data/codelist.ts'])
    const offenders: string[] = []

    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name)
        if (statSync(full).isDirectory()) { walk(full); continue }
        if (!name.endsWith('.ts')) continue
        if (name.includes('.test.')) continue
        const rel = full.slice(SRC.length + 1).split(sep).join('/')
        if (ALLOWED.has(rel)) continue
        const src = readFileSync(full, 'utf8')
        // A CALL is `resolveDimRef(` — a bare import/mention in a comment is fine.
        if (/resolveDimRef\s*\(/.test(src)) offenders.push(rel)
      }
    }
    walk(SRC)
    expect(offenders, `these modules bypass resolveRef for dim refs: ${offenders.join(', ')}`).toEqual([])
  })
})

// ── Migration round-trip — DataLink `$ctx` → `$param` (the collision fix) ─────

describe('v4 → v5 — DataLink param $ctx renamed to $param (collision fix)', () => {
  it('rewrites a DataLink param $ctx → $param, leaving ObsQuery/var $ctx untouched', () => {
    const v4 = {
      id: 'p', type: 'inner-page', schemaVersion: 4,
      vars: { mode: { op: 'if', cond: { left: { $ctx: 'region' }, op: 'includes', right: ',' }, then: 'multi', else: 'single' } },
      children: [
        {
          type: 'chart', id: 'c1',
          data: { type: 'query', query: { measure: 'B1G', filter: { time: { $ctx: 'time' } } } },
          dataLinks: [
            {
              target: 'page', page: '/regional', title: { en: 'Drill' },
              params: { region: { $row: 'id' }, time: { $ctx: 'time' } },
            },
          ],
        },
      ],
    }
    const out = migratePageConfig(v4) as Record<string, unknown>
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)

    const node  = (out.children as Array<Record<string, unknown>>)[0]
    const link  = (node.dataLinks as Array<Record<string, unknown>>)[0]
    const params = link.params as Record<string, unknown>
    // The DataLink filter-param $ctx is now $param; $row is untouched.
    expect(params.time).toEqual({ $param: 'time' })
    expect(params.region).toEqual({ $row: 'id' })

    // The ObsQuery filter $ctx is LEFT untouched (it means ctx.dims, not param).
    const q = (node.data as { query: { filter: Record<string, unknown> } }).query
    expect(q.filter.time).toEqual({ $ctx: 'time' })
    // The page var $ctx is LEFT untouched.
    const cond = (out.vars as { mode: { cond: { left: unknown } } }).mode.cond
    expect(cond.left).toEqual({ $ctx: 'region' })
  })

  it('is byte-identical (modulo version stamp) for a config with NO DataLink $ctx', () => {
    const v4 = {
      id: 'p', type: 'inner-page', schemaVersion: 4,
      children: [
        {
          type: 'chart', id: 'c1',
          data: { type: 'query', query: { measure: 'B1G', filter: { time: { $ctx: 'time' } } } },
          dataLinks: [{ target: 'page', page: '/r', title: { en: 'x' }, params: { region: { $row: 'id' } } }],
        },
      ],
    }
    const out = migratePageConfig(v4)
    expect(out).toEqual({ ...v4, schemaVersion: CURRENT_SCHEMA_VERSION })
  })

  it('is idempotent — re-migrating a v5 config is a no-op', () => {
    const v4 = {
      id: 'p', type: 'inner-page', schemaVersion: 4,
      children: [{ type: 'chart', id: 'c1', dataLinks: [{ target: 'page', page: '/r', title: { en: 'x' }, params: { t: { $ctx: 'time' } } }] }],
    }
    const once  = migratePageConfig(v4)
    const twice = migratePageConfig(once)
    expect(twice).toEqual(once)
    // And the only param ref is now $param, no $ctx left in the link.
    const link = ((once.children as Array<Record<string, unknown>>)[0].dataLinks as Array<Record<string, unknown>>)[0]
    expect((link.params as Record<string, unknown>).t).toEqual({ $param: 'time' })
  })

  it('does not mutate the v4 input tree', () => {
    const v4 = {
      id: 'p', type: 'inner-page', schemaVersion: 4,
      children: [{ type: 'chart', id: 'c1', dataLinks: [{ target: 'page', page: '/r', title: { en: 'x' }, params: { t: { $ctx: 'time' } } }] }],
    }
    const snapshot = JSON.parse(JSON.stringify(v4))
    migratePageConfig(v4)
    expect(v4).toEqual(snapshot)
  })
})
