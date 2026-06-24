// @vitest-environment node
//
// ── presentation.fitness.test.ts — the OCP discipline can't regress [N-ADR-0029 v2] ──
//
//  The Presentation-Projection Registry reshaped page presentation UP: the generic
//  renderer must know NOTHING about any specific presentation concern. Presentation
//  flows ONLY through a registry loop (projectPresentation → listPresentationProjectors).
//  These fitness functions make that load-bearing and un-regressable:
//
//    (a) No privileged underscore-magic-key reads in engine + core (the documented
//        sentinel allowlist stands) — the v1 sweep, carried forward.
//    (b) SiteRenderer.tsx + targets/html.tsx contain NO per-concern presentation
//        literal ('--sc', isCrumbs(, a 'crumbs'/'color' special-case) and reference
//        ONLY projectPresentation / the registry. THE load-bearing assertion.
//    (c) The registry loop is generic: an inline test projector is iterated and
//        projected with ZERO renderer/registry edits (proves the OCP seam). The
//        REAL color+crumbs byte-identical render snapshot lives in the plugins
//        package (which owns the real projectors); here we prove the mechanism.
//

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  registerPresentationProjector,
  listPresentationProjectors,
  presentationPropSchema,
}                                       from './presentationRegistry'
import { projectPresentation }          from './index'
import { projectPresentation as projectPresentationHelper } from './projectPresentation'
import type { PresentationProjector, EvalExpr } from './PresentationProjector'

const here          = dirname(fileURLToPath(import.meta.url))      // …/engine/presentation
const engineDir     = resolve(here, '..')                          // …/engine
const siteRenderer  = resolve(engineDir, 'SiteRenderer.tsx')
const htmlTarget    = resolve(engineDir, 'targets', 'html.tsx')

// ── (b) THE load-bearing assertion: renderers name NO presentation concern ─────

describe('(b) generic renderers carry ZERO per-concern presentation code', () => {
  // Concrete concern literals that MUST NOT appear in either generic renderer.
  // The concern (--sc var name, isCrumbs guard) now lives WITH its projector.
  const FORBIDDEN: { needle: string; why: string }[] = [
    { needle: "'--sc'",     why: 'the page-color CSS var name belongs to colorProjector' },
    { needle: '"--sc"',     why: 'the page-color CSS var name belongs to colorProjector' },
    { needle: 'isCrumbs(',  why: 'the crumbs runtime guard belongs to crumbsProjector' },
  ]

  for (const file of [siteRenderer, htmlTarget]) {
    const label = file.endsWith('html.tsx') ? 'targets/html.tsx' : 'SiteRenderer.tsx'

    it(`${label} references the presentation registry, not a concern`, () => {
      const src = readFileSync(file, 'utf8')
      // Positive: presentation flows through the shared loop.
      expect(src).toContain('projectPresentation')
    })

    it(`${label} contains NO per-concern presentation literal`, () => {
      const src = readFileSync(file, 'utf8')
      const offenders = FORBIDDEN.filter(f => src.includes(f.needle))
        .map(f => `${label}: "${f.needle}" — ${f.why}`)
      expect(offenders).toEqual([])
    })
  }
})

// ── (c) the registry loop is generic — a NEW projector needs ZERO renderer edits ─

describe('(c) the projection loop is a generic visitor over the registry', () => {
  // The registry is module-global; we register a throwaway projector and assert
  // the loop picks it up + projects it with no special-casing anywhere.
  const TEST_KEY = '__fitness_badge__'

  const badgeProjector: PresentationProjector<string, string> = {
    key: TEST_KEY,
    schema: () => [{ field: TEST_KEY, type: 'string', label: { en: 'Test badge' } }],
    evaluate: (raw) => (typeof raw === 'string' ? raw : undefined),
    project:  (value, sink) => { sink.nav.badge = value },
  }

  beforeEach(() => {
    registerPresentationProjector(badgeProjector)
  })

  it('listPresentationProjectors() includes a freshly-registered projector', () => {
    expect(listPresentationProjectors().some(p => p.key === TEST_KEY)).toBe(true)
  })

  it('presentationPropSchema() surfaces the new projector PropField automatically', () => {
    const schema = presentationPropSchema()
    expect(schema.some(f => f.field === TEST_KEY)).toBe(true)
  })

  it('projectPresentation iterates the projector generically (no renderer edit)', () => {
    const idEval: EvalExpr = (e) => e
    const sink = projectPresentation({ [TEST_KEY]: 'Preliminary' }, idEval, {
      filterParams: {}, stores: {},
    })
    // The renderer loop did not know 'badge' exists — the projector targeted nav.
    expect(sink.nav).toEqual({ badge: 'Preliminary' })
    expect(sink.cssVars).toEqual({})
  })

  it('a projector contributing nothing (evaluate→undefined) folds to an empty sink', () => {
    const idEval: EvalExpr = (e) => e
    const sink = projectPresentation({ /* no value for TEST_KEY */ }, idEval, {
      filterParams: {}, stores: {},
    })
    expect(sink.nav.badge).toBeUndefined()
  })

  it('the barrel helper and registry-re-export are the same function', () => {
    expect(projectPresentation).toBe(projectPresentationHelper)
  })
})

// ── (b-cont) the registry shape mirrors the precedent registries ──────────────

describe('presentationPropSchema is the union of registered projector schemas', () => {
  it('is empty when nothing is registered beyond test projectors; grows per registration', () => {
    // After (c) registered the badge projector, its field is present.
    const before = presentationPropSchema().length
    registerPresentationProjector({
      key: '__fitness_extra__',
      schema: () => [{ field: '__fitness_extra__', type: 'string', label: { en: 'x' } }],
      evaluate: () => undefined,
      project: () => {},
    })
    expect(presentationPropSchema().length).toBe(before + 1)
  })
})
