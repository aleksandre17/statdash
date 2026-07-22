// ── FF-NO-DATA-COURIER — the Sources → workbench teleport is dead (ADR-051 DU2) ──
//
//  The invariant, encoded as a red-on-regression gate (ADR-051 §Consequences):
//    "`store/sourcesHandoff.ts` is deleted; no role-flip + nav teleport bridges
//     Sources → workbench."
//
//  DU2 removes the one-shot courier store and the cross-SURFACE navigation that welded
//  the (formerly separate) Sources screen to the (formerly separate) Model-page workbench.
//  Now that DU1 made Sources and the workbench floors of ONE Data workspace, "browse this
//  cube" is an IN-WORKSPACE selection: the Sources floor switches to the Model floor of the
//  SAME `/studio/data` surface with the picked cube riding the URL (`studioDataWorkbench
//  Path`); the workbench seeds its `source` step from that seed on arrival. This gate locks
//  the deletion so the archipelago's teleport cannot silently reopen.
//
//  ── Scoped note on the LENS (flagged to the owner, ADR-051 DU2) ────────────────
//  The browse gesture STILL selects the steward lens: shaping a raw cube is a steward
//  activity by the platform's own law (FF-AUTHOR-NO-QUERY — "the author never picks a raw
//  cube"), and the workbench mounts ONLY behind the steward lens. Landing in the steward
//  shaping view is therefore the correct, explicit outcome of "browse in workbench" — NOT
//  the courier's silent cross-screen escalation. This gate targets the COURIER (the store +
//  the cross-SURFACE `setSurface` teleport), which is fully gone; it does not forbid the
//  in-workspace lens selection the destination legitimately requires.
//
import { describe, it, expect } from 'vitest'

// Strip comments before scanning — the gate tests CODE references (imports/calls), never
// prose. A doc-comment may legitimately NAME the retired symbol (e.g. the ADR-051 DU2
// rationale in useStudioRoute); a real `import … from '…/sourcesHandoff'` is code and
// survives stripping, so a genuine regression is still caught. (House fitness pattern.)
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')      // block comments
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')   // line comments (the [^:] guard spares `://` in URLs)
}

// Every app source as raw text (Vite ?raw, browser-graph typed), comment-stripped — the
// static proof the courier module is gone and no file imports it. `.ts`/`.tsx` only.
const APP_SRC: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
  ).map(([p, src]) => [p, stripComments(src)]),
)

// The one workspace's Sources floor + the workbench host, isolated for targeted assertions.
// DU6-IA-1: the workbench + its URL cube-seed consumer live on the Specs floor (SpecsBody),
// extracted from the retired DataModelingPanel.
const SOURCES_BODY = Object.entries(APP_SRC).find(([p]) => p.endsWith('/sources/SourcesBody.tsx'))?.[1] ?? ''
const SPECS_BODY = Object.entries(APP_SRC).find(([p]) => p.endsWith('/specs/SpecsBody.tsx'))?.[1] ?? ''

describe('FF-NO-DATA-COURIER — the courier store + cross-surface teleport are deleted', () => {
  it('the courier module `store/sourcesHandoff.ts` no longer exists', () => {
    const courierFiles = Object.keys(APP_SRC).filter((p) => p.endsWith('/store/sourcesHandoff.ts') || p.endsWith('sourcesHandoff.ts'))
    expect(courierFiles).toHaveLength(0)
  })

  it('NO app source imports or references the courier (`sourcesHandoff` / `useSourcesHandoff`)', () => {
    const offenders = Object.entries(APP_SRC)
      // Exclude THIS gate itself — it names the retired symbols on purpose (the scan pattern).
      .filter(([p]) => !p.endsWith('/noCourier.fitness.test.tsx'))
      .filter(([, src]) => /sourcesHandoff|useSourcesHandoff|browseCube|takePendingCube/.test(src))
      .map(([p]) => p)
    expect(offenders).toEqual([])
  })

  it('the Sources floor performs NO cross-surface teleport (no `setSurface` / `useSetSurface`)', () => {
    expect(SOURCES_BODY.length).toBeGreaterThan(0)
    // The former teleport (`setSurface('model')`) is gone — the floor switch is in-workspace.
    expect(/useSetSurface|setSurface\s*\(/.test(SOURCES_BODY)).toBe(false)
    expect(/sourcesHandoff/.test(SOURCES_BODY)).toBe(false)
  })

  it('the Sources floor browses a cube via the IN-WORKSPACE seed path (studioDataWorkbenchPath)', () => {
    // Positive proof of the replacement: same `/studio/data` surface, cube on the URL.
    expect(/studioDataWorkbenchPath/.test(SOURCES_BODY)).toBe(true)
    expect(/useNavigate/.test(SOURCES_BODY)).toBe(true)
  })

  it('the workbench host (Specs floor) reads its cube seed off the workspace URL, not a courier store', () => {
    expect(SPECS_BODY.length).toBeGreaterThan(0)
    expect(/useSearchParams/.test(SPECS_BODY)).toBe(true)
    expect(/CUBE_SEED_PARAM/.test(SPECS_BODY)).toBe(true)
    expect(/sourcesHandoff/.test(SPECS_BODY)).toBe(false)
  })
})
