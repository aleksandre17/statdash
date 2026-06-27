// @vitest-environment node
//
// ── buildStaticContext.test.ts — factory for StaticRenderContext ──────────────
//
//  Tests that buildStaticContext fills sensible defaults and that caller-supplied
//  overrides always win. Tests are intentionally isolated from renderPageToHTML
//  so the factory invariants can be validated without React / SSR.
//

import { describe, it, expect, vi } from 'vitest'

// i18next is an optional peer — mock before any imports to avoid resolution error
vi.mock('i18next', () => ({
  default: { use: () => ({}) },
  t: (k: string) => k,
}))
import { buildStaticContext }   from './html'
import type { StaticRenderContext } from './html'

// Minimal valid input — only the two required fields. No perspectiveState: the
// factory seeds it from the active perspective default ('year').
const MINIMAL_INPUT = {
  sectionCtx: { dims: { time: 2024 } },
  stores:     {},
}

// ── Structural shape ──────────────────────────────────────────────────────────

describe('buildStaticContext() — shape', () => {

  it('returns an object satisfying StaticRenderContext', () => {
    const ctx = buildStaticContext(MINIMAL_INPUT)

    expect(ctx).toHaveProperty('sectionCtx')
    expect(ctx).toHaveProperty('stores')
    expect(ctx).toHaveProperty('filterParams')
    expect(ctx).toHaveProperty('vars')
    expect(ctx).toHaveProperty('color')
    expect(ctx).toHaveProperty('locale')
    expect(ctx).toHaveProperty('fallbackLocale')
    expect(ctx).toHaveProperty('perspectiveKey')
    expect(ctx).toHaveProperty('perspective')
    expect(ctx).toHaveProperty('effects')
  })

  it('passes sectionCtx dims through + seeds the perspectiveState SSOT', () => {
    // VISION #3 — buildStaticContext seeds ctx.perspectiveState from the active id
    // (perspective.current) keyed by perspectiveKey, so the SSR walkers + the visibility
    // gate read the SAME source the live DOM reads. The caller's object is NOT mutated
    // (immutable augmentation — a shallow clone with the SSOT added).
    const ctx = buildStaticContext(MINIMAL_INPUT)
    expect(ctx.sectionCtx.dims).toBe(MINIMAL_INPUT.sectionCtx.dims)
    expect(ctx.sectionCtx.perspectiveState).toEqual({ mode: 'year' })
    // caller's object untouched (no perspectiveState leaked back onto the input)
    expect('perspectiveState' in MINIMAL_INPUT.sectionCtx).toBe(false)
  })

  it('preserves a caller-supplied perspectiveState (does not overwrite the SSOT)', () => {
    const input = {
      sectionCtx: { dims: { time: 2024 }, perspectiveState: { perspective: 'range' } },
      stores:     {},
    }
    const ctx = buildStaticContext(input)
    expect(ctx.sectionCtx).toBe(input.sectionCtx)           // already seeded ⇒ passthrough
    expect(ctx.sectionCtx.perspectiveState).toEqual({ perspective: 'range' })
  })

  it('passes stores through unchanged', () => {
    const ctx = buildStaticContext(MINIMAL_INPUT)
    expect(ctx.stores).toBe(MINIMAL_INPUT.stores)
  })

})

// ── Defaults ──────────────────────────────────────────────────────────────────

describe('buildStaticContext() — defaults (minimal input)', () => {

  it('filterParams defaults to empty object', () => {
    expect(buildStaticContext(MINIMAL_INPUT).filterParams).toEqual({})
  })

  it('vars defaults to empty object', () => {
    expect(buildStaticContext(MINIMAL_INPUT).vars).toEqual({})
  })

  it('color has no default (engine is app-agnostic — Law 3)', () => {
    // engine/react supplies no brand colour; a shell applies its own fallback.
    expect(buildStaticContext(MINIMAL_INPUT).color).toBeUndefined()
  })

  it('locale defaults to "en"', () => {
    expect(buildStaticContext(MINIMAL_INPUT).locale).toBe('en')
  })

  it('fallbackLocale defaults to "en"', () => {
    expect(buildStaticContext(MINIMAL_INPUT).fallbackLocale).toBe('en')
  })

  it('perspectiveKey defaults to "mode"', () => {
    expect(buildStaticContext(MINIMAL_INPUT).perspectiveKey).toBe('mode')
  })

  it('effects defaults to empty array', () => {
    expect(buildStaticContext(MINIMAL_INPUT).effects).toEqual([])
  })

  it('pageStoreKey defaults to undefined', () => {
    expect(buildStaticContext(MINIMAL_INPUT).pageStoreKey).toBeUndefined()
  })

  it('crumbs defaults to undefined', () => {
    expect(buildStaticContext(MINIMAL_INPUT).crumbs).toBeUndefined()
  })

  it('navContext defaults to undefined', () => {
    expect(buildStaticContext(MINIMAL_INPUT).navContext).toBeUndefined()
  })

})

