// ── FF-ROLE-IS-LENS — role is a LENS, not RBAC (AR-49 M2.0) ────────────────────
//
//  The invariant (SPEC-authoring-reconception-M2 §2, §12), encoded as a
//  red-on-regression gate:
//
//   (1) The role value is read ONLY through `useRole()`. Its SOURCE (the persisted
//       preference store `useRoleStore` / the localStorage key `statdash.role`) is
//       an implementation detail of useRole.ts — no other Studio file may reach past
//       the seam to the source. This is what makes the source swappable to an auth
//       claim later without touching a single consumer.
//   (2) No Studio UI file gates its rendering on an auth/tenant/user PRIMITIVE
//       (a JWT claim, an auth token, a tenant id). The data-model content split gates
//       on the LENS value (`role === 'steward'`), never on authorization — because the
//       lens is not an enforcement boundary yet ("lens now, RBAC later").
//   (3) The role lens splits CONTENT, not VISIBILITY (AR-50 M5b). The rail is a flat,
//       always-visible list — no entry is role-gated, so the data-model destination is
//       reachable in ANY lens; the lens only chooses that destination's BODY
//       (DataModelBody: author→dictionary, steward→modeler). "Built ≠ buried."
//
import { describe, it, expect } from 'vitest'
import { RAIL_ENTRIES } from './rail'
import { FOCUS_VIEW_TARGETS } from './focusViewRegistry'

// All Studio sources as raw text (Vite ?raw) — browser-graph typed (the panel
// tsconfig excludes @types/node), no filesystem dependency.
const ALL_SOURCES = import.meta.glob(['./**/*.ts', './**/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

// The UI/consumer sources: everything under studio EXCEPT the seam module itself
// (useRole.ts — the one legitimate owner of the source) and test files.
const CONSUMER_SOURCES = Object.entries(ALL_SOURCES).filter(
  ([path]) =>
    !path.includes('/useRole.ts') &&
    !path.includes('.test.') &&
    !path.includes('.fitness.'),
)

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

describe('FF-ROLE-IS-LENS — role read only through the useRole() seam', () => {
  it('scans the Studio consumer sources (guard is actually running)', () => {
    expect(CONSUMER_SOURCES.length).toBeGreaterThan(5)
  })

  it('no consumer reaches past the seam to the role SOURCE (useRoleStore / statdash.role)', () => {
    const offenders = CONSUMER_SOURCES.filter(([, src]) => {
      const clean = stripComments(src)
      return /\buseRoleStore\b/.test(clean) || /statdash\.role/.test(clean)
    }).map(([path]) => path)
    expect(offenders).toEqual([])
  })

  it('no consumer gates UI on an auth/tenant/user primitive (lens, not RBAC)', () => {
    // A JWT/auth/tenant primitive used to DECIDE UI is the RBAC smell the lens
    // must not grow in M2. (`logout` on the top bar is a session action, not a
    // gate — these tokens are the read-side authorization primitives specifically.)
    const AUTH_PRIMITIVE = /\bgetToken\b|\bisAuthenticated\b|\bjwt\b|\bclaim\b|\btenant\b/i
    const offenders = CONSUMER_SOURCES.filter(([, src]) =>
      AUTH_PRIMITIVE.test(stripComments(src)),
    ).map(([path]) => path)
    expect(offenders).toEqual([])
  })

  it('the role lens splits CONTENT, not VISIBILITY — no destination is role-gated', () => {
    // No RailEntry carries a role/visibility gate (the `stewardOnly` field is gone):
    // every navigation destination is always visible regardless of the lens.
    for (const entry of RAIL_ENTRIES) {
      expect(entry).not.toHaveProperty('stewardOnly')
    }
    // SPEC S5: the Data-model destination was DEMOTED off the rail to a top-bar-summoned
    // project workspace — a registered focus-view target, reachable in ANY lens (the top
    // bar summons it unconditionally; the lens only splits its BODY, asserted below).
    // "Built ≠ buried" now holds via the workspace, not a rail entry.
    expect(Object.keys(FOCUS_VIEW_TARGETS)).toContain('data-model')
  })

  it('the data-model destination splits its BODY by the lens value (content, not access)', () => {
    // The one predicate that projects the data-model destination — steward→modeler,
    // author→dictionary — gates on the LENS value, read through the useRole() seam
    // (DataModelBody is scanned as a consumer above: no source reach / auth primitive).
    // Assert the split predicate lives in DataModelBody (the registry's role-split body).
    const body = ALL_SOURCES['./DataModelBody.tsx']
    expect(body).toBeDefined()
    const clean = stripComments(body)
    expect(/role\s*===\s*'steward'/.test(clean)).toBe(true)
    expect(/\bDataDictionarySurface\b/.test(clean)).toBe(true)
  })

  it('the guard actually bites — a planted source reach + auth gate are detected', () => {
    expect(/\buseRoleStore\b/.test(stripComments('const r = useRoleStore.getState()'))).toBe(true)
    expect(/\bgetToken\b/.test(stripComments('if (getToken()) show()'))).toBe(true)
  })
})
