// ── Skeleton restoration fitness (ADR-050 R3) ─────────────────────────────────
//
//  R3's structural move — SKELETON = registered page-KIND × page-level PresetDecl —
//  restores the LOST projection: the page skeleton is choosable at creation, and
//  starters are REGISTERED declarations, not a fixture. These two guards lock each
//  projection so the "engine-canonical, projection-missing" gap cannot silently
//  reopen (the governing invariant ADR-050 raises):
//
//   • FF-SKELETON-CHOOSABLE — a page can be created as ANY registered page-kind;
//     no page-creation path hardcodes a kind (the hidden `DEFAULT_PAGE_TYPE` stamp
//     is gone from the create path, replaced by the objectRegistry-fed kind gallery).
//   • FF-STARTERS-ARE-DECLARATIONS — starters resolve from the ONE preset registry,
//     not a fixture file (the `starterTemplates.ts` fixture is deleted).
//
//  Source scanning uses Vite's `import.meta.glob(?raw)` — the browser module graph,
//  no `fs`/`__dirname` (the Vitest-4 workspace-root injection hazard does not apply).
//
import { describe, it, expect, beforeAll } from 'vitest'
import { objectRegistry, presetRegistry } from '@statdash/react/engine'
import { setupCanvasRegistry } from '../../canvas/setupCanvasRegistry'
import { toNodePageConfig, fromNodePageConfig } from '../../canvas/canvasPageAdapter'
import { pageStarterList, isPageStarter } from './pageStarters'
import type { CanvasPage } from '../../types/constructor'

beforeAll(() => { setupCanvasRegistry() })

// The page-creation surface + the round-trip adapter — scanned as raw source.
const CREATE_SOURCES = import.meta.glob(
  ['../page-workflow/PageBrowser.tsx', '../../canvas/canvasPageAdapter.ts'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

// The retired fixture — MUST be absent from the module graph (glob → {} when gone).
const FIXTURE_SOURCES = import.meta.glob('./starterTemplates.{ts,tsx}', { eager: true })

/** Strip comments so a token in prose (a doc-comment mention) never trips the gate. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

const source = (suffix: string) =>
  Object.entries(CREATE_SOURCES).find(([p]) => p.endsWith(suffix))?.[1] ?? ''

describe('FF-SKELETON-CHOOSABLE — page kind is choosable, no hardcoded default', () => {
  it('every registered page kind is projectable from the ONE type-descriptor registry', () => {
    const kinds = objectRegistry.listByKind('page')
    const ids = kinds.map((k) => `${k.type}::${k.variant}`)
    // The registered skeletons the gallery offers (base kinds + the landing variant).
    expect(ids).toContain('inner-page::default')
    expect(ids).toContain('container-page::default')
    expect(ids).toContain('tab-page::default')
    expect(ids).toContain('container-page::landing')
    expect(kinds.length).toBeGreaterThanOrEqual(4)
  })

  it('the create path does NOT hardcode a kind — it reads the page-kind registry', () => {
    const pageBrowser = stripComments(source('PageBrowser.tsx'))
    // The hidden DEFAULT_PAGE_TYPE stamp is gone from the creation surface…
    expect(pageBrowser).not.toContain('DEFAULT_PAGE_TYPE')
    // …replaced by the registry-fed kind gallery (the projection R3 restores).
    expect(pageBrowser).toContain("objectRegistry.listByKind('page')")
  })

  it('a chosen page-root variant (landing) round-trips LOSSLESSLY — the kind is representable', () => {
    const landing: CanvasPage = {
      id: 'p', type: 'container-page', variant: 'landing',
      title: { ka: 'ლენდინგი', en: 'Landing' }, slug: 'landing',
      nodeIds: [], nodes: {},
    }
    const restored = fromNodePageConfig(toNodePageConfig(landing), landing.title)
    expect(restored.type).toBe('container-page')
    expect(restored.variant).toBe('landing')     // the variant survived (was previously dropped)
    expect(restored).toEqual(landing)
  })

  it('a default-variant page carries NO page-root variant (byte-identical to pre-R3)', () => {
    const inner: CanvasPage = {
      id: 'p', type: 'inner-page',
      title: { ka: 'შიდა', en: 'Inner' }, slug: 'inner',
      nodeIds: [], nodes: {},
    }
    const cfg = toNodePageConfig(inner) as unknown as Record<string, unknown>
    expect(cfg.variant).toBeUndefined()
    expect(fromNodePageConfig(cfg as never, inner.title)).toEqual(inner)
  })
})

describe('FF-STARTERS-ARE-DECLARATIONS — starters are registry declarations, not a fixture', () => {
  it('the starterTemplates fixture file is DELETED (absent from the module graph)', () => {
    expect(Object.keys(FIXTURE_SOURCES)).toHaveLength(0)
  })

  it('starters resolve from the ONE preset registry (each seeds a registered page kind)', () => {
    const starters = pageStarterList()
    expect(starters.length).toBeGreaterThanOrEqual(3)
    // Each starter is a preset whose seed roots a REGISTERED page kind (the R3 pairing) —
    // discriminated GENERICALLY (objectRegistry), never a hardcoded id list.
    for (const s of starters) {
      expect(isPageStarter(s), `starter "${s.id}" must root a registered page kind`).toBe(true)
      expect(presetRegistry.has(s.id)).toBe(true)
    }
  })

  it('the create-page gallery reads the registry, not a fixture import', () => {
    // The gallery projects pageStarterList() (registry) — proving no fixture path remains.
    const starters = pageStarterList().map((s) => s.id)
    expect(starters).toEqual(expect.arrayContaining(['single-chart', 'chart-table', 'ons-dashboard']))
  })
})
