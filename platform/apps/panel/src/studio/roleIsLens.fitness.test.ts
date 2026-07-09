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
//       (a JWT claim, an auth token, a tenant id). The Model surface gates on the
//       LENS value (`role === 'steward'`), never on authorization — because the lens
//       is not an enforcement boundary yet ("lens now, RBAC later").
//   (3) Exactly one rail entry is `stewardOnly` (the Model slot) — the single
//       role-gated surface.
//
import { describe, it, expect } from 'vitest'
import { RAIL_ENTRIES } from './rail'

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

  it('exactly one rail entry is role-gated (the Model slot) — the single steward surface', () => {
    const gated = RAIL_ENTRIES.filter((e) => e.stewardOnly)
    expect(gated).toHaveLength(1)
    expect(gated[0].id).toBe('model')
  })

  it('the guard actually bites — a planted source reach + auth gate are detected', () => {
    expect(/\buseRoleStore\b/.test(stripComments('const r = useRoleStore.getState()'))).toBe(true)
    expect(/\bgetToken\b/.test(stripComments('if (getToken()) show()'))).toBe(true)
  })
})
