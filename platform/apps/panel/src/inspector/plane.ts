// ── plane — the AUTHORING-PLANE lens (root Law 11 · ADR-043) ─────────────────────
//
//  "Projection with a plane": every declared field / facet carries its audience
//  (`author` | `steward` | `system`, engine-side `AudiencePlane`). This module is the
//  APP-tier projector that maps the active ROLE lens (useRole) to the SET of planes a
//  session sees, and filters a schema down to that set. The Inspector filters FIELDS
//  through it; the dock filters FACET sections through it — one grammar, two consumers.
//
//  The lens (author ⊆ steward):
//    • author  → { author }               — the non-programmer; plumbing is invisible.
//    • steward → { author, steward }       — additionally the advanced/governed controls.
//    • system  → in NO role's set          — projected to no one by default (Law 11);
//                reachable only under an explicit system lens (not the role lens).
//
//  This is the machine half of FF-NO-UNPROJECTED-DECLARED-FIELD: a `system` field can
//  never resolve into the author (or steward) projection. Pure + framework-free except
//  the one React hook at the bottom (the single reader for components).
//
import type { AudiencePlane, PropField, PropSchema } from '@statdash/react/engine'
import type { Role } from '../studio/useRole'
import { useRole } from '../studio/useRole'

const AUTHOR_PLANES:  ReadonlySet<AudiencePlane> = new Set<AudiencePlane>(['author'])
const STEWARD_PLANES: ReadonlySet<AudiencePlane> = new Set<AudiencePlane>(['author', 'steward'])

/**
 * The planes a role's lens projects. `author ⊆ steward`; `system` is in NO role's set
 * — projected to no one by default (root Law 11). Undefined role ⇒ the author lens
 * (the safe default: unknown audience sees only the non-plumbing plane).
 */
export function planesForRole(role: Role | undefined): ReadonlySet<AudiencePlane> {
  return role === 'steward' ? STEWARD_PLANES : AUTHOR_PLANES
}

/**
 * True when a field / facet of the given plane is visible under the lens. Absent plane
 * ⇒ `'author'` — unmigrated fields stay author-visible (additive, byte-identical).
 */
export function isPlaneVisible(
  plane: AudiencePlane | undefined,
  planes: ReadonlySet<AudiencePlane>,
): boolean {
  return planes.has(plane ?? 'author')
}

/**
 * Filter a schema to the fields visible under the lens — the field-level projection.
 * The ONE place a schema is narrowed by plane (the Inspector calls it), so no render
 * path can leak a non-visible field.
 */
export function filterSchemaByPlanes(
  schema: PropSchema,
  planes: ReadonlySet<AudiencePlane>,
): PropSchema {
  return schema.filter((f: PropField) => isPlaneVisible(f.plane, planes))
}

/**
 * The active lens's visible planes — THE reader for React consumers (the Inspector).
 * Reads the role lens through the swappable `useRole` seam, so a future auth-bound
 * role (AR-30) re-projects every plane filter with no consumer change.
 */
export function useVisiblePlanes(): ReadonlySet<AudiencePlane> {
  return planesForRole(useRole())
}
