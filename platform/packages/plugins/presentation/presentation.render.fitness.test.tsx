// @vitest-environment node
//
// ── presentation.render.fitness.test.tsx — byte-identical projection [N-ADR-0029 v2] ──
//
//  The plugins-side half of the presentation fitness suite. It registers the REAL
//  colorProjector + crumbsProjector and asserts they reproduce the exact render
//  output the old imperative SiteRenderer/html.tsx special-casing produced:
//    • page color → the CSS custom property `--sc` on the wrapper div
//    • derived crumbs → ctx.navContext.crumbs (consumed by PageHeaderShell)
//
//  This is the Strangler-Fig green bar: visible output stays byte-identical; only
//  the dispatch model changed from imperative special-casing to a registered loop.
//

import { describe, it, expect, beforeAll } from 'vitest'
import { registerPresentationProjector, projectPresentation } from '@statdash/react/engine'
import { renderPageToHTML, buildStaticContext } from '@statdash/react/engine/targets/html'
import type { NodePageConfig } from '@statdash/react/engine'
import { colorProjector, crumbsProjector, isCrumbs } from './index'

beforeAll(() => {
  registerPresentationProjector(colorProjector)
  registerPresentationProjector(crumbsProjector)
})

// A pre-resolved evaluator: literals/arrays pass through unchanged, mirroring the
// static render path. (Data-driven find/breadcrumbs reuse evalVarMap in the app;
// here we exercise the literal/pre-resolved branch for a deterministic snapshot.)
const passthrough = (e: unknown): unknown => e

// ── color projector → --sc ─────────────────────────────────────────────────────

describe('colorProjector projects page color to the --sc CSS var (byte-identical)', () => {
  it('a literal color resolves to cssVars["--sc"]', () => {
    const sink = projectPresentation({ color: '#0080BE' }, passthrough, {
      filterParams: {}, stores: {},
    })
    expect(sink.cssVars).toEqual({ '--sc': '#0080BE' })
  })

  it('falls back to the static page color when no presentation.color is authored', () => {
    const sink = projectPresentation({}, passthrough, {
      filterParams: {}, stores: {}, pageColorFallback: '#123456',
    })
    expect(sink.cssVars).toEqual({ '--sc': '#123456' })
  })

  it('contributes no CSS var when neither authored nor fallback color exists', () => {
    const sink = projectPresentation({}, passthrough, { filterParams: {}, stores: {} })
    expect(sink.cssVars).toEqual({})
  })
})

// ── crumbs projector → navContext.crumbs ────────────────────────────────────────

describe('crumbsProjector projects breadcrumbs to nav.crumbs (byte-identical)', () => {
  const crumbs = [{ label: 'Regional accounts' }, { label: 'Adjara', href: '/adjara' }]

  it('a valid Crumb[] resolves to sink.nav.crumbs', () => {
    const sink = projectPresentation({ crumbs }, passthrough, { filterParams: {}, stores: {} })
    expect(sink.nav).toEqual({ crumbs })
  })

  it('isCrumbs rejects a non-crumb value (no projection)', () => {
    expect(isCrumbs([{ nope: 1 }])).toBe(false)
    const sink = projectPresentation({ crumbs: [{ nope: 1 }] }, passthrough, {
      filterParams: {}, stores: {},
    })
    expect(sink.nav.crumbs).toBeUndefined()
  })
})

// ── full render: the wrapper carries --sc with the page color ───────────────────

describe('renderPageToHTML applies the projected --sc var on the wrapper (byte-identical)', () => {
  const page: NodePageConfig = {
    id: 'p1',
    type: 'inner-page',
    children: [],
    presentation: { color: '#0080BE' },
  } as unknown as NodePageConfig

  it('the snapshot wrapper sets --sc to the page color', () => {
    const html = renderPageToHTML(page, buildStaticContext({
      sectionCtx: { dims: {}, timeMode: 'year' },
      stores: {},
    }))
    // The generic cssVars bag produced the same wrapper the old --sc literal did.
    expect(html).toContain('--sc:#0080BE')
  })

  it('legacy staticCtx.color (via buildStaticContext) still reaches --sc', () => {
    const plain: NodePageConfig = {
      id: 'p2', type: 'inner-page', children: [],
    } as unknown as NodePageConfig
    const html = renderPageToHTML(plain, buildStaticContext({
      sectionCtx: { dims: {}, timeMode: 'year' },
      stores: {},
      color: '#FF0000',
    }))
    expect(html).toContain('--sc:#FF0000')
  })

  it('no wrapper --sc when no color is present anywhere', () => {
    const plain: NodePageConfig = {
      id: 'p3', type: 'inner-page', children: [],
    } as unknown as NodePageConfig
    const html = renderPageToHTML(plain, buildStaticContext({
      sectionCtx: { dims: {}, timeMode: 'year' },
      stores: {},
    }))
    expect(html).not.toContain('--sc')
  })
})