// ── mode default ──────────────────────────────────────────────────────────────

describe('buildStaticContext() — perspective default', () => {

  it('perspective.current mirrors the seeded perspectiveState id', () => {
    const ctx = buildStaticContext({
      sectionCtx: { dims: {}, perspectiveState: { mode: 'range' } },
      stores:     {},
    })
    expect(ctx.perspective.current).toBe('range')
  })

  it('perspective.current falls back to "year" when no perspectiveState is seeded', () => {
    const ctx = buildStaticContext({
      sectionCtx: { dims: {} } as StaticRenderContext['sectionCtx'],
      stores:     {},
    })
    expect(ctx.perspective.current).toBe('year')
  })

  it('perspective.available defaults to empty array', () => {
    const ctx = buildStaticContext(MINIMAL_INPUT)
    expect(ctx.perspective.available).toEqual([])
  })

  it('perspective.set is a no-op function', () => {
    const ctx = buildStaticContext(MINIMAL_INPUT)
    expect(typeof ctx.perspective.set).toBe('function')
    expect(() => ctx.perspective.set('year')).not.toThrow()
  })

})

// ── Overrides always win ──────────────────────────────────────────────────────

describe('buildStaticContext() — caller overrides', () => {

  it('overrides locale', () => {
    const ctx = buildStaticContext({ ...MINIMAL_INPUT, locale: 'fr' })
    expect(ctx.locale).toBe('fr')
  })

  it('overrides fallbackLocale', () => {
    const ctx = buildStaticContext({ ...MINIMAL_INPUT, fallbackLocale: 'de' })
    expect(ctx.fallbackLocale).toBe('de')
  })

  it('overrides perspectiveKey', () => {
    const ctx = buildStaticContext({ ...MINIMAL_INPUT, perspectiveKey: 'view' })
    expect(ctx.perspectiveKey).toBe('view')
  })

  it('overrides color', () => {
    const ctx = buildStaticContext({ ...MINIMAL_INPUT, color: '#FF0000' })
    expect(ctx.color).toBe('#FF0000')
  })

  it('overrides filterParams', () => {
    const params = { time: '2023', region: 'GE-TB' }
    const ctx    = buildStaticContext({ ...MINIMAL_INPUT, filterParams: params })
    expect(ctx.filterParams).toBe(params)
  })

  it('overrides vars', () => {
    const vars = { threshold: 100 }
    const ctx  = buildStaticContext({ ...MINIMAL_INPUT, vars })
    expect(ctx.vars).toBe(vars)
  })

  it('overrides effects', () => {
    const effects = [{ type: 'sync-filters' as const, params: {} }]
    // @ts-expect-error — Effect shape is engine-internal; cast is safe for the override test
    const ctx = buildStaticContext({ ...MINIMAL_INPUT, effects })
    expect(ctx.effects).toBe(effects)
  })

  it('overrides perspective entirely', () => {
    const customPerspective = {
      current:   'compare',
      available: [{ id: 'compare', label: 'Compare' }],
      set:       () => {},
    }
    const ctx = buildStaticContext({ ...MINIMAL_INPUT, perspective: customPerspective })
    expect(ctx.perspective).toBe(customPerspective)
    expect(ctx.perspective.current).toBe('compare')
  })

  it('overrides pageStoreKey', () => {
    const ctx = buildStaticContext({ ...MINIMAL_INPUT, pageStoreKey: 'ds_main' })
    expect(ctx.pageStoreKey).toBe('ds_main')
  })

  it('overrides crumbs', () => {
    const crumbs = [{ label: 'Home', href: '/' }, { label: 'Economy' }]
    const ctx    = buildStaticContext({ ...MINIMAL_INPUT, crumbs })
    expect(ctx.crumbs).toBe(crumbs)
  })

  it('overrides navContext', () => {
    const navContext = {
      sections:    [{ id: 's1', label: 'Section 1', anchor: '#s1', depth: 0 }],
      perspectiveKey: 'mode',
    }
    // @ts-expect-error — NavSection shape; cast safe for override test
    const ctx = buildStaticContext({ ...MINIMAL_INPUT, navContext })
    expect(ctx.navContext).toBe(navContext)
  })

})

// ── Isolation — each call is independent ─────────────────────────────────────

describe('buildStaticContext() — isolation', () => {

  it('two calls with the same input return different object references', () => {
    const a = buildStaticContext(MINIMAL_INPUT)
    const b = buildStaticContext(MINIMAL_INPUT)
    expect(a).not.toBe(b)
  })

  it('mutating the returned filterParams does not affect a second call', () => {
    const first  = buildStaticContext(MINIMAL_INPUT)
    ;(first.filterParams as Record<string, unknown>)['x'] = 1
    const second = buildStaticContext(MINIMAL_INPUT)
    expect(second.filterParams).toEqual({})
  })

})
